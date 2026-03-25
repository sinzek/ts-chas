// Guard API v2

import { ok, type Result } from './result.js';
import { GlobalErrs, type InferErr } from './tagged-errs.js';
import { deepEqual } from './utils.js';

type GuardErr = InferErr<typeof GlobalErrs.GuardErr>;

type GuardMeta = {
	schema?: string;
	name: string;
	error?: string;
	type: string;
	path: string[];
	shape?: Record<string, any>;
	[key: string]: any;
};

type Brand<Tag extends string, Base> = Base & { readonly __brand: Tag };

// ---------------------------------------------------------------------------
// Guard type — every guard has universal methods + optional chainable helpers
// ---------------------------------------------------------------------------

type Guard<T, Helpers extends Record<string, any> = {}> = {
	(value: unknown): value is T;
	meta: GuardMeta;
	/**
	 * Adds a custom error message to the guard that will be used when parsing fails.
	 * @param msg The error message or a function that returns one.
	 * @returns A new guard with the error message.
	 */
	err: (msg: string | ((ctx: { meta: GuardMeta }) => string)) => Guard<T, Helpers>;
	/**
	 * Adds a brand to the guard.
	 * @param tag The tag to add to the guard.
	 * @returns A new guard with the brand.
	 */
	brand: <Tag extends string>(tag: Tag) => Guard<Brand<Tag, T>, Helpers>;
	/**
	 * Parses a value against the guard.
	 * @param value The value to parse.
	 * @param errMsg Optional error message or function that returns one.
	 * @returns A result containing the parsed value or an error.
	 */
	parse: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => Result<T, GuardErr>;
	/**
	 * Adds a custom predicate to the guard.
	 * @param predicate The predicate to add to the guard.
	 * @returns A new guard with the predicate.
	 */
	where: (predicate: (value: T) => boolean) => Guard<T, Helpers>;
	/**
	 * Adds a value to the guard that must be equal to the value being tested.
	 * @param value The value to compare against.
	 * @returns A new guard that also checks for equality.
	 */
	eq: <U>(value: U) => Guard<T & U, Helpers>;
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
} & Helpers;

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

const FACTORY = Symbol('factory');

/**
 * Marks a helper as a factory (takes args, returns a predicate).
 * Without this, the proxy assumes helpers are value guards.
 */
function factory<F extends (...args: any[]) => (value: any) => boolean>(fn: F): F & { [FACTORY]: true } {
	return Object.assign(fn, { [FACTORY]: true as const });
}

// ---------------------------------------------------------------------------
// Core: makeGuard + createProxy
// ---------------------------------------------------------------------------

/**
 * Creates a guard with universal methods and optional type-specific chainable helpers.
 *
 * Every property access, chain step, and method call returns a new guard, so they are never mutated.
 */
function makeGuard<T, H extends Record<string, any> = {}>(
	fn: (value: unknown) => value is T,
	meta: Pick<GuardMeta, 'name' | 'type'> & Partial<GuardMeta>,
	helpers?: H
): Guard<T, H> {
	const guard = Object.assign(fn, {
		meta: { schema: undefined, error: undefined, path: [], ...meta } as GuardMeta,
	});
	return createProxy(guard, helpers ?? ({} as H)) as Guard<T, H>;
}

/**
 * Wraps a guard function in a Proxy that intercepts all property access.
 * This is the single chaining mechanism — universal methods, type-specific
 * helpers, and composition all flow through here.
 */
