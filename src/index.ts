export namespace chas {
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

		constructor(promise: Promise<Result<T, E>>) {
			this._promise = promise;
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
						// If the next function returns a ResultAsync, we must await it
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
			return !this.ok && predicate(this.error);
		},
		map<T, E, U>(this: Result<T, E>, f: (value: T) => U): Result<U, E> {
			return this.ok ? ok(f(this.value)) : err(this.error);
		},
		mapErr<T, E, F>(this: Result<T, E>, f: (error: E) => F): Result<T, F> {
			return this.ok ? ok(this.value) : err(f(this.error));
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
			return this.ok ? (f(this.value) as Result<U, E | F>) : (err(this.error) as Result<U, E | F>);
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
			throw new Error('Called unwrapErr on an Ok');
		},
		unwrapOr<T, E>(this: Result<T, E>, defaultValue: T): T {
			return this.ok ? this.value : defaultValue;
		},
		unwrapOrElse<T, E>(this: Result<T, E>, f: (error: E) => T): T {
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
			throw new Error(message);
		},
		expectErr<T, E, V extends Error>(this: Result<T, E>, message: string, error?: V): E | never {
			if (!this.ok) return this.error;
			if (error) throw error;
			throw new Error(message);
		},
		match<T, E, U, F>(this: Result<T, E>, fns: { ok: (value: T) => U; err: (error: E) => F }): U | F {
			return this.ok ? fns.ok(this.value) : fns.err(this.error);
		},
		inspect<T, E>(this: Result<T, E>, f: (value: T) => void): Result<T, E> {
			if (this.ok) f(this.value);
			return this;
		},
		inspectErr<T, E>(this: Result<T, E>, f: (error: E) => void): Result<T, E> {
			if (!this.ok) f(this.error);
			return this;
		},
	};

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
	export const fromPromise = <T, E>(promise: Promise<T>, onRejected: (error: unknown) => E): ResultAsync<T, E> => {
		return new ResultAsync(promise.then(v => ok<T, E>(v)).catch(e => err<E, T>(onRejected(e))));
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
	export const all = <T, E>(results: Iterable<Result<T, E>>): Result<T[], E> => {
		const values: T[] = [];
		for (const result of results) {
			if (result.isErr()) {
				return err(result.error);
			}
			values.push(result.value);
		}
		return ok(values);
	};

	/**
	 * Takes an iterable of `Result` promises (or `ResultAsync`s) and returns a single `ResultAsync`.
	 * Combines all concurrent operations: resolves to an array of all values if all are `Ok`,
	 * or resolves to the *first resolved* `Err`.
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
	export const allAsync = <T, E>(promises: Iterable<PromiseLike<Result<T, E>>>): ResultAsync<T[], E> => {
		return new ResultAsync(
			Promise.all(promises).then(results => {
				const values: T[] = [];

				for (const result of results) {
					if (result.isErr()) {
						return err<E, T[]>(result.error);
					}
					values.push(result.value);
				}

				return ok<T[], E>(values);
			})
		);
	};

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
	export const withResult = <Args extends unknown[], T, E>(
		fn: (...args: Args) => T,
		onThrow: (error: unknown) => E
	) => {
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
		// Wait for all concurrent operations to finish
		const resolvedResults = await Promise.all(promises);
		// Reuse the synchronous partition function
		return partition(resolvedResults);
	};
}
