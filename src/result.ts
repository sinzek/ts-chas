/* eslint-disable @typescript-eslint/no-explicit-any */
import { type TaggedError } from './errors.js';
/**
 * A successful result.
 *
 * ```ts
 * import { chas } from './index.js';
 *
 * const x: chas.Ok<number> = { ok: true, value: 1 };
 * ```
 */
export type Ok<T> = {
	readonly ok: true;
	readonly value: T;
};

/**
 * An error result.
 *
 * ```ts
 * import { chas } from './index.js';
 *
 * const x: chas.Err<string> = { ok: false, error: 'error' };
 * ```
 */
export type Err<E> = {
	readonly ok: false;
	readonly error: E;
};

/**
 * Helper to safely extract the error type from a union of Results.
 * Bypasses TypeScript's contravariance inference bug.
 */
export type UnwrapErr<U> = U extends { ok: false; error: infer E }
	? E
	: U extends PromiseLike<infer R>
		? R extends { ok: false; error: infer E }
			? E
			: never
		: never;

/**
 * Distributes over a union to safely extract the value from an `Ok` branch,
 * bypassing contravariance inference bugs.
 */
export type ExtractOkValue<T> = T extends { ok: true; value: infer U } ? U : never;

/**
 * Distributes over a union to safely extract the error from an `Err` branch,
 * bypassing contravariance inference bugs.
 */
export type ExtractErrError<T> = T extends { ok: false; error: infer E } ? E : never;

interface ResultMethods<T, E> {
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
	readonly and: <U>(other: Result<U, E>) => Result<U, E>;

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
	readonly or: <F>(other: Result<T, F>) => Result<T, F>;

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
	readonly andThen: <U, F>(f: (value: T) => Result<U, F>) => Result<U, E | F>;

	/**
	 * Does the same thing as andThen, except `f` must return a ResultAsync. The returned value will be `ResultAsync`.
	 *
	 * @param f The function to call with the `Ok` value, which must return a `ResultAsync`.
	 * @returns The resulting `ResultAsync` from `f`, or the original `Err`.
	 */
	readonly asyncAndThen: <U, F>(f: (value: T) => ResultAsync<U, F>) => ResultAsync<U, E | F>;

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
	readonly orElse: <F>(f: (error: E) => Result<T, F>) => Result<T, F>;

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
	 * // chas.ok(5).unwrapErr(); // Throws Error('Called unwrapErr on an Ok')
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
	readonly unwrapOr: (defaultValue: T) => T;

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
	readonly unwrapOrElse: (f: (error: E) => T) => T;

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
	 * // chas.err('e').expect('Should not be reached'); // Throws Error('Should not be reached')
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
	 * Calls the provided closure with the `Ok` value if the result is `Ok`, otherwise does nothing.
	 * Returns the original result unchanged.
	 *
	 * @param f The closure to call with the `Ok` value.
	 * @returns The `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * chas.ok(5).inspect(v => console.log('Value:', v)); // logs 5
	 * ```
	 */
	readonly inspect: (f: (value: T) => void) => Result<T, E>;

	/**
	 * Calls the provided closure with the `Err` value if the result is `Err`, otherwise does nothing.
	 * Returns the original result unchanged.
	 *
	 * @param f The closure to call with the `Err` error.
	 * @returns The `Result` unmodified.
	 *
	 * @example
	 * ```ts
	 * chas.err('error').inspectErr(e => console.error('Failed:', e));
	 * ```
	 */
	readonly inspectErr: (f: (error: E) => void) => Result<T, E>;

	/**
	 * Calls the provided closure with the `Ok` value asynchronously if the result is `Ok`.
	 * Does not modify the inner result.
	 *
	 * @param f The async side-effect closure to call.
	 * @returns A `ResultAsync` wrapping the unmodified original result.
	 */
	readonly asyncInspect: (f: (value: T) => Promise<void>) => ResultAsync<T, E>;

	/**
	 * Calls the provided closure with the `Err` error asynchronously if the result is `Err`.
	 * Does not modify the inner result.
	 *
	 * @param f The async side-effect closure to call.
	 * @returns A `ResultAsync` wrapping the unmodified original result.
	 */
	readonly asyncInspectErr: (f: (error: E) => Promise<void>) => ResultAsync<T, E>;

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
	readonly filter: <F>(predicate: (value: T) => boolean, errorFn: (value: T) => F) => Result<T, E | F>;

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
	 * Catches a specific tagged error variant by its `_tag`, handles it, and removes it
	 * from the error union. Unmatched tags pass through unchanged.
	 *
	 * @param tag The `_tag` value to catch.
	 * @param handler A function that receives the caught error and returns a recovery `Result`.
	 * @returns A `Result` with the caught tag excluded from the error union.
	 *
	 * @example
	 * ```ts
	 * getUser(id)
	 *     .catchTag('NotFound', () => chas.ok(GUEST_USER));
	 * // Result<User, DbError | Unauthorized> — NotFound is gone!
	 * ```
	 */
	readonly catchTag: <Tag extends string, E2 = never>(
		tag: Tag,
		handler: (error: [E] extends [TaggedError] ? Extract<E, { _tag: Tag }> : any) => Result<T, E2>
	) => Result<T, [E] extends [TaggedError] ? Exclude<E, { _tag: Tag }> | E2 : E | E2>;

