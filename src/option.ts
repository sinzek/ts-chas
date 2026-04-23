import { ok, err, okAsync, errAsync, ResultAsync } from './result/result.js';

import { fromSafePromise } from './result/result-helpers.js';
import type { Ok, Err, ExtractOkValue } from './result/shared.js';

import { type NonVoid } from './utils.js';
import type { Guard } from './guard/index.js';
import type { ResultMethods } from './result/result.js';

/**
 * Represents the "None" variant of an `Option` (equivalent to `Err<never>`)
 *
 * @example Creating a None
 * ```ts
 * import { none } from 'chas/option';
 * const x = none();
 * expect(x.isNone()).toBe(true);
 * ```
 */
export type None = Err<never> &
	ResultMethods<never, never> & {
		/**
		 * @deprecated You generally don't need to unwrap an Option. Since it's None, it will always throw undefined.
		 *
		 * Unwrapping an option is an anti-pattern, and can lead to the following:
		 * - Loss of type safety
		 * - Logical fragility
		 *
		 * @example
		 * ```ts
		 * const x = none();
		 * x.unwrap(); // will always throw undefined
		 * ```
		 */
		unwrap(): never;
	};

/**
 * Represents the "Some" variant of an `Option` (equivalent to `Ok<NonNullable<T>>`)
 *
 * @example Creating a Some
 * ```ts
 * import { some } from 'chas/option';
 * const x = some(5);
 * expect(x.isSome()).toBe(true);
 * const val = x.value; // Accessible directly!
 * ```
 */
export type Some<T> = Ok<NonVoid<T>> &
	ResultMethods<NonVoid<T>, never> & {
		/**
		 * @deprecated You generally don't need to unwrap an Option. If you do, check if it's Some first, then access .value.
		 *
		 * Unwrapping an option is an anti-pattern, and can lead to the following:
		 * - Runtime errors (if an option is None, it will throw undefined)
		 * - Loss of type safety
		 * - Logical fragility
		 *
		 * @example
		 * ```ts
		 * const x = some(5);
		 * expect(x.unwrap()).toBe(5);
		 * ```
		 *
		 * @example
		 * ```ts
		 * const x = none();
		 * expect(x.unwrap()).toThrow();
		 * ```
		 */
		unwrap(): NonVoid<T>;
	};

/**
 * Represents an optional value: every `Option` is either `Some` and contains a value,
 * or `None`, and does not.
 *
 * Implementation-wise, `Option<T>` is effectively an alias for `Result<NonNullable<T>, never>`.
 *
 * @example Creating an Option from a nullable value
 * ```ts
 * import { nullable } from 'chas/option';
 * const x = nullable(5);
 * expect(x.isSome()).toBe(true);
 * const val = x.value; // Accessible directly!
 * ```
 */
export type Option<T> = Some<T> | None;

/**
 * Represents an optional value that evaluates asynchronously.
 */
export type OptionAsync<T> = ResultAsync<T, never>;

/**
 * Creates an `Option` containing a value.
 *
 * @param value The value to wrap in `Some` (must not be `null` or `undefined`).
 * @returns A `Some` variant which has immediate access to `.value`.
 *
 * @example
 * ```ts
 * const x = some(5);
 * expect(x.isSome()).toBe(true);
 * const val = x.value; // Accessible directly!
 * ```
 */
export const some = <T>(value: NonVoid<T>): Some<T> => ok(value) as unknown as Some<T>;

/**
 * Creates an `Option` representing no value.
 *
 * @returns A `None` variant.
 *
 * @example
 * ```ts
 * const x = none();
 * expect(x.isNone()).toBe(true);
 * ```
 */
export const none = (): None => err(undefined as never) as None;

/**
 * Creates an `OptionAsync` containing a value or a promise that resolves to a value.
 *
 * @param value The value or promise to wrap in `SomeAsync`.
 * @returns An `OptionAsync` containing the value.
 */
export const someAsync = <T>(value: NonVoid<T> | Promise<NonVoid<T>>): OptionAsync<T> =>
	okAsync(value) as OptionAsync<T>;

/**
 * Creates an `OptionAsync` representing no value.
 *
 * @returns An `OptionAsync` with no value.
 */
export const noneAsync = <T = never>(): OptionAsync<T> => errAsync(undefined as never);

/**
 * Creates an `Option` from a value that might be nullish.
 *
 * If the value is nullish, returns `None`. Otherwise, returns `Some(value)`.
 *
 * @param value The nullable value.
 * @returns `Some` if the value is non-nullable, otherwise `None`.
 *
 * @example
 * ```ts
 * const x = nullable(null); // none() -> Option<never>
 * const y = nullable(5);    // some(5) -> Option<number>
 * ```
 */
export const nullable = <T>(value: T): Option<T> => {
	return value != null ? some(value as NonVoid<T>) : none();
};

