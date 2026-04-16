import { errAsync, ResultAsync, type Result, err, ok } from './result/result.js';
import type { UnwrapErr } from './result/shared.js';
import {
	fromPromise,
	go,
	allAsync as resultAllAsync,
	anyAsync as resultAnyAsync,
	collectAsync as resultCollectAsync,
} from './result/result-helpers.js';
import { type Option } from './option.js';
import type {
	CatchTag,
	CatchTarget,
	ExtractErrorFromTarget,
	UnionToIntersection,
} from './utils.js';

/**
 * A promise-like wrapper with chaining, mapping, error handling, and resilience logic that evaluates to a ResultAsync.
 *
 * @example
 * ```ts
 * const task = chas.Task.from(() => Promise.resolve(42));
 * const result = await task.execute();
 * ```
 */
export class Task<T, E, C = void> {
	private readonly run: (ctx: C, signal?: AbortSignal) => ResultAsync<T, E>;

	constructor(run: (ctx: C, signal?: AbortSignal) => ResultAsync<T, E> | Promise<Result<T, E>>) {
		this.run = (ctx, signal) => {
			try {
				const res = run(ctx, signal);
				if (res instanceof ResultAsync) return res;
				return fromPromise(res as Promise<Result<T, E>>, e => err(e as any)).andThen(v => v) as any;
			} catch (e) {
				return errAsync(e as any);
			}
		};
	}

	/**
	 * Creates a Task from a function that returns a `Result`, a `Promise<Result>`, a plain value, or a `Promise<T>`.
	 *
	 * Two workflows:
	 * - **Define-with-Result**: `fn` explicitly returns `ok()`/`err()` — Result is passed through as-is.
	 * - **Plain value / wrap-a-thrower**: `fn` returns `T` or `Promise<T>` — the value is auto-wrapped in `ok()`,
	 *   and any throws or rejections are caught and wrapped in `err()`.
	 *
	 * @example
	 * ```ts
	 * // Define-with-Result
	 * const findUser = Task.from(async () => {
	 *     const user = await db.find(id);
	 *     if (!user) return chas.err('NOT_FOUND' as const);
	 *     return chas.ok(user);
	 * });
	 *
	 * // Plain value / wrap-a-thrower
	 * const parse = Task.from(() => JSON.parse(raw), e => new SyntaxError(String(e)));
	 * ```
	 */
	static from<T, E = unknown, C = void>(
		fn: (ctx: C, signal?: AbortSignal) => PromiseLike<T>,
		onThrow?: (error: unknown) => E
	): Task<T, E extends null | undefined ? unknown : E, C>;
	static from<T, E, C = void>(
		fn: (ctx: C, signal?: AbortSignal) => Result<T, E> | PromiseLike<Result<T, E>>,
		onThrow?: (error: unknown) => E
	): Task<T, E, C>;
	static from<T, E = unknown, C = void>(
		fn: (ctx: C, signal?: AbortSignal) => T,
		onThrow?: (error: unknown) => E
	): Task<T, E extends null | undefined ? unknown : E, C>;
	static from(fn: (ctx: any, signal?: AbortSignal) => any, onThrow?: (error: unknown) => any): Task<any, any, any> {
		return new Task((ctx, signal) => ResultAsync.from(() => fn(ctx, signal), onThrow) as ResultAsync<any, any>);
	}

	/**
	 * Creates a Task that returns the current context.
	 *
	 * @returns a Task
	 */
	static ask<C>(): Task<C, never, C> {
		return new Task(
			ctx => ResultAsync.fromSafePromise(Promise.resolve(ctx as C)) as unknown as ResultAsync<C, never>
		);
	}

