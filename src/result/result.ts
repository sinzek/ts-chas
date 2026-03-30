import type { None, Option, OptionAsync, Some } from '../option.js';
import { GlobalErrs, type TaggedErr } from '../tagged-errs.js';
import type { CatchTag, CatchTarget, ExtractErrorFromTarget, NonVoid } from '../utils.js';
import type { Err, Ok } from './shared.js';

// ==== RESULT TYPE ====

/**
 * Represents either a success (`Ok<T>`) or a failure (`Err<E>`).
 * Both branches provide the extensive list of functional methods available in `ResultMethods`.
 */
export type Result<T, E> = (Ok<T> & ResultMethods<T, E>) | (Err<E> & ResultMethods<T, E>);

// ==== RESULT FACTORIES ====

/**
 * Creates a `Result` from a successful value.
 *
 * @param value The value to wrap in an `Ok`.
 * @returns A `Result` indicating success and containing the value.
 *
 * @example
 * ```ts
 * const result = chas.ok(42);
 * // result is Ok(42)
 * ```
 */
export const ok = <T, E = never>(value: T): Result<T, E> => {
	const result = Object.create(ResultMethodsProto);
	result.ok = true;
	result.value = value;
	return result;
};

/**
 * Creates a `Result` from an error.
 *
 * @param error The error to wrap in an `Err`.
 * @returns A `Result` indicating failure and containing the error.
 *
 * @example
 * ```ts
 * const result = chas.err('Something went wrong');
 * // result is Err('Something went wrong')
 * ```
 */
export const err = <E = unknown, T = never>(error: E): Result<T, E> => {
	const result = Object.create(ResultMethodsProto);
	result.ok = false;
	result.error = error;
	return result;
};

/**
 * Creates a Result Async from a value or promise.
 *
 * @param value The value or promise to wrap in an `OkAsync`.
 * @returns A `ResultAsync` resolving to an `Ok` containing the value.
 *
 * @example
 * ```ts
 * const res = chas.okAsync(42);
 * const val = await res; // Ok(42)
 * ```
 */
export const okAsync = <T, E = never>(value: T | Promise<T>): ResultAsync<T, E> => {
	return new ResultAsync(Promise.resolve(value).then(v => ok(v)));
};

/**
 * Creates a ResultAsync from an error or promise.
 *
 * @param error The error or promise to wrap in an `ErrAsync`.
 * @returns A `ResultAsync` resolving to an `Err` containing the error.
 *
 * @example
 * ```ts
 * const res = chas.errAsync('error');
 * const val = await res; // Err('error')
 * ```
 */
export const errAsync = <E, T = never>(error: E | Promise<E>): ResultAsync<T, E> => {
	return new ResultAsync(Promise.resolve(error).then(e => err(e)));
};

// ==== RESULT METHODS ====

export interface ResultMethods<T, E> {
	/**
	 * Returns `true` if the result is an `Ok`.
	 *
	 * @returns `true` if the result is `Ok<T>`.
	 *
	 * @example
	 * ```ts
	 * const x = chas.ok(2);
	 * expect(x.isOk()).toBe(true);
	 *
	 * const y = chas.err('error');
	 * expect(y.isOk()).toBe(false);
	 * ```
	 */
	readonly isOk: () => this is Ok<T>;

	/**
	 * Returns `true` if the result is an `Err`.
	 *
	 * @returns `true` if the result is `Err<E>`.
	 *
	 * @example
	 * ```ts
	 * const x = chas.ok(2);
	 * expect(x.isErr()).toBe(false);
	 *
	 * const y = chas.err('error');
	 * expect(y.isErr()).toBe(true);
	 * ```
	 */
	readonly isErr: () => this is Err<E>;

	/**
	 * Returns `true` if the result is `Ok` and the value satisfies the predicate.
	 *
	 * @param predicate A function to test the `Ok` value.
	 * @returns `true` if `Ok<T>` and the predicate returns `true`, otherwise `false`.
	 *
	 * @example
	 * ```ts
	 * const x = chas.ok(2);
	 * expect(x.isOkAnd(v => v > 1)).toBe(true);
	 * expect(x.isOkAnd(v => v < 1)).toBe(false);
	 *
	 * const y = chas.err('error');
	 * expect(y.isOkAnd(v => v > 1)).toBe(false);
	 * ```
	 */
	readonly isOkAnd: (predicate: (value: T) => boolean) => this is Ok<T>;

	/**
	 * Returns `true` if the result is `Err` and the error satisfies the predicate.
	 *
	 * @param predicate A function to test the `Err` error.
	 * @returns `true` if `Err<E>` and the predicate returns `true`, otherwise `false`.
	 *
	 * @example
	 * ```ts
	 * const x = chas.err('error');
	 * expect(x.isErrAnd(e => e.length > 0)).toBe(true);
	 * expect(x.isErrAnd(e => e.length === 0)).toBe(false);
	 *
	 * const y = chas.ok(2);
	 * expect(y.isErrAnd(e => e.length > 0)).toBe(false);
	 * ```
	 */
	readonly isErrAnd: (predicate: (error: E) => boolean) => this is Err<E>;

	/**
	 * Maps a `Result<T, E>` to `Result<U, E>` by applying a function to a
	 * contained `Ok` value, leaving an `Err` value untouched.
	 *
	 * @param f The function to apply to the `Ok` value.
	 * @returns A new `Result` containing the mapped value or the original error.
	 *
	 * @example
	 * ```ts
	 * const r1 = chas.ok(5).map(v => v * 2);
	 * // r1 is Ok(10)
	 *
	 * const r2 = chas.err('error').map(v => v * 2);
	 * // r2 is Err('error')
	 * ```
	 */
	readonly map: <U>(f: (value: T) => U) => Result<U, E>;

	/**
	 * Same as map, except `f` must return a Promise and the return value is `ResultAsync`
	 * @param f The function to apply to the `Ok` value (must return a Promise)
	 * @returns A new `ResultAsync` containing the mapped value or the original error.
	 */
	readonly asyncMap: <U>(f: (value: T) => Promise<U>) => ResultAsync<U, E>;

	/**
	 * Maps a `Result<T, E>` to `Result<T, F>` by applying a function to a
	 * contained `Err` error, leaving an `Ok` value untouched.
	 *
	 * @param f The function to apply to the `Err` error.
	 * @returns A new `Result` containing the original value or the mapped error.
	 *
	 * @example
	 * ```ts
	 * const r1 = chas.err('error').mapErr(e => e.toUpperCase());
	 * // r1 is Err('ERROR')
	 *
	 * const r2 = chas.ok(2).mapErr(e => e.toUpperCase());
	 * // r2 is Ok(2)
	 * ```
	 */
	readonly mapErr: <F>(f: (error: E) => F) => Result<T, F>;

	/**
	 * Maps a `Result<T, E>` to `Result<U, F>` by applying a function to a
	 * contained `Ok` value, and a function to an `Err` value.
	 *
	 * @param onOk The function to apply to the `Ok` value.
	 * @param onErr The function to apply to the `Err` value.
	 * @returns A new `Result` containing the mapped value or the mapped error.
	 *
	 * @example
	 * ```ts
	 * const r1 = chas.ok(5).bimap(v => v * 2, e => e.toUpperCase());
	 * // r1 is Ok(10)
	 *
	 * const r2 = chas.err('error').bimap(v => v * 2, e => e.toUpperCase());
	 * // r2 is Err('ERROR')
	 * ```
	 */
	readonly bimap: <U, F>(onOk: (value: T) => U, onErr: (error: E) => F) => Result<U, F>;