function createProxy<T, H extends Record<string, any>>(
	target: { (value: unknown): value is T; meta: GuardMeta },
	helpers: H
): Guard<T, H> {
	return new Proxy(target, {
		apply(_target, _thisArg, args) {
			return target(args[0]);
		},

		get(_target, prop: string | symbol) {
			// --- Let symbols and internal props pass through ---
			if (typeof prop === 'symbol' || prop === 'meta') {
				return (target as any)[prop];
			}

			// --- Universal: .err() ---
			if (prop === 'err') {
				return (msg: string | ((ctx: { meta: GuardMeta }) => string)) => {
					const error = typeof msg === 'function' ? msg({ meta: target.meta }) : msg;
					const next = Object.assign((v: unknown): v is T => target(v), { meta: { ...target.meta, error } });
					return createProxy(next, helpers);
				};
			}

			// --- Universal: .brand() ---
			if (prop === 'brand') {
				return (tag: string) => {
					const next = Object.assign((v: unknown): v is any => target(v), {
						meta: { ...target.meta, name: `${target.meta.name}.brand<${tag}>` },
					});
					return createProxy(next, helpers);
				};
			}

			// --- Universal: .parse() ---
			if (prop === 'parse') {
				return (
					value: unknown,
					errMsg?: string | ((ctx: { meta: GuardMeta }) => string)
				): Result<T, GuardErr> => {
					if (target(value)) return ok(value);
					const message =
						typeof errMsg === 'function' ? errMsg({ meta: target.meta }) : (errMsg ?? target.meta.error);
					return GlobalErrs.GuardErr.err({
						message:
							message ??
							`Validation failed: expected ${target.meta.name}, but got ${typeof value} (${JSON.stringify(value)})`,
						path: target.meta.path,
						expected: target.meta.name,
						actual: typeof value,
					});
				};
			}

			// --- Universal: .where() ---
			if (prop === 'where') {
				return (predicate: (value: T) => boolean) => {
					const next = Object.assign((v: unknown): v is T => target(v) && predicate(v as T), {
						meta: { ...target.meta, name: `${target.meta.name}.where(...)` },
					});
					return createProxy(next, helpers);
				};
			}

			// --- Universal: .eq() ---
			if (prop === 'eq') {
				return (value: T) => {
					const next = Object.assign((v: unknown): v is T => target(v) && deepEqual(v, value), {
						meta: { ...target.meta, name: `${target.meta.name}.eq(${JSON.stringify(value)})` },
					});
					return createProxy(next, helpers);
				};
			}

			// --- Universal wrappers: .nullable, .optional, .nil ---
			// These use OR-escape composition: `v === null || target(v)`
			// They widen the type and drop type-specific helpers (no helpers arg)
			// because chaining `.email` after `.nullable` makes no sense.
			if (prop === 'nullable') {
				const next = Object.assign((v: unknown): v is T | null => v === null || target(v), {
					meta: { ...target.meta, name: `${target.meta.name}.nullable` },
				});
				return createProxy(next, {});
			}

			if (prop === 'optional') {
				const next = Object.assign((v: unknown): v is T | undefined => v === undefined || target(v), {
					meta: { ...target.meta, name: `${target.meta.name}.optional` },
				});
				return createProxy(next, {});
			}

			if (prop === 'nil') {
				const next = Object.assign((v: unknown): v is T | null | undefined => v == null || target(v), {
					meta: { ...target.meta, name: `${target.meta.name}.nil` },
				});
				return createProxy(next, {});
			}

			// --- Type-specific helpers ---
			if (prop in helpers) {
				const helper = helpers[prop];

				// Factory helper — takes args, returns a predicate.
				// We return a function that, when called, composes the result.
				if (helper[FACTORY]) {
					return (...args: any[]) => {
						const predicate = helper(...args);
						const next = Object.assign((v: unknown): v is T => target(v) && predicate(v), {
							meta: {
								...target.meta,
								name: `${target.meta.name}.${String(prop)}(${args.map(a => JSON.stringify(a)).join(', ')})`,
							},
						});
						return createProxy(next, helpers);
					};
				}

				// Value helper — IS a predicate. Compose immediately.
				const next = Object.assign((v: unknown): v is T => target(v) && helper(v), {
					meta: { ...target.meta, name: `${target.meta.name}.${String(prop)}` },
				});
				return createProxy(next, helpers);
			}

			// --- Fallback ---
			return (target as any)[prop];
		},
	}) as Guard<T, H>;
}

// ---------------------------------------------------------------------------
// Example: is.string with helpers
// ---------------------------------------------------------------------------

// const stringHelpers = {
// 	// Value helpers — plain predicates, composed with AND
// 	nonEmpty: (v: unknown) => typeof v === 'string' && v.trim().length > 0,
// 	empty: (v: unknown) => typeof v === 'string' && v.trim().length === 0,
// 	email: (v: unknown) => typeof v === 'string' && RGX_EMAIL.test(v),
// 	url: (v: unknown) => typeof v === 'string' && RGX_URL.test(v),
// 	hexColor: (v: unknown) => typeof v === 'string' && RGX_HEX.test(v),
// 	alphanumeric: (v: unknown) => typeof v === 'string' && /^[a-z0-9]+$/i.test(v),

// 	// Factory helpers — take args, return a predicate
// 	length: factory(
// 		(min: number, max?: number) => (v: unknown) =>
// 			typeof v === 'string' && (max != null ? v.length >= min && v.length <= max : v.length === min)
// 	),
// 	lengthGt: factory((n: number) => (v: unknown) => typeof v === 'string' && v.length > n),
// 	lengthGte: factory((n: number) => (v: unknown) => typeof v === 'string' && v.length >= n),
// 	lengthLt: factory((n: number) => (v: unknown) => typeof v === 'string' && v.length < n),
// 	lengthLte: factory((n: number) => (v: unknown) => typeof v === 'string' && v.length <= n),
// 	regex: factory((re: RegExp) => (v: unknown) => typeof v === 'string' && re.test(v)),
// 	startsWith: factory((pfx: string) => (v: unknown) => typeof v === 'string' && v.startsWith(pfx)),
// 	endsWith: factory((sfx: string) => (v: unknown) => typeof v === 'string' && v.endsWith(sfx)),
// 	includes: factory((sub: string) => (v: unknown) => typeof v === 'string' && v.includes(sub)),
// 	uuid: factory(
// 		(version?: string) => (v: unknown) =>
// 			typeof v === 'string' && (version === 'v4' ? RGX_UUID_V4.test(v) : RGX_UUID_V4.test(v))
// 	),
// };

