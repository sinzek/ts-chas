import { err, ok, type Result } from '../../result/result.js';
import { GlobalErrs } from '../../tagged-errs.js';
import { deepEqual, safeStringify } from '../../utils.js';
import { AsyncGuard } from '../async.js';
import { COERCERS } from '../coercion.js';
import { arbitraryTerminal, generateTerminal } from '../generate.js';
import type { UnknownGuard } from '../misc/type-only.js';
import type { ArrayGuard } from '../objects/array.js';
import type { Schema } from '../schema.js';
import { arrayHelpers } from './array-helpers.js';
import { property, terminal, transformer } from './helper-markers.js';
import {
	buildGuardErr,
	evaluateDefault,
	evaluateFallback,
	type AddBrand,
	type Arbitrary,
	type Guard,
	type GuardErr,
	type GuardMeta,
	type JsonSchemaNode,
	type Unbrand,
} from './shared.js';

type CurrentGuard<T, H extends Record<string, any>, Prev = undefined> = Prev extends undefined ? Guard<T, H> : Prev;

export interface UniversalHelpers<T, H extends Record<string, any>, Prev = undefined> {
	/**
	 * Adds a custom error message to the guard that will be used when parsing fails.
	 * @param msg The error message or a function that returns one.
	 * @returns A new guard with the error message.
	 */
	error: (msg: string | ((ctx: { meta: GuardMeta; value: unknown }) => string)) => CurrentGuard<T, H, Prev>;
	/**
	 * Adds a brand to the guard. Drops type-specific helpers since the brand cannot be propogated through them at runtime.
	 * @param tag The tag to add to the guard.
	 * @returns A new guard with the brand.
	 */
	brand: <Tag extends string | number | symbol>(tag: Tag) => Guard<AddBrand<T, Tag>>; // no carryover of guard type name
	/**
	 * Removes a brand from the guard.
	 * @param tag The tag to remove from the guard. If not provided, all brands will be removed.
	 * @returns A new guard with the brand removed.
	 */
	unbrand: <Tag extends string | number | symbol | undefined = undefined>(tag?: Tag) => Guard<Unbrand<T, Tag>>;
	/**
	 * Parses a value against the guard, returning a `Result<T, GuardErr>`.
	 *
	 * > [!NOTE]
	 * > **Short-circuits on first failure.** Guards are type predicates first and
	 * > error reporters second — `.parse()` stops at the first rejecting step and
	 * > returns a single `GuardErr`. For exhaustive error collection across nested
	 * > object/array/tuple shapes (every failing field reported at once), promote
	 * > the guard with `.toSchema('Name').parse(value)` or compose with
	 * > `defineSchemas(...)`.
	 *
	 * @param value The value to parse.
	 * @param errMsg Optional override error message (string or function returning one).
	 * @returns A result containing the parsed value or a single `GuardErr`.
	 */
	parse: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => Result<T, GuardErr>;
	/**
	 * Asserts that the value is valid according to the guard, throwing a `GuardErr` on failure.
	 *
	 * > [!NOTE]
	 * > **Short-circuits on first failure.** Like `.parse()`, only the first rejecting
	 * > step is thrown. For full error collection across nested shapes, use
	 * > `.toSchema('Name').assert(value)` which throws an `AggregateGuardError`
	 * > containing every failing field.
	 *
	 * @param value The value to assert.
	 * @param errMsg Optional override error message (string or function returning one).
	 * @throws {GuardErr} If the value is not valid.
	 * @returns The correctly typed value if valid.
	 */
	assert: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => T;
	/**
	 * Adds a custom predicate to the guard.
	 * @param predicate The predicate to add to the guard.
	 * @returns A new guard with the predicate.
	 */
	where: (predicate: (value: T) => boolean) => CurrentGuard<T, H, Prev>;
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
	not: UnknownGuard;
	/**
	 * Combines this guard with another using AND: both must pass.
	 * Preserves this guard's helpers since the intersection refines the same base type.
	 *
	 * `is.object({ name: is.string }).and(is.object({ age: is.number }))` → `Guard<{ name: string } & { age: number }>`
	 */
	and: <U>(other: Guard<U, Record<string, any>>) => Guard<T & U, H>;
	/**
	 * Combines this guard with another using OR: either can pass.
	 * Drops type-specific helpers since the value could be either type.
	 *
	 * `is.string.or(is.number)` → `Guard<string | number>`
	 */
	or: <U>(other: Guard<U, Record<string, any>>) => Guard<T | U>;
	/**
	 * Combines this guard with another using XOR: exactly one can pass.
	 * Drops type-specific helpers since the value could be either type.
	 *
	 * `is.string.xor(is.number)` → `Guard<string | number>`
	 */
	xor: <U>(other: Guard<U, Record<string, any>>) => Guard<T | U>;
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
	/**
	 * Wraps the guard to validate arrays where every element matches.
	 * Equivalent to `is.array(thisGuard)`.
	 *
	 * `is.string.array` → `Guard<string[], ArrayHelpers<string>>`
	 * `is.number.positive.array` → `Guard<number[], ArrayHelpers<number>>`
	 */
	array: ArrayGuard<T>;
	/**
	 * Adds coercion support to the guard.
	 *
	 * When enabled, the guard attempts to cast "loose" inputs (like numeric strings or truthy values)
	 * into the target type before validation.
	 *
	 * Coercion happens during `.parse()`, `.assert()`, and Standard Schema validation.
	 *
	 * @example
	 * ```ts
	 * is.number.coerce.parse("123");       // Ok(123)
	 * is.boolean.coerce.parse("true");     // Ok(true)
	 * is.date.coerce.parse("2021-01-01");  // Ok(Date)
	 * ```
	 */
	coerce: CurrentGuard<T, H, Prev>;
	/**
	 * Sets a fallback value (or a function that returns one) to use when validation fails.
	 *
	 * When a guard has a fallback, `.parse()` and `.assert()` will return the fallback
	 * value instead of an error if the input is invalid. This also works recursively
	 * in schemas--nested properties with fallbacks will be auto-populated.
	 *
	 * > [!IMPORTANT]
	 * > This does **not** change the behavior of the guard when used as a boolean type predicate
	 * > (e.g. in `if (guard(v))`). The predicate still returns `false` if the input is invalid,
	 * > as it cannot safely narrow the type of the original variable to include the fallback.
	 *
	 * @param value - The fallback value OR a function `(ctx) => T`. The ctx includes
	 * the failing `value`, the guard's `meta`, and the `error` that would have been thrown.
	 * @returns A new guard with the fallback configured.
	 */
	fallback: <U>(
		value: U | ((ctx: { meta: GuardMeta; value: unknown; error: GuardErr }) => U)
	) => [U] extends [T] ? CurrentGuard<T | U, H, Prev> : Guard<T | U, H>;
	/**
	 * Sets a default value used when input is `undefined`. Unlike `.fallback`, this
	 * fires *before* validation runs, so the default itself is returned as-is without
	 * being re-validated.
	 *
	 * Most useful on optional object fields — a missing key materializes the default
	 * in `.parse()` / `.assert()` output rather than the undefined hole.
	 *
	 * @example
	 * ```ts
	 * const User = is.object({
	 *   name: is.string,
	 *   role: is.string.default('user'),
	 * });
	 * User.parse({ name: 'Alice' });               // Ok({ name: 'Alice', role: 'user' })
	 * User.parse({ name: 'Alice', role: 'admin' }); // Ok({ name: 'Alice', role: 'admin' })
	 * ```
	 *
	 * @param value - The default value OR a function `(ctx) => T`.
	 * @returns A new guard with the default configured.
	 */
	default: <U>(value: U | ((ctx: { meta: GuardMeta }) => U)) => CurrentGuard<T | U, H, Prev>;
	/**
	 * Attaches a human-readable description to the guard. Flows into the JSON Schema
	 * output as `description` and can be read from `meta.description` for docs / tooling.
	 *
	 * Accepts either a static string or a function that receives the current `meta`
	 * (evaluated eagerly at `.describe(...)` call time, so the function sees the
	 * accumulated chain state up to this point).
	 *
	 * @example
	 * ```ts
	 * is.string.email.describe('User email address').toJsonSchema();
	 * // { type: 'string', format: 'email', description: 'User email address' }
	 *
	 * is.number.int.gte(0).describe(m => `non-negative ${m.id}`).meta.description;
	 * // 'non-negative number'
	 * ```
	 */
	describe: (text: string | ((meta: GuardMeta) => string)) => CurrentGuard<T, H, Prev>;
	/**
	 * Merges custom metadata into the guard's `meta`. Intended for user-level tooling
	 * metadata (tags, author, doc links, etc.) — not for touching fields that drive
	 * validation behavior.
	 *
	 * Reserved keys (`id`, `name`, `shape`, `values`, `fallback`, `default`, `description`,
	 * `error`, `transform`, `jsonSchema`, and internal guard-specific fields) are rejected
	 * at runtime. Use the corresponding helper (`.describe`, `.default`, `.fallback`, ...) instead.
	 *
	 * @example
	 * ```ts
	 * const Email = is.string.email.annotate({ tag: 'pii', owner: 'auth-team' });
	 * Email.meta.tag;    // 'pii'
	 * Email.meta.owner;  // 'auth-team'
	 * ```
	 */
	annotate: (
		data: Record<string, unknown> | ((meta: GuardMeta) => Record<string, unknown>)
	) => CurrentGuard<T, H, Prev>;
	/**
	 * Applies a transformation to the validated value. The guard still validates
	 * the original input, but `.parse()` and `.assert()` return the transformed value.
	 *
	 * Subsequent chain steps (`.where()`, `.eq()`, etc.) operate on the **transformed** value.
	 * Drops type-specific helpers since the output type may have changed.
	 *
	 * For same-type transforms that preserve helpers, use type-specific transformers
	 * like `.trim()`, `.toLowerCase()`, etc.
	 *
	 * @example
	 * ```typescript
	 * // Type-changing transform: string → number
	 * const len = is.string.transform(s => s.length);
	 * len.parse('hello'); // Ok(5)
	 *
	 * // Chain with further refinements on the transformed type
	 * const shortString = is.string.transform(s => s.length).where(n => n < 10);
	 * shortString.parse('hello'); // Ok(5)
	 * shortString.parse('a very long string'); // Err(...)
	 *
	 * // Same-type transform (use .refine() instead to keep helpers)
	 * const upper = is.string.transform(s => s.toUpperCase());
	 * upper.parse('hello'); // Ok('HELLO')
	 * ```
	 */
	transform: { <U>(fn: (value: T) => U): Guard<U>; <U>(value: U): Guard<U> };
	/**
	 * Applies a same-type transformation to the validated value, **preserving type-specific helpers**.
	 *
	 * Like `.transform()`, the guard validates the original input, then applies the function.
	 * Unlike `.transform()`, the return type stays `T` and all helpers are preserved,
	 * so you can continue chaining type-specific methods.
	 *
	 * Use `.refine()` for normalizations (trimming, clamping, rounding) where the type doesn't change.
	 * Use `.transform()` when the output type changes (e.g., `string → number`).
	 *
	 * @example
	 * ```typescript
	 * // Same-type: normalize then continue chaining string helpers
	 * const guard = is.string.refine(s => s.trim().toLowerCase()).email;
	 * guard.parse('  HELLO@EXAMPLE.COM  '); // Ok('hello@example.com')
	 *
	 * // Clamp a number, then continue with number helpers
	 * const clamped = is.number.refine(n => Math.min(100, Math.max(0, n))).int;
	 * clamped.parse(150); // Ok(100)
	 * ```
	 */
	refine: { (fn: (value: T) => T): CurrentGuard<T, H, Prev>; (val: T): CurrentGuard<T, H, Prev> };
	/**
	 * Returns a Promise that resolves to a fast-check `Arbitrary<T>` for this guard.
	 *
	 * Requires `fast-check` to be installed (`npm install fast-check`).
	 * The arbitrary reflects all constraints accumulated through the helper chain.
	 *
	 * @example
	 * ```ts
	 * import * as fc from 'fast-check';
	 * const arb = await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).arbitrary();
	 * fc.assert(fc.property(arb, user => myFn(user) !== null));
	 * ```
	 */
	arbitrary: () => Promise<Arbitrary<T>>;
	/**
	 * Generates `n` valid values that satisfy this guard (default: 1 → returns a single value).
	 *
	 * Requires `fast-check` to be installed (`npm install fast-check`).
	 * Generated values are guaranteed to pass the guard's predicate.
	 *
	 * @example
	 * ```ts
	 * await is.string.email.generate()          // 'x@example.com'
	 * await is.number.int.between(1,100).generate(5)  // [7, 42, 3, 88, 15]
	 *
	 * // Pair with it.each for data-driven tests
	 * const samples = await is.object({ name: is.string.min(1) }).generate(10);
	 * it.each(samples)('processes %o', obj => expect(process(obj)).toBeTruthy());
	 * ```
	 */
	generate: {
		(): Promise<T>;
		(n: number): Promise<T[]>;
	};
	/**
	 * Serializes the guard to a JSON Schema Draft-07 compatible object.
	 *
	 * Captures constraints accumulated through the helper chain (min/max/email/etc.),
	 * recursively resolves object shapes and array element types, and handles
	 * nullable/optional variants. Best-effort: exotic guards (lazy, custom functions)
	 * fall back to `{}`.
	 *
	 * @example
	 * ```ts
	 * is.string.email.min(5).toJsonSchema()
	 * // { type: 'string', format: 'email', minLength: 5 }
	 *
	 * is.object({ name: is.string, age: is.number.int.gte(0).optional }).toJsonSchema()
	 * // { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer', minimum: 0 } }, required: ['name'] }
	 *
	 * is.array(is.string.email).toJsonSchema()
	 * // { type: 'array', items: { type: 'string', format: 'email' } }
	 * ```
	 */
	toJsonSchema: () => JsonSchemaNode;
	/**
	 * Appends an async predicate check, switching to async mode.
	 *
	 * The returned `AsyncGuard<T>` has `.parseAsync()` returning a
	 * `ResultAsync<T, GuardErr>` with the full monadic API.
	 *
	 * @example
	 * ```ts
	 * const UniqueEmail = is.string.email.whereAsync(async v => {
	 *   return !(await db.users.exists({ email: v }));
	 * });
	 * UniqueEmail.parseAsync(input).match({ ok: v => v, err: e => e.message });
	 * ```
	 */
	whereAsync: (fn: (value: T) => Promise<boolean>) => AsyncGuard<T>;
	/**
	 * Appends an async same-type transformation, switching to async mode.
	 *
	 * The resolved value replaces the current value and is passed to subsequent steps.
	 */
	refineAsync: (fn: (value: T) => Promise<T>) => AsyncGuard<T>;
	/**
	 * Appends an async type-changing transformation, switching to async mode.
	 *
	 * @example
	 * ```ts
	 * const Parsed = is.string.transformAsync(async raw => JSON.parse(raw) as User);
	 * // AsyncGuard<User>
	 * ```
	 */
	transformAsync: <U>(fn: (value: T) => Promise<U>) => AsyncGuard<U>;
	/**
	 * Converts this guard into a `Schema` with recursive error collection.
	 *
	 * Unlike `.parse()` (fail-fast, single error), `schema.parse()` walks the entire
	 * structure and collects **all** validation failures with full dot-path tracking.
	 *
	 * @param name - A label for this schema, used in error paths and messages.
	 *
	 * @example
	 * ```ts
	 * const UserSchema = is.object({
	 *   name: is.string.min(1),
	 *   age: is.number.gt(0),
	 * }).toSchema('User');
	 *
	 * UserSchema.parse({ name: '', age: -1 });
	 * // Err([
	 * //   GuardErr { path: ['User', 'name'], ... },
	 * //   GuardErr { path: ['User', 'age'], ... },
	 * // ])
	 * ```
	 */
	toSchema: (name: string) => Schema<CurrentGuard<T, H, Prev>>;
}