	/**
	 * Returns the provided `defaultValue` (if `Err`), or applies a function to the
	 * contained value (if `Ok`).
	 *
	 * @param defaultValue The value to return if the result is an `Err`.
	 * @param f The function to apply to the `Ok` value.
	 * @returns The mapped value or the default value.
	 *
	 * @example
	 * ```ts
	 * const mapped1 = chas.ok(5).mapOr(100, v => v * 2);
	 * // mapped1 is 10
	 *
	 * const mapped2 = chas.err('error').mapOr(100, v => v * 2);
	 * // mapped2 is 100
	 * ```
	 */
	readonly mapOr: <U>(defaultValue: U, f: (value: T) => U) => U;

	/**
	 * Maps a `Result<T, E>` to `U` by applying fallback function `f` to a contained `Err` error,
	 * or function `g` to a contained `Ok` value.
	 *
	 * @param f The fallback function to apply to the `Err` error.
	 * @param g The function to apply to the `Ok` value.
	 * @returns The result of applying `g` to the value or `f` to the error.
	 *
	 * @example
	 * ```ts
	 * const mapped1 = chas.ok(5).mapOrElse(() => 100, v => v * 2);
	 * // mapped1 is 10
	 *
	 * const mapped2 = chas.err('error').mapOrElse(e => e.length, v => v * 2);
	 * // mapped2 is 5
	 * ```
	 */
	readonly mapOrElse: <U>(f: (error: E) => U, g: (value: T) => U) => U;

	/**
	 * Returns `other` if the result is `Ok`, otherwise returns the `Err` value of `this`.
	 *
	 * @param other The `Result` to return if `this` is `Ok`.
	 * @returns `other` if `this` is `Ok`, otherwise `this` casted appropriately.
	 *
	 * @example
	 * ```ts
	 * expect(chas.ok(1).and(chas.ok(2)).unwrap()).toBe(2);
	 * expect(chas.ok(1).and(chas.err('e')).unwrapErr()).toBe('e');
	 * expect(chas.err('e').and(chas.ok(1)).unwrapErr()).toBe('e');
	 * ```
	 */
	readonly and: <U, F = E>(other: Result<U, F>) => Result<U, E | F>;

	/**
	 * Returns `this` if it is `Ok`, otherwise returns the `other` Result.
	 *
	 * @param other The `Result` to return if `this` is `Err`.
	 * @returns `this` if it is `Ok`, otherwise `other`.
	 *
	 * @example
	 * ```ts
	 * expect(chas.ok(1).or(chas.ok(2)).unwrap()).toBe(1);
	 * expect(chas.err('e').or(chas.ok(2)).unwrap()).toBe(2);
	 * expect(chas.err('e1').or(chas.err('e2')).unwrapErr()).toBe('e2');
	 * ```
	 */
	readonly or: <T2 = T, F = E>(other: Result<T2, F>) => Result<T | T2, F>;

	/**
	 * Calls `f` if the result is `Ok`, otherwise returns the `Err` value of `this`.
	 *
	 * @param f The function to call with the `Ok` value, which must return a `Result`.
	 * @returns The resulting `Result` from `f`, or the original `Err`.
	 *
	 * @example
	 * ```ts
	 * const s1 = chas.ok(5).andThen(v => chas.ok(v * 2));
	 * // s1 is Ok(10)
	 *
	 * const s2 = chas.err('e').andThen(v => chas.ok(v * 2));
	 * // s2 is Err('e')
	 * ```
	 */
	readonly andThen: <U, F = E>(f: (value: T) => Result<U, F>) => Result<U, E | F>;

	/**
	 * Does the same thing as andThen, except `f` must return a ResultAsync. The returned value will be `ResultAsync`.
	 *
	 * @param f The function to call with the `Ok` value, which must return a `ResultAsync`.
	 * @returns The resulting `ResultAsync` from `f`, or the original `Err`.
	 */
	readonly asyncAndThen: <U, F = E>(f: (value: T) => ResultAsync<U, F>) => ResultAsync<U, E | F>;

	/**
	 * Calls `f` if the result is `Err`, otherwise returns the `Ok` value of `this`.
	 *
	 * @param f The function to call with the `Err` error, which must return a `Result`.
	 * @returns The resulting `Result` from `f`, or the original `Ok`.
	 *
	 * @example
	 * ```ts
	 * const s1 = chas.ok(5).orElse(e => chas.err(e + ' modified'));
	 * // s1 is Ok(5)
	 *
	 * const s2 = chas.err('e').orElse(e => chas.err(e + ' modified'));
	 * // s2 is Err('e modified')
	 * ```
	 */
	readonly orElse: <T2 = T, F = E>(f: (error: E) => Result<T2, F>) => Result<T | T2, F>;

	/**
	 * Unwraps a result, yielding the content of an `Ok`.
	 * Throws the contained error if the result is an `Err`.
	 *
	 * @returns The value inside the `Ok`.
	 * @throws The error inside the `Err`.
	 *
	 * @example
	 * ```ts
	 * const value = chas.ok(5).unwrap();
	 * // value is 5
	 *
	 * // chas.err('error').unwrap(); // Throws 'error'
	 * ```
	 */
	readonly unwrap: () => T;

	/**
	 * Unwraps a result, yielding the content of an `Err`.
	 * Throws an error (or a custom error if provided) if the result is an `Ok`.
	 *
	 * @param error Optional custom error to throw if the result is `Ok`.
	 * @returns The error inside the `Err`.
	 * @throws An error if it is an `Ok`.
	 *
	 * @example
	 * ```ts
	 * const errStr = chas.err('error').unwrapErr();
	 * // errStr is 'error'
	 *
	 * // chas.ok(5).unwrapErr(); // Throws ChasErr('Called unwrapErr on an Ok', 'Result.unwrapErr')
	 * ```
	 */
	readonly unwrapErr: <V extends Error>(error?: V) => E;

	/**
	 * Unwraps a result, yielding the content of an `Ok`, or returns the provided fallback `defaultValue`.
	 *
	 * @param defaultValue The value to return if the result is an `Err`.
	 * @returns The value inside the `Ok`, or the `defaultValue`.
	 *
	 * @example
	 * ```ts
	 * const v1 = chas.ok(5).unwrapOr(10);
	 * // v1 is 5
	 *
	 * const v2 = chas.err('e').unwrapOr(10);
	 * // v2 is 10
	 * ```
	 */
	readonly unwrapOr: <T2 = T>(defaultValue: T2) => T | T2;

	/**
	 * Unwraps a result, yielding the content of an `Ok`, or computes it from a closure.
	 *
	 * @param f The closure to execute and evaluate if the result is an `Err`.
	 * @returns The value inside the `Ok`, or the result of calling `f`.
	 *
	 * @example
	 * ```ts
	 * const v1 = chas.ok(5).unwrapOrElse(() => 10);
	 * // v1 is 5
	 *
	 * const v2 = chas.err('e').unwrapOrElse(e => e.length);
	 * // v2 is 1
	 * ```
	 */
	readonly unwrapOrElse: <T2 = T>(f: (error: E) => T2) => T | T2;

	/**
	 * Unwraps a result, yielding the content of an `Ok`, or returns `null` if the result is an `Err`.
	 *
	 * @returns The value inside the `Ok`, or `null`.
	 *
	 * @example
	 * ```ts
	 * const v = chas.err('e').unwrapOrNull(); // null
	 * ```
	 */
	readonly unwrapOrNull: () => T | null;

	/**
	 * Unwraps a result, yielding the content of an `Ok`, or returns `undefined` if the result is an `Err`.
	 *
	 * @returns The value inside the `Ok`, or `undefined`.
	 *
	 * @example
	 * ```ts
	 * const v = chas.err('e').unwrapOrUndefined(); // undefined
	 * ```
	 */
	readonly unwrapOrUndefined: () => T | undefined;

