import { type TaggedErr, defineErrs, type InferErr } from './tagged-errs.js';
import { type None, type Option, type OptionAsync, type Some } from './option.js';
import { type Guard } from './guard.js';
import type { NonVoid } from './utils.js';
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

/** Helper to extract the string tag from either a string or an error factory */
export type CatchTarget = string | { is: (err: any) => err is { readonly _tag: string } };
export type CatchTag<Target> = Target extends string
	? Target
	: Target extends { is: (err: any) => err is { readonly _tag: infer Tag } }
		? Tag
		: never;

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errs = defineErrs({
	ChasErr: (message: string, origin: string, cause?: unknown) => ({ message, origin, cause }),
});

export type ChasErr = InferErr<typeof errs, 'ChasErr'>;

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
	 * ```
	 */
	readonly catchTag: <Target extends CatchTarget, T2 = T, E2 = never>(
		target: Target,
		handler: (error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any) => Result<T2, E2>
	) => Result<T | T2, [E] extends [TaggedErr] ? Exclude<E, { _tag: CatchTag<Target> }> | E2 : E | E2>;
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
		handler: (error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any) => void
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

/**
 * Represents either a success (`Ok<T>`) or a failure (`Err<E>`).
 * Both branches provide the extensive list of functional methods available in `ResultMethods`.
 */
export type Result<T, E> = (Ok<T> & ResultMethods<T, E>) | (Err<E> & ResultMethods<T, E>);

/**
 * A promise-like wrapper representing a `Result` that evaluates asynchronously.
 * Can be directly `await`ed or chained with further operators.
 *
 * @example
 * ```ts
 * const res = chas.ResultAsync.fromSafePromise(Promise.resolve(42));
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

	static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
		return new ResultAsync<T, E>(Promise.resolve(result));
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
			error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any
		) => Result<T2, E2> | ResultAsync<T2, E2> | PromiseLike<Result<T2, E2>>
	): ResultAsync<T | T2, [E] extends [TaggedErr] ? Exclude<E, { _tag: CatchTag<Target> }> | E2 : E | E2> {
		return new ResultAsync(
			this._promise.then(res => res.catchTag<Target, T2, E2>(target, handler as any))
		) as ResultAsync<T | T2, [E] extends [TaggedErr] ? Exclude<E, { _tag: CatchTag<Target> }> | E2 : E | E2>;
	}

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
	 * // Result<User, DbError | Unauthorized | NotFound>
	 * ```
	 */
	tapTag<Target extends CatchTarget>(
		target: Target,
		handler: (
			error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any
		) => void | PromiseLike<void>
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

const ResultMethodsProto = {
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
		throw errs.ChasErr('Called unwrapErr on an Ok', 'Result.unwrapErr', this);
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
		throw errs.ChasErr(message, 'Result.expect', this);
	},
	expectErr<T, E, V extends Error>(this: Result<T, E>, message: string, error?: V): E | never {
		if (!this.ok) return this.error;
		if (error) throw error;
		throw errs.ChasErr(message, 'Result.expectErr', this);
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
		handler: (error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any) => Result<T2, E2>
	): Result<T | T2, [E] extends [TaggedErr] ? Exclude<E, { _tag: CatchTag<Target> }> | E2 : E | E2> {
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
		handler: (
			error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any
		) => void | PromiseLike<void>
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
	toJSON<T, E>(this: Result<T, E>): { ok: true; value: T } | { ok: false; error: E } {
		return this.ok ? { ok: true, value: this.value } : { ok: false, error: this.error };
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
				const result = state.value;
				const resolvedResult: Result<any, any> = result instanceof ResultAsync ? await result : result;

				if (resolvedResult.isErr()) return err(resolvedResult.error);

				state = await generatorInstance.next(resolvedResult.value);
			}
			return ok(state.value);
		};

		return new ResultAsync(runAsyncGeneratorLoop(initialNext));
	}

	let state = initialNext;

	const runSyncGeneratorAsyncUpgradeLoop = async (
		currentState: IteratorResult<Result<any, any> | ResultAsync<any, any>, any>
	): Promise<Result<any, any>> => {
		let s = currentState;
		while (!s.done) {
			const result = s.value;
			const resolvedResult: Result<any, any> = result instanceof ResultAsync ? await result : result;

			if (resolvedResult.isErr()) return err(resolvedResult.error);

			s = (generatorInstance as Generator<Result<any, any> | ResultAsync<any, any>, any, any>).next(
				resolvedResult.value
			);
		}
		return ok(s.value);
	};

	while (!state.done) {
		const result = state.value;

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
	onRejected?: (error: unknown) => E
): ResultAsync<T, E extends null | undefined ? unknown : E> => {
	return new ResultAsync(promise.then(v => ok<T, E>(v)).catch(e => err<E, T>(onRejected?.(e) ?? e))) as ResultAsync<
		T,
		E extends null | undefined ? unknown : E
	>;
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
 * @param onThrow A function to map the thrown exception to an error type `E`. If not provided, the thrown exception is returned as the error value typed as `unknown`.
 * @returns A `Result` evaluating the function.
 *
 * @example
 * ```ts
 * const parseJson = (str: string) => chas.tryCatch(() => JSON.parse(str), e => new Error('Invalid JSON'));
 * ```
 */
export const tryCatch = <T, E = unknown>(
	fn: () => T,
	onThrow?: (error: unknown) => E
): Result<T, E extends null | undefined ? unknown : E> => {
	try {
		return ok(fn());
	} catch (e) {
		return err(onThrow?.(e) ?? e) as Result<T, E extends null | undefined ? unknown : E>;
	}
};

/**
 * Creates a `Result` from a value based on a type guard.
 *
 * If the guard returns `true`, returns `Ok(value as T)`.
 * Otherwise, returns `Err(error)`.
 *
 * @param value The value to check.
 * @param guard The type guard to use.
 * @param error Either the error value or a function that produces it.
 * @returns An `Ok` result if the guard passes, otherwise an `Err`.
 *
 * @example
 * ```ts
 * const res = chas.resultFromGuard(val, is.string, 'Not a string');
 * ```
 */
export const resultFromGuard = <T, E>(
	value: unknown,
	guard: Guard<T>,
	error: E | ((value: unknown) => E)
): Result<T, E> => {
	if (guard(value)) return ok(value as T);
	return err(typeof error === 'function' ? (error as any)(value) : error);
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
			return err(result.error);
		}
		values.push(result.value);
	}
	return ok(values);
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
			for (const result of results) {
				if (result.isErr()) {
					return err(result.error);
				}
				values.push(result.value);
			}
			return ok(values);
		})
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
 * Returns the first `Result` encountered from an iterable, regardless of whether it is `Ok` or `Err`.
 * In synchronous contexts, this simply evaluates to the first element since it evaluates left-to-right.
 *
 * @param results Iterable of Results.
 * @returns The first `Result`.
 *
 * @example
 * ```ts
 * chas.race([chas.err('a'), chas.ok(2)]); // Err('a')
 * chas.race([chas.ok(1), chas.err('b')]); // Ok(1)
 * ```
 */
export function race<T extends readonly Result<any, any>[] | []>(results: T): T[number];
export function race<T, E>(results: Iterable<Result<T, E>>): Result<T, E>;
export function race(results: Iterable<Result<any, any>>): Result<any, any> {
	for (const result of results) {
		return result;
	}
	throw errs.ChasErr('chas.race was called with an empty iterable', 'chas.race', results);
}

/**
 * Returns the first resolved `Result` from an iterable of async results,
 * regardless of whether it is an `Ok` or an `Err`.
 *
 * @param promises Iterable of Promises resolving to `Result`s.
 * @returns A `ResultAsync` resolving to the first outcome.
 *
 * @example
 * ```ts
 * await chas.raceAsync([chas.errAsync('a'), chas.okAsync(2)]); // Whichever resolves first
 * ```
 */
export function raceAsync<T extends readonly PromiseLike<Result<any, any>>[] | []>(
	promises: T
): ResultAsync<
	{ [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractOkValue<R> : never }[number],
	{ [P in keyof T]: T[P] extends PromiseLike<infer R> ? ExtractErrError<R> : never }[number]
>;
export function raceAsync<T, E>(promises: Iterable<PromiseLike<Result<T, E>>>): ResultAsync<T, E>;
export function raceAsync(promises: Iterable<PromiseLike<Result<any, any>>>): ResultAsync<any, any> {
	return new ResultAsync(Promise.race(promises));
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
 * @param onThrow A function to map thrown exceptions to an error type `E`. If not provided, the thrown exception is returned as the error value typed as `unknown`.
 * @returns A new function returning `Result<T, E>`.
 *
 * @example
 * ```ts
 * const safeParse = chas.withResult(JSON.parse, e => new Error('Failed to parse'));
 * const res = safeParse('{"a": 1}'); // Ok({ a: 1 })
 * ```
 */
export const wrap = <Args extends unknown[], T, E = unknown>(
	fn: (...args: Args) => T,
	onThrow?: (error: unknown) => E
): ((...args: Args) => Result<T, E extends null | undefined ? unknown : E>) => {
	return (...args: Args): Result<T, E extends null | undefined ? unknown : E> => {
		try {
			return ok(fn(...args));
		} catch (e) {
			return err(onThrow?.(e) ?? e) as Result<T, E extends null | undefined ? unknown : E>;
		}
	};
};

/**
 * Wraps an asynchronous function, returning a new function that returns a `ResultAsync`
 * instead of rejecting or throwing.
 *
 * @param fn The async function to wrap.
 * @param onThrow A function to map thrown exceptions or rejections to an error type `E`. If not provided, the thrown exception is returned as the error value typed as `unknown`.
 * @returns A new function returning `ResultAsync<T, E>`.
 *
 * @example
 * ```ts
 * const fetchUrl = async (url: string) => { ... }
 * const safeFetch = chas.withResultAsync(fetchUrl, e => String(e));
 * const res = await safeFetch('https://api.example.com'); // Ok(Response) or Err(ErrorString)
 * ```
 */
export const wrapAsync = <Args extends unknown[], T, E = unknown>(
	fn: (...args: Args) => Promise<T>,
	onThrow?: (error: unknown) => E
) => {
	return (...args: Args): ResultAsync<T, E extends null | undefined ? unknown : E> => {
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
 * Note: Throws `ChasErr` if `parsedJson` is not a Result
 *
 * @example
 * ```ts
 * const safeData = chas.reattachResultMethods(await response.json());
 * ```
 */
export const reattachResultMethods = <T, E>(parsedJson: unknown): Result<T, E> => {
	if (!parsedJson || typeof parsedJson !== 'object' || !('ok' in parsedJson) || typeof parsedJson.ok !== 'boolean') {
		throw errs.ChasErr(
			'Invalid Result object in chas.revive, got ' + JSON.stringify(parsedJson),
			'chas.revive',
			parsedJson
		);
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
						: options.onThrow(errs.ChasErr('Operation timed out', 'withRetryAsync', e));
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
	const keys = Object.keys(resultsRecord);
	const okOutput: any = {};

	for (const key of keys) {
		const res = resultsRecord[key]!;
		if (res.isErr()) {
			return err(res.error);
		}
		okOutput[key] = res.value;
	}

	return ok(okOutput);
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
	const keys = Object.keys(promisesRecord);
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

/**
 * Wraps a function that returns a `Promise<Result<T, E>>` in a `ResultAsync<T, E>`, allowing for easy creation of `ResultAsync`-returning functions.
 *
 * @param fn Async function that returns a `Result` (most commonly with `ok()` or `err()`).
 * @param onThrow Optional function to map thrown exceptions or rejections to an error type `E`.
 * @returns `ResultAsync` that returns the same result as the input function.
 *
 * @example
 * ```ts
 * const fetchUser = asyncFn(async (id: number) => {
 *     const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
 *     if (!res.ok) return err('NOT_FOUND');
 *     return ok(await res.json());
 * }); // Returns ResultAsync<User, string>
 *
 * const fetchUserWithCatch = asyncFn(async (id: number) => {
 *     const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
 *     if (!res.ok) throw 'NOT_FOUND';
 *     return ok(await res.json());
 * }, (error) => error as string); // Returns ResultAsync<User, string>
 * ```
 */
export const asyncFn = <Args extends unknown[], T, E>(
	fn: (...args: Args) => Promise<Result<T, E>>,
	onThrow?: (error: unknown) => E
) => {
	return (...args: Args): ResultAsync<T, E> => {
		const promise = fn(...args).catch(error => err(onThrow ? onThrow(error) : (error as E)));
		return new ResultAsync(promise as Promise<Result<T, E>>);
	};
};

/**
 * Wraps a schema with a parse method in a `Result` that returns the parsed value on success or an error on failure.
 * Most useful for those migrating from libraries like Zod.
 *
 * @param schema Schema with a parse method.
 * @param onErr Function to map thrown exceptions or rejections to an error type `E`.
 * @returns `Result` that returns the same result as the input function.
 *
 * @example
 * ```ts
 * const parseUser = fromSchema(z.object({ name: z.string() }), (error) => error.message as string);
 * // parseUser is now typed as Result<{ name: string }, string>
 * ```
 */
export const fromSchema = <T, E, S extends { parse: (input: unknown) => T }>(
	schema: S,
	onErr: (error: unknown) => E
) => {
	return (input: unknown): Result<T, E> => {
		try {
			return ok(schema.parse(input));
		} catch (error) {
			return err(onErr(error));
		}
	};
};

/**
 * Also a namespace for Result utilities, merges with the `Result` type definition.
 */
export const Result = {
	ok,
	err,
	tryCatch,
	fromPromise,
	fromSafePromise,
	wrap,
	go,
	partition,
	reattachMethods: reattachResultMethods,
	shape,
	fromGuard: resultFromGuard,
} as const;

const resultGo = go;

/**
 * Also a namespace for ResultAsync utilities, merges with the `ResultAsync` type definition.
 */
export namespace ResultAsync {
	export const all = allAsync;
	export const any = anyAsync;
	export const race = raceAsync;
	export const collect = collectAsync;
	export const partition = partitionAsync;
	export const wrap = wrapAsync;
	export const withRetry = withRetryAsync;
	export const shape = shapeAsync;
	export const go = resultGo;
	export const ok = okAsync;
	export const err = errAsync;
	export const fn = asyncFn;
}
