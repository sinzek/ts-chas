import { ok, err, type Result } from '../result.js';
import { GlobalErrs, type InferErr } from '../tagged-errs.js';
import { deepEqual, safeStringify } from '../utils.js';

export type GuardErr = InferErr<typeof GlobalErrs.GuardErr>;

export type GuardMeta = {
	/**
	 * The schema name that this guard is part of (if any).
	 */
	schema?: string | undefined;
	/**
	 * The name of the guard (includes the entire chain).
	 */
	name: string;
	/**
	 * The error message for the guard (if supplied).
	 */
	error?: string | undefined;
	/**
	 * A unique identifier for a guard's top-level definition (e.g. `string`, `record`, `tuple`, etc.)
	 */
	id: string;
	/**
	 * The path to the guard in the schema. !!! TODO: Populate when parsing object guards, arrays, tuples, and schemas.
	 */
	path: string[];
	/**
	 * The shape of the guard (for objects).
	 */
	shape?: Record<string, any> | undefined;
	/**
	 * The values of the guard (for literals).
	 */
	values?: Set<any> | undefined;
	/**
	 * Optional transformation function that will be applied to the value
	 * before being passed to any subsequent helpers in the chain.
	 */
	transform?: (v: any, original: any) => any;
	[key: string]: any;
};

export type GuardType<T> = T extends (value: unknown) => value is infer U ? U : never;

type Brand<Tag extends string, Base> = Base & { readonly __brand: Tag };

// ---------------------------------------------------------------------------
// Guard type — every guard has universal methods + optional chainable helpers
// ---------------------------------------------------------------------------

export type Guard<T, H extends Record<string, any> = {}> = {
	(value: unknown): value is T;
	meta: GuardMeta;
	/**
	 * Adds a custom error message to the guard that will be used when parsing fails.
	 * @param msg The error message or a function that returns one.
	 * @returns A new guard with the error message.
	 */
	err: (msg: string | ((ctx: { meta: GuardMeta }) => string)) => Guard<T, H>;
	/**
	 * Adds a brand to the guard.
	 * @param tag The tag to add to the guard.
	 * @returns A new guard with the brand.
	 */
	brand: <Tag extends string>(tag: Tag) => Guard<Brand<Tag, T>, H>;
	/**
	 * Parses a value against the guard.
	 * @param value The value to parse.
	 * @param errMsg Optional error message or function that returns one.
	 * @returns A result containing the parsed value or an error.
	 */
	parse: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => Result<T, GuardErr>;
	/**
	 * Asserts that the value is valid according to the guard.
	 * @param value The value to assert.
	 * @param errMsg Optional error message or function that returns one.
	 * @throws {GuardErr} If the value is not valid.
	 * @returns The correctly typed value if valid.
	 */
	assert: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => T;
	/**
	 * Adds a custom predicate to the guard.
	 * @param predicate The predicate to add to the guard.
	 * @returns A new guard with the predicate.
	 */
	where: (predicate: (value: T) => boolean) => Guard<T, H>;
	/**
	 * Adds a value to the guard that must be equal to the value being tested.
	 * @param value The value to compare against.
	 * @returns A new guard that also checks for equality.
	 */
	eq: <U>(value: U) => Guard<T & U, H>;
	/**
	 * Inverts the guard and returns a new guard that passes when the original fails.
	 * Drops type-specific helpers since the result is `unknown`.
	 *
	 * `is.string.email.not(v)` = `!(isString(v) && isEmail(v))`
	 */
	not: Guard<unknown>;
	/**
	 * Combines this guard with another using AND — both must pass.
	 * Preserves this guard's helpers since the intersection refines the same base type.
	 *
	 * `is.object({ name: is.string }).and(is.object({ age: is.number }))` → `Guard<{ name: string } & { age: number }>`
	 */
	and: <U>(other: Guard<U, Record<string, any>>) => Guard<T & U, H>;
	/**
	 * Combines this guard with another using OR — either can pass.
	 * Drops type-specific helpers since the value could be either type.
	 *
	 * `is.string.or(is.number)` → `Guard<string | number>`
	 */
	or: <U>(other: Guard<U, Record<string, any>>) => Guard<T | U>;
	/**
	 * Wraps the guard to also accept `null`.
	 * Drops type-specific helpers since the value may be null.
	 *
	 * `is.string.email.nullable(v)` = `v === null || (isString(v) && isEmail(v))`
	 */
	nullable: Guard<T | null>;
	/**
	 * Wraps the guard to also accept `undefined`.
	 * Drops type-specific helpers since the value may be undefined.
	 *
	 * `is.string.email.optional(v)` = `v === undefined || (isString(v) && isEmail(v))`
	 */
	optional: Guard<T | undefined>;
	/**
	 * Wraps the guard to also accept `null` or `undefined`.
	 * Drops type-specific helpers since the value may be nullish.
	 *
	 * `is.string.email.nullish(v)` = `v == null || (isString(v) && isEmail(v))`
	 */
	nullish: Guard<T | null | undefined>;
} & H;