	/**
	 * Iterable symbol allowing `Result` to be yielded inside `chas.go` do-notation blocks.
	 * Yields the `Result` itself, and naturally receives the inner `Ok` value from the runner framework over `yield*`.
	 */

	[Symbol.iterator](): Generator<Result<T, E>, T, any>;

	/**
	 * AsyncIterable symbol allowing `Result` to be yielded inside `chas.go` async do-notation blocks natively.
	 */
	[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any>;
}

/**
 * Represents either a success (`Ok<T>`) or a failure (`Err<E>`).
 * Both branches provide the extensive list of functional methods available in `ResultMethods`.
 */
export type Result<T, E> = (Ok<T> & ResultMethods<T, E>) | (Err<E> & ResultMethods<T, E>);

/**
 * A promise-like wrapper representing a `Result` that evaluates asynchronously.
 * Can be directly `await`ed or chained with further operators.
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
		return new ResultAsync<T, E>(Promise.resolve().then(() => fn()) as Promise<Result<T, E>>);
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
					return ok(mappedValue) as Result<U, E>;
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
					return err(mappedError) as Result<T, F>;
				}
				return ok(res.value);
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
					return nextResult instanceof ResultAsync
						? ((await nextResult) as Result<U, E | F>)
						: (nextResult as Result<U, E | F>);
				}
				return err(res.error) as Result<U, E | F>;
			})
		);
	}

	/**
	 * Resolves the async Result to a final union type `Promise<U | F>`.
	 * Handlers can be synchronously or asynchronously evaluated.
	 *
	 * @param fns Object mapping `ok` and `err` handlers.
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
	match<U, F>(fns: { ok: (value: T) => U | Promise<U>; err: (error: E) => F | Promise<F> }): Promise<U | F> {
		return this._promise.then(res => {
			if (res.isOk()) return fns.ok(res.value);
			return fns.err(res.error);
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
	 */
	unwrap(): Promise<T> {
		return this._promise.then(r => r.unwrap());
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
	 * const user = await fetchUser().inspect(async u => await logToDb(u.id));
	 * ```
	 */
	inspect(f: (value: T) => void | Promise<void>): ResultAsync<T, E> {
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
	 * const user = await fetchUser().inspectErr(async e => await submitErrorToSentry(e));
	 * ```
	 */
	inspectErr(f: (error: E) => void | Promise<void>): ResultAsync<T, E> {
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
	 * Catches a specific tagged error variant by its `_tag`, handles it, and removes it
	 * from the error union. Unmatched tags pass through unchanged.
	 *
	 * @param tag The `_tag` value to catch.
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
	catchTag<Tag extends string, E2 = never>(
		tag: Tag,
		handler: (error: [E] extends [TaggedError] ? Extract<E, { _tag: Tag }> : any) => Result<T, E2> | ResultAsync<T, E2> | PromiseLike<Result<T, E2>>
	): ResultAsync<T, [E] extends [TaggedError] ? Exclude<E, { _tag: Tag }> | E2 : E | E2> {
		return new ResultAsync(
			this._promise.then(res => res.catchTag(tag, handler as any) as any)
		) as ResultAsync<T, [E] extends [TaggedError] ? Exclude<E, { _tag: Tag }> | E2 : E | E2>;
	}

	*[Symbol.iterator](): Generator<ResultAsync<T, E>, T, any> {
		return (yield this) as T;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any> {
		return (yield await this) as T;
	}
}

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
	return new ResultAsync(Promise.resolve(value).then(v => ok(v)) as Promise<Result<T, E>>);
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
	return new ResultAsync(Promise.resolve(error).then(e => err(e)) as Promise<Result<T, E>>);
};

const ResultMethodsProto = {
	isOk<T, E>(this: Result<T, E>): this is Ok<T> {
		return this.ok;
	},
	isErr<T, E>(this: Result<T, E>): this is Err<E> {
		return !this.ok;
	},
	isOkAnd<T, E>(this: Result<T, E>, predicate: (value: T) => boolean): this is Ok<T> {
		return this.ok && predicate(this.value);
	},
	isErrAnd<T, E>(this: Result<T, E>, predicate: (error: E) => boolean): this is Err<E> {
		return !this.ok && predicate((this as unknown as Err<E>).error);
	},
	map<T, E, U>(this: Result<T, E>, f: (value: T) => U): Result<U, E> {
		return this.ok ? ok(f(this.value)) : err((this as unknown as Err<E>).error);
	},
	asyncMap<T, E, U>(this: Result<T, E>, f: (value: T) => Promise<U>): ResultAsync<U, E> {
		if (this.ok) {
			return new ResultAsync(f(this.value).then(v => ok(v)));
		}
		return errAsync((this as unknown as Err<E>).error);
	},
	mapErr<T, E, F>(this: Result<T, E>, f: (error: E) => F): Result<T, F> {
		return this.ok ? ok(this.value) : err(f((this as unknown as Err<E>).error));
	},
	mapOr<T, E, U>(this: Result<T, E>, defaultValue: U, f: (value: T) => U): U {
		return this.ok ? f(this.value) : defaultValue;
	},
	mapOrElse<T, E, U>(this: Result<T, E>, f: (error: E) => U, g: (value: T) => U): U {
		return this.ok ? g(this.value) : f((this as unknown as Err<E>).error);
	},
	and<T, E, U>(this: Result<T, E>, other: Result<U, E>): Result<U, E> {
		return this.ok ? other : err((this as unknown as Err<E>).error);
	},
	or<T, E, F>(this: Result<T, E>, other: Result<T, F>): Result<T, F> {
		return this.ok ? ok(this.value) : other;
	},
	andThen<T, E, U, F>(this: Result<T, E>, f: (value: T) => Result<U, F>): Result<U, E | F> {
		return this.ok
			? (f(this.value) as Result<U, E | F>)
			: (err((this as unknown as Err<E>).error) as Result<U, E | F>);
	},
	asyncAndThen<T, E, U, F>(this: Result<T, E>, f: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F> {
		if (this.ok) {
			return f(this.value) as ResultAsync<U, E | F>;
		}
		return errAsync((this as unknown as Err<E>).error as E | F);
	},
	orElse<T, E, F>(this: Result<T, E>, f: (error: E) => Result<T, F>): Result<T, F> {
		return this.ok ? ok(this.value) : f((this as unknown as Err<E>).error);
	},
	unwrap<T, E>(this: Result<T, E>): T {
		if (this.ok) return this.value;
		throw (this as unknown as Err<E>).error;
	},
	unwrapErr<T, E, V extends Error>(this: Result<T, E>, error?: V): E {
		if (!this.ok) return (this as unknown as Err<E>).error;
		if (error) throw error;
		throw new Error('Called unwrapErr on an Ok');
	},
	unwrapOr<T, E>(this: Result<T, E>, defaultValue: T): T {
		return this.ok ? this.value : defaultValue;
	},
	unwrapOrElse<T, E>(this: Result<T, E>, f: (error: E) => T): T {
		return this.ok ? this.value : f((this as unknown as Err<E>).error);
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
		throw new Error(message);
	},
	expectErr<T, E, V extends Error>(this: Result<T, E>, message: string, error?: V): E | never {
		if (!this.ok) return (this as unknown as Err<E>).error;
		if (error) throw error;
		throw new Error(message);
	},
	match<T, E, U, F>(this: Result<T, E>, fns: { ok: (value: T) => U; err: (error: E) => F }): U | F {
		return this.ok ? fns.ok(this.value) : fns.err((this as unknown as Err<E>).error);
	},
	inspect<T, E>(this: Result<T, E>, f: (value: T) => void): Result<T, E> {
		if (this.ok) f(this.value);
		return this;
	},
	inspectErr<T, E>(this: Result<T, E>, f: (error: E) => void): Result<T, E> {
		if (!this.ok) f((this as unknown as Err<E>).error);
		return this;
	},
	asyncInspect<T, E>(this: Result<T, E>, f: (value: T) => Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			Promise.resolve(this).then(async res => {
				if (res.isOk()) {
					await f(res.value);
				}
				return res;
			})
		);
	},
	asyncInspectErr<T, E>(this: Result<T, E>, f: (error: E) => Promise<void>): ResultAsync<T, E> {
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
	filter<T, E, F>(this: Result<T, E>, predicate: (value: T) => boolean, errorFn: (value: T) => F): Result<T, E | F> {
		if (!this.ok) return err<E | F, T>((this as unknown as Err<E>).error as E | F);
		if (predicate(this.value)) return ok<T, E | F>(this.value);
		return err<E | F, T>(errorFn(this.value));
	},
	flatten<T, E>(this: Result<T, E>): T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E> {
		if (!this.ok) return this as unknown as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
		// check if the strictly typed `Ok` value structurally conforms to a Result before unwrapping it

		const val = this.value as any;
		if (val !== null && typeof val === 'object' && ('ok' in val || 'isOk' in val)) {
			return val as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
		}
		return this as unknown as T extends Result<infer U, infer F> ? Result<U, E | F> : Result<T, E>;
	},
	swap<T, E>(this: Result<T, E>): Result<E, T> {
		return this.ok ? err(this.value) : ok((this as unknown as Err<E>).error);
	},
	catchTag<T, E, Tag extends string, E2 = never>(
		this: Result<T, E>,
		tag: Tag,
		handler: (error: [E] extends [TaggedError] ? Extract<E, { _tag: Tag }> : any) => Result<T, E2>
	): Result<T, [E] extends [TaggedError] ? Exclude<E, { _tag: Tag }> | E2 : E | E2> {
		if (this.ok) return this as any;
		const error = (this as unknown as Err<any>).error;
		if (error !== null && typeof error === 'object' && '_tag' in error && error._tag === tag) {
			return handler(error as any) as any;
		}
		return this as any;
	},
	*[Symbol.iterator]<T, E>(this: Result<T, E>): Generator<Result<T, E>, T, T> {
		return (yield this) as T;
	},
};

/**
 * Do-Notation implementation simulating Rust's `?` operator via JavaScript Generators.
 * Executes sequential code and unwraps `Ok` values automatically when `yield*` is called,
 * but immediately short-circuits and returns if any Result is an `Err`.
 *
 * Supports both synchronous `function* ()` and asynchronous `async function* ()` generators.
 * When yielding `ResultAsync` or using an async generator, `go()` will return a `ResultAsync`.
 *
 * @param generator A generator or async generator function utilizing `yield* result` pattern.
 * @returns The finalized unpacked `Ok` Result, or the first strict `Err`.
 *
 * @example
 * ```ts
 * const finalResult = chas.go(function* () {
 *     const user = yield* fetchUser(1);           // if err, stops here and returns Err
 *     const profile = yield* fetchProfile(user);
 *     return { user, profile };                   // wraps nicely in Ok
 * });
 *
 * const finalAsyncResult = await chas.go(async function* () {
 *     const user = yield* fetchUserAsync(1);      // `yield*` seamlessly unwraps ResultAsync
 *     const profile = yield* fetchProfile(user);  // mixes sync/async results natively
 *     return { user, profile };
 * });
 * ```
 */

export function go<Y, T>(
	generator: () => Generator<Y, T, any>
): Extract<Y, ResultAsync<any, any>> extends never ? Result<T, UnwrapErr<Y>> : ResultAsync<T, UnwrapErr<Y>>;

export function go<Y, T>(generator: () => AsyncGenerator<Y, T, any>): ResultAsync<T, UnwrapErr<Y>>;

export function go(
	generator: () => Generator<any, any, any> | AsyncGenerator<any, any, any>
): Result<any, any> | ResultAsync<any, any> {
	const generatorInstance = generator();
	const initialNext = generatorInstance.next();

	const isPromise = (val: any): val is Promise<any> =>
		val !== null && typeof val === 'object' && typeof val.then === 'function';

	if (isPromise(initialNext)) {
		// Native AsyncGenerator loop
		const runAsyncGeneratorLoop = async (
			initialStatePromise: Promise<IteratorResult<Result<any, any> | ResultAsync<any, any>, any>>
		): Promise<Result<any, any>> => {
			let state = await initialStatePromise;
			while (!state.done) {
				const result = state.value as Result<any, any> | ResultAsync<any, any>;
				const resolvedResult: Result<any, any> = result instanceof ResultAsync ? await result : result;

				if (resolvedResult.isErr()) return err(resolvedResult.error);

				state = await (
					generatorInstance as AsyncGenerator<Result<any, any> | ResultAsync<any, any>, any, any>
				).next(resolvedResult.value);
			}
			return ok(state.value);
		};

		return new ResultAsync(
			runAsyncGeneratorLoop(initialNext as Promise<IteratorResult<Result<any, any> | ResultAsync<any, any>, any>>)
		);
	}

	let state = initialNext as IteratorResult<Result<any, any> | ResultAsync<any, any>, any>;

	const runSyncGeneratorAsyncUpgradeLoop = async (
		currentState: IteratorResult<Result<any, any> | ResultAsync<any, any>, any>
	): Promise<Result<any, any>> => {
		let s = currentState;
		while (!s.done) {
			const result = s.value as Result<any, any> | ResultAsync<any, any>;
			const resolvedResult: Result<any, any> = result instanceof ResultAsync ? await result : result;

			if (resolvedResult.isErr()) return err(resolvedResult.error);

			s = (generatorInstance as Generator<Result<any, any> | ResultAsync<any, any>, any, any>).next(
				resolvedResult.value
			);
		}
		return ok(s.value);
	};

	while (!state.done) {
		const result = state.value as Result<any, any> | ResultAsync<any, any>;

		if (result instanceof ResultAsync) {
			return new ResultAsync(runSyncGeneratorAsyncUpgradeLoop(state));
		}

		if (result.isErr()) return err(result.error);

		state = (generatorInstance as Generator<Result<any, any> | ResultAsync<any, any>, any, any>).next(result.value);
	}

	return ok(state.value);
}

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
	return result as Result<T, E>;
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
export const err = <E, T = never>(error: E): Result<T, E> => {
	const result = Object.create(ResultMethodsProto);
	result.ok = false;
	result.error = error;
	return result as Result<T, E>;
};

/**
 * Creates a `ResultAsync` from a Native Promise.
 * Resolves to `Ok` if the promise fulfills, or `Err` if the promise rejects.
 *
 * @param promise The promise to execute.
 * @param onRejected A function to map the promise rejection reason to an error type `E`.
 * @returns A `ResultAsync` evaluating the promise.
 *
 * @example
 * ```ts
 * const fetchUser = () => Promise.resolve({ id: 1 });
 * const res = chas.fromPromise(fetchUser(), e => String(e));
 * ```
 */
export const fromPromise = <T, E = unknown>(
	promise: Promise<T>,
	onRejected: (error: unknown) => E
): ResultAsync<T, E> => {
	return new ResultAsync(promise.then(v => ok<T, E>(v)).catch(e => err<E, T>(onRejected(e))));
};

/**
 * Creates a `ResultAsync` from a Promise that is guaranteed not to reject.
 * Skips the `onRejected` mapper since rejection is not expected.
 *
 * @param promise A Promise that will not reject.
 * @returns A `ResultAsync` resolving to `Ok` containing the value.
 *
 * @example
 * ```ts
 * const res = chas.fromSafePromise(Promise.resolve(42));
 * const val = await res; // Ok(42)
 * ```
 */
export const fromSafePromise = <T>(promise: Promise<T>): ResultAsync<T, never> => {
	return ResultAsync.fromSafePromise(promise);
};

/**
 * Creates a `Result` from a synchronous function that may throw.
 * Returns `Ok` with the function's return value, or `Err` if an exception occurred.
 *
 * @param fn The synchronous function to execute.
 * @param onThrow A function to map the thrown exception to an error type `E`.
 * @returns A `Result` evaluating the function.
 *
 * @example
 * ```ts
 * const parseJson = (str: string) => chas.tryCatch(() => JSON.parse(str), e => new Error('Invalid JSON'));
 * ```
 */
export const tryCatch = <T, E>(fn: () => T, onThrow: (error: unknown) => E): Result<T, E> => {
	try {
		return ok(fn());
	} catch (e) {
		return err(onThrow(e));
	}
};

/**
 * Takes an iterable of `Result`s and returns a single `Result`.
 * Resolves to `Ok` containing an array of all values if strictly all inputs are `Ok`.
 * Short-circuits and resolves to the first `Err` encountered.
 *
 * **Note:** When passing a tuple of results where some have `never`-typed parameters
 * (e.g. bare `chas.ok()` or `chas.err()`), the tuple overload's mapped types may
 * degrade to `any`. This is a known TypeScript inference limitation with complex
 * recursive types. Results with concrete `T` and `E` types (e.g. from real functions)
 * infer correctly.
 *
 * @param results Iterable of Results.
 * @returns A single `Result` grouping the values or the first error.
 *
 * @example
 * ```ts
 * const r1 = chas.ok(1);
 * const r2 = chas.ok(2);
 * const all = chas.all([r1, r2]); // Ok([1, 2])
 * ```
 */
export function all<T extends readonly Result<any, any>[] | []>(
	results: T
): Result<{ -readonly [P in keyof T]: ExtractOkValue<T[P]> }, { [P in keyof T]: ExtractErrError<T[P]> }[number]>;
export function all<T, E>(results: Iterable<Result<T, E>>): Result<T[], E>;
export function all(results: Iterable<Result<any, any>>): Result<any, any> {
	const values: any[] = [];
	for (const result of results) {
		if (result.isErr()) {
			return err(result.error) as any;
		}
		values.push(result.value);
	}
	return ok(values) as any;
}

/**
 * Takes an iterable of `Result` promises (or `ResultAsync`s) and returns a single `ResultAsync`.
 * Combines all concurrent operations: resolves to an array of all values if all are `Ok`,
 * or resolves to the *first resolved* `Err`.
 *
 * **Note:** When passing a tuple of results where some have `never`-typed parameters
 * (e.g. bare `chas.okAsync()` or `chas.errAsync()`), the tuple overload's mapped types may
 * degrade to `any`. This is a known TypeScript inference limitation with complex
 * recursive types. Results with concrete `T` and `E` types (e.g. from real functions)
 * infer correctly.
 *
 * @param promises Iterable of Promises resolving to `Result`s.
 * @returns A Single `ResultAsync` grouping the outcomes.
 *
 * @example
 * ```ts
 * const p1 = chas.okAsync(1);
 * const p2 = chas.okAsync(2);
 * const allAsync = chas.allAsync([p1, p2]); // Resolves to Ok([1, 2])
 * ```
 */
// @ts-expect-error - TS2394: complex mapped-tuple return type through ResultAsync's private fields
//   causes a false-positive overload incompatibility. The implementation handles both overloads correctly.
export function allAsync<T extends readonly PromiseLike<Result<any, any>>[] | []>(
	promises: T
): ResultAsync<
	{ -readonly [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractOkValue<R> : never },
	{ [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractErrError<R> : never }[number]
>;
export function allAsync<T, E>(promises: Iterable<PromiseLike<Result<T, E>>>): ResultAsync<T[], E>;
export function allAsync(promises: Iterable<PromiseLike<Result<any, any>>>): ResultAsync<any, any> {
	return new ResultAsync(
		Promise.all(promises).then(results => {
			const values: any[] = [];
			for (const result of (results as any)) {
				if (result.isErr()) {
					return err(result.error);
				}
				values.push(result.value);
			}
			return ok(values);
		}) as any
	);
}

/**
 * Returns the first `Ok` result from an iterable, or `Err` with an array of all errors
 * if every result is an `Err`. The inverse of `all`.
 *
 * @param results Iterable of Results.
 * @returns The first `Ok` result, or `Err` of all collected errors.
 *
 * @example
 * ```ts
 * chas.any([chas.err('a'), chas.ok(2), chas.err('c')]); // Ok(2)
 * chas.any([chas.err('a'), chas.err('b')]);              // Err(['a', 'b'])
 * ```
 */
export function any<T extends readonly Result<any, any>[] | []>(
	results: T
): Result<{ [P in keyof T]: ExtractOkValue<T[P]> }[number], { -readonly [P in keyof T]: ExtractErrError<T[P]> }>;
export function any<T, E>(results: Iterable<Result<T, E>>): Result<T, E[]>;
export function any(results: Iterable<Result<any, any>>): Result<any, any[]> {
	const errors: any[] = [];
	for (const result of results) {
		if (result.isOk()) return ok(result.value);
		errors.push(result.error);
	}
	return err(errors);
}

/**
 * Returns the first resolved `Ok` from an iterable of async results,
 * or `Err` with an array of all errors if every result is an `Err`. The async inverse of `all`.
 *
 * @param promises Iterable of Promises resolving to `Result`s.
 * @returns A `ResultAsync` resolving to the first `Ok`, or `Err` of all errors.
 *
 * @example
 * ```ts
 * await chas.anyAsync([chas.errAsync('a'), chas.okAsync(2)]); // Ok(2)
 * ```
 */
// @ts-expect-error - TS2394: complex mapped-tuple return type through ResultAsync's private fields
//   causes a false-positive overload incompatibility. The implementation handles both overloads correctly.
export function anyAsync<T extends readonly PromiseLike<Result<any, any>>[] | []>(
	promises: T
): ResultAsync<
	{ [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractOkValue<R> : never }[number],
	{ -readonly [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractErrError<R> : never }
>;
export function anyAsync<T, E>(promises: Iterable<PromiseLike<Result<T, E>>>): ResultAsync<T, E[]>;
export function anyAsync(promises: Iterable<PromiseLike<Result<any, any>>>): ResultAsync<any, any[]> {
	return new ResultAsync(
		Promise.all(promises).then(results => {
			const errors: any[] = [];
			for (const result of results) {
				if (result.isOk()) return ok(result.value);
				errors.push(result.error);
			}
			return err(errors);
		})
	);
}

/**
 * Takes an iterable of `Result`s and returns a single `Result`.
 * Unlike `all`, does not short-circuit: resolves to `Ok` with all values if
 * strictly all inputs are `Ok`, or `Err` with an array of **all** errors encountered.
 *
 * Ideal for validation scenarios where you want to report every error at once.
 *
 * @param results Iterable of Results.
 * @returns A single `Result` containing all values or all errors.
 *
 * @example
 * ```ts
 * chas.collect([chas.ok(1), chas.err('a'), chas.err('b')]); // Err(['a', 'b'])
 * chas.collect([chas.ok(1), chas.ok(2)]);                    // Ok([1, 2])
 * ```
 */
export function collect<T extends readonly Result<any, any>[] | []>(
	results: T
): Result<{ -readonly [P in keyof T]: ExtractOkValue<T[P]> }, { [P in keyof T]: ExtractErrError<T[P]> }[number][]>;
export function collect<T, E>(results: Iterable<Result<T, E>>): Result<T[], E[]>;
export function collect(results: Iterable<Result<any, any>>): Result<any[], any[]> {
	const values: any[] = [];
	const errors: any[] = [];
	for (const result of results) {
		if (result.isOk()) {
			values.push(result.value);
		} else {
			errors.push(result.error);
		}
	}
	if (errors.length > 0) return err(errors);
	return ok(values);
}

/**
 * Takes an iterable of `Result` promises and returns a single `ResultAsync`.
 * Unlike `allAsync`, does not short-circuit: resolves to `Ok` with all values if
 * strictly all resolve to `Ok`, or `Err` with an array of **all** errors encountered.
 *
 * @param promises Iterable of Promises resolving to `Result`s.
 * @returns A single `ResultAsync` containing all values or all errors.
 *
 * @example
 * ```ts
 * await chas.collectAsync([chas.okAsync(1), chas.errAsync('a'), chas.errAsync('b')]); // Err(['a', 'b'])
 * ```
 */
// @ts-expect-error - TS2394: complex mapped-tuple return type through ResultAsync's private fields
//   causes a false-positive overload incompatibility. The implementation handles both overloads correctly.
export function collectAsync<T extends readonly PromiseLike<Result<any, any>>[] | []>(
	promises: T
): ResultAsync<
	{ -readonly [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractOkValue<R> : never },
	{ [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractErrError<R> : never }[number][]
>;
export function collectAsync<T, E>(promises: Iterable<PromiseLike<Result<T, E>>>): ResultAsync<T[], E[]>;
export function collectAsync(promises: Iterable<PromiseLike<Result<any, any>>>): ResultAsync<any[], any[]> {
	return new ResultAsync(
		Promise.all(promises).then(results => {
			const values: any[] = [];
			const errors: any[] = [];
			for (const result of results) {
				if (result.isOk()) {
					values.push(result.value);
				} else {
					errors.push(result.error);
				}
			}
			if (errors.length > 0) return err(errors);
			return ok(values);
		})
	);
}

/**
 * Wraps a synchronous function, returning a new function that returns a `Result`
 * instead of throwing.
 *
 * @param fn The function to wrap.
 * @param onThrow A function to map thrown exceptions to an error type `E`.
 * @returns A new function returning `Result<T, E>`.
 *
 * @example
 * ```ts
 * const safeParse = chas.withResult(JSON.parse, e => new Error('Failed to parse'));
 * const res = safeParse('{"a": 1}'); // Ok({ a: 1 })
 * ```
 */
export const withResult = <Args extends unknown[], T, E>(fn: (...args: Args) => T, onThrow: (error: unknown) => E) => {
	return (...args: Args): Result<T, E> => {
		try {
			return ok(fn(...args));
		} catch (e) {
			return err(onThrow(e));
		}
	};
};

/**
 * Wraps an asynchronous function, returning a new function that returns a `ResultAsync`
 * instead of rejecting or throwing.
 *
 * @param fn The async function to wrap.
 * @param onThrow A function to map thrown exceptions or rejections to an error type `E`.
 * @returns A new function returning `ResultAsync<T, E>`.
 *
 * @example
 * ```ts
 * const fetchUrl = async (url: string) => { ... }
 * const safeFetch = chas.withResultAsync(fetchUrl, e => String(e));
 * const res = await safeFetch('https://api.example.com'); // Ok(Response) or Err(ErrorString)
 * ```
 */
export const withResultAsync = <Args extends unknown[], T, E>(
	fn: (...args: Args) => Promise<T>,
	onThrow: (error: unknown) => E
) => {
	return (...args: Args): ResultAsync<T, E> => {
		return fromPromise(fn(...args), onThrow);
	};
};

/**
 * Partitions an iterable of `Result`s into an object containing separate arrays of `Ok` values and `Err` errors.
 * Does not short-circuit; evaluates all items.
 *
 * @param results An iterable of `Result`s.
 * @returns An object containing `oks` (array of values) and `errs` (array of errors).
 *
 * @example
 * ```ts
 * const results = [chas.ok(1), chas.err('e'), chas.ok(2)];
 * const { oks, errs } = chas.partition(results);
 * // oks is [1, 2], errs is ['e']
 * ```
 */
export const partition = <T, E>(results: Iterable<Result<T, E>>): { oks: T[]; errs: E[] } => {
	const oks: T[] = [];
	const errs: E[] = [];

	for (const result of results) {
		if (result.isOk()) {
			oks.push(result.value);
		} else {
			errs.push(result.error);
		}
	}

	return { oks, errs };
};

/**
 * Awaits multiple `ResultAsync`s (or Promises of `Result`s) and partitions them into separate arrays of `Ok` values and `Err` errors.
 * Note: This returns a standard `Promise` rather than a `ResultAsync`, because partitioning itself does not "fail".
 *
 * @param promises An iterable of Promises resolving to `Result`s.
 * @returns A Promise resolving to an object containing `oks` and `errs` arrays.
 *
 * @example
 * ```ts
 * const promises = [chas.okAsync(1), chas.errAsync('e')];
 * const { oks, errs } = await chas.partitionAsync(promises);
 * // oks is [1], errs is ['e']
 * ```
 */
export const partitionAsync = async <T, E>(
	promises: Iterable<PromiseLike<Result<T, E>>>
): Promise<{ oks: T[]; errs: E[] }> => {
	const resolvedResults = await Promise.all(promises);
	return partition(resolvedResults);
};

/**
 *
 * Re-attaches a `Result` object's methods if they were stripped.
 * Since a `Result` can be cleanly serialized to `{ "ok": true|false,
 * "value|error": ... }`, this allows you to "revive" those methods.
 *
 * Note: Throws if `parsedJson` is not a Result
 *
 * @example
 * ```ts
 * const safeData = chas.revive(await response.json());
 * ```
 */
export const revive = <T, E>(parsedJson: unknown): Result<T, E> => {
	if (!parsedJson || typeof parsedJson !== 'object' || !('ok' in parsedJson) || typeof parsedJson.ok !== 'boolean') {
		throw new Error('Invalid Result object in chas.revive, got ' + JSON.stringify(parsedJson));
	}

	const result = Object.create(ResultMethodsProto);
	Object.assign(result, parsedJson);
	return result;
};

/**
 * Wraps an asynchronous function with resilience logic (retries and timeouts),
 * returning a new function that returns a `ResultAsync`.
 *
 * @param fn The async function to execute.
 * @param options Configuration for retries and timeouts.
 * @param options.retries Maximum number of retries (default: 0).
 * @param options.delayMs Optional delay in milliseconds between attempts.
 * @param options.timeoutMs Optional timeout in milliseconds per attempt.
 * @param options.onTimeout A function to return an error `E` if an attempt times out.
 * @param options.onThrow A function to map thrown exceptions or rejections to an error type `E`.
 * @returns A new function returning `ResultAsync<T, E>`.
 */
export const withRetryAsync = <Args extends unknown[], T, E>(
	fn: (...args: Args) => Promise<T>,
	options: {
		retries?: number;
		delayMs?: number;
		timeoutMs?: number;
		onTimeout?: () => E;
		onThrow: (error: unknown) => E;
	}
) => {
	return (...args: Args): ResultAsync<T, E> => {
		const retries = options.retries ?? 0;
		const timeoutMs = options.timeoutMs;

		const executeAttempt = async (): Promise<T> => {
			if (!timeoutMs || timeoutMs <= 0) {
				return fn(...args);
			}

			return new Promise<T>((resolve, reject) => {
				const timer = setTimeout(() => {
					reject({ _isChasTimeout: true });
				}, timeoutMs);

				fn(...args).then(
					res => {
						clearTimeout(timer);
						resolve(res);
					},
					err => {
						clearTimeout(timer);
						reject(err);
					}
				);
			});
		};

		const attempt = async (attemptsLeft: number): Promise<Result<T, E>> => {
			try {
				const value = await executeAttempt();
				return ok<T, E>(value);
			} catch (e: any) {
				if (attemptsLeft > 0) {
					if (options.delayMs && options.delayMs > 0) {
						await new Promise(res => setTimeout(res, options.delayMs));
					}
					return attempt(attemptsLeft - 1);
				}

				if (e && e._isChasTimeout) {
					const timeoutError = options.onTimeout
						? options.onTimeout()
						: options.onThrow(new Error('Operation timed out'));
					return err<E, T>(timeoutError);
				}

				return err<E, T>(options.onThrow(e));
			}
		};

		return new ResultAsync(attempt(retries));
	};
};

/**
 * Takes an object where values are `Result`s and returns a single `Result` containing
 * an object with the identically key-mapped `Ok` values, or the first `Err` encountered.
 *
 * **Note:** When some values have `never`-typed parameters (e.g. bare `chas.ok()` or `chas.err()`),
 * the inferred error union type may degrade to `any`. This is a known TypeScript inference
 * limitation with complex recursive types. Results with concrete `T` and `E` types
 * (e.g. from real functions) infer correctly.
 *
 * @param resultsRecord Object mapping keys to Results.
 * @returns A single `Result` of the shaped object, or the first error.
 *
 * @example
 * ```ts
 * const data = chas.shape({
 *     user: getUser(id),
 *     config: getConfig(),
 * });
 * // Ok({ user: User, config: Config }) or first Err
 * ```
 */
export const shape = <TRec extends Record<string, Result<any, any>>>(
	resultsRecord: TRec
): Result<
	{
		[K in keyof TRec]: TRec[K] extends Result<infer T, any> ? T : never;
	},
	{
		[K in keyof TRec]: TRec[K] extends Result<any, infer E> ? E : never;
	}[keyof TRec]
> => {
	const keys = Object.keys(resultsRecord) as Array<keyof TRec>;
	const okOutput: any = {};

	for (const key of keys) {
		const res = resultsRecord[key]!;
		if (res.isErr()) {
			return err(res.error) as any;
		}
		okOutput[key] = res.value;
	}

	return ok(okOutput) as any;
};

/**
 * Takes an object where values are `ResultAsync`s or Promises of `Result`s.
 * Concurrently awaits all of them and returns a single `ResultAsync` containing
 * an object with the identically key-mapped `Ok` values, or the first `Err` encountered.
 *
 * **Note:** When some values have `never`-typed parameters (e.g. bare `chas.errAsync()`),
 * the inferred error union type may degrade to `any`. This is a known TypeScript inference
 * limitation with complex recursive types. Results with concrete `T` and `E` types
 * (e.g. from real functions) infer correctly.
 *
 * @param promisesRecord Object mapping keys to async Results.
 * @returns A `ResultAsync` of the shaped object, or the first error.
 *
 * @example
 * ```ts
 * const dashboardData = await chas.shapeAsync({
 *     user: fetchUser(id),
 *     posts: fetchPosts(id),
 *     settings: fetchSettings(id)
 * });
 * ```
 */
export const shapeAsync = <TRec extends Record<string, ResultAsync<any, any> | PromiseLike<Result<any, any>>>>(
	promisesRecord: TRec
): ResultAsync<
	{
		[K in keyof TRec]: TRec[K] extends PromiseLike<Result<infer T, any>> ? T : never;
	},
	{
		[K in keyof TRec]: TRec[K] extends PromiseLike<Result<any, infer E>> ? E : never;
	}[keyof TRec]
> => {
	const keys = Object.keys(promisesRecord) as Array<keyof TRec>;
	const promises = keys.map(key => promisesRecord[key]);

	return new ResultAsync(
		Promise.all(promises).then(results => {
			const okOutput: any = {};

			for (let i = 0; i < results.length; i++) {
				const res = results[i]!;
				if (res.isErr()) {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore - complex type mapping that is hard for TS to properly infer natively
					return err(res.error);
				}
				okOutput[keys[i]!] = res.value;
			}

			return ok(okOutput);
		})
	);
};

// Re-export tagged errors system
export { errors, matchError, matchErrorPartial, isErrorTag } from './errors.js';
export type { TaggedError, ErrorDefinitions, ErrorFactories, InferErrors, MatchErrorHandlers, MatchErrorPartialHandlers } from './errors.js';