	/**
	 * Do-Notation implementation for Task, delegating to chas.go()
	 *
	 * @param generator generator function
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.go(function* () {
	 *   const x = yield* chas.Task.from(() => Promise.resolve(1));
	 *   const y = yield* chas.Task.from(() => Promise.resolve(2));
	 *   return x + y;
	 * });
	 * ```
	 */
	static go<Y, T>(
		generator: () => Generator<Y, T, unknown>
	): Extract<Y, Task<unknown, unknown, any> | ResultAsync<unknown, unknown>> extends never
		? Task<T, UnwrapErr<Y>, any>
		: Task<T, UnwrapErr<Y>, any>;
	static go<Y, T>(generator: () => AsyncGenerator<Y, T, unknown>): Task<T, UnwrapErr<Y>, any>;
	static go(generator: () => Generator<any, any, any> | AsyncGenerator<any, any, any>): Task<any, any, any> {
		return new Task(() => {
			const res = go(generator as any);
			if (res instanceof ResultAsync) return res as ResultAsync<any, any>;
			return new ResultAsync(Promise.resolve(res as unknown as Result<any, any>));
		});
	}

	/**
	 * Takes an iterable of Tasks and returns a single Task.
	 * Resolves to Ok containing an array of all values if strictly all inputs are Ok.
	 * Short-circuits and resolves to the first Err encountered.
	 *
	 * @param tasks iterable of Tasks
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const tasks = [chas.Task.from(() => Promise.resolve(1)), chas.Task.from(() => Promise.resolve(2))];
	 * const result = await chas.Task.all(tasks); // Ok([1, 2]) or Err(error1) or Err(error2)
	 * ```
	 */
	static all<T extends Task<any, any, any>[]>(
		tasks: [...T]
	): Task<
		{ [K in keyof T]: T[K] extends Task<infer A, any, any> ? A : never },
		T[number] extends Task<any, infer E, any> ? E : never,
		UnionToIntersection<T[number] extends Task<any, any, infer C> ? C : void>
	>;
	static all<T, E, C = void>(tasks: Iterable<Task<T, E, C>>): Task<T[], E, C>;
	static all(tasks: Iterable<any>): any {
		return new Task((ctx, signal) => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx, signal));
			return resultAllAsync(asyncResults) as unknown as ResultAsync<any[], any>;
		});
	}

	/**
	 * Returns the first task to settle (either success or failure).
	 *
	 * @param tasks iterable of Tasks
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const tasks = [chas.Task.from(() => Promise.resolve(1)), chas.Task.from(() => Promise.resolve(2))];
	 * const result = await chas.Task.race(tasks); // Ok(1) or Ok(2) or Err(error1) or Err(error2)
	 * ```
	 */
	static race<T extends Task<any, any, any>[]>(
		tasks: [...T]
	): Task<
		T[number] extends Task<infer A, any, any> ? A : never,
		T[number] extends Task<any, infer E, any> ? E : never,
		UnionToIntersection<T[number] extends Task<any, any, infer C> ? C : void>
	>;
	static race<T, E, C = void>(tasks: Iterable<Task<T, E, C>>): Task<T, E, C>;
	static race(tasks: Iterable<any>): any {
		return new Task((ctx, signal) => {
			const promises = Array.from(tasks).map(t => t.run(ctx, signal));
			return new ResultAsync(Promise.race(promises));
		});
	}

	/**
	 * Returns the first success (Ok), or an array of all errors if they all fail.
	 *
	 * @param tasks iterable of Tasks
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const tasks = [chas.Task.from(() => Promise.resolve(1)), chas.Task.from(() => Promise.resolve(2))];
	 * const result = await chas.Task.any(tasks); // Ok(1) or Ok(2) or Err([error1, error2])
	 * ```
	 */
	static any<T extends Task<any, any, any>[]>(
		tasks: [...T]
	): Task<
		T[number] extends Task<infer A, any, any> ? A : never,
		{ [K in keyof T]: T[K] extends Task<any, infer E, any> ? E : never },
		UnionToIntersection<T[number] extends Task<any, any, infer C> ? C : void>
	>;
	static any<T, E, C = void>(tasks: Iterable<Task<T, E, C>>): Task<T, E[], C>;
	static any(tasks: Iterable<any>): any {
		return new Task((ctx, signal) => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx, signal));
			return resultAnyAsync(asyncResults) as unknown as ResultAsync<any, any[]>;
		});
	}

	/**
	 * Does not short-circuit: resolves to Ok with all values if strictly all inputs are Ok,
	 * or Err with an array of ALL errors encountered.
	 *
	 * @param tasks iterable of Tasks
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const tasks = [chas.Task.from(() => Promise.resolve(1)), chas.Task.from(() => Promise.resolve(2))];
	 * const result = await chas.Task.collect(tasks); // Ok([1, 2]) or Err([error1, error2])
	 * ```
	 */
	static collect<T extends Task<any, any, any>[]>(
		tasks: [...T]
	): Task<
		{ [K in keyof T]: T[K] extends Task<infer A, any, any> ? A : never },
		{ [K in keyof T]: T[K] extends Task<any, infer E, any> ? E : never },
		UnionToIntersection<T[number] extends Task<any, any, infer C> ? C : void>
	>;
	static collect<T, E, C = void>(tasks: Iterable<Task<T, E, C>>): Task<T[], E[], C>;
	static collect(tasks: Iterable<any>): any {
		return new Task((ctx, signal) => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx, signal));
			return resultCollectAsync(asyncResults) as unknown as ResultAsync<any[], any[]>;
		});
	}

	/**
	 * Runs multiple tasks in parallel with a concurrency limit.
	 * Returns Ok with an array of values if all succeed, or Err with the first error encountered.
	 *
	 * @param tasks iterable of Tasks
	 * @param concurrency maximum number of concurrent executions
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const tasks = [chas.Task.delay(100).map(() => 1), chas.Task.delay(100).map(() => 2)];
	 * const result = await chas.Task.parallel(tasks, 1); // Executes sequentially, returns Ok([1, 2])
	 * ```
	 */
	static parallel<T extends Task<any, any, any>[]>(
		tasks: [...T],
		concurrency: number
	): Task<
		{ [K in keyof T]: T[K] extends Task<infer A, any, any> ? A : never },
		T[number] extends Task<any, infer E, any> ? E : never,
		UnionToIntersection<T[number] extends Task<any, any, infer C> ? C : void>
	>;
	static parallel<T, E, C = void>(tasks: Iterable<Task<T, E, C>>, concurrency: number): Task<T[], E, C>;
	static parallel<T, E, C = void>(tasks: Iterable<any>, concurrency: number): any {
		return new Task((ctx, signal) => {
			const taskArray = Array.from(tasks) as Task<T, E, C>[];
			if (taskArray.length === 0)
				return ResultAsync.fromSafePromise(Promise.resolve([])) as unknown as ResultAsync<any[], any>;

			const results: T[] = new Array(taskArray.length);
			let completedCount = 0;
			let startedCount = 0;
			let firstError: E | undefined;
			let resolvePromise: (res: Result<T[], E>) => void = () => {};

			const promise = new Promise<Result<T[], E>>(resolve => {
				resolvePromise = resolve;
			});

			const next = () => {
				if (firstError !== undefined || signal?.aborted) return;
				if (completedCount === taskArray.length) {
					resolvePromise(ok(results));
					return;
				}

				while (startedCount < taskArray.length && startedCount - completedCount < concurrency) {
					const index = startedCount++;
					const task = taskArray[index];
					if (!task) continue;
					task.run(ctx as C, signal).then(res => {
						if (firstError !== undefined || signal?.aborted) return;
						if (res.isOk()) {
							results[index] = res.value;
							completedCount++;
							next();
						} else {
							firstError = res.unwrapErr();
							resolvePromise(err(firstError));
						}
					});
				}
			};

			next();
			return new ResultAsync(promise);
		});
	}

	/**
	 * Creates a Task that resolves to Ok(undefined).
	 */
	static void(): Task<void, never, void> {
		return new Task(() => ResultAsync.fromSafePromise(Promise.resolve(undefined as void)));
	}

	/**
	 * Creates a Task from an Option.
	 * @param option Option to convert
	 * @param onNone function that returns an error if the Option is None
	 * @returns a Task
	 */
	static fromOption<T, E, C = void>(option: Option<T>, onNone: () => E): Task<T, E, C> {
		return new Task(() =>
			option.isSome()
				? (ResultAsync.fromSafePromise(Promise.resolve(option.value)) as unknown as ResultAsync<T, E>)
				: errAsync(onNone())
		);
	}

	/**
	 * Provides a context value to the task.
	 *
	 * @param context context value
	 * @returns a Task
	 */
	provide(context: C): Task<T, E, void> {
		return new Task((_, signal) => this.run(context, signal));
	}

	/**
	 * Resource management helper. Acquires a resource, uses it, and ensures it is released.
	 * Even if the 'use' task fails, the resource is released.
	 *
	 * @param acquire Task to acquire the resource
	 * @param release function to release the resource
	 * @param use function that uses the resource and returns a Task
	 * @returns a Task
	 */
	static using<R, T, E, C1 = void, C2 = void>(
		acquire: Task<R, E, C1>,
		release: (res: R) => Promise<void> | void,
		use: (res: R) => Task<T, E, C2>
	): Task<T, E, C1 & C2> {
		return new Task((ctx, signal) => {
			return acquire.run(ctx as any, signal).andThen(res => {
				return new ResultAsync(
					Promise.resolve(
						use(res)
							.run(ctx as any, signal)
							.then(async result => {
								try {
									await release(res);
								} catch {
									// Release errors are ignored in the base using pattern
								}
								return result;
							})
					)
				);
			});
		});
	}

	/**
	 * Chain a function that returns a Task to this Task.
	 * Short-circuits on error.
	 * @param next function that returns a Task
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).chain(v => chas.Task.from(() => Promise.resolve(v + 1)));
	 * const result = await task.execute(); // Ok(2)
	 * ```
	 */
	chain<U, E2 = E, C2 = void>(next: (arg: T) => Task<U, E2, C2>): Task<U, E | E2, C & C2> {
		return new Task(
			(ctx, signal) => this.run(ctx as any, signal).andThen(val => next(val).run(ctx as any, signal)) // short-circuits on error
		);
	}

	/**
	 * Map a function to this Task, transforming the value.
	 * @param fn function to apply to the value
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).map(v => v + 1);
	 * const result = await task.execute(); // Ok(2)
	 * ```
	 */
	map<U>(fn: (arg: T) => U): Task<U, E, C> {
		return new Task((ctx, signal) => this.run(ctx, signal).map(fn));
	}

	/**
	 * Maps the error of a task, transforming the error.
	 * @param fn function to apply to the error
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).mapErr(e => e.message);
	 * const result = await task.execute(); // Ok(1) or Err(message)
	 * ```
	 */
	mapErr<F>(fn: (error: E) => F): Task<T, F, C> {
		return new Task((ctx, signal) => this.run(ctx, signal).mapErr(fn));
	}

	/**
	 * Attaches context information to the error if the eventual Result is an Err.
	 * Context is stored as a `_context` array on the error, with the most recent
	 * context first. This is useful for debugging which step in a chain failed.
	 *
	 * @param ctx A string description or metadata object describing the current step.
	 * @returns A new Task with context attached to the error (if Err).
	 */
	context(ctx: string | Record<string, unknown>): Task<T, E, C> {
		return new Task((ctx2, signal) => this.run(ctx2, signal).context(ctx));
	}

	/**
	 * Retries the task up to N times if it fails, optionally with exponential backoff.
	 *
	 * @param count Maximum number of retries.
	 * @param options optional delay settings for backoff.
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).retry(3);
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	retry(count: number, options?: { delay?: number; factor?: number }): Task<T, E, C> {
		return new Task((ctx, signal) => {
			const delay = options?.delay ?? 0;
			const factor = options?.factor ?? 1;

			const attempt = (remaining: number, currentDelay: number): ResultAsync<T, E> => {
				return this.run(ctx, signal).orElse(error => {
					if (remaining <= 0 || signal?.aborted) return errAsync(error);

					if (currentDelay > 0) {
						return new ResultAsync(
							new Promise<Result<T, E>>(resolve =>
								setTimeout(() => {
									attempt(remaining - 1, currentDelay * factor).then(resolve);
								}, currentDelay)
							)
						);
					}

					return attempt(remaining - 1, currentDelay * factor);
				});
			};
			return attempt(count, delay);
		});
	}

	/**
	 * Returns a Task that fails fast if the original task has failed too many times
	 * within a certain window.
	 *s
	 * @param options configuration for the circuit breaker.
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).circuitBreaker({ threshold: 3, resetTimeout: 1000 });
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	circuitBreaker(
		options: { threshold: number; resetTimeout: number },
		sharedState?: CircuitBreakerState
	): Task<T, E, C> {
		const internalState: CircuitBreakerState = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };

		return new Task((ctx, signal) => {
			const s = sharedState ?? internalState;
			const now = Date.now();

			if (s.state === 'OPEN') {
				if (now - s.lastFailureTime > options.resetTimeout) {
					s.state = 'HALF_OPEN';
				} else {
					return errAsync('CIRCUIT_OPEN' as any);
				}
			}

			return this.run(ctx, signal)
				.tap(() => {
					if (s.state === 'HALF_OPEN') {
						s.state = 'CLOSED';
						s.failures = 0;
					}
				})
				.tapErr(() => {
					s.failures++;
					s.lastFailureTime = Date.now();
					if (s.failures >= options.threshold) {
						s.state = 'OPEN';
					}
				});
		});
	}

	/**
	 * Limits the number of concurrent executions of this task.
	 *
	 * @param concurrency The maximum number of concurrent executions.
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).throttle(3);
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	throttle(concurrency: number, sharedState?: ThrottleState): Task<T, E, C> {
		const internalState: ThrottleState = { active: 0, queue: [] };

		return new Task((ctx, signal) => {
			const s = sharedState ?? internalState;

			const next = () => {
				if (s.queue.length > 0 && s.active < concurrency) {
					const run = s.queue.shift()!;
					run();
				}
			};

			return new ResultAsync(
				new Promise<Result<T, E>>((resolve, reject) => {
					const execute = () => {
						s.active++;
						this.run(ctx, signal).then(
							res => {
								s.active--;
								next();
								resolve(res);
							},
							e => {
								s.active--;
								next();
								reject(e);
							}
						);
					};

					if (s.active < concurrency) {
						execute();
					} else {
						s.queue.push(execute);
					}
				})
			);
		});
	}

	/**
	 * Recovery operator that calls a function if the task fails.
	 *
	 * @param fn function to apply to the error
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).orElse(e => chas.Task.from(() => Promise.resolve(e + 1)));
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	orElse<F, C2 = void>(fn: (error: E) => Task<T, F, C2>): Task<T, F, C & C2> {
		return new Task(
			(ctx, signal) => this.run(ctx as any, signal).orElse(e => fn(e).run(ctx as any, signal) as any) as any
		);
	}

	/**
	 * Explicit fallback to another task if this one fails.
	 * Semantic alias for orElse.
	 *
	 * @param other The task to run if this one fails.
	 * @returns a Task
	 */
	fallback<C2 = void>(other: Task<T, E, C2>): Task<T, E, C & C2> {
		return this.orElse(() => other);
	}

	/**
	 * Special recovery operator for `TaggedErr`.
	 *
	 * @param tag The tag to match.
	 * @param handler The function to apply to the error.
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).catchTag('NotFound', e => chas.Task.from(() => Promise.resolve(e + 1)));
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	catchTag<Target extends CatchTarget, E2 = never, C2 = void>(
		target: Target,
		handler: (error: NoInfer<ExtractErrorFromTarget<Target, E>>) => Task<T, E2, C2>
	): Task<T, Exclude<E, { _tag: CatchTag<Target> }> | E2, C & C2> {
		return new Task(
			(ctx, signal) =>
				this.run(ctx as any, signal).catchTag(
					target as any,
					e => handler(e as any).run(ctx as any, signal) as any
				) as any
		);
	}

	/**
	 * Side-effect operator for success that does not affect the result.
	 *
	 * @param fn function to apply to the value
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).tap(v => console.log(v));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	tap(fn: (value: T) => void | Promise<void>): Task<T, E, C> {
		return new Task((ctx, signal) => this.run(ctx, signal).tap(fn));
	}

	/**
	 * Side-effect operator for failure that does not affect the result.
	 *
	 * @param fn function to apply to the error
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).tapErr(e => console.log(e));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	tapErr(fn: (error: E) => void | Promise<void>): Task<T, E, C> {
		return new Task((ctx, signal) => this.run(ctx, signal).tapErr(fn));
	}

	tapTag<Target extends CatchTarget>(
		target: Target,
		handler: (error: NoInfer<ExtractErrorFromTarget<Target, E>>) => void | Promise<void>
	): Task<T, E, C> {
		return new Task((ctx, signal) => this.run(ctx, signal).tapTag(target, handler));
	}

	/**
	 * Short-circuits with an error if the task takes too long.
	 *
	 * @param ms The maximum time to wait.
	 * @param onTimeout The function to apply to the error.
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).timeout(1000, () => 'timeout');
	 * const result = await task.execute(); // Ok(1) or Err('timeout')
	 * ```
	 */
	timeout(ms: number, onTimeout: () => E): Task<T, E, C> {
		return new Task((ctx, signal) => {
			const timeoutPromise = new Promise<Result<T, E>>((_, reject) =>
				setTimeout(() => reject('TIMEOUT_INTERNAL'), ms)
			);
			return new ResultAsync(
				Promise.race([this.run(ctx, signal).then(res => res), timeoutPromise]).catch(e =>
					e === 'TIMEOUT_INTERNAL' ? err(onTimeout()) : err(e as E)
				)
			);
		});
	}

	/**
	 * Ensures a minimum delay before/between executions.
	 * Note: just injects a sleep before running.
	 *
	 * @param ms The minimum delay.
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).delay(1000);
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	delay(ms: number): Task<T, E, C> {
		return new Task((ctx, signal) => {
			const wait = new Promise(resolve => setTimeout(resolve, ms));
			return new ResultAsync(wait.then(() => this.run(ctx, signal).then(res => res)));
		});
	}

	/**
	 * Binds an AbortSignal to the task. If the signal is aborted, the task will fail with the abort reason.
	 *
	 * @param signal The signal to bind.
	 * @returns a Task
	 */
	withSignal(signal: AbortSignal): Task<T, E, C> {
		return new Task(ctx => {
			if (signal.aborted) return errAsync(signal.reason ?? 'ABORTED');
			const abortPromise = new Promise<Result<T, E>>((_, reject) => {
				signal.addEventListener('abort', () => reject(signal.reason ?? 'ABORTED'), { once: true });
			});
			return new ResultAsync(Promise.race([this.run(ctx, signal), abortPromise]).catch(e => err(e)));
		});
	}

	/**
	 * Executes the task and returns the result.
	 *
	 * @param signal optional AbortSignal to cancel the execution
	 * @returns a Promise of the result
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	async execute(signal?: AbortSignal): Promise<Result<T, E>> {
		if (signal) return this.withSignal(signal).run(undefined as any, signal);
		return this.run(undefined as any);
	}

	/**
	 * Unwraps a nested Task. Current Task T must extend a Task.
	 */
	flatten(): T extends Task<infer U, infer E2, infer C2> ? Task<U, E | E2, C & C2> : this {
		return this.chain(t => t as any) as any;
	}

	/**
	 * Unwraps the task, yielding T or throwing E.
	 *
	 * @returns a Promise of the value
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1));
	 * const value = await task.unwrap(); // 1
	 * ```
	 */
	async unwrap(): Promise<T> {
		return this.run(undefined as any).then(res => res.unwrap());
	}

	*[Symbol.iterator](): Generator<ResultAsync<T, E>, T, any> {
		return yield* this.run(undefined as any);
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any> {
		return yield* this.run(undefined as any);
	}

	/**
	 * Memoization for Task. Only executes once and caches the result.
	 *
	 * @returns a Task
	 */
	once(): Task<T, E, C> {
		let cached: ResultAsync<T, E> | undefined;
		return new Task((ctx, signal) => {
			if (cached) return cached;
			cached = this.run(ctx, signal);
			return cached;
		});
	}

	/**
	 * Memoization with TTL and error handling.
	 *
	 * @param options configuration for caching.
	 * @returns a Task
	 */
	memoize(options?: { ttl?: number; cacheErr?: boolean }): Task<T, E, C> {
		let cached: { result: Result<T, E>; timestamp: number } | undefined;
		let pending: Promise<Result<T, E>> | undefined;

		return new Task((ctx, signal) => {
			const now = Date.now();
			if (cached && (!options?.ttl || now - cached.timestamp < options.ttl)) {
				return ResultAsync.fromSafePromise(Promise.resolve(cached.result)) as unknown as ResultAsync<T, E>;
			}

			if (pending) return new ResultAsync(pending);

			const p = this.run(ctx, signal).then(res => {
				if (res.isOk() || options?.cacheErr) {
					cached = { result: res, timestamp: Date.now() };
				}
				pending = undefined;
				return res;
			});
			pending = Promise.resolve(p);

			return new ResultAsync(pending);
		});
	}

	/**
	 * External caching for Task.
	 *
	 * @param key cache key
	 * @param store cache store
	 * @param options configuration for caching.
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const cache = new Map<string, Result<number, Error>>();
	 * const task = Task.from(() => Promise.resolve(1)).cache('key', cache);
	 * const result = await task.execute();
	 * ```
	 */
	cache(key: string, store: TaskCache, options?: { ttl?: number }): Task<T, E, C> {
		return new Task((ctx, signal) => {
			return new ResultAsync(
				Promise.resolve(
					(async () => {
						const cached = await store.get<Result<T, E>>(key);
						if (cached) return cached;

						const res = await this.run(ctx, signal);
						await store.set(key, res, options?.ttl);
						return res;
					})()
				)
			);
		});
	}
}