/**
 * Creates an `OptionAsync` from a value that might be nullish or a promise that resolves to a value that might be nullish.
 *
 * If the value is nullish, returns `NoneAsync`. Otherwise, returns `SomeAsync(value)`.
 *
 * @param value The nullable value or promise.
 * @returns `SomeAsync` if the value is non-nullish, otherwise `NoneAsync`.
 *
 * @example
 * ```ts
 * const x = nullableAsync(null); // noneAsync() -> OptionAsync<never>
 * const y = nullableAsync(5);    // someAsync(5) -> OptionAsync<number>
 * ```
 */
export const nullableAsync = <T>(value: T | Promise<T>): OptionAsync<T> => {
	return fromSafePromise(Promise.resolve(value).then(v => nullable(v))) as OptionAsync<T>;
};

/**
 * Creates an `Option` from a function that might throw an error or return a nullish value.
 *
 * If the function throws an error or returns a nullish value, returns `None`. Otherwise, returns `Some(value)`.
 *
 * @param fn The function to call.
 * @returns `Some` if the function returns a non-nullish value, otherwise `None`.
 *
 * @example
 * ```ts
 * const x = tryNull(() => 5); // some(5) -> Option<number>
 * const y = tryNull(() => null); // none() -> Option<never>
 * ```
 */
export const tryNullable = <T>(fn: () => T): Option<T> => {
	try {
		const res = fn();
		return res != null ? some(res as NonVoid<T>) : none();
	} catch {
		return none();
	}
};

/**
 * Creates an `OptionAsync` from an async function that might throw an error or return a nullish value.
 *
 * If the function throws an error or returns a nullish value, returns `NoneAsync`. Otherwise, returns `SomeAsync(value)`.
 *
 * @param fn The async function to call.
 * @returns `SomeAsync` if the function resolves to a non-nullish value, otherwise `NoneAsync`.
 *
 * @example
 * ```ts
 * const x = tryNullableAsync(() => Promise.resolve(5)); // someAsync(5) -> OptionAsync<number>
 * const y = tryNullableAsync(() => Promise.resolve(null)); // noneAsync() -> OptionAsync<never>
 * ```
 */
export const tryNullableAsync = <T>(fn: () => Promise<T>): OptionAsync<T> => {
	return fromSafePromise(
		Promise.resolve()
			.then(() => fn())
			.then(res => nullable(res))
			.catch(() => none())
	) as OptionAsync<T>;
};

/**
 * Takes an iterable of Options and returns an Option of an array of the values.
 * If any of the Options are None, returns None.
 * @param results An iterable of Options.
 * @returns `Some` if all Options are Some, otherwise `None`.
 *
 * @example
 * ```ts
 * const x = allNullable([some(1), some(2), some(3)]);
 * expect(x).toEqual(some([1, 2, 3]));
 * ```
 *
 * @example
 * ```ts
 * const x = allNullable([some(1), none(), some(3)]);
 * expect(x).toEqual(none());
 * ```
 */
export function allNullable<T>(results: Iterable<Option<T>>): Option<T[]>;
export function allNullable<T extends readonly Option<any>[] | []>(
	values: T
): Option<{ -readonly [P in keyof T]: ExtractOkValue<T[P]> }>;
export function allNullable(results: Iterable<Option<any>>): Option<any[]> {
	const values: any[] = [];
	for (const result of results) {
		if (result.isNone()) {
			return none();
		}
		values.push(result.value);
	}
	return some(values);
}

/**
 * Takes an iterable of Options and returns an OptionAsync of an array of the values.
 * If any of the Options are None, returns NoneAsync.
 * @param promises An iterable of Options.
 * @returns `SomeAsync` if all Options are Some, otherwise `NoneAsync`.
 *
 * @example
 * ```ts
 * const x = await allNullableAsync([someAsync(1), someAsync(2), someAsync(3)]).unwrap();
 * expect(x).toEqual([1, 2, 3]);
 * ```
 *
 * @example
 * ```ts
 * const x = await allNullableAsync([someAsync(1), noneAsync(), someAsync(3)]).unwrap();
 * expect(x).toEqual(None);
 * ```
 */