	/**
	 * Unwraps a result, yielding the content of an `Ok`.
	 * Throws an error with the provided `message` if the result is an `Err`.
	 *
	 * @param message The error message to throw if the result is an `Err`.
	 * @param error Optional custom error instance to throw.
	 * @returns The value inside the `Ok`.
	 * @throws An error with the specified message if it is an `Err`.
	 *
	 * @example
	 * ```ts
	 * const val = chas.ok(5).expect('should be ok');
	 * // val is 5
	 *
	 * // chas.err('e').expect('Should not be reached'); // Throws ChasErr('Should not be reached', 'Result.expect')
	 * ```
	 */
	readonly expect: <V extends Error>(message: string, error?: V) => T | never;

	/**
	 * Unwraps a result, yielding the content of an `Err`.
	 * Throws an error with the provided `message` if the result is an `Ok`.
	 *
	 * @param message The error message to throw if the result is an `Ok`.
	 * @param error Optional custom error instance to throw.
	 * @returns The error inside the `Err`.
	 * @throws An error with the specified message if it is an `Ok`.
	 *
	 * @example
	 * ```ts
	 * const errVal = chas.err('e').expectErr('should be err');
	 * // errVal is 'e'
	 * ```
	 */
	readonly expectErr: <V extends Error>(message: string, error?: V) => E | never;

	/**
	 * Performs pattern matching on the `Result`.
	 * Evaluates the `ok` function if the result is `Ok`, or the `err` function if the result is `Err`.
	 *
	 * @param fns Object mapping `ok` and `err` handlers.
	 * @returns The value from evaluating either handler.
	 *
	 * @example
	 * ```ts
	 * const result = chas.ok(5).match({
	 *   ok: v => v * 2,
	 *   err: e => 0
	 * }); // 10
	 * ```
	 */
	readonly match: <U, F>(fns: { ok: (value: T) => U; err: (error: E) => F }) => U | F;

	/**
	 * Performs asynchronous pattern matching on the `Result`.
	 * Evaluates the `ok` function if the result is `Ok`, or the `err` function if the result is `Err`.
	 *
	 * @param fns Object mapping `ok` and `err` handlers.
	 * @returns A `Promise` that resolves to the value from evaluating either handler.
	 *
	 * @example
	 * ```ts
	 * const result = await chas.ok(5).matchAsync({
	 *   ok: async v => v * 2,
	 *   err: async e => 0
	 * }); // 10
	 * ```
	 */
	readonly matchAsync: <U, F>(fns: {
		ok: (value: T) => U | PromiseLike<U>;
		err: (error: E) => F | PromiseLike<F>;
	}) => PromiseLike<U | F>;

	/**
	 * Same as match, but for `Option<T>`. Works on `Result<T, E>` too!
	 * If the result is `Ok` and `T != undefined`, evaluates the `Some` handler.
	 * If the result is `Err` or `T == undefined`, evaluates the `None` handler.
	 *
	 * @param fns Object mapping `Some` and `None` handlers.
	 * @returns The value from evaluating either handler.
	 *
	 * @example
	 * ```ts
	 * const result = chas.ok(5).matchSome({
	 *   Some: v => v * 2,
	 *   None: () => 0
	 * }); // 10
	 * ```
	 */
	readonly matchSome: <U, F>(fns: { Some: (value: NonVoid<T>) => U; None: () => F }) => U | F;

	/**
	 * Same as matchSome, but asynchronous.
	 *
	 * @param fns Object mapping `Some` and `None` handlers.
	 * @returns A `Promise` that resolves to the value from evaluating either handler.
	 *
	 * @example
	 * ```ts
	 * const result = await chas.ok(5).matchSomeAsync({
	 *   Some: async v => v * 2,
	 *   None: async () => 0
	 * }); // 10
	 * ```
	 */
	readonly matchSomeAsync: <U, F>(fns: {
		Some: (value: NonVoid<T>) => U | PromiseLike<U>;
		None: () => F | PromiseLike<F>;
	}) => PromiseLike<U | F>;

	/**
	 * Calls the provided closure with the `Ok` value if the result is `Ok`, otherwise does nothing.
	 * Returns the original result unchanged.
	 *
	 * @param f The closure to call with the `Ok` value.
	 * @returns The `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).tap(v => console.log('Value:', v)); // logs 5
	 * ```
	 */
	readonly tap: (f: (value: T) => void) => this;

	/**
	 * Calls the provided closure with the `Err` value if the result is `Err`, otherwise does nothing.
	 * Returns the original result unchanged.
	 *
	 * @param f The closure to call with the `Err` error.
	 * @returns The `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * chas.err('error').tapErr(e => console.error('Failed:', e));
	 * ```
	 */
	readonly tapErr: (f: (error: E) => void) => this;

	/**
	 * Calls the provided closure with the `Ok` value asynchronously if the result is `Ok`.
	 * Does not modify the inner result.
	 *
	 * @param f The async side-effect closure to call.
	 * @returns A `ResultAsync` wrapping the unmodified original result.
	 */
	readonly asynctap: (f: (value: T) => Promise<void>) => ResultAsync<T, E>;

	/**
	 * Calls the provided closure with the `Err` error asynchronously if the result is `Err`.
	 * Does not modify the inner result.
	 *
	 * @param f The async side-effect closure to call.
	 * @returns A `ResultAsync` wrapping the unmodified original result.
	 */
	readonly asynctapErr: (f: (error: E) => Promise<void>) => ResultAsync<T, E>;

	/**
	 * Executes a side-effect that does not modify the result.
	 * Runs after previous synchronous chain parts regardless of Ok or Err.
	 *
	 * @param f The side-effect to execute.
	 * @returns The original `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).finally(() => console.log('Done'));
	 * ```
	 */
	readonly finally: (f: () => void) => Result<T, E>;

	/**
	 * Applies a predicate to a contained `Ok` value.
	 * If `Ok` and the predicate returns true, returns `this`.
	 * If the predicate returns false, returns an `Err` containing the result of `errorFn(value)`.
	 * If `this` is `Err`, returns `this`.
	 *
	 * @param predicate The condition to test the `Ok` value against.
	 * @param errorFn Function generating the error to return if the condition fails.
	 * @returns The filtered Result.
	 *
	 * @example
	 * ```ts
	 * chas.ok(20).filter(v => v >= 18, () => 'Too young'); // Ok(20)
	 * chas.ok(15).filter(v => v >= 18, () => 'Too young'); // Err('Too young')
	 * ```
	 */
	readonly filter: {
		<U extends T, F>(predicate: (value: T) => value is U, errorFn: (value: T) => F): Result<U, E | F>;
		<F>(predicate: (value: T) => boolean, errorFn: (value: T) => F): Result<T, E | F>;
	};

	/**
	 * Flattens a nested Result down one level.
	 * If the Result is `Ok`, but contains another `Result` (or structural Result), it extracts that inner Result.
	 * Otherwise, it returns the original untouched result.
	 *
	 * @returns The flattened Result.
	 *
	 * @example
	 * ```ts
	 * const nested = chas.ok(chas.ok(5));
	 * const flat = nested.flatten(); // Ok(5)
	 * ```
	 */
	readonly flatten: () => Result<unknown, unknown>;

	/**
	 * Swaps the `Ok` and `Err` branches.
	 * An `Ok<T>` becomes `Err<T>`, and an `Err<E>` becomes `Ok<E>`.
	 *
	 * @returns A new `Result` with the branches swapped.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).swap();      // Err(5)
	 * chas.err('e').swap();   // Ok('e')
	 * ```
	 */
	readonly swap: () => Result<E, T>;