// Shared by all guards
export const universalHelpers: Record<string, any> = {
	error: transformer((target, msg: string | ((ctx: { meta: GuardMeta; value: unknown }) => string)) => {
		return {
			fn: (v: unknown): v is any => target(v),
			meta: { error: msg },
		};
	}),

	brand: transformer(
		<Tag extends string | number | symbol, T, H extends Record<string, any>>(target: Guard<T, H>, tag: Tag) => ({
			fn: (v: unknown): v is AddBrand<T, Tag> => target(v),
			meta: { name: `${target.meta.name}.brand<${String(tag)}>` },
		})
	),
	unbrand: transformer(
		<Tag extends string | number | symbol | undefined, T, H extends Record<string, any>>(
			target: Guard<T, H>,
			tag?: Tag
		) => ({
			fn: (v: unknown): v is Unbrand<T, Tag> => target(v),
			meta: { name: `${target.meta.name} unbranded${tag ? `<${String(tag)}>` : ''}` },
		})
	) as any,

	parse: terminal(
		(
			target: Guard<any, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): Result<any, GuardErr> => {
			if (value === undefined && 'default' in target.meta) {
				return ok(evaluateDefault(target.meta.default, target.meta));
			}
			if (target(value)) {
				try {
					return ok(target.meta.transform ? target.meta.transform(value, value) : value);
				} catch (transformErr) {
					if ('fallback' in target.meta) {
						const error = buildGuardErr(target, value, errMsg);
						return ok(evaluateFallback(target.meta.fallback, target.meta, value, error));
					}
					throw transformErr;
				}
			}

			const error = buildGuardErr(target, value, errMsg);
			if ('fallback' in target.meta) {
				return ok(evaluateFallback(target.meta.fallback, target.meta, value, error));
			}
			return err(error);
		}
	) as any,

	assert: terminal(
		<T>(
			target: Guard<T, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): T => {
			if (value === undefined && 'default' in target.meta) {
				return evaluateDefault(target.meta.default, target.meta);
			}
			if (target(value)) {
				try {
					return target.meta.transform?.(value, value) ?? value;
				} catch (transformErr) {
					if ('fallback' in target.meta) {
						const error = buildGuardErr(target, value, errMsg);
						return evaluateFallback(target.meta.fallback, target.meta, value, error);
					}
					throw transformErr;
				}
			}

			const error = buildGuardErr(target, value, errMsg);
			if ('fallback' in target.meta) {
				return evaluateFallback(target.meta.fallback, target.meta, value, error);
			}
			throw error;
		}
	) as any,

	where: transformer((target, predicate: (value: any) => boolean) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return predicate(transformed);
		},
		meta: {
			name: `${target.meta.name}.where(condition)`,
			_refinements: [...(target.meta._refinements ?? []), { predicate, name: 'where(condition)' }],
		},
	})),

	eq: transformer((target, value: any) => {
		const predicate = (v: any) => deepEqual(v, value);
		const refinementName = `eq(${safeStringify(value)})`;
		return {
			fn: (v: unknown): v is any => {
				if (!target(v)) return false;
				const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
				return predicate(transformed);
			},
			meta: {
				name: `${target.meta.name}.${refinementName}`,
				_refinements: [...(target.meta._refinements ?? []), { predicate, name: refinementName }],
			},
		};
	}),

	not: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is unknown => !target(v),
			meta: { name: `${target.meta.name}.not` },
			helpers: {}, // drops helpers — "not T" is unknown
			replaceHelpers: true,
		}))
	) as any,

	and: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return other(transformed);
		},
		meta: { name: `${target.meta.name}.and(${other.meta?.name ?? '?'})` },
		transform: other.meta.transform ? (v: unknown) => other.meta.transform!(v, v) : undefined,
	})),

	or: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => target(v) || other(v),
		meta: { name: `${target.meta.name}.or(${other.meta?.name ?? '?'})` },
		helpers: {},
		replaceHelpers: true,
	})),

	xor: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => {
			// Evaluate each predicate exactly once; short-circuit on unanimous rejection or match.
			const a = target(v);
			const b = other(v);
			return a !== b; // exactly one passes
		},
		meta: { name: `${target.meta.name}.xor(${other.meta?.name ?? '?'})` },
		helpers: {},
		replaceHelpers: true,
	})),

	nullable: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === null || target(v),
			meta: {
				name: `${target.meta.name}.nullable`,
				jsonSchema: { ...target.meta.jsonSchema, _nullable: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	) as any,

	optional: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === undefined || target(v),
			meta: {
				name: `${target.meta.name}.optional`,
				jsonSchema: { ...target.meta.jsonSchema, _optional: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	) as any,

	nullish: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v == null || target(v),
			meta: {
				name: `${target.meta.name}.nullish`,
				jsonSchema: { ...target.meta.jsonSchema, _nullable: true, _optional: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	) as any,

	fallback: transformer((target, value: any) => ({
		fn: (v: unknown): v is any => target(v),
		meta: {
			name: `${target.meta.name}.fallback(${typeof value === 'function' ? 'fn' : safeStringify(value)})`,
			fallback: value,
		},
	})),

	default: transformer((target, value: any) => ({
		fn: (v: unknown): v is any => target(v),
		meta: {
			name: `${target.meta.name}.default(${typeof value === 'function' ? 'fn' : safeStringify(value)})`,
			default: value,
			jsonSchema: {
				...target.meta.jsonSchema,
				default: typeof value === 'function' ? undefined : value,
			},
		},
	})),

	describe: transformer((target, text: string | ((meta: GuardMeta) => string)) => {
		const resolved = typeof text === 'function' ? text(target.meta) : text;
		return {
			fn: (v: unknown): v is any => target(v),
			meta: {
				name: target.meta.name,
				description: resolved,
				jsonSchema: { ...target.meta.jsonSchema, description: resolved },
			},
		};
	}),

	annotate: transformer(
		(
			target: Guard<any, Record<string, any>>,
			data: Record<string, unknown> | ((meta: GuardMeta) => Record<string, unknown>)
		) => {
			let dataMeta: Record<string, unknown>;
			if (typeof data === 'function') {
				dataMeta = data(target.meta);
			} else {
				dataMeta = data;
			}
			for (const k of Object.keys(dataMeta)) {
				if (RESERVED_META_KEYS.has(k)) {
					throw GlobalErrs.ChasErr({
						message:
							`[ts-chas] .annotate() cannot set reserved meta key "${k}". ` +
							`Use the dedicated helper (e.g. .describe, .default, .fallback, .error) instead.`,
						origin: 'annotate',
					});
				}
			}
			return {
				fn: (v: unknown): v is any => target(v),
				meta: data as Partial<GuardMeta>,
			};
		}
	),

	array: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any[] => Array.isArray(v) && v.every(item => target(item)),
			meta: {
				name: `${target.meta.name}[]`,
				id: 'array',
				elementGuards: [target],
			},
			transform: (v: any[]) => v.map(item => (target.meta.transform ? target.meta.transform(item, item) : item)),
			helpers: arrayHelpers,
			replaceHelpers: true,
		}))
	) as any,

	transform: transformer((target: Guard<any, Record<string, any>>, fn: ((value: any) => any) | unknown) => ({
		fn: (v: unknown): v is any => target(v),
		meta: { name: `${target.meta.name}.transform(${typeof fn === 'function' ? 'fn' : safeStringify(fn)})` },
		transform: (v: any) => (typeof fn === 'function' ? fn(v) : fn), // createProxy handles composition with parent transforms
		helpers: {},
		replaceHelpers: true,
	})),

	refine: transformer((target: Guard<any, Record<string, any>>, fn: ((value: any) => any) | unknown) => ({
		fn: (v: unknown): v is any => target(v),
		meta: { name: `${target.meta.name}.refine(${typeof fn === 'function' ? 'fn' : safeStringify(fn)})` },
		transform: (v: any) => (typeof fn === 'function' ? fn(v) : fn), // createProxy handles composition with parent transforms
		// preserve type-specific helpers
	})),

	coerce: property(
		transformer((target: Guard<any, Record<string, any>>) => {
			const id = target.meta.id.toLowerCase();
			const coercer = COERCERS[id];

			return {
				fn: (v: unknown): v is any => {
					if (target(v)) return true;
					const val = coercer ? coercer(v) : v;
					return target(val);
				},
				meta: { name: `${target.meta.name}.coerce` },
				transform: (v: unknown) => {
					const coerced = coercer ? coercer(v) : v;
					return target.meta.transform ? target.meta.transform(coerced, coerced) : coerced;
				},
			};
		})
	),

	toJsonSchema: terminal(
		(target: Guard<any, Record<string, any>>): JsonSchemaNode => cleanSchema(buildJsonSchema(target))
	) as any,

	arbitrary: terminal((target: Guard<any, Record<string, any>>) => arbitraryTerminal(target)) as any,

	generate: terminal((target: Guard<any, Record<string, any>>, n?: number) => generateTerminal(target, n)) as any,

	whereAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<boolean>) =>
		new AsyncGuard(target, []).whereAsync(fn)
	) as any,

	refineAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<any>) =>
		new AsyncGuard(target, []).refineAsync(fn)
	) as any,

	transformAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<any>) =>
		new AsyncGuard(target, []).transformAsync(fn)
	) as any,

	toSchema: terminal((target: Guard<any>, name: string) => {
		if (!_toSchemaFn) {
			throw new Error(
				'[ts-chas] Guard.toSchema() is unavailable — import from "ts-chas/guard" rather than an internal module.'
			);
		}
		return _toSchemaFn(name, target);
	}) as any,
} satisfies UniversalHelpers<any, any>;