export function allNullableAsync<T extends readonly PromiseLike<Option<any>>[] | []>(
	promises: T
): OptionAsync<{ -readonly [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractOkValue<R> : never }>;
export function allNullableAsync<T>(promises: Iterable<PromiseLike<Option<T>>>): OptionAsync<T[]>;
export function allNullableAsync(promises: Iterable<PromiseLike<Option<any>>>): OptionAsync<any> {
	return new ResultAsync(
		Promise.all(promises).then(results => {
			const values: any[] = [];
			for (const result of results) {
				if (result.isNone()) {
					return none();
				}
				values.push(result.value);
			}
			return some(values);
		})
	);
}

/**
 * Takes an object of Options and returns an Option of an object of the values.
 * If any of the Options are None, returns None.
 * @param rec An object of Options.
 * @returns `Some` if all Options are Some, otherwise `None`.
 *
 * @example
 * ```ts
 * const x = shapeNullable({ a: some(1), b: some(2), c: some(3) });
 * expect(x).toEqual(some({ a: 1, b: 2, c: 3 }));
 * ```
 *
 * @example
 * ```ts
 * const x = shapeNullable({ a: some(1), b: none(), c: some(3) });
 * expect(x).toEqual(none());
 * ```
 */
export function shapeNullable<T extends Record<string, Option<any>>>(
	rec: T
): Option<{
	[K in keyof T]: T[K] extends Option<infer U> ? U : never;
}> {
	const keys = Object.keys(rec);
	const someOutput: any = {};

	for (const key of keys) {
		const res = rec[key]!;
		if (res.isNone()) {
			return none();
		}
		someOutput[key] = res.value;
	}

	return some(someOutput);
}

/**
 * Takes an object of OptionAsyncs (or PromiseLike<Option>) and returns an OptionAsync of an object of the values.
 * If any of the Options resolve to None, returns NoneAsync.
 *
 * @param rec An object of OptionAsyncs or PromiseLike<Option>.
 * @returns `SomeAsync` if all Options are Some, otherwise `NoneAsync`.
 *
 * @example
 * ```ts
 * const x = await shapeNullableAsync({ a: someAsync(1), b: someAsync(2) });
 * // Some({ a: 1, b: 2 })
 * ```
 *
 * @example
 * ```ts
 * const x = await shapeNullableAsync({ a: someAsync(1), b: noneAsync() });
 * // None
 * ```
 */
export const shapeNullableAsync = <TRec extends Record<string, OptionAsync<any> | PromiseLike<Option<any>>>>(
	rec: TRec
): OptionAsync<{
	[K in keyof TRec]: TRec[K] extends PromiseLike<Option<infer U>> ? U : never;
}> => {
	const keys = Object.keys(rec);
	const promises = keys.map(key => rec[key]);

	return new ResultAsync(
		Promise.all(promises).then(results => {
			const someOutput: any = {};

			for (let i = 0; i < results.length; i++) {
				const res = results[i]!;
				if (res.isNone()) {
					return none();
				}
				someOutput[keys[i]!] = (res as Some<any>).value;
			}

			return some(someOutput);
		})
	);
};

/**
 * Wraps a synchronous function that might throw, returning a new function that returns an `Option`.
 * If the function returns a non-nullish value, returns `Some(value)`. If it throws or returns nullish, returns `None`.
 *
 * @param fn The function to wrap.
 * @returns A new function returning `Option<T>`.
 *
 * @example
 * ```ts
 * const safeParse = wrapNullable(JSON.parse);
 * safeParse('{"a": 1}'); // Some({ a: 1 })
 * safeParse('invalid');   // None
 * ```
 */
export const wrapNullable = <Args extends unknown[], T>(fn: (...args: Args) => T): ((...args: Args) => Option<T>) => {
	return (...args: Args): Option<T> => {
		try {
			const res = fn(...args);
			return res != null ? some(res as NonVoid<T>) : none();
		} catch {
			return none();
		}
	};
};

/**
 * Wraps an asynchronous function that might throw or reject, returning a new function that returns an `OptionAsync`.
 * If the function resolves to a non-nullish value, returns `SomeAsync(value)`. If it throws, rejects, or resolves to nullish, returns `NoneAsync`.
 *
 * @param fn The async function to wrap.
 * @returns A new function returning `OptionAsync<T>`.
 *
 * @example
 * ```ts
 * const safeFetch = wrapNullableAsync(async (url: string) => {
 *     const res = await fetch(url);
 *     return res.ok ? await res.json() : null;
 * });
 * await safeFetch('/api/user'); // Some({...}) or None
 * ```
 */
export const wrapNullableAsync = <Args extends unknown[], T>(
	fn: (...args: Args) => Promise<T>
): ((...args: Args) => OptionAsync<T>) => {
	return (...args: Args): OptionAsync<T> => {
		return new ResultAsync(
			fn(...args)
				.then(res => (res != null ? some(res as NonVoid<T>) : none()) as Option<T>)
				.catch(() => none())
		);
	};
};

/**
 * Creates an `Option` from a value based on a type guard.
 *
 * If the guard returns `true`, returns `Some(value as T)`.
 * Otherwise, returns `None`.
 *
 * @param value The value to check.
 * @param guard The type guard to use.
 * @returns A `Some` if the guard passes, otherwise `None`.
 *
 * @example
 * ```ts
 * const res = chas.optionFromGuard(val, is.string);
 * ```
 */
export const optionFromGuard = <T>(value: unknown, guard: Guard<T>): Option<T> => {
	return guard(value) ? (some(value as any) as Some<T>) : none();
};
