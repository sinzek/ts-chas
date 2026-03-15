/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TaggedError } from './tagged-errs.js';
import type { None, Option, Some } from './option.js';
import { err, ok, ResultAsync, type Err, type Ok, type Result } from './result.js';
import { Task } from './task.js';

/**
 * A guard is a function that returns true if the value is of the specified type (or satisfies a set of conditions) and narrows the type of the value.
 *
 * @example
 * ```ts
 * import { is } from 'chas/guard';
 *
 * // Using a guard to narrow the type of a value
 * const value: unknown = 'hello';
 * if (is.string(value)) {
 *   // value is now typed as string
 * }
 *
 * // Using a guard to validate a form field
 * const email = document.getElementById('email') as HTMLInputElement;
 * if (is.email(email.value)) {
 *   // email.value is now typed as string
 * }
 *
 * // Using a guard to validate a value and return a Result
 * const result = validate(value, is.string, new Error('Value must be a string'));
 * // result is now typed as Result<string, Error>
 * ```
 */
export type Guard<T> = (value: unknown) => value is T;

/**
 * Extracts the type from a guard.
 * @internal
 */
type GuardType<T> = T extends Guard<infer U> ? U : never;

/**
 * Helper to identify a factory produced by the errors() utility.
 * It identifies any object/function that has an .is guard.
 * @internal
 */
type ErrorFactory<T = any> = { is: Guard<T> };

const RGX = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	hex: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
	alphanumeric: { base: /^[a-z0-9]+$/i, withSpaces: /^[a-z0-9\s]+$/i },
};

/**
 * @internal
 */
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
	string: Object.assign((v => typeof v === 'string') as Guard<string>, {
		nonEmpty: (v => typeof v === 'string' && v.trim().length > 0) as Guard<string>,
		empty: (v => typeof v === 'string' && v.trim().length === 0) as Guard<string>,
		email: (v => typeof v === 'string' && RGX.email.test(v)) as Guard<string>,
		hexColor: (v => typeof v === 'string' && RGX.hex.test(v)) as Guard<string>,
		url: (v => typeof v === 'string' && RGX.url.test(v)) as Guard<string>,
		alphanumeric: Object.assign((v => typeof v === 'string' && RGX.alphanumeric.base.test(v)) as Guard<string>, {
			withSpaces: (v => typeof v === 'string' && RGX.alphanumeric.withSpaces.test(v)) as Guard<string>,
		}),
	}),
	number: Object.assign((v => typeof v === 'number' && Number.isFinite(v)) as Guard<number>, {
		gt: (n: number): Guard<number> => (v => is.number(v) && v > n) as Guard<number>,
		gte: (n: number): Guard<number> => (v => is.number(v) && v >= n) as Guard<number>,
		lt: (n: number): Guard<number> => (v => is.number(v) && v < n) as Guard<number>,
		lte: (n: number): Guard<number> => (v => is.number(v) && v <= n) as Guard<number>,
		between: (min: number, max: number): Guard<number> =>
			(v => is.number(v) && v >= min && v <= max) as Guard<number>,
		positive: (v => is.number(v) && v > 0) as Guard<number>,
		negative: (v => is.number(v) && v < 0) as Guard<number>,
		even: (v => is.number(v) && v % 2 === 0) as Guard<number>,
		odd: (v => is.number(v) && v % 2 !== 0) as Guard<number>,
		integer: (v => is.number(v) && Number.isInteger(v)) as Guard<number>,
		float: (v => is.number(v) && !Number.isInteger(v)) as Guard<number>,
	}),
	boolean: (v => typeof v === 'boolean') as Guard<boolean>,
	symbol: (v => typeof v === 'symbol') as Guard<symbol>,
	bigint: (v => typeof v === 'bigint') as Guard<bigint>,
	undefined: (v => v === undefined) as Guard<undefined>,
	null: (v => v === null) as Guard<null>,
	nil: (v => v == null) as Guard<null | undefined>,
	function: (v => typeof v === 'function') as Guard<Function>,

	array: Object.assign(
		<T>(inner?: Guard<T>): Guard<T[]> => (v => Array.isArray(v) && (!inner || v.every(inner))) as Guard<T[]>,
		{
			min: (n: number) => (v: any[]) => v.length >= n,
			max: (n: number) => (v: any[]) => v.length <= n,
			size: (n: number) => (v: any[]) => v.length === n,
			nonEmpty: (v: any[]) => v.length > 0,
			empty: (v: any[]) => v.length === 0,
			unique: (v: any[]) => new Set(v).size === v.length,
			includes: (v: any[]) => (item: any) => v.includes(item),
			excludes: (v: any[]) => (item: any) => !v.includes(item),
			includesAll: (v: any[]) => (items: any[]) => items.every(item => v.includes(item)),
			includesAny: (v: any[]) => (items: any[]) => items.some(item => v.includes(item)),
			includesNone: (v: any[]) => (items: any[]) => items.every(item => !v.includes(item)),
			includesOnly: (v: any[]) => (items: any[]) => v.every(item => items.includes(item)),
		}
	),
	object: <T extends object>(shape?: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			if (!shape) return true;
			return Object.entries(shape).every(([k, g]) => (g as any)((v as any)[k]));
		}) as Guard<T>,
	partial: <T extends object>(shape: { [K in keyof T]: Guard<T[K]> }): Guard<Partial<T>> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			return Object.entries(shape).every(([k, g]) => (v as any)[k] === undefined || (g as any)((v as any)[k]));
		}) as Guard<Partial<T>>,
	record: <K extends string | number | symbol, V>(keyGuard: Guard<K>, valGuard: Guard<V>): Guard<Record<K, V>> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			return Object.entries(v).every(([k, val]) => keyGuard(k) && valGuard(val));
		}) as Guard<Record<K, V>>,
	tuple: <T extends any[]>(...guards: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		(v => {
			if (!Array.isArray(v) || v.length !== guards.length) return false;
			return v.every((val, idx) => (guards[idx] as any)(val));
		}) as Guard<T>,

	oneOf: <T extends Guard<any>[]>(...guards: T): Guard<GuardType<T[number]>> =>
		((v: unknown) => guards.some(g => g(v))) as any,

	allOf: <T>(...guards: Guard<any>[]): Guard<T> => ((v: unknown) => guards.every(g => g(v))) as any,

	date: (v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime()),

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
			if (typeof tagOrFactory !== 'string' && 'is' in tagOrFactory) {
				return tagOrFactory.is(v) && (!inner || inner(v));
			}
			const matchesTag = !!v && typeof v === 'object' && v._tag === tagOrFactory;
			return matchesTag && (!inner || inner(v));
		};
	},

	not:
		<T>(guard: Guard<T>): Guard<any> =>
		(v: unknown): v is any =>
			!guard(v),
	schema: <T>(s: { safeParse: (v: unknown) => any }): Guard<T> => (v => s.safeParse(v).success) as Guard<T>,
	literal:
		<T extends string | number | boolean>(val: T): Guard<T> =>
		(v: unknown): v is T =>
			v === val,
	union: <T extends object, K extends keyof T>(
		key: K,
		mapping: { [V in T[K] & (string | number)]: Guard<Extract<T, { [P in K]: V }>> }
	): Guard<T> =>
		(v => {
			if (typeof v !== 'object' || v === null) return false;
			const tag = (v as any)[key];
			const guard = (mapping as any)[tag];
			return guard ? guard(v) : false;
		}) as Guard<T>,
};