// ---------------------------------------------------------------------------
// Helper classification — distinguish value helpers from factory helpers
// ---------------------------------------------------------------------------

// A "value helper" is a guard function itself (checks a value directly).
// Example: `nonEmpty`, `email`, `positive`
//
// A "factory helper" is a function that takes arguments and RETURNS a guard.
// Example: `length(5, 10)`, `gt(5)`, `regex(/foo/)`
//
// We mark factory helpers with a flag so the proxy can tell them apart.

/**
 * Marks a helper as a factory (takes optional args, returns a guard).
 * Without this, the proxy assumes helpers are value guards.
 */
export const FACTORY = Symbol('factory');
/**
 * Marks a helper as a transformer (takes optional args, returns a function that modifies the guard).
 * This allows the helper to change the target function, metadata, type, and extend or replace the base guard's helpers.
 */
export const TRANSFORMER = Symbol('transformer');
/**
 * Marks a helper as a terminal (takes optional args, returns a value).
 * Without this, the proxy assumes helpers are value guards.
 */
export const TERMINAL = Symbol('terminal');
/**
 * Marks a helper as a property (does not take args, returns a guard).
 * Without this, the proxy assumes helpers are value guards.
 */
export const PROPERTY = Symbol('property');

/**
 * Marks a helper as a factory (takes args, returns a predicate).
 * Without this, the proxy assumes helpers are value guards.
 */
export function factory<Args extends any[], R extends (value: any) => boolean, H extends Record<string, any> = {}>(
	fn: (...args: Args) => R
): ((...args: Args) => Guard<any, H>) & { [FACTORY]: true } {
	return Object.assign(fn, { [FACTORY]: true as const }) as any;
}

export interface TransformerResult<T, H> {
	/**
	 * The predicate to apply to the value.
	 */
	fn: (v: unknown) => v is T;
	/**
	 * The metadata to apply to the guard. Merges with the existing metadata.
	 */
	meta: Partial<GuardMeta>;
	/**
	 * The helpers to apply to the guard. Merges with the existing helpers by default, but can be replaced by setting `replaceHelpers` to `true`.
	 */
	helpers?: H;
	/**
	 * Local transformation to apply to the value.
	 * This will be applied sequentially within the chain.
	 *
	 * @example
	 * ```typescript
	 * is.string.trim().toLowerCase().email
	 * // order matters:
	 * // 1. validate that the value is a string
	 * // 2. trim the value
	 * // 3. convert the value to lowercase
	 * // 4. validate that the value is an email
	 * ```
	 */
	transform?: (v: any, original: any) => any;
	/**
	 * If true, `helpers` completely replaces the current helper context.
	 * If false/undefined, `helpers` is merged with the current context,
	 * preserving parent transformers and refinements.
	 *
	 * Use `true` for converting transformers (e.g. string.parsedJson) that change the underlying type.
	 * Use `false`/omit for narrowing transformers (e.g. string.iso) that keep the same type.
	 */
	replaceHelpers?: boolean;
}

/**
 * Marks a helper as a transformation (takes args, returns a function that modifies the guard).
 * This allows the helper to change the target function, metadata, type, and extend or replace the base guard's helpers.
 */
export function transformer<
	CurGuardType,
	NewGuardType,
	FactoryArgs extends any[],
	NewHelpers extends Record<string, any> = {},
>(
	fn: (
		target: Guard<CurGuardType, Record<string, any>>,
		...args: FactoryArgs
	) => TransformerResult<NewGuardType, NewHelpers>
): ((...args: FactoryArgs) => Guard<NewGuardType, NewHelpers>) & { [TRANSFORMER]: true } {
	return Object.assign(fn, { [TRANSFORMER]: true as const }) as any;
}

/**
 * Marks a helper as a terminal. Does not return a guard, meaning it is the end of the chain.
 * Use this for helpers that don't return a guard, such as `is.string.parse(foo)`.
 */
export function terminal<F extends (...args: any[]) => any>(fn: F): F & { [TERMINAL]: true } {
	return Object.assign(fn, { [TERMINAL]: true as const }) as any;
}

/**
 * Marks a helper as a property-style access (e.g. .nullable instead of .nullable())
 *
 * NOTE: This is used for helpers that don't take any arguments and are not transformations.
 */