// ---------------------------------------------------------------------------
// JSON Schema builder
// ---------------------------------------------------------------------------

const ID_TO_JSON_TYPE: Record<string, string> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	bigint: 'integer',
	null: 'null',
	object: 'object',
	array: 'array',
	// Date guard uses 'Date' (capitalised) as its id
	date: 'string',
	Date: 'string',
	url: 'string',
	URL: 'string',
	regexp: 'string',
	RegExp: 'string',
	symbol: 'string',
	function: 'object',
	literal: 'string',
	enum: 'string',
	union: 'object',
	intersection: 'object',
	discriminatedUnion: 'object',
	file: 'object',
	File: 'object',
};

/**
 * Converts a guard's meta into a JSON Schema Draft-07 compatible node.
 * @internal Used by the `.toJsonSchema()` terminal helper.
 */
function buildJsonSchema(guard: Guard<any>): JsonSchemaNode {
	const meta = guard.meta;
	const accumulated = meta.jsonSchema ?? {};

	// --- Literal / Enum (values override type) ---
	if (meta.values && (meta.id === 'literal' || meta.id === 'enum')) {
		const vals = [...(meta.values as Set<unknown>)];
		if (vals.length === 1) return { const: vals[0] };
		return { enum: vals };
	}

	// --- Union: anyOf ---
	if (meta.id === 'union' && Array.isArray(meta['guards'])) {
		return { anyOf: (meta['guards'] as Guard<any>[]).map(buildJsonSchema) };
	}

	// --- Intersection: allOf ---
	if (meta.id === 'intersection' && Array.isArray(meta['guards'])) {
		return { allOf: (meta['guards'] as Guard<any>[]).map(buildJsonSchema) };
	}

	// --- Xor: oneOf (JSON Schema 2020-12 — exactly one branch matches) ---
	if (meta.id === 'xor' && Array.isArray(meta['guards'])) {
		return { oneOf: (meta['guards'] as Guard<any>[]).map(buildJsonSchema) };
	}

	// --- Discriminated union: anyOf with discriminant injected ---
	if (meta.id === 'discriminatedUnion' && meta['variantMap']) {
		const anyOf: JsonSchemaNode[] = [];
		const key = meta['discriminantKey'] as string;
		for (const [disc, variantGuard] of Object.entries(meta['variantMap'] as Record<string, Guard<any>>)) {
			const variantSchema = buildJsonSchema(variantGuard);
			anyOf.push({
				...variantSchema,
				properties: {
					...variantSchema.properties,
					[key]: { const: disc },
				},
				required: [...(variantSchema.required ?? []), key].filter((v, i, a) => a.indexOf(v) === i),
			});
		}
		return { anyOf };
	}

	// --- Object: recurse into shape ---
	if (meta.id === 'object' && meta.shape) {
		const properties: Record<string, JsonSchemaNode> = {};
		const required: string[] = [];
		// `.partial()` / `.required()` set this set explicitly, overriding the
		// per-field `_optional` flag. Pick/omit/extend reset it so their schemas
		// match their runtime predicates.
		const optionalOverride = meta['_optionalKeys'] as Set<string> | undefined;
		for (const [key, fieldGuard] of Object.entries(meta.shape as Record<string, Guard<any>>)) {
			const fieldSchema = buildJsonSchema(fieldGuard);
			const isOptional = optionalOverride ? optionalOverride.has(key) : Boolean(fieldSchema._optional);
			properties[key] = cleanSchema(fieldSchema);
			if (!isOptional) required.push(key);
		}
		const schema: JsonSchemaNode = {
			...accumulated,
			type: 'object',
		};
		if (Object.keys(properties).length > 0) schema.properties = properties;
		if (required.length > 0) schema.required = required;
		return cleanSchema(schema);
	}

	// --- Record ---
	if (meta.id === 'record') {
		const valueGuard = meta['valueGuard'] as Guard<any> | undefined;
		const keyGuard = meta['keyGuard'] as Guard<any> | undefined;
		const schema: JsonSchemaNode = { ...accumulated, type: 'object' };
		if (valueGuard) {
			schema.additionalProperties = buildJsonSchema(valueGuard);
		}
		if (keyGuard) {
			schema['propertyNames'] = buildJsonSchema(keyGuard);
		}
		return cleanSchema(schema);
	}

	// --- Tuple: fixed-position items + optional rest (JSON Schema Draft-07) ---
	if (meta.id === 'tuple') {
		const tupleGuards = meta['tupleGuards'] as Guard<any>[] | undefined;
		const restGuard = meta['restGuard'] as Guard<any> | undefined;
		const schema: JsonSchemaNode = { ...accumulated, type: 'array' };
		if (tupleGuards?.length) {
			(schema as any).prefixItems = tupleGuards.map(buildJsonSchema);
			schema.items = restGuard ? buildJsonSchema(restGuard) : (false as any);
			if (!restGuard) {
				schema.minItems = tupleGuards.length;
				schema.maxItems = tupleGuards.length;
			} else {
				schema.minItems = tupleGuards.length;
			}
		} else if (!restGuard) {
			schema.maxItems = 0;
		} else {
			schema.items = buildJsonSchema(restGuard);
		}
		return cleanSchema(schema);
	}

	// --- Array: recurse into element guard ---
	if (meta.id === 'array') {
		const elementGuards = meta['elementGuards'] as Guard<any>[] | undefined;
		const schema: JsonSchemaNode = { ...accumulated, type: 'array' };
		if (elementGuards?.length === 1) {
			schema.items = buildJsonSchema(elementGuards[0]!);
		} else if (elementGuards && elementGuards.length > 1) {
			schema.items = { anyOf: elementGuards.map(buildJsonSchema) };
		}
		return cleanSchema(schema);
	}

	// --- Base type + accumulated constraints ---
	const jsonType = ID_TO_JSON_TYPE[meta.id] ?? undefined;
	const schema: JsonSchemaNode = { ...accumulated };
	if (jsonType && !accumulated.type) {
		schema.type = jsonType;
	}

	// Special: dates use string + date-time format (id is 'Date' in the built-in guard)
	if ((meta.id === 'date' || meta.id === 'Date') && !accumulated.format) {
		schema.format = 'date-time';
	}

	// _nullable and _optional are left intact for callers (object builder / cleanSchema).
	return schema;
}

