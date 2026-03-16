import type { TaggedErr } from './tagged-errs.js';
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
	 *   console.log(value.resource); // value is now typed as TaggedErr & { _tag: 'NotFound' } & (whatever other properties the factory provides)
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
	 *   console.log(value.resource); // value is now typed as TaggedErr & { _tag: 'NotFound' } & (whatever other properties the factory with this tag provides)
	 * }
	 * ```
	 */
	<Tag extends string>(tag: Tag, inner?: Guard<any>): Guard<TaggedErr & { readonly _tag: Tag }>;
}

type IsApi = Omit<typeof implementation, 'tagged'> & {
	readonly tagged: TaggedFn;
};

const implementation = {
	/**
	 * Checks if a value is a string.
	 * @param value The value to check.
	 * @returns True if the value is a string, false otherwise.
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
	 * ```
	 */
	string: Object.assign((v => typeof v === 'string') as Guard<string>, {
		/** Checks if a value is a non-empty string. */
		nonEmpty: (v => typeof v === 'string' && v.trim().length > 0) as Guard<string>,
		/** Checks if a value is an empty string. */
		empty: (v => typeof v === 'string' && v.trim().length === 0) as Guard<string>,
		/** Checks if a value is an email address. */
		email: (v => typeof v === 'string' && RGX.email.test(v)) as Guard<string>,
		/** Checks if a value is a hex color. */
		hexColor: (v => typeof v === 'string' && RGX.hex.test(v)) as Guard<string>,
		/** Checks if a value is a URL. */
		url: (v => typeof v === 'string' && RGX.url.test(v)) as Guard<string>,
		/** Checks if a value is an alphanumeric string. */
		alphanumeric: Object.assign((v => typeof v === 'string' && RGX.alphanumeric.base.test(v)) as Guard<string>, {
			/** Checks if a value is an alphanumeric string with spaces. */
			withSpaces: (v => typeof v === 'string' && RGX.alphanumeric.withSpaces.test(v)) as Guard<string>,
		}),
	}),
	/**
	 * Checks if a value is a number.
	 * @param value The value to check.
	 * @returns True if the value is a number, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = 123;
	 * if (is.number(value)) {
	 *   // value is now typed as number
	 * }
	 * ```
	 */
	number: Object.assign((v => typeof v === 'number' && Number.isFinite(v)) as Guard<number>, {
		/** Checks if a value is greater than a given number. */
		gt: (n: number): Guard<number> => (v => is.number(v) && v > n) as Guard<number>,
		/** Checks if a value is greater than or equal to a given number. */
		gte: (n: number): Guard<number> => (v => is.number(v) && v >= n) as Guard<number>,
		/** Checks if a value is less than a given number. */
		lt: (n: number): Guard<number> => (v => is.number(v) && v < n) as Guard<number>,
		/** Checks if a value is less than or equal to a given number. */
		lte: (n: number): Guard<number> => (v => is.number(v) && v <= n) as Guard<number>,
		/** Checks if a value is between two given numbers. */
		between: (min: number, max: number): Guard<number> =>
			(v => is.number(v) && v >= min && v <= max) as Guard<number>,
		/** Checks if a value is a positive number. */
		positive: (v => is.number(v) && v > 0) as Guard<number>,
		/** Checks if a value is a negative number. */
		negative: (v => is.number(v) && v < 0) as Guard<number>,
		/** Checks if a value is an even number. */
		even: (v => is.number(v) && v % 2 === 0) as Guard<number>,
		/** Checks if a value is an odd number. */
		odd: (v => is.number(v) && v % 2 !== 0) as Guard<number>,
		/** Checks if a value is an integer. */
		integer: (v => is.number(v) && Number.isInteger(v)) as Guard<number>,
		/** Checks if a value is a float. */
		float: (v => is.number(v) && !Number.isInteger(v)) as Guard<number>,
	}),
	/**
	 * Checks if a value is a boolean.
	 * @param value The value to check.
	 * @returns True if the value is a boolean, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = true;
	 * if (is.boolean(value)) {
	 *   // value is now typed as boolean
	 * }
	 * ```
	 */
	boolean: (v => typeof v === 'boolean') as Guard<boolean>,
	/**
	 * Checks if a value is a symbol.
	 * @param value The value to check.
	 * @returns True if the value is a symbol, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = Symbol('test');
	 * if (is.symbol(value)) {
	 *   // value is now typed as symbol
	 * }
	 * ```
	 */
	symbol: (v => typeof v === 'symbol') as Guard<symbol>,
	/**
	 * Checks if a value is a bigint.
	 * @param value The value to check.
	 * @returns True if the value is a bigint, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = 123n;
	 * if (is.bigint(value)) {
	 *   // value is now typed as bigint
	 * }
	 * ```
	 */
	bigint: (v => typeof v === 'bigint') as Guard<bigint>,
	/**
	 * Checks if a value is undefined.
	 * @param value The value to check.
	 * @returns True if the value is undefined, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = undefined;
	 * if (is.undefined(value)) {
	 *   // value is now typed as undefined
	 * }
	 * ```
	 */
	undefined: (v => v === undefined) as Guard<undefined>,
	/**
	 * Checks if a value is null.
	 * @param value The value to check.
	 * @returns True if the value is null, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = null;
	 * if (is.null(value)) {
	 *   // value is now typed as null
	 * }
	 * ```
	 */
	null: (v => v === null) as Guard<null>,
	/**
	 * Checks if a value is null or undefined.
	 * @param value The value to check.
	 * @returns True if the value is null or undefined, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = null;
	 * if (is.nil(value)) {
	 *   // value is now typed as null | undefined
	 * }
	 * ```
	 */
	nil: (v => v == null) as Guard<null | undefined>,
	/**
	 * Checks if a value is a function.
	 * @param value The value to check.
	 * @returns True if the value is a function, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = () => {};
	 * if (is.function(value)) {
	 *   // value is now typed as Function
	 * }
	 * ```
	 */
	function: (v => typeof v === 'function') as Guard<Function>,

	/**
	 * Checks if a value is an array.
	 * @param value The value to check.
	 * @returns True if the value is an array, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = [1, 2, 3];
	 * if (is.array()(value)) {
	 *   // value is now typed as any[]
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the inner type of an array
	 * const value: unknown = [1, 2, 3];
	 * if (is.array(is.number)(value)) {
	 *   // value is now typed as number[]
	 * }
	 * ```
	 */
	array: Object.assign(
		<T>(inner?: Guard<T>): Guard<T[]> => (v => Array.isArray(v) && (!inner || v.every(inner))) as Guard<T[]>,
		{
			/** Checks if an array has a minimum length. */
			min: (n: number) => (v: any[]) => v.length >= n,
			/** Checks if an array has a maximum length. */
			max: (n: number) => (v: any[]) => v.length <= n,
			/** Checks if an array has a specific length. */
			size: (n: number) => (v: any[]) => v.length === n,
			/** Checks if an array is not empty. */
			nonEmpty: (v: any[]) => v.length > 0,
			/** Checks if an array is empty. */
			empty: (v: any[]) => v.length === 0,
			/** Checks if an array contains only unique values. */
			unique: (v: any[]) => new Set(v).size === v.length,
			/** Checks if an array includes a specific item. */
			includes: (v: any[]) => (item: any) => v.includes(item),
			/** Checks if an array excludes a specific item. */
			excludes: (v: any[]) => (item: any) => !v.includes(item),
			/** Checks if an array includes all specified items. */
			includesAll: (v: any[]) => (items: any[]) => items.every(item => v.includes(item)),
			/** Checks if an array includes any of the specified items. */
			includesAny: (v: any[]) => (items: any[]) => items.some(item => v.includes(item)),
			/** Checks if an array includes none of the specified items. */
			includesNone: (v: any[]) => (items: any[]) => items.every(item => !v.includes(item)),
			/** Checks if an array includes only the specified items. */
			includesOnly: (v: any[]) => (items: any[]) => v.every(item => items.includes(item)),
		}
	),
	/**
	 * Checks if a value is an object.
	 * @param value The value to check.
	 * @returns True if the value is an object, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.object()(value)) {
	 *   // value is now typed as Record<string, unknown>
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of an object
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.object({ a: is.number, b: is.number })(value)) {
	 *   // value is now typed as { a: number, b: number }
	 * }
	 * ```
	 */
	object: <T extends object>(shape?: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			if (!shape) return true;
			return Object.entries(shape).every(([k, g]) => (g as any)((v as any)[k]));
		}) as Guard<T>,
	/**
	 * Checks if a value is a partial object.
	 * @param value The value to check.
	 * @returns True if the value is a partial object, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.partial()(value)) {
	 *   // value is now typed as Partial<Record<string, unknown>>
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a partial object
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.partial({ a: is.number, b: is.number })(value)) {
	 *   // value is now typed as { a: number, b: number }
	 * }
	 * ```
	 */
	partial: <T extends object>(shape: { [K in keyof T]: Guard<T[K]> }): Guard<Partial<T>> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			return Object.entries(shape).every(([k, g]) => (v as any)[k] === undefined || (g as any)((v as any)[k]));
		}) as Guard<Partial<T>>,
	/**
	 * Checks if a value is a record.
	 * @param value The value to check.
	 * @returns True if the value is a record, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.record(is.string, is.number)(value)) {
	 *   // value is now typed as Record<string, number>
	 * }
	 * ```
	 */
	record: <K extends string | number | symbol, V>(keyGuard: Guard<K>, valGuard: Guard<V>): Guard<Record<K, V>> =>
		(v => {
			if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
			return Object.entries(v).every(([k, val]) => keyGuard(k) && valGuard(val));
		}) as Guard<Record<K, V>>,
	/**
	 * Checks if a value is a tuple.
	 * @param value The value to check.
	 * @returns True if the value is a tuple, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = [1, 2, 3];
	 * if (is.tuple(is.number, is.number, is.number)(value)) {
	 *   // value is now typed as [number, number, number]
	 * }
	 * ```
	 */
	tuple: <T extends any[]>(...guards: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		(v => {
			if (!Array.isArray(v) || v.length !== guards.length) return false;
			return v.every((val, idx) => (guards[idx] as any)(val));
		}) as Guard<T>,
	/**
	 * Checks if a value is one of the specified types.
	 * @param value The value to check.
	 * @returns True if the value is one of the specified types, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 1;
	 * if (is.oneOf(is.string, is.number)(value)) {
	 *   // value is now typed as string | number
	 * }
	 * ```
	 */
	oneOf: <T extends Guard<any>[]>(...guards: T): Guard<GuardType<T[number]>> =>
		((v: unknown) => guards.some(g => g(v))) as any,
	/**
	 * Checks if a value is all of the specified types.
	 * @param value The value to check.
	 * @returns True if the value is all of the specified types, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 1;
	 * if (is.allOf(is.string, is.number)(value)) {
	 *   // value is now typed as string | number
	 * }
	 * ```
	 */
	allOf: <T>(...guards: Guard<any>[]): Guard<T> => ((v: unknown) => guards.every(g => g(v))) as any,
	/**
	 * Checks if a value is a date.
	 * @param value The value to check.
	 * @returns True if the value is a date, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = new Date();
	 * if (is.date(value)) {
	 *   // value is now typed as Date
	 * }
	 * ```
	 */
	date: (v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime()),
	/**
	 * Checks if a value is an Ok result.
	 * @param value The value to check.
	 * @returns True if the value is an Ok result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.ok(is.number)(value)) {
	 *   // value is now typed as Ok<number> (i.e. { ok: true, value: number, ...methods })
	 * }
	 * ```
	 */
	ok:
		<T = any>(inner?: Guard<T>): Guard<Ok<T>> =>
		(v: any): v is Ok<T> =>
			!!v && v.ok === true && (!inner || inner(v.value)),

	/**
	 * Checks if a value is an Err result.
	 * @param value The value to check.
	 * @returns True if the value is an Err result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: false, error: 'error' };
	 * if (is.err(is.string)(value)) {
	 *   // value is now typed as Err<string> (i.e. { ok: false, error: string, ...methods })
	 * }
	 * ```
	 */
	err:
		<E = any>(inner?: Guard<E>): Guard<Err<E>> =>
		(v: any): v is Err<E> =>
			!!v && v.ok === false && (!inner || inner(v.error)),

	/**
	 * Checks if a value is a Result.
	 * @param value The value to check.
	 * @returns True if the value is a Result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.result(is.string, is.number)(value)) {
	 *   // value is now typed as Result<number, string> (i.e. { ok: true, value: number, ...methods } | { ok: false, error: string, ...methods })
	 * }
	 * ```
	 */
	result: <T, E>(okG?: Guard<T>, errG?: Guard<E>): Guard<Result<T, E>> =>
		((v: unknown) => is.ok(okG)(v) || is.err(errG)(v)) as Guard<Result<T, E>>,

	/**
	 * Checks if a value is a Some.
	 * @param value The value to check.
	 * @returns True if the value is a Some, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.some(is.number)(value)) {
	 *   // value is now typed as Some<number> (i.e. { ok: true, value: number, ...methods })
	 * }
	 * ```
	 */
	some:
		<T = any>(inner?: Guard<T>): Guard<Some<T>> =>
		(v: any): v is Some<T> =>
			is.ok()(v) && v.value != null && (!inner || inner(v.value)),

	/**
	 * Checks if a value is a None.
	 * @param value The value to check.
	 * @returns True if the value is a None, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: false, error: undefined };
	 * if (is.none()(value)) {
	 *   // value is now typed as None (i.e. { ok: false, error: undefined, ...methods })
	 * }
	 * ```
	 */
	none:
		(): Guard<None> =>
		(v: any): v is None =>
			is.err()(v) && v.error === undefined,

	/**
	 * Checks if a value is an Option.
	 * @param value The value to check.
	 * @returns True if the value is an Option, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.option(is.number)(value)) {
	 *   // value is now typed as Option<number> (i.e. { ok: true, value: number, ...methods } | { ok: false, error: undefined, ...methods })
	 * }
	 * ```
	 */
	option: <T>(inner?: Guard<T>): Guard<Option<T>> =>
		((v: unknown) => is.some(inner)(v) || is.none()(v)) as Guard<Option<T>>,

	/**
	 * Checks if a value is a tagged error using a tag or error factory.
	 * @param value The value to check.
	 * @returns True if the value is a tagged error, false otherwise.
	 *
	 * @example Using a string tag
	 * ```ts
	 * import { is } from 'chas/guard';
	 * const value: unknown = { _tag: 'UserError', message: 'error' };
	 * if (is.tagged('UserError')(value)) {
	 *   // value is now typed as { _tag: 'UserError', message: string, ...methods }
	 * }
	 * ```
	 *
	 * @example Using an error factory
	 * ```ts
	 * import { is } from 'chas/guard';
	 * const value: unknown = { _tag: 'UserError', message: 'error' };
	 * if (is.tagged(AppError.NotFound)(value)) {
	 *   // value is now typed as { _tag: 'UserError', message: string, ...methods }
	 * }
	 * ```
	 */
	tagged: (tagOrFactory: string | ErrorFactory, inner?: Guard<any>): Guard<any> => {
		return (v: any): v is any => {
			if (typeof tagOrFactory !== 'string' && 'is' in tagOrFactory) {
				return tagOrFactory.is(v) && (!inner || inner(v));
			}
			const matchesTag = !!v && typeof v === 'object' && v._tag === tagOrFactory;
			return matchesTag && (!inner || inner(v));
		};
	},

	/**
	 * Checks if a value is not a specific type.
	 * @param value The value to check.
	 * @returns True if the value is not a specific type, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 1;
	 * if (is.not(is.string)(value)) {
	 *   // value is not a string
	 * }
	 * ```
	 */
	not:
		<T>(guard: Guard<T>): Guard<any> =>
		(v: unknown): v is any =>
			!guard(v),

	/**
	 * Checks if a value matches a schema.
	 * @param schema The schema to check against, must have a safeParse or parse method (e.g. Zod schema or custom schema from chas.defineSchemas).
	 * @returns True if the value matches the schema, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is, defineSchemas } from 'chas/guard';
	 * import { z } from 'zod';
	 *
	 * const schema = z.object({ name: z.string(), age: z.number() });
	 * const value: unknown = { name: 'John', age: 30 };
	 *
	 * if (is.schema(schema)(value)) {
	 *   // value is now typed as { name: string, age: number }
	 * }
	 *
	 * const schemas = defineSchemas({
	 *   User: {
	 *     name: is.string,
	 *     age: is.number,
	 *   },
	 * });
	 *
	 * const value: unknown = { name: 'John', age: 30 };
	 * if (is.schema(schemas.User)(value)) {
	 *   // value is now typed as { name: string, age: number }
	 * }
	 * ```
	 */
	schema: <T>(s: { safeParse?: (v: unknown) => any; parse?: (v: unknown) => any }): Guard<T> =>
		(v => s.safeParse?.(v).success || s.parse?.(v).success) as Guard<T>,

	/**
	 * Checks if a value is a specific literal value.
	 * @param value The value to check.
	 * @returns True if the value is a specific literal value, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 'hello';
	 * if (is.literal('hello')(value)) {
	 *   // value is now typed as 'hello'
	 * }
	 * ```
	 */
	literal:
		<T extends string | number | boolean>(val: T): Guard<T> =>
		(v: unknown): v is T =>
			v === val,

	/**
	 * Checks if a value is a union of types.
	 * @param value The value to check.
	 * @returns True if the value is a union of types, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 'hello';
	 * if (is.union('hello', 'world')(value)) {
	 *   // value is now typed as 'hello' | 'world'
	 * }
	 * ```
	 */
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
 *   console.log(value.name); // value is now typed as TaggedErr with _tag: 'UserError'
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

/**
 * Infer the type of a guard schema.
 *
 * @example
 * ```ts
 * const schema = defineSchemas({
 *   User: {
 *     name: is.string,
 *     age: is.number,
 *   },
 * });
 *
 * type User = InferSchema<typeof schema.User>;
 * // User is now { name: string; age: number }
 * ```
 */
export type InferSchema<T> = T extends { parse: (value: unknown) => Result<infer U, any> }
	? U
	: T extends Record<string, Guard<any>>
		? { [K in keyof T]: T[K] extends Guard<infer V> ? V : never }
		: never;

/**
 * Defines a set of schemas for use with the `is` guard.
 *
 * @param schemas An object containing the schemas to define.
 * @returns An object containing the defined schemas.
 *
 * @example
 * ```ts
 * const schemas = defineSchemas({
 *   User: {
 *     name: is.string,
 *     age: is.number,
 *   },
 * });
 *
 * type User = InferSchema<typeof schemas.User>;
 * // User is now { name: string; age: number }
 * ```
 */
export function defineSchemas<S extends Record<string, Record<string, Guard<any>>>>(
	schemas: S
): {
	readonly [K in keyof S]: {
		/**
		 * Synchronously parses a value against the schema.
		 * @param value The value to parse.
		 * @returns A Result containing the parsed value or an array of errors.
		 */
		parse: (value: unknown) => Result<InferSchema<S[K]>, string[]>;
		/**
		 * Synchronously 'asserts' that a value matches the schema (throws if not).
		 *
		 * We use `value is SchemaInfer<S[K]>` instead of `asserts value is SchemaInfer<S[K]>`
		 * because `asserts` does not work with inferred types.
		 *
		 * @param value The value to assert.
		 * @throws An error if the value does not match the schema.
		 */
		assert: (value: unknown) => value is InferSchema<S[K]>;
	};
} {
	return Object.fromEntries(
		Object.entries(schemas).map(([schemaName, schema]) => {
			return [
				schemaName,
				{
					parse: (value: unknown) => {
						if (typeof value !== 'object' || value === null || Array.isArray(value)) {
							return err([`${schemaName}: Expected an object but got ${typeof value}`]);
						}
						const errors: string[] = [];
						for (const [key, guard] of Object.entries(schema)) {
							const propertyValue = (value as any)[key];
							if (!guard(propertyValue)) {
								errors.push(
									`${schemaName}.${key} failed validation: expected ${guard.toString()} but got ${JSON.stringify(propertyValue)}`
								);
							}
						}
						return errors.length === 0 ? ok(value as any) : err(errors);
					},
					assert: (value: unknown) => {
						if (typeof value !== 'object' || value === null || Array.isArray(value)) {
							throw new Error(`${schemaName}: Expected an object but got ${typeof value}`);
						}
						for (const [key, guard] of Object.entries(schema)) {
							const propertyValue = (value as any)[key];
							if (!guard(propertyValue)) {
								throw new Error(
									`${schemaName}.${key} failed validation: expected ${guard.toString()} but got ${JSON.stringify(propertyValue)}`
								);
							}
						}
						return true;
					},
				},
			];
		})
	) as any;
}

/**
 * Also a namespace for guard utilities, merges with the `Guard` type definition.
 */
export const Guard = {
	toValidator: guardToValidator,
	toTask: guardToTask,
	validate,
	assert,
	ensure,
	is,
	defineSchemas,
};