export function property<F extends (...args: any[]) => any>(fn: F): F & { [PROPERTY]: true } {
	return Object.assign(fn, { [PROPERTY]: true as const }) as any;
}

// ---------------------------------------------------------------------------
// Core: makeGuard + createProxy
// ---------------------------------------------------------------------------

/**
 * Creates a top-level guard with universal methods and optional type-specific chainable helpers.
 *
 * Every property access, chain step, and method call returns a new guard, so they are never mutated.
 */
export function makeGuard<T, H extends Record<string, any> = {}>(
	fn: (value: unknown) => value is T,
	meta: Pick<GuardMeta, 'name' | 'id'> & Partial<GuardMeta>,
	helpers?: H
): Guard<T, H> {
	const guard = Object.assign(fn, {
		meta: { schema: undefined, error: undefined, path: [], ...meta } as GuardMeta,
	});
	return createProxy(guard, helpers ?? ({} as H)) as Guard<T, H>;
}

// ---------------------------------------------------------------------------
// Universal helpers — shared by all guards
// ---------------------------------------------------------------------------

const universalHelpers: Record<string, any> = {
	/**
	 * Adds a custom error message to the guard that will be used when parsing fails.
	 * Allows for dynamic error messages based on the guard's metadata.
	 */
	err: transformer((target, msg: string | ((meta: GuardMeta) => string)) => {
		const error = typeof msg === 'function' ? msg(target.meta) : msg;
		return {
			fn: (v: unknown): v is any => target(v),
			meta: { error },
		};
	}),

	/**
	 * Adds a brand to the guard (modifies the type).
	 *
	 * @example
	 * ```typescript
	 * const isEmail = is.string.brand('email');
	 * // isEmail is now of type Guard<Brand<'email', string>>
	 * ```
	 */
	brand: transformer(<Tag extends string, T, H extends Record<string, any>>(target: Guard<T, H>, tag: Tag) => ({
		fn: (v: unknown): v is Brand<Tag, T> => target(v),
		meta: { name: `${target.meta.name}.brand<${tag}>` },
	})),

	/**
	 * Parses a value using the guard.
	 *
	 * @example
	 * ```typescript
	 * const result = is.string.parse('hello', 'Error: this is a custom error message!');
	 * // result is Ok('hello')
	 * const result = is.string.parse(123);
	 * // result is Err(GuardErr { message: 'Validation for string failed: expected string, but got number (123)', path: [], expected: 'string', actual: 'number', name: 'string' })
	 * ```
	 */
	parse: terminal(
		(
			target: Guard<any, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): Result<any, GuardErr> => {
			if (target(value)) return ok(target.meta.transform ? target.meta.transform(value, value) : value);
			const message = typeof errMsg === 'function' ? errMsg(target.meta) : (errMsg ?? target.meta.error);
			return GlobalErrs.GuardErr.err({
				message:
					message ??
					`Validation failed for guard ${target.meta.name}: expected ${target.meta.id}, but got ${typeof value} (${safeStringify(value)})`,
				path: target.meta.path,
				expected: target.meta.id,
				actual: typeof value,
				values: target.meta.values,
				name: target.meta.name,
			});
		}
	),

	/**
	 * Asserts that the value is valid according to the guard and returns the coerced value.
	 *
	 * @example
	 * ```typescript
	 * const result = is.string.assert('hello', 'Error: this is a custom error message!');
	 * // result is 'hello'
	 * const result = is.string.assert(123);
	 * // throws GuardErr { message: 'Validation for string failed: expected string, but got number (123)', path: [], expected: 'string', actual: 'number', name: 'string' }
	 * ```
	 */
	assert: terminal(
		<T>(
			target: Guard<T, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): T => {
			if (target(value)) return target.meta.transform?.(value, value) ?? value;
			const message = typeof errMsg === 'function' ? errMsg(target.meta) : (errMsg ?? target.meta.error);
			throw GlobalErrs.GuardErr.err({
				message:
					message ??
					`Validation failed for guard ${target.meta.name}: expected ${target.meta.id}, but got ${typeof value} (${safeStringify(value)})`,
				path: target.meta.path,
				expected: target.meta.id,
				actual: typeof value,
				values: target.meta.values,
				name: target.meta.name,
			});
		}
	),

	/**
	 * Adds a condition to the guard that must be met for the value to be considered valid.
	 *
	 * @example
	 * ```typescript
	 * const result = is.string.where((v) => v.length > 5).parse('hello');
	 * // throws GuardErr { message: 'Validation for string.where(condition) failed: expected string, but got string (hello)', path: [], expected: 'string', actual: 'string', name: 'string' }
	 * ```
	 */
	where: transformer((target, predicate: (value: any) => boolean) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return predicate(transformed);
		},
		meta: { name: `${target.meta.name}.where(condition)` },
	})),

	eq: transformer((target, value: any) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return deepEqual(transformed, value);
		},
		meta: { name: `${target.meta.name}.eq(${safeStringify(value)})` },
	})),

	not: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is unknown => !target(v),
			meta: { name: `${target.meta.name}.not` },
			helpers: {}, // drops helpers — "not T" is unknown
		}))
	),

	and: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return other(transformed);
		},
		meta: { name: `${target.meta.name}.and(${other.meta?.name ?? '?'})` },
	})),

	or: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => target(v) || other(v),
		meta: { name: `${target.meta.name}.or(${other.meta?.name ?? '?'})` },
		helpers: {}, // drops helpers
	})),

	nullable: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === null || target(v),
			meta: { name: `${target.meta.name}.nullable` },
			helpers: {},
		}))
	),

	optional: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === undefined || target(v),
			meta: { name: `${target.meta.name}.optional` },
			helpers: {},
		}))
	),

	nullish: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v == null || target(v),
			meta: { name: `${target.meta.name}.nullish` },
			helpers: {},
		}))
	),
};

