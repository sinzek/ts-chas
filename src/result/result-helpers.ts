import type { Guard } from '../guard/shared.js';
import { GlobalErrs } from '../tagged-errs.js';
import { err, isResult, ok, ResultAsync, ResultMethodsProto, type Result } from './result.js';
import type { ExtractErrError, ExtractOkValue, UnwrapErr } from './shared.js';

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
 * For async functions, use `tryCatchAsync`.
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
 * Creates a `ResultAsync` from an async function that may throw or reject.
 * Returns `Ok` with the resolved value, or `Err` if the function throws synchronously
 * or the returned promise rejects.
 *
 * For synchronous functions, use `tryCatch`.
 *
 * @param fn The async function to execute.
 * @param onThrow A function to map the thrown exception or rejection to an error type `E`. If not provided, the raw exception is used as the error value (typed as `unknown`).
 * @returns A `ResultAsync` evaluating the function.
 *
 * @example
 * ```ts
 * const fetchUser = (id: number) => chas.tryCatchAsync(
 *   () => fetch(`/users/${id}`).then(r => r.json()),
 *   e => new NetworkError(String(e)),
 * );
 * ```
 */
export const tryCatchAsync = <T, E = unknown>(
	fn: () => Promise<T>,
	onThrow?: (error: unknown) => E
): ResultAsync<T, E extends null | undefined ? unknown : E> => {
	let promise: Promise<T>;
	try {
		promise = fn();
	} catch (e) {
		return new ResultAsync(Promise.resolve(err(onThrow?.(e) ?? e))) as ResultAsync<
			T,
			E extends null | undefined ? unknown : E
		>;
	}
	return new ResultAsync(promise.then(v => ok(v)).catch(e => err(onThrow?.(e) ?? e))) as ResultAsync<
		T,
		E extends null | undefined ? unknown : E
	>;
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
	throw GlobalErrs.ChasErr({
		message: 'chas.race was called with an empty iterable',
		origin: 'chas.race',
		cause: results,
	});
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
	const arr = Array.from(promises);
	if (arr.length === 0) {
		throw GlobalErrs.ChasErr({
			message: 'chas.raceAsync was called with an empty iterable',
			origin: 'chas.raceAsync',
			cause: promises,
		});
	}
	return new ResultAsync(Promise.race(arr));
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
 * Wraps a synchronous function, returning a new function that returns a `Result` instead of throwing.
 *
 * Supports two workflows:
 * - **Wrap-a-thrower**: pass an existing function that returns a plain value and may throw.
 *   Provide an optional `onThrow` mapper to type the error.
 * - **Define-with-Result**: pass a function whose body explicitly returns `ok()`/`err()`.
 *   Throws from that body are still caught and turned into `err()`.
 *
 * @example
 * ```ts
 * // Wrap-a-thrower
 * const safeParse = chas.wrap(JSON.parse, e => new SyntaxError(String(e)));
 * safeParse('{"a":1}');     // Ok({ a: 1 })
 * safeParse('bad json');    // Err(SyntaxError)
 *
 * // Define-with-Result
 * const divide = chas.wrap((a: number, b: number) => {
 *     if (b === 0) return chas.err('division by zero' as const);
 *     return chas.ok(a / b);
 * });
 * divide(10, 2);   // Ok(5)
 * divide(10, 0);   // Err('division by zero')
 * ```
 */
export function wrap<Args extends unknown[], T, E>(
	fn: (...args: Args) => Result<T, E>,
	onThrow?: (error: unknown) => E
): (...args: Args) => Result<T, E>;
export function wrap<Args extends unknown[], T, E = unknown>(
	fn: (...args: Args) => T,
	onThrow?: (error: unknown) => E
): (...args: Args) => Result<T, E extends null | undefined ? unknown : E>;
export function wrap(fn: (...args: any[]) => any, onThrow?: (error: unknown) => any) {
	return (...args: any[]) => {
		try {
			const val = fn(...args);
			return isResult(val) ? val : ok(val);
		} catch (e) {
			return err(onThrow ? onThrow(e) : e);
		}
	};
}

/**
 * Wraps an asynchronous function, returning a new function that returns a `ResultAsync`
 * instead of throwing or rejecting.
 *
 * Supports two workflows:
 * - **Wrap-a-thrower**: pass an existing async function that returns a plain value and may
 *   throw or reject. Provide an optional `onThrow` mapper to type the error.
 * - **Define-with-Result**: pass an async function whose body explicitly returns `ok()`/`err()`.
 *   Sync throws before the first `await` and async rejections are still caught.
 *
 * @example
 * ```ts
 * // Wrap-a-thrower
 * const safeFetch = chas.wrapAsync(fetch, e => new NetworkError(String(e)));
 * await safeFetch('/api/user');  // Ok(Response) or Err(NetworkError)
 *
 * // Define-with-Result
 * const findUser = chas.wrapAsync(async (id: string) => {
 *     const user = await db.find(id);
 *     if (!user) return chas.err('NOT_FOUND' as const);
 *     return chas.ok(user);
 * });
 * await findUser('123');  // Ok(User) or Err('NOT_FOUND')
 * ```
 */
export function wrapAsync<Args extends unknown[], T, E>(
	fn: (...args: Args) => Result<T, E> | PromiseLike<Result<T, E>>,
	onThrow?: (error: unknown) => E
): (...args: Args) => ResultAsync<T, E>;
export function wrapAsync<Args extends unknown[], T, E = unknown>(
	fn: (...args: Args) => T | PromiseLike<T>,
	onThrow?: (error: unknown) => E
): (...args: Args) => ResultAsync<T, E extends null | undefined ? unknown : E>;
export function wrapAsync(fn: (...args: any[]) => any, onThrow?: (error: unknown) => any) {
	return (...args: any[]): ResultAsync<any, any> => {
		return ResultAsync.from(() => fn(...args), onThrow) as ResultAsync<any, any>;
	};
}

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
 * Note: Throws `ChasErr` if `parsedJson` is not of the shape { ok: boolean }
 *
 * @example
 * ```ts
 * const safeData = chas.revive(await response.json());
 * ```
 */
export function revive<T, E>(parsedJson: Result<T, E> | (() => Result<T, E>)): Result<T, E>;
export function revive<T, E = never>(parsedJson: { ok: true; value: T } | (() => { ok: true; value: T })): Result<T, E>;
export function revive<E, T = never>(
	parsedJson: { ok: false; error: E } | (() => { ok: false; error: E })
): Result<T, E>;
export function revive<T, E>(
	parsedJson: { ok: boolean; value: T; error: E } | (() => { ok: boolean; value: T; error: E })
): Result<T, E>;
export function revive<T, E = never>(
	parsedJson: { ok: boolean; value: T } | (() => { ok: boolean; value: T })
): Result<T, E>;
export function revive<E, T = never>(
	parsedJson: { ok: boolean; error: E } | (() => { ok: boolean; error: E })
): Result<T, E>;
export function revive<T = undefined, E = never>(parsedJson: { ok: true } | (() => { ok: true })): Result<T, E>;
export function revive<E = undefined, T = never>(parsedJson: { ok: false } | (() => { ok: false })): Result<T, E>;
export function revive<T = unknown, E = unknown>(
	parsedJson: { ok: boolean; value?: T; error?: E } | (() => { ok: boolean; value?: T; error?: E })
): Result<T, E>;
export function revive<T = unknown, E = unknown>(parsedJson: unknown | (() => unknown)): Result<T, E>;
export function revive(parsedJson: any): any {
	let json = parsedJson;
	if (typeof json === 'function') {
		json = json();
	}
	if (!json || typeof json !== 'object' || !('ok' in json) || typeof json.ok !== 'boolean') {
		throw GlobalErrs.ChasErr({
			message: '[ts-chas] Invalid Result object in chas.revive, got ' + JSON.stringify(json),
			origin: 'chas.revive',
			cause: json,
		});
	}

	if ('isOk' in json && typeof (json as any).isOk === 'function') {
		return json as any;
	}

	const result = Object.create(ResultMethodsProto);
	Object.assign(result, json);
	return result;
}

/**
 * Re-attaches a `ResultAsync` object's methods if they were stripped.
 * Since a `ResultAsync` can be cleanly serialized to `{ "ok": true|false,
 * "value|error": ... }`, this allows you to "revive" those methods.
 *
 * Note: Throws `ChasErr` if the evaluated promise is not of the shape { ok: boolean }
 *
 * @example
 * ```ts
 * const safeData = chas.reviveAsync(await response.json());
 * ```
 */
export function reviveAsync<T, E>(
	promise:
		| PromiseLike<Result<T, E>>
		| (() => PromiseLike<Result<T, E>>)
		| ResultAsync<T, E>
		| (() => ResultAsync<T, E>)
		| PromiseLike<ResultAsync<T, E>>
		| (() => PromiseLike<ResultAsync<T, E>>)
): ResultAsync<T, E>;
export function reviveAsync<T, E = never>(
	promise:
		| PromiseLike<{ ok: true; value: T }>
		| (() => PromiseLike<{ ok: true; value: T }>)
		| (() => { ok: true; value: T })
): ResultAsync<T, E>;
export function reviveAsync<E, T = never>(
	promise:
		| PromiseLike<{ ok: false; error: E }>
		| (() => PromiseLike<{ ok: false; error: E }>)
		| (() => { ok: false; error: E })
): ResultAsync<T, E>;
export function reviveAsync<T, E>(
	promise:
		| PromiseLike<{ ok: boolean; value: T; error: E }>
		| (() => PromiseLike<{ ok: boolean; value: T; error: E }>)
		| (() => { ok: boolean; value: T; error: E })
): ResultAsync<T, E>;
export function reviveAsync<T, E = never>(
	promise:
		| PromiseLike<{ ok: boolean; value: T }>
		| (() => PromiseLike<{ ok: boolean; value: T }>)
		| (() => { ok: boolean; value: T })
): ResultAsync<T, E>;
export function reviveAsync<E, T = never>(
	promise:
		| PromiseLike<{ ok: boolean; error: E }>
		| (() => PromiseLike<{ ok: boolean; error: E }>)
		| (() => { ok: boolean; error: E })
): ResultAsync<T, E>;
export function reviveAsync<T = undefined, E = never>(
	promise: PromiseLike<{ ok: true }> | (() => PromiseLike<{ ok: true }>) | (() => { ok: true })
): ResultAsync<T, E>;
export function reviveAsync<E = undefined, T = never>(
	promise: PromiseLike<{ ok: false }> | (() => PromiseLike<{ ok: false }>) | (() => { ok: false })
): ResultAsync<T, E>;
export function reviveAsync<T = unknown, E = unknown>(
	promise:
		| PromiseLike<{ ok: boolean; value?: T; error?: E }>
		| (() => PromiseLike<{ ok: boolean; value?: T; error?: E }>)
		| (() => { ok: boolean; value?: T; error?: E })
): ResultAsync<T, E>;
export function reviveAsync<T = unknown, E = unknown>(
	promise: PromiseLike<unknown> | (() => PromiseLike<unknown>) | unknown | (() => unknown)
): ResultAsync<T, E>;
export function reviveAsync(promise: any): any {
	const p = typeof promise === 'function' ? promise() : promise;

	return new ResultAsync(Promise.resolve(p).then(res => revive(res) as any));
}

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
						: options.onThrow(
								GlobalErrs.ChasErr({
									message: 'Operation timed out',
									origin: 'withRetryAsync',
									cause: e,
								})
							);
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