	/**
	 * Catches a specific tagged error variant by its `_tag` or error factory, handles it, and removes it
	 * from the error union. Unmatched tags pass through unchanged.
	 *
	 * @param target The `_tag` value or error factory to catch.
	 * @param handler A function that receives the caught error and returns a recovery `Result`.
	 * @returns A `Result` with the caught tag excluded from the error union.
	 *
	 * @example
	 * ```ts
	 * getUser(id)
	 *     .catchTag('NotFound', () => chas.ok(GUEST_USER));
	 * // Result<User, DbError | Unauthorized> — NotFound is gone!
	 * // Also works: .catchTag(Errors.NotFound, ...);
	 * ```
	 */
	readonly catchTag: <Target extends CatchTarget, T2 = T, E2 = never>(
		target: Target,
		handler: (error: NoInfer<ExtractErrorFromTarget<Target, E>>) => Result<T2, E2>
	) => Result<T | T2, Exclude<E, { _tag: CatchTag<Target> }> | E2>;
	/**
	 * Taps into a specific tagged error variant by its `_tag`. The original result is returned unchanged.
	 *
	 * @param target The `_tag` value or error factory to tap.
	 * @param handler A function that receives the caught error.
	 * @returns The original `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * getUser(id)
	 *     .tapTag('NotFound', () => console.log('User not found'));
	 * // Result<User, DbError | Unauthorized> — NotFound is gone!
	 * ```
	 */
	readonly tapTag: <Target extends CatchTarget>(
		target: Target,
		handler: (error: NoInfer<ExtractErrorFromTarget<Target, E>>) => void
	) => Result<T, E>;