function getType(v: any): string {
	if (v === null) return 'null';
	if (Array.isArray(v)) return 'array';
	return typeof v;
}

/**
 * Wraps a guard function in a Proxy that intercepts all property access.
 * This is the single chaining mechanism — universal methods, type-specific
 * helpers, and composition all flow through here.
 */
export function createProxy<T, H extends Record<string, any>>(
	target: { (value: unknown): value is T; meta: GuardMeta },
	helpers: H
): Guard<T, H> {
	return new Proxy(target, {
		apply(_target, _thisArg, args) {
			return target(args[0]);
		},

		get(target, prop: string) {
			if (prop === 'meta') return target.meta;
			if (prop === 'helpers') return helpers;

			// Universal methods (terminal)
			if (prop === 'parse') {
				return (v: unknown) => {
					if (target(v)) return ok((target.meta.transform ? target.meta.transform(v, v) : v) as T);
					return err(
						GlobalErrs.GuardErr({
							name: target.meta.name,
							message:
								target.meta.error ??
								`Validation for ${target.meta.name} failed: expected ${target.meta.id}, but got ${getType(v)} (${safeStringify(v)})`,
							path: target.meta.path,
							expected: target.meta.id,
							actual: getType(v),
							values: target.meta.values,
						})
					);
				};
			}
			// --- Let symbols and internal props pass through ---
			if (typeof prop === 'symbol') {
				return (target as any)[prop];
			}

			// --- Lookup helper (Universal first, then specific) ---
			const helper = universalHelpers[prop] ?? helpers[prop];
			if (!helper) {
				return (target as any)[prop];
			}

			// 1. Terminal helpers - execution ends the chain or returns a non-guard value
			if (helper[TERMINAL]) {
				return (...args: any[]) => helper(target, ...args);
			}

			// 2. Transformer helpers - these return a new Guard with modified logic/meta
			if (helper[TRANSFORMER]) {
				const execute = (...args: any[]) => {
					const result = helper(target, ...args);
					const next = Object.assign(result.fn, {
						meta: {
							...target.meta,
							...result.meta,
							transform: result.transform
								? (v: any, original: any) =>
										result.transform!(
											target.meta.transform ? target.meta.transform(v, original) : v,
											original
										)
								: target.meta.transform,
						} as GuardMeta,
					});
					const nextHelpers = result.helpers
						? result.replaceHelpers
							? result.helpers
							: { ...helpers, ...result.helpers }
						: helpers;
					return createProxy(next, nextHelpers);
				};

				// If marked as a property, execute immediately with no extra args
				if (helper[PROPERTY]) {
					return execute();
				}

				return execute;
			}

			// 3. Factory helpers - these take args and return a predicate to be combined with the target
			if (helper[FACTORY]) {
				return (...args: any[]) => {
					const predicate = helper(...args);
					const next = Object.assign(
						(v: unknown): v is T => {
							const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
							return target(v) && predicate(transformed);
						},
						{
							meta: {
								...target.meta,
								name: `${target.meta.name}.${String(prop)}(${args.map(a => safeStringify(a)).join(', ')})`,
							},
						}
					);
					return createProxy(next, helpers);
				};
			}

			// 4. Value helpers — simple predicates, compose immediately
			const next = Object.assign(
				(v: unknown): v is T => {
					const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
					return target(v) && helper(transformed);
				},
				{
					meta: { ...target.meta, name: `${target.meta.name}.${String(prop)}` },
				}
			);
			return createProxy(next, helpers);
		},
	}) as Guard<T, H>;
}