const baseIs = {
	// primitives
	string: makeGuard((v: unknown): v is string => typeof v === 'string', { name: 'string', type: 'string' }),
	number: makeGuard((v: unknown): v is number => typeof v === 'number', { name: 'number', type: 'number' }),
	boolean: makeGuard((v: unknown): v is boolean => typeof v === 'boolean', { name: 'boolean', type: 'boolean' }),
	bigint: makeGuard((v: unknown): v is bigint => typeof v === 'bigint', { name: 'bigint', type: 'bigint' }),
	symbol: makeGuard((v: unknown): v is symbol => typeof v === 'symbol', { name: 'symbol', type: 'symbol' }),
	undefined: makeGuard((v: unknown): v is undefined => typeof v === 'undefined', {
		name: 'undefined',
		type: 'undefined',
	}),
	null: makeGuard((v: unknown): v is null => v === null, { name: 'null', type: 'null' }),
	instance: <T>(ctor: abstract new (...args: any[]) => T) =>
		makeGuard((v: unknown): v is T => v instanceof ctor, { name: `instance<${ctor.name}>`, type: ctor.name }),
	array: <G extends Guard<any, any>[]>(
		...guards: G
	): Guard<G extends [] ? unknown[] : GuardType<G[number]>[], typeof arrayHelpers> => {
		type T = G extends [] ? unknown[] : GuardType<G[number]>[];
		const names = guards.length > 0 ? guards.map(g => g.meta?.name ?? 'unknown').join(' | ') : 'unknown';
		return makeGuard(
			(v: unknown): v is T => {
				if (!Array.isArray(v)) return false;
				if (guards.length === 0) return true;
				return v.every(el => guards.some(g => g(el)));
			},
			{ name: `array<${names}>`, type: 'array' },
			arrayHelpers
		);
	},
	object: <S extends Record<string, Guard<any, any>>>(
		schema?: S
	): Guard<
		S extends undefined
			? object
			: {
					[K in keyof S]: GuardType<S[K]>;
				},
		typeof objectHelpers
	> => {
		if (schema === undefined) {
			return makeGuard(
				(v: unknown): v is object => v != null && typeof v === 'object' && !Array.isArray(v),
				{ name: 'object', type: 'object' },
				objectHelpers
			);
		}
		const names = Object.keys(schema)
			.map(k => `${k}: ${schema[k].meta?.name ?? 'unknown'}`)
			.join(', ');
		return makeGuard(
			(
				v: unknown
			): v is {
				[K in keyof S]: GuardType<S[K]>;
			} => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
				const obj = v as Record<string, unknown>;
				for (const key in schema) {
					if (!schema[key](obj[key])) return false;
				}
				return true;
			},
			{ name: `object<${names}>`, type: 'object' },
			objectHelpers
		);
	},

	// type-level only
	unknown: makeGuard((_v: unknown): _v is unknown => true, { name: 'unknown', type: 'unknown' }),
	any: makeGuard((_v: unknown): _v is any => true, { name: 'any', type: 'any' }),

	// built-ins that need helpers
	date: makeGuard((v: unknown): v is Date => v instanceof Date, { name: 'date', type: 'date' }),
	regexp: (pattern: string | RegExp, flags?: string) =>
		makeGuard((v: unknown): v is RegExp => v instanceof RegExp && v.source === pattern && v.flags === flags, {
			name: `regexp<${pattern}, ${flags}>`,
			type: 'regexp',
		}),
};

// Array helpers
const arrayHelpers = {
	nonEmpty: (v: unknown) => Array.isArray(v) && v.length > 0,
	empty: (v: unknown) => Array.isArray(v) && v.length === 0,
	unique: (v: unknown) => Array.isArray(v) && new Set(v).size === v.length,
	min: factory((n: number) => (v: unknown) => Array.isArray(v) && v.length >= n),
	max: factory((n: number) => (v: unknown) => Array.isArray(v) && v.length <= n),
	size: factory((n: number) => (v: unknown) => Array.isArray(v) && v.length === n),
	includes: factory((item: unknown) => (v: unknown) => Array.isArray(v) && v.includes(item)),
	excludes: factory((item: unknown) => (v: unknown) => Array.isArray(v) && !v.includes(item)),
};

// Object helpers
const objectHelpers = {};

// ---------------------------------------------------------------------------
// Helper Types
// ---------------------------------------------------------------------------

type GuardType<T> = T extends Guard<infer U, any> ? U : never;

// ---------------------------------------------------------------------------
// IsAPI (stub)
// ---------------------------------------------------------------------------

type IsAPI<Extensions = {}> = {};