/**
 * Applies `_nullable` → type widening and strips all internal `_` flags.
 * Call this on the final output of `buildJsonSchema` before returning to the user.
 */
function cleanSchema(schema: JsonSchemaNode): JsonSchemaNode {
	const out = { ...schema };
	if (out._nullable) {
		out.type = out.type ? [...(Array.isArray(out.type) ? out.type : [out.type]), 'null'] : ['null'];
	}
	delete out._nullable;
	delete out._optional;
	return out;
}

/**
 * Meta keys that `.annotate()` refuses to set, because they carry validation-critical
 * invariants or are populated by dedicated helpers (`.describe`, `.default`, `.fallback`,
 * `.error`, `.transform`, etc.). Users who want to edit these should use the corresponding
 * helper; `.annotate()` is strictly for custom user-level tooling metadata.
 */
export const RESERVED_META_KEYS: ReadonlySet<string> = new Set([
	'schema',
	'name',
	'id',
	'path',
	'error',
	'shape',
	'values',
	'fallback',
	'default',
	'description',
	'transform',
	'jsonSchema',
	// Well-known internal keys set by specific guard factories
	'elementGuards',
	'guards',
	'tupleGuards',
	'restGuard',
	'keyGuard',
	'valueGuard',
	'discriminator',
	'inner',
]);

let _toSchemaFn: ((name: string, guard: Guard<any>) => unknown) | undefined;

/** @internal Called once by schema.ts at module init to register buildSchema. */
export function _registerToSchema(fn: (name: string, guard: Guard<any>) => unknown): void {
	_toSchemaFn = fn;
}
