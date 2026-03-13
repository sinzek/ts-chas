/* eslint-disable @typescript-eslint/no-explicit-any */
import { ok, err, okAsync, errAsync, type ResultAsync, type Ok, type Err, type ResultMethods } from './result.js';
import { type NonVoid } from './utils.js';
import { type Guard } from './is.js';

/**
 * Represents the "None" variant of an `Option` (equivalent to `Err<never>`)
 */
export type None = Err<never> &
	Omit<ResultMethods<never, never>, 'unwrap'> & {
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
 */
export type Some<T> = Ok<NonVoid<T>> &
	Omit<ResultMethods<NonVoid<T>, never>, 'unwrap'> & {
		value: NonVoid<T>;

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
export const some = <T extends NonNullable<unknown>>(value: T): Some<T> => ok(value) as unknown as Some<T>;

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
export const someAsync = <T extends NonVoid<unknown>>(value: T | Promise<T>): OptionAsync<T> =>
	okAsync(value) as OptionAsync<T>;

/**
 * Creates an `OptionAsync` representing no value.
 *
 * @returns An `OptionAsync` with no value.
 */
export const noneAsync = <T = never>(): OptionAsync<T> => errAsync(undefined as never) as OptionAsync<T>;

/**
 * Creates an `Option` from a value that might be `null` or `undefined`.
 *
 * If the value is `null` or `undefined`, returns `None`. Otherwise, returns `Some(value)`.
 *
 * @param value The nullable value.
 * @returns `Some` if the value is non-nullable, otherwise `None`.
 *
 * @example
 * ```ts
 * const x = fromNullable(null); // none() -> Option<never>
 * const y = fromNullable(5);    // some(5) -> Option<number>
 * ```
 */
export const fromNullable = <T>(value: T): Option<T> => {
	return value === null || value === undefined ? none() : (some(value) as Some<T>);
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