	[Symbol.iterator](): Generator<Result<T, E>, T, any>;
	[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any>;

	/**
	 * Logs the result to the console.
	 *
	 * @param label Optional label to prepend to the log message.
	 * @returns The original result.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).log(); // logs 'Ok: 5'
	 * chas.err('e').log('my error'); // logs 'my error [Err]: e'
	 * ```
	 */
	log(label?: string): this;

	/**
	 * Alias for `isOk()` and `value != undefined`
	 *
	 * @returns `true` if the result is `Ok`, `false` otherwise.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).isSome(); // true
	 * chas.err('e').isSome(); // false
	 * ```
	 */
	readonly isSome: () => this is Some<NonVoid<T>>;

	/**
	 * Alias for `isErr()` or `value == undefined`
	 *
	 * @returns `true` if the result is `Err`, `false` otherwise.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).isNone(); // false
	 * chas.err('e').isNone(); // true
	 * ```
	 */
	readonly isNone: () => this is None;

	/**
	 * Discards the error and returns a `Option<T>`
	 *
	 * @returns `Some<T>` if the result is `Ok`, or `None` if it is `Err`.
	 *
	 * @example
	 * ```ts
	 * const x = chas.err<string, number>('error').toOption();
	 * // x is Option<number>
	 * ```
	 */
	readonly toOption: () => Option<T>;

	/**
	 * Attaches context information to the error if this Result is an Err.
	 * Context is stored as a `_context` array on the error, with the most recent
	 * context first. This is useful for debugging which step in a chain failed.
	 *
	 * @param ctx A string description or metadata object describing the current step.
	 * @returns The same Result with context attached to the error (if Err).
	 *
	 * @example
	 * ```ts
	 * const result = await fetchUser(id)
	 *   .context("fetching user profile")
	 *   .andThen(u => validatePermissions(u))
	 *   .context("checking permissions")
	 *   .andThen(u => loadDashboard(u))
	 *   .context({ step: "loading dashboard", userId: id });
	 *
	 * // On error, context is available:
	 * if (result.isErr()) {
	 *   console.log(result.error._context);
	 *   // [{ step: "loading dashboard", userId: "123" }, "checking permissions", "fetching user profile"]
	 * }
	 * ```
	 */
	readonly context: (ctx: string | Record<string, unknown>) => Result<T, E>;

	/**
	 * Transforms a `Result<T, E>` into a `Result<T, F>` by providing a new error value.
	 * If the result is `Ok`, it remains `Ok`. If it is `Err`, the error is replaced by `error`.
	 *
	 * @param error The new error value to use if the result is `Err`.
	 * @returns A new `Result` with the same value or the provided error.
	 *
	 * @example
	 * ```ts
	 * const x = chas.none().toResult('fallback error');
	 * // x is Err('fallback error')
	 * ```
	 */
	readonly toResult: <F>(error: F) => Result<T, F>;

	/**
	 * Alias for `toResult` (with a more descriptive name for Option usage)
	 *
	 * @param error The new error value to use if the result is `Err`.
	 * @returns A new `Result` with the same value or the provided error.
	 *
	 * @example
	 * ```ts
	 * const x = chas.none().okOr('fallback error');
	 * // x is Err('fallback error')
	 * ```
	 */
	readonly okOr: <F>(error: F) => Result<T, F>;

	/**
	 * Chains a series of functions that can transform the `Result`.
	 *
	 * @param fns The functions to apply to `this`.
	 * @returns The result of applying `fns` to `this`.
	 *
	 * @example
	 * ```ts
	 * const res = chas.ok(5).pipe(r => r.map(v => v * 2)); // Ok(10)
	 * ```
	 */
	pipe<A>(f1: (a: Result<T, E>) => A): A;
	pipe<A, B>(f1: (a: Result<T, E>) => A, f2: (a: A) => B): B;
	pipe<A, B, C>(f1: (a: Result<T, E>) => A, f2: (a: A) => B, f3: (a: B) => C): C;
	pipe<A, B, C, D>(f1: (a: Result<T, E>) => A, f2: (a: A) => B, f3: (a: B) => C, f4: (a: C) => D): D;
	pipe<A, B, C, D, F>(
		f1: (a: Result<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F
	): F;
	pipe<A, B, C, D, F, G>(
		f1: (a: Result<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G
	): G;
	pipe<A, B, C, D, F, G, H>(
		f1: (a: Result<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H
	): H;
	pipe<A, B, C, D, F, G, H, I>(
		f1: (a: Result<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H,
		f8: (a: H) => I
	): I;
	pipe<A, B, C, D, F, G, H, I, J>(
		f1: (a: Result<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H,
		f8: (a: H) => I,
		f9: (a: I) => J
	): J;
	pipe(...fns: ((a: any) => any)[]): any;

	toJSON<T, E>(this: Result<T, E>): { ok: true; value: T } | { ok: false; error: E };
}

export const ResultMethodsProto = {
	isOk<T, E>(this: Result<T, E>): this is Ok<T> {
		return this.ok;
	},
	isErr<T, E>(this: Result<T, E>): this is Err<E> {
		return !this.ok;
	},
	isTaggedErr<T, E, Tag extends string>(
		this: Result<T, E>,
		tag: Tag
	): this is Err<TaggedErr & { readonly _tag: Tag }> {
		return !this.ok && (this as Err<TaggedErr>).error._tag === tag;
	},
	isOkAnd<T, E>(this: Result<T, E>, predicate: (value: T) => boolean): this is Ok<T> {
		return this.ok && predicate(this.value);
	},
	isErrAnd<T, E>(this: Result<T, E>, predicate: (error: E) => boolean): this is Err<E> {
		return !this.ok && predicate(this.error);
	},
	isSome<T, E>(this: Result<T, E>): this is Some<NonVoid<T>> {
		return this.ok && this.value != undefined;
	},
	isNone<T, E>(this: Result<T, E>): this is None {
		return !this.ok || this.value == undefined;
	},
	toOption<T, E>(this: Result<T, E>): Option<T> {
		return this.ok && this.value != undefined ? (ok(this.value) as Some<T>) : (err(undefined) as None);
	},
	toResult<T, E, F>(this: Result<T, E>, error: F): Result<T, F> {
		return this.ok ? ok(this.value) : err(error);
	},
	okOr<T, E, F>(this: Result<T, E>, error: F): Result<T, F> {
		return this.toResult(error);
	},
	map<T, E, U>(this: Result<T, E>, f: (value: T) => U): Result<U, E> {
		return this.ok ? ok(f(this.value)) : err(this.error);
	},
	asyncMap<T, E, U>(this: Result<T, E>, f: (value: T) => Promise<U>): ResultAsync<U, E> {
		if (this.ok) {
			return new ResultAsync(f(this.value).then(v => ok(v)));
		}
		return errAsync(this.error);
	},
	mapErr<T, E, F>(this: Result<T, E>, f: (error: E) => F): Result<T, F> {
		return this.ok ? ok(this.value) : err(f(this.error));
	},
	bimap<T, E, U, F>(this: Result<T, E>, onOk: (value: T) => U, onErr: (error: E) => F): Result<U, F> {
		return this.ok ? ok(onOk(this.value)) : err(onErr(this.error));
	},
	mapOr<T, E, U>(this: Result<T, E>, defaultValue: U, f: (value: T) => U): U {
		return this.ok ? f(this.value) : defaultValue;
	},
	mapOrElse<T, E, U>(this: Result<T, E>, f: (error: E) => U, g: (value: T) => U): U {
		return this.ok ? g(this.value) : f(this.error);
	},
	and<T, E, U>(this: Result<T, E>, other: Result<U, E>): Result<U, E> {
		return this.ok ? other : err(this.error);
	},
	or<T, E, F>(this: Result<T, E>, other: Result<T, F>): Result<T, F> {
		return this.ok ? ok(this.value) : other;
	},
	andThen<T, E, U, F>(this: Result<T, E>, f: (value: T) => Result<U, F>): Result<U, E | F> {
		return this.ok ? f(this.value) : err(this.error);
	},
	asyncAndThen<T, E, U, F>(this: Result<T, E>, f: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F> {
		if (this.ok) {
			return f(this.value);
		}
		return errAsync(this.error);
	},
	orElse<T, E, F>(this: Result<T, E>, f: (error: E) => Result<T, F>): Result<T, F> {
		return this.ok ? ok(this.value) : f(this.error);
	},
	unwrap<T, E>(this: Result<T, E>): T {
		if (this.ok) return this.value;
		throw this.error;
	},
	unwrapErr<T, E, V extends Error>(this: Result<T, E>, error?: V): E {
		if (!this.ok) return this.error;
		if (error) throw error;
		throw GlobalErrs.ChasErr({ message: 'Called unwrapErr on an Ok', origin: 'Result.unwrapErr', cause: this });
	},
	unwrapOr<T, E, T2 = T>(this: Result<T, E>, defaultValue: T2): T | T2 {
		return this.ok ? this.value : defaultValue;
	},
	unwrapOrElse<T, E, T2 = T>(this: Result<T, E>, f: (error: E) => T2): T | T2 {
		return this.ok ? this.value : f(this.error);
	},
	unwrapOrNull<T, E>(this: Result<T, E>): T | null {
		return this.ok ? this.value : null;
	},
	unwrapOrUndefined<T, E>(this: Result<T, E>): T | undefined {
		return this.ok ? this.value : undefined;
	},
	expect<T, E, V extends Error>(this: Result<T, E>, message: string, error?: V): T | never {
		if (this.ok) return this.value;
		if (error) throw error;
		throw GlobalErrs.ChasErr({ message, origin: 'Result.expect', cause: this });
	},
	expectErr<T, E, V extends Error>(this: Result<T, E>, message: string, error?: V): E | never {
		if (!this.ok) return this.error;
		if (error) throw error;
		throw GlobalErrs.ChasErr({ message, origin: 'Result.expectErr', cause: this });
	},
	match<T, E, U, F>(this: Result<T, E>, fns: { ok: (value: T) => U; err: (error: E) => F }): U | F {
		return this.ok ? fns.ok(this.value) : fns.err(this.error);
	},
	matchAsync<T, E, U, F>(this: Result<T, E>, fns: { ok: (value: T) => U; err: (error: E) => F }): Promise<U | F> {
		return this.ok ? Promise.resolve(fns.ok(this.value)) : Promise.resolve(fns.err(this.error));
	},
	matchSome<T, E, U, F>(this: Result<T, E>, fns: { Some: (value: NonVoid<T>) => U; None: () => F }): U | F {
		return this.isSome() ? fns.Some(this.value) : fns.None();
	},
	matchSomeAsync<T, E, U, F>(
		this: Result<T, E>,
		fns: { Some: (value: NonVoid<T>) => U; None: () => F }
	): Promise<U | F> {
		return this.isSome() ? Promise.resolve(fns.Some(this.value)) : Promise.resolve(fns.None());
	},
	tap<T, E>(this: Result<T, E>, f: (value: T) => void): Result<T, E> {
		if (this.ok) f(this.value);
		return this;
	},
	tapErr<T, E>(this: Result<T, E>, f: (error: E) => void): Result<T, E> {
		if (!this.ok) f(this.error);
		return this;
	},
	asynctap<T, E>(this: Result<T, E>, f: (value: T) => Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			Promise.resolve(this).then(async res => {
				if (res.isOk()) {
					await f(res.value);
				}
				return res;
			})
		);
	},
	asynctapErr<T, E>(this: Result<T, E>, f: (error: E) => Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			Promise.resolve(this).then(async res => {
				if (res.isErr()) {
					await f(res.error);
				}
				return res;
			})
		);
	},
	finally<T, E>(this: Result<T, E>, f: () => void): Result<T, E> {
		f();
		return this;
	},
	filter<T, E, U extends T, F>(
		this: Result<T, E>,
		predicate: ((value: T) => value is U) | ((value: T) => boolean),
		errorFn: (value: T) => F
	): Result<U, E | F> {
		if (!this.ok) return err<E | F, U>(this.error);
		if (predicate(this.value)) return ok<U, E | F>(this.value as U);
		return err<E | F, U>(errorFn(this.value));
	},
	flatten<T, E>(this: Result<T, E>): T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E> {
		if (!this.ok) return this as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
		// check if the strictly typed `Ok` value structurally conforms to a Result before unwrapping it

		const val = this.value;
		if (val !== null && typeof val === 'object' && ('ok' in val || 'isOk' in val)) {
			return val as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
		}
		return this as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
	},
	swap<T, E>(this: Result<T, E>): Result<E, T> {
		return this.ok ? err(this.value) : ok(this.error);
	},
	catchTag<T, E, Target extends CatchTarget, T2 = T, E2 = never>(
		this: Result<T, E>,
		target: Target,
		handler: (error: ExtractErrorFromTarget<Target, NoInfer<E>>) => Result<T2, E2>
	): Result<T | T2, Exclude<E, { _tag: CatchTag<Target> }> | E2> {
		if (this.ok) return this as any;
		const error = this.error;
		if (typeof target === 'string') {
			if (error !== null && typeof error === 'object' && '_tag' in error && error._tag === target) {
				return handler(error as any);
			}
		} else if (
			target !== null &&
			(typeof target === 'object' || typeof target === 'function') &&
			'is' in target &&
			typeof target.is === 'function'
		) {
			if (target.is(error)) {
				return handler(error as any);
			}
		}
		return this as any;
	},
	tapTag<T, E, Target extends CatchTarget>(
		this: Result<T, E>,
		target: Target,
		handler: (error: ExtractErrorFromTarget<Target, NoInfer<E>>) => void | PromiseLike<void>
	): Result<T, E> {
		if (this.ok) return this;
		const error = this.error;
		if (typeof target === 'string') {
			if (error !== null && typeof error === 'object' && '_tag' in error && error._tag === target) {
				handler(error as any);
			}
		} else if (
			target !== null &&
			(typeof target === 'object' || typeof target === 'function') &&
			'is' in target &&
			typeof target.is === 'function'
		) {
			if (target.is(error)) {
				handler(error as any);
			}
		}
		return this;
	},
	*[Symbol.iterator]<T, E>(this: Result<T, E>): Generator<Result<T, E>, T, T> {
		return (yield this) as T;
	},
	pipe(...fns: ((a: any) => any)[]): any {
		return fns.reduce((acc, fn) => fn(acc), this);
	},
	log<T, E>(this: Result<T, E>, label?: string): Result<T, E> {
		const ok = this.isOk();
		if (ok && typeof this.value === 'bigint') {
			console.log(`${label ?? 'Result'}: [Ok]: ${this.value}n`);
		} else if (!ok && typeof this.error === 'bigint') {
			console.log(`${label ?? 'Result'}: [Err]: ${this.error}n`);
		} else {
			console.log(
				`${label ?? 'Result'}: [${ok ? 'Ok' : 'Err'}]: ${ok ? JSON.stringify(this.value) : JSON.stringify(this.error)}`
			);
		}
		return this;
	},
	context<T, E>(this: Result<T, E>, ctx: string | Record<string, unknown>): Result<T, E> {
		if (this.ok) return this;
		const error = this.error;
		if (error !== null && typeof error === 'object') {
			const e = error as any;
			e._context = [ctx, ...(e._context ?? [])];
		}
		return this;
	},
	toJSON<T, E>(this: Result<T, E>): { ok: true; value: T } | { ok: false; error: E } {
		return this.ok ? { ok: true, value: this.value } : { ok: false, error: this.error };
	},
};

// ==== RESULT ASYNC ====

/**
 * A promise-like wrapper representing a `Result` that evaluates asynchronously.
 * Can be directly `await`ed or chained with further operators.
 *
 * @example
 * ```ts
 * const res = ResultAsync.fromSafePromise(Promise.resolve(42));
 * ```
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
	private readonly _promise: Promise<Result<T, E>>;
	private _status: 'pending' | 'ok' | 'err' = 'pending';
	private _value?: T;
	private _error?: E;

	/**
	 * Creates a `ResultAsync` from a Promise that is guaranteed not to reject.
	 * Skips the `onRejected` mapper since rejection is not expected.
	 *
	 * @param promise A Promise that will not reject.
	 * @returns A `ResultAsync` resolving to `Ok` containing the value.
	 *
	 * @example
	 * ```ts
	 * const res = chas.ResultAsync.fromSafePromise(Promise.resolve(42));
	 * ```
	 */
	static fromSafePromise<T>(promise: Promise<T>): ResultAsync<T, never> {
		return new ResultAsync(promise.then(v => ok(v)));
	}

	/**
	 * Creates a `ResultAsync` where the provided function is deferred to the next microtask.
	 * The function is not called synchronously during construction, but will execute
	 * when the microtask queue is processed.
	 *
	 * @param fn A function returning a `ResultAsync` to defer.
	 * @returns A `ResultAsync` wrapping the deferred execution.
	 *
	 * @example
	 * ```ts
	 * const deferred = chas.ResultAsync.defer(() => expensiveFetchAsync());
	 * // fn() has not been called yet during synchronous execution
	 * const result = await deferred; // fn() executes here
	 * ```
	 */
	static defer<T, E>(fn: () => ResultAsync<T, E>): ResultAsync<T, E> {
		return new ResultAsync<T, E>(Promise.resolve().then(() => fn()));
	}

	/**
	 * Creates a `ResultAsync` from an already resolved `Result`.
	 * This is useful for lifting synchronous `Result` values into the asynchronous context of `ResultAsync`.
	 * @param result A `Result` to wrap in a `ResultAsync`.
	 * @returns A `ResultAsync` that resolves to the provided `Result`.
	 *
	 * @example
	 * ```ts
	 * const res = chas.ResultAsync.fromResult(chas.ok(42));
	 * const val = await res; // Ok(42)
	 * ```
	 */
	static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
		return new ResultAsync<T, E>(Promise.resolve(result));
	}

	/**
	 * Creates a `ResultAsync` from a value that may be a `Result`, a `Promise`, or a plain value.
	 */
	static from<T, E>(val: () => Result<T, E> | PromiseLike<Result<T, E>>): ResultAsync<T, E>;
	static from<T, E = unknown>(
		val: () => T | PromiseLike<T>,
		onThrow?: (error: unknown) => E | PromiseLike<E>
	): ResultAsync<T, E>;
	static from<T, E>(val: PromiseLike<Result<T, E>>): ResultAsync<T, E>;
	static from<T>(val: PromiseLike<T>): ResultAsync<T, unknown>;
	static from<T, E>(val: Result<T, E>): ResultAsync<T, E>;
	static from<T>(val: T): [unknown] extends [T] ? ResultAsync<unknown, unknown> : ResultAsync<T, never>;
	static from(val: any, onThrow?: (error: unknown) => any): ResultAsync<any, any> {
		let resolved = val;

		if (typeof val === 'function') {
			try {
				resolved = val();
			} catch (e) {
				resolved = err(onThrow ? onThrow(e) : e);
			}
		}

		if (isPromise(resolved)) {
			return new ResultAsync(
				(resolved as Promise<any>).then(v => (isResult(v) ? v : ok(v))).catch(e => err(e))
			) as ResultAsync<any, any>;
		}

		if (isResult(resolved)) {
			return ResultAsync.fromResult(resolved);
		}

		return new ResultAsync(Promise.resolve(ok(resolved)));
	}

	constructor(promise: Promise<Result<T, E>>) {
		this._promise = promise.then(res => {
			if (res.isOk()) {
				this._status = 'ok';
				this._value = res.value;
			} else {
				this._status = 'err';
				this._error = res.error;
			}
			return res;
		});
	}

	/**
	 * Allows the `ResultAsync` object to be `await`ed directly to obtain the inner synchronous `Result`.
	 *
	 * @param onfulfilled The function to apply to the `Ok` value.
	 * @param onrejected The function to apply to the `Err` value.
	 * @returns A new `ResultAsync` with the transformed value.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(10).then(v => v * 2);
	 * const val = await res; // Ok(20)
	 * ```
	 */
	then<TResult1 = Result<T, E>, TResult2 = never>(
		onfulfilled?: ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this._promise.then(onfulfilled, onrejected);
	}

	/**
	 * Transforms the inner value asynchronously if the inner promise resolves to `Ok`.
	 *
	 * @param f The async transformer function for the `Ok` value.
	 * @returns A new `ResultAsync` with the transformed value.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(10).map(async v => v * 2);
	 * const val = await res; // Ok(20)
	 * ```
	 */
	map<U>(f: (value: T) => U | Promise<U>): ResultAsync<U, E> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isOk()) {
					const mappedValue = await f(res.value);
					return ok(mappedValue);
				}
				return err(res.error);
			})
		);
	}

	/**
	 * Transforms the inner error asynchronously if the inner promise resolves to `Err`.
	 *
	 * @param f The async transformer function for the `Err` error.
	 * @returns A new `ResultAsync` with the transformed error.
	 *
	 * @example
	 * ```ts
	 * const res = chas.errAsync('err').mapErr(async e => e.toUpperCase());
	 * const val = await res; // Err('ERR')
	 * ```
	 */
	mapErr<F>(f: (error: E) => F | Promise<F>): ResultAsync<T, F> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isErr()) {
					const mappedError = await f(res.error);
					return err(mappedError);
				}
				return ok(res.value);
			})
		);
	}

	bimap<U, F>(onOk: (value: T) => U | Promise<U>, onErr: (error: E) => F | Promise<F>): ResultAsync<U, F> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isOk()) {
					const mappedValue = await onOk(res.value);
					return ok(mappedValue);
				}
				const mappedError = await onErr(res.error);
				return err(mappedError);
			})
		);
	}

	/**
	 * Chains another Result-returning operation asynchronously.
	 * If `this` is `Ok`, calls `f` with the value and returns a new joined `ResultAsync`.
	 *
	 * @param f A function returning either a `Result` or another `ResultAsync`.
	 * @returns A chained `ResultAsync`.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(5).andThen(v => chas.okAsync(v * 2));
	 * const val = await res; // Ok(10)
	 * ```
	 */
	andThen<U, F>(f: (value: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isOk()) {
					const nextResult = f(res.value);
					// if the next function returns a ResultAsync, we must await it
					return nextResult instanceof ResultAsync ? await nextResult : nextResult;
				}
				return err(res.error);
			})
		);
	}

	/**
	 * Chains another Result-returning operation asynchronously.
	 * If `this` is `Err`, calls `f` with the error and returns a new joined `ResultAsync`.
	 *
	 * @param f A function returning either a `Result` or another `ResultAsync`.
	 * @returns A chained `ResultAsync`.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(5).andThen(v => chas.okAsync(v * 2));
	 * const val = await res; // Ok(10)
	 * ```
	 */
	orElse<T2 = T, F = E>(f: (error: E) => Result<T2, F> | ResultAsync<T2, F>): ResultAsync<T | T2, F> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isErr()) {
					const nextResult = f(res.error);
					// if the next function returns a ResultAsync, we must await it
					return nextResult instanceof ResultAsync ? await nextResult : nextResult;
				}
				return ok(res.value);
			})
		);
	}

	/**
	 * Resolves the async Result to a final union type `Promise<U | F>`.
	 * Handlers can be synchronously or asynchronously evaluated.
	 *
	 * @param fns Object mapping `Ok` and `Err` handlers.
	 * @returns A standard `Promise` of the extracted matched value.
	 *
	 * @example
	 * ```ts
	 * const val = await chas.okAsync(5).match({
	 *   ok: v => v * 2,
	 *   err: e => 0
	 * }); // 10
	 * ```
	 */
	match<U, F>(fns: { ok: (value: T) => U | PromiseLike<U>; err: (error: E) => F | PromiseLike<F> }): Promise<U | F> {
		return this._promise.then(res => {
			if (res.isOk()) return fns.ok(res.value);
			return fns.err(res.error);
		});
	}
	/**
	 * Unwraps the async result, returning a Promise that resolves to the `Some` value,
	 * or rejects with the `None` error.
	 *
	 * Note: Because `ResultAsync` wraps a `Promise`, this method cannot return synchronously.
	 * You must `await` the returned Promise to get the value.
	 *
	 * @param fns Object mapping `Some` and `None` handlers.
	 * @returns A standard `Promise` of the extracted matched value.
	 *
	 * @example
	 * ```ts
	 * const val = await chas.okAsync(5).matchSome({
	 *   some: v => v * 2,
	 *   none: () => 0
	 * }); // 10
	 * ```
	 */
	matchSome<U, F>(fns: { some: (value: T) => U | PromiseLike<U>; none: () => F | PromiseLike<F> }): Promise<U | F> {
		return this._promise.then(res => {
			if (res.isSome()) return fns.some(res.value);
			return fns.none();
		});
	}

	/**
	 * Unwraps the async result, returning a Promise that resolves to the `Ok` value,
	 * or rejects with the `Err` error.
	 *
	 * Note: Because `ResultAsync` wraps a `Promise`, this method cannot return synchronously.
	 * You must `await` the returned Promise to get the value.
	 *
	 * @returns A standard `Promise` of the `Ok` value.
	 *
	 * @example
	 * ```ts
	 * const val = await chas.okAsync(5).unwrap(); // 5 or throws
	 * ```
	 */
	unwrap(): Promise<T> {
		return this._promise.then(r => r.unwrap());
	}

	/**
	 * Unwraps the async result, returning a Promise that resolves to the `Ok` value,
	 * or rejects and returns `Ok` with the provided default value.
	 *
	 * Note: Because `ResultAsync` wraps a `Promise`, this method cannot return synchronously.
	 * You must `await` the returned Promise to get the value.
	 *
	 * @returns A standard `Promise` of the `Ok` value.
	 *
	 * @example
	 * ```ts
	 * const val = await chas.okAsync(5).unwrapOr(10); // 5 or 10
	 * ```
	 */
	unwrapOr(defaultValue: T): Promise<T> {
		return this._promise.then(r => r.unwrapOr(defaultValue));
	}

	/**
	 * Unwraps the async result, returning a Promise that resolves to the `Ok` value,
	 * or rejects and returns `Ok` with the result of the provided function.
	 *
	 * Note: Because `ResultAsync` wraps a `Promise`, this method cannot return synchronously.
	 * You must `await` the returned Promise to get the value.
	 *
	 * @returns A standard `Promise` of the `Ok` value.
	 *
	 * @example
	 * ```ts
	 * const val = await chas.okAsync(5).unwrapOrElse(e => e.length); // 5 or e.length
	 * ```
	 */
	unwrapOrElse(fn: (error: E) => T): Promise<T> {
		return this._promise.then(r => r.unwrapOrElse(fn));
	}

	/**
	 * Supports React Suspense by throwing the internal promise if still pending,
	 * returning the value if resolved to `Ok`, or throwing the error if resolved to `Err`.
	 *
	 * @example
	 * ```tsx
	 * const data = myResultAsync.readSuspense(); // Suspends React component if pending
	 * return <div>{data}</div>;
	 * ```
	 */
	readSuspense(): T {
		if (this._status === 'pending') {
			throw this._promise;
		}
		if (this._status === 'err') {
			throw this._error;
		}
		return this._value as T;
	}

	/**
	 * Calls the provided closure with the `Ok` value asynchronously if the result is `Ok`.
	 * Does not modify the inner result, useful for async side-effects like logging to a database.
	 *
	 * @param f The side-effect closure to call.
	 * @returns The original `ResultAsync` unmodified.
	 *
	 * @example
	 * ```ts
	 * const user = await fetchUser().tap(async u => await logToDb(u.id));
	 * ```
	 */
	tap(f: (value: T) => void | Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isOk()) {
					await f(res.value);
				}
				return res;
			})
		);
	}

	/**
	 * Calls the provided closure with the `Err` error asynchronously if the result is `Err`.
	 * Does not modify the inner result, useful for async side-effects like appending to a remote error log.
	 *
	 * @param f The side-effect closure to call.
	 * @returns The original `ResultAsync` unmodified.
	 *
	 * @example
	 * ```ts
	 * const user = await fetchUser().tapErr(async e => await submitErrorToSentry(e));
	 * ```
	 */
	tapErr(f: (error: E) => void | Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			this._promise.then(async res => {
				if (res.isErr()) {
					await f(res.error);
				}
				return res;
			})
		);
	}

	/**
	 * Executes a side-effect asynchronously regardless of whether the inner Result is `Ok` or `Err`.
	 * Does not modify the Result value.
	 *
	 * @param f The side-effect to execute. Can be async.
	 * @returns The original `ResultAsync` unmodified.
	 *
	 * @example
	 * ```ts
	 * const data = await performQuery(conn).finally(() => db.disconnect());
	 * ```
	 */
	finally(f: () => void | Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(this._promise.finally(f));
	}

	/**
	 * Swaps the `Ok` and `Err` branches of the async result.
	 * An `Ok<T>` becomes `Err<T>`, and an `Err<E>` becomes `Ok<E>`.
	 *
	 * @returns A new `ResultAsync` with the branches swapped.
	 *
	 * @example
	 * ```ts
	 * const swapped = await chas.okAsync(5).swap(); // Err(5)
	 * ```
	 */
	swap(): ResultAsync<E, T> {
		return new ResultAsync(this._promise.then(res => res.swap()));
	}

	/**
	 * Catches a specific tagged error variant by its `_tag` or error factory, handles it, and removes it
	 * from the error union. Unmatched tags pass through unchanged.
	 *
	 * @param target The `_tag` value or error factory to catch.
	 * @param handler A function that receives the caught error and returns a recovery `Result` or `ResultAsync`.
	 * @returns A `ResultAsync` with the caught tag excluded from the error union.
	 *
	 * @example
	 * ```ts
	 * await fetchUser(id)
	 *     .catchTag('NotFound', () => chas.ok(GUEST_USER));
	 * // ResultAsync<User, DbError | Unauthorized>
	 * ```
	 */
	catchTag<Target extends CatchTarget, T2 = T, E2 = never>(
		target: Target,
		handler: (
			error: NoInfer<ExtractErrorFromTarget<Target, E>>
		) => Result<T2, E2> | ResultAsync<T2, E2> | PromiseLike<Result<T2, E2>>
	): ResultAsync<T | T2, Exclude<E, { _tag: CatchTag<Target> }> | E2> {
		return new ResultAsync(
			this._promise.then(res => res.catchTag<Target, T2, E2>(target, handler as any))
		) as ResultAsync<T | T2, Exclude<E, { _tag: CatchTag<Target> }> | E2>;
	}

	/**
	 * Taps into a specific tagged error variant. The original result is returned unchanged.
	 *
	 * @param target The error factory or `_tag` value to tap.
	 * @param handler A function that receives the caught error.
	 * @returns The original `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * getUser(id)
	 *     .tapTag(AppErr.NotFound, (e) => console.log('Not found: ', e.resource));
	 * //                           ^^^ `e` is correctly inferred only if an error factory is provided.
	 * //                               If a string is provided, the error will be typed as `{ _tag: string } & Error`.
	 * ```
	 */
	tapTag<Target extends CatchTarget>(
		target: Target,
		handler: (error: NoInfer<ExtractErrorFromTarget<Target, E>>) => void | PromiseLike<void>
	): ResultAsync<T, E> {
		return new ResultAsync(this._promise.then(res => res.tapTag(target, handler)));
	}

	*[Symbol.iterator](): Generator<ResultAsync<T, E>, T, any> {
		return (yield this) as T;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any> {
		return (yield await this) as T;
	}

	/**
	 * Discards the error and returns a `ResultAsync<T, void>` (an `OptionAsync<T>`).
	 *
	 * @returns `Ok` if the result resolves to `Ok`, or `Err<void>` if it resolves to `Err`.
	 */
	toOption(): OptionAsync<T> {
		return new ResultAsync(this._promise.then(res => res.toOption()));
	}

	/**
	 * Transforms a `ResultAsync<T, E>` into a `ResultAsync<T, F>` by providing a new error value.
	 *
	 * @param error The new error value to use if the result is `Err`.
	 * @returns A new `ResultAsync` with the same value or the provided error.
	 */
	toResult<F>(error: F): ResultAsync<T, F> {
		return new ResultAsync(
			this._promise.then(res => {
				if (res.isOk()) return ok(res.value);
				return err(error);
			})
		);
	}

	/**
	 * Alias for `toResult` (with a more descriptive name for Option usage)
	 *
	 * @param error The new error value to use if the result is `Err`.
	 * @returns A new `ResultAsync` with the same value or the provided error.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(5).okOr('e'); // ResultAsync(5)
	 * ```
	 */
	readonly okOr: <F>(error: F) => ResultAsync<T, F> = this.toResult;

	/**
	 * Logs the result to the console.
	 *
	 * @param label Optional label to print before the result.
	 * @returns The original `ResultAsync` unmodified.
	 *
	 * @example
	 * ```ts
	 * getUser(id)
	 *     .log('User');
	 * // Logs: User [Ok]: { name: 'Alice' } or User [Err]: { _tag: 'NotFound', ... }
	 * ```
	 */
	log(label?: string): ResultAsync<T, E> {
		return new ResultAsync(
			this._promise.then(res => {
				const ok = res.isOk();
				if (ok && typeof res.value === 'bigint') {
					console.log(`${label ?? 'ResultAsync'}: [Ok]: ${res.value}n`);
				} else if (!ok && typeof res.error === 'bigint') {
					console.log(`${label ?? 'ResultAsync'}: [Err]: ${res.error}n`);
				} else {
					console.log(
						`${label ?? 'ResultAsync'}: [${ok ? 'Ok' : 'Err'}]: ${ok ? JSON.stringify(res.value) : JSON.stringify(res.error)}`
					);
				}
				return res;
			})
		);
	}

	/**
	 * Attaches context information to the error if the eventual Result is an Err.
	 */
	context(ctx: string | Record<string, unknown>): ResultAsync<T, E> {
		return new ResultAsync(this._promise.then(res => res.context(ctx)));
	}

	/**
	 * Chains a series of functions that can transform the `ResultAsync`.
	 *
	 * @param f1 The function to apply to `this`.
	 * @returns The result of applying `f1` to `this`.
	 *
	 * @example
	 * ```ts
	 * const res = chas.okAsync(5).pipe(r => r.map(v => v * 2)); // ResultAsync(10)
	 * ```
	 */
	pipe<A>(f1: (a: ResultAsync<T, E>) => A): A;
	pipe<A, B>(f1: (a: ResultAsync<T, E>) => A, f2: (a: A) => B): B;
	pipe<A, B, C>(f1: (a: ResultAsync<T, E>) => A, f2: (a: A) => B, f3: (a: B) => C): C;
	pipe<A, B, C, D>(f1: (a: ResultAsync<T, E>) => A, f2: (a: A) => B, f3: (a: B) => C, f4: (a: C) => D): D;
	pipe<A, B, C, D, F>(
		f1: (a: ResultAsync<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F
	): F;
	pipe<A, B, C, D, F, G>(
		f1: (a: ResultAsync<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G
	): G;
	pipe<A, B, C, D, F, G, H>(
		f1: (a: ResultAsync<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H
	): H;
	pipe<A, B, C, D, F, G, H, I>(
		f1: (a: ResultAsync<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H,
		f8: (a: H) => I
	): I;
	pipe<A, B, C, D, F, G, H, I, J>(
		f1: (a: ResultAsync<T, E>) => A,
		f2: (a: A) => B,
		f3: (a: B) => C,
		f4: (a: C) => D,
		f5: (a: D) => F,
		f6: (a: F) => G,
		f7: (a: G) => H,
		f8: (a: H) => I,
		f9: (a: I) => J
	): J;
	pipe(...fns: ((a: any) => any)[]): any {
		return fns.reduce((acc, fn) => fn(acc), this);
	}

	toJSON<T, E>(this: ResultAsync<T, E>): Promise<{ ok: true; value: T } | { ok: false; error: E }> {
		return this._promise.then(res => res.toJSON());
	}
}

// ==== RESULT/RESULTASYNC HELPERS ====

function isResult(val: unknown): val is Result<any, any> {
	return (
		val !== null &&
		typeof val === 'object' &&
		'ok' in val &&
		typeof (val as any).isOk === 'function' &&
		typeof (val as any).isErr === 'function'
	);
}

function isPromise(val: unknown): val is PromiseLike<any> {
	return val !== null && typeof val === 'object' && typeof (val as any).then === 'function';
}