/**
 * Interface for custom cache stores.
 *
 * @example With Map
 * ```ts
 * const cache = new Map<string, Result<number, Error>>();
 * const task = Task.from(() => Promise.resolve(1)).cache('key', cache);
 * const result = await task.execute();
 * ```
 *
 * @example With Redux
 * ```ts
 * import { createStore } from 'redux';
 * import { Task } from 'chas';
 *
 * const store = createStore<{ cache: Map<string, Result<number, Error>> }>(set => ({
 *   cache: new Map(),
 * }));
 *
 * const task = Task.from(() => Promise.resolve(1)).cache('key', {
 *   get: key => store.getState().cache.get(key),
 *   set: (key, value, ttl) => {
 *   	store.dispatch({
 *     	type: 'SET_CACHE',
 *     	payload: { key, value },
 *   	});
 *   },
 * });
 * const result = await task.execute();
 * ```
 *
 * @example With Zustand
 * ```ts
 * import { create } from 'zustand';
 * import { Task } from 'chas';
 *
 * const useCache = create<{ cache: Map<string, Result<number, Error>> }>(set => ({
 *   cache: new Map(),
 * }));
 *
 * const task = Task.from(() => Promise.resolve(1)).cache('key', {
 *   get: key => useCache.getState().cache.get(key),
 *   set: (key, value, ttl) => {
 *     useCache.setState(state => {
 *       state.cache.set(key, value);
 *     });
 *   },
 * });
 * const result = await task.execute();
 * ```
 */
export interface TaskCache {
	get<T>(key: string): T | undefined | Promise<T | undefined>;
	set<T>(key: string, value: T, ttl?: number): void | Promise<void>;
}

export interface CircuitBreakerState {
	failures: number;
	lastFailureTime: number;
	state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface ThrottleState {
	active: number;
	queue: Array<() => void>;
}