/**
 * Type guard utilities for runtime type checking.
 *
 * @example
 * ```ts
 * import { is } from 'chas/guard';
 *
 * if (is(value, Error)) {
 *   console.log(value.message); // value is now typed as Error
 * }
 *
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
 *
 * @example
 * ```ts
 * assert(value, is.string, 'Value must be a string');
 * ```
 */
export function assert<T>(value: unknown, guard: Guard<T>, message?: string): asserts value is T {
	if (!guard(value)) {
		throw new Error(message ?? `Value failed type assertion`);
	}
}

/**
 * "Ensures" a value matches a guard and returns it, typed.
 *
 * @example
 * ```ts
 * const value = ensure(value, is.string, 'Value must be a string');
 * ```
 */
export function ensure<T>(value: unknown, guard: Guard<T>, message?: string): T {
	assert(value, guard, message);
	return value;
}

/**
 * Uses a guard to validate a value, returning a Result.
 *
 * @example
 * ```ts
 * const result = validate(value, is.string, 'Value must be a string');
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function validate<T, E>(value: unknown, guard: Guard<T>, error: E): Result<T, E> {
	return guard(value) ? ok(value) : err(error);
}

/**
 * Converts a guard into a Result-returning function.
 *
 * @example
 * ```ts
 * const validateString = guardToValidator(is.string, 'Value must be a string');
 * const result = validateString(value);
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function guardToValidator<T, E>(guard: Guard<T>, error: E): (value: unknown) => Result<T, E> {
	return (value: unknown) => validate(value, guard, error);
}

/**
 * Takes a guard and an error, and returns a function
 * that converts a value into a Task.
 *
 * @param guard The guard to use for validation.
 * @param error The error to return if the guard fails.
 *
 * @example
 * ```ts
 * const validateString = guardToTask(is.string, 'Value must be a string');
 * const result = validateString(value);
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function guardToTask<T, E>(guard: Guard<T>, error: E) {
	return (value: unknown): Task<T, E> => new Task(() => ResultAsync.fromResult(validate(value, guard, error)));
}

export const Guard = {
	toValidator: guardToValidator,
	toTask: guardToTask,
	validate,
	assert,
	ensure,
	is,
};
