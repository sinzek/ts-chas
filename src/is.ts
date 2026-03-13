/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TaggedError } from './errors.js';
import type { None, Option, Some } from './option.js';
import type { Err, Ok, Result } from './result.js';

/**
 * A type guard is a function that returns true if the value is of the specified type.
 */
export type Guard<T> = (value: unknown) => value is T;

/**
 * Helper type to extract the type from a guard.
 */
type GuardType<T> = T extends Guard<infer U> ? U : never;

/** * Helper to identify a factory produced by the errors() utility.
 * It identifies any object/function that has an .is guard.
 */
type ErrorFactory<T = any> = { is: Guard<T> };

// --- REGEX ---
const RGX = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	hex: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
};

interface TaggedFn {
	/**
	 * Checks if a value is a tagged error using an error factory (e.g., AppError.NotFound)
	 * @param factory The error factory to check for.
	 * @param inne  r An optional guard to check the inner value.
	 * @returns A guard that checks if the value is a tagged error.
	 *
	 * @example
	 * ```ts
	 * if (is.tagged(AppError.NotFound)(value)) {
	 *   console.log(value.resource); // value is now typed as TaggedError & { _tag: 'NotFound' } & (whatever other properties the factory provides)
	 * }
	 * ```
	 */
	<T extends ErrorFactory>(factory: T, inner?: Guard<GuardType<T['is']>>): Guard<GuardType<T['is']>>;
	/**
	 * Checks if a value is a tagged error using a string tag.
	 * @param tag The tag to check for.
	 * @param inner An optional guard to check the inner value.
	 * @returns A guard that checks if the value is a tagged error.
	 *
	 * @example
	 * ```ts
	 * if (is.tagged('NotFound')(value)) {
	 *   console.log(value.resource); // value is now typed as TaggedError & { _tag: 'NotFound' } & (whatever other properties the factory with this tag provides)
	 * }
	 * ```
	 */
	<Tag extends string>(tag: Tag, inner?: Guard<any>): Guard<TaggedError & { readonly _tag: Tag }>;
}

type IsApi = Omit<typeof implementation, 'tagged'> & {
	readonly tagged: TaggedFn;
};

const implementation = {
	// --- PRIMITIVES ---
	string: (v => typeof v === 'string') as Guard<string>,
	number: (v => typeof v === 'number' && Number.isFinite(v)) as Guard<number>,
	boolean: (v => typeof v === 'boolean') as Guard<boolean>,
	symbol: (v => typeof v === 'symbol') as Guard<symbol>,
	bigint: (v => typeof v === 'bigint') as Guard<bigint>,
	undefined: (v => v === undefined) as Guard<undefined>,
	null: (v => v === null) as Guard<null>,
	nil: (v => v == null) as Guard<null | undefined>,
	function: (v => typeof v === 'function') as Guard<Function>,

	// --- COMPOSABLE STRUCTURES ---
	array: <T>(inner?: Guard<T>): Guard<T[]> => (v => Array.isArray(v) && (!inner || v.every(inner))) as Guard<T[]>,

	object: <T extends object>(shape?: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			if (!shape) return true;
			return Object.entries(shape).every(([k, g]) => (g as any)((v as any)[k]));
		}) as Guard<T>,

	oneOf: <T extends Guard<any>[]>(...guards: T): Guard<GuardType<T[number]>> =>
		((v: unknown) => guards.some(g => g(v))) as any,

	allOf: <T>(...guards: Guard<any>[]): Guard<T> => ((v: unknown) => guards.every(g => g(v))) as any,

	// --- STRING & MATH ---
	integer: (v => Number.isInteger(v)) as Guard<number>,
	date: (v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime()),
	nonEmptyString: (v => typeof v === 'string' && v.trim().length > 0) as Guard<string>,
	email: (v => typeof v === 'string' && RGX.email.test(v)) as Guard<string>,
	hexColor: (v => typeof v === 'string' && RGX.hex.test(v)) as Guard<string>,
	url: (v => typeof v === 'string' && RGX.url.test(v)) as Guard<string>,

	// --- LIBRARY TYPES (Factories) ---

	/** is.ok(is.string) */
	ok:
		<T = any>(inner?: Guard<T>): Guard<Ok<T>> =>
		(v: any): v is Ok<T> =>
			!!v && v.ok === true && (!inner || inner(v.value)),

	/** is.err(is.string) */
	err:
		<E = any>(inner?: Guard<E>): Guard<Err<E>> =>
		(v: any): v is Err<E> =>
			!!v && v.ok === false && (!inner || inner(v.error)),

	/** is.result(is.string, is.number) */
	result: <T, E>(okG?: Guard<T>, errG?: Guard<E>): Guard<Result<T, E>> =>
		((v: unknown) => is.ok(okG)(v) || is.err(errG)(v)) as Guard<Result<T, E>>,

	/** is.some(is.number) */
	some:
		<T = any>(inner?: Guard<T>): Guard<Some<T>> =>
		(v: any): v is Some<T> =>
			is.ok()(v) && v.value != null && (!inner || inner(v.value)),

	/** is.none() */
	none:
		(): Guard<None> =>
		(v: any): v is None =>
			is.err()(v) && v.error === undefined,

	/** is.option(is.string) */
	option: <T>(inner?: Guard<T>): Guard<Option<T>> =>
		((v: unknown) => is.some(inner)(v) || is.none()(v)) as Guard<Option<T>>,

	/** is.tagged('UserError') or is.tagged(AppError.NotFound) */
	tagged: (tagOrFactory: string | ErrorFactory, inner?: Guard<any>): Guard<any> => {
		return (v: any): v is any => {
			// case 1: it's an Error Factory (AppError.NotFound)
			if (typeof tagOrFactory !== 'string' && 'is' in tagOrFactory) {
				return tagOrFactory.is(v) && (!inner || inner(v));
			}

			// case 2: it's a string tag
			const matchesTag = !!v && typeof v === 'object' && v._tag === tagOrFactory;
			return matchesTag && (!inner || inner(v));
		};
	},

	schema: <T>(s: { safeParse: (v: unknown) => any }): Guard<T> => (v => s.safeParse(v).success) as Guard<T>,
};

// --- CORE ENGINE ---
/**
 * Type guard utilities for runtime type checking.
 *
 * @example
 * ```ts
 * if (is.ok(is.string)(value)) {
 *   console.log(value.value); // value is now typed as Ok<string>
 * }
 *
 * if (is.result(is.number, is.string)(value)) {
 *   console.log(value.value); // value is now typed as Result<number, string>
 * }
 *
 * if (is.tagged('UserError')(value)) {
 *   console.log(value.name); // value is now typed as TaggedError with _tag: 'UserError'
 * }
 * ```
 */
export const is = Object.assign(
	/** Instance Check: is(value, Date) */
	<T>(value: unknown, ctor: abstract new (...args: any[]) => T): value is T => value instanceof ctor,
	implementation
) as IsApi;

/**
 * Asserts that a value matches a guard, or throws.
 */
export function assert<T>(value: unknown, guard: Guard<T>, message?: string): asserts value is T {
	if (!guard(value)) {
		throw new Error(message ?? `Value failed type assertion`);
	}
}

/**
 * "Ensures" a value matches a guard and returns it, typed.
 */
export function ensure<T>(value: unknown, guard: Guard<T>, message?: string): T {
	assert(value, guard, message);
	return value;
}
