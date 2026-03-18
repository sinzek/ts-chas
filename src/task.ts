import {
	errAsync,
	fromPromise,
	ResultAsync,
	type Result,
	go,
	type UnwrapErr,
	err,
	allAsync as resultAllAsync,
	anyAsync as resultAnyAsync,
	collectAsync as resultCollectAsync,
	ok,
	type CatchTarget,
	type CatchTag
} from './result.js';
import { type TaggedErr } from './tagged-errs.js';
import { type Option } from './option.js';

/**
 * A promise-like wrapper with chaining, mapping, error handling, and resilience logic that evaluates to a ResultAsync.
 *
 * @example
 * ```ts
 * const task = chas.Task.from(() => Promise.resolve(42));
 * const result = await task.execute();
 * ```
 */
export class Task<T, E> {
	private readonly run: (ctx?: any) => ResultAsync<T, E>;

	constructor(run: (ctx?: any) => ResultAsync<T, E> | Promise<Result<T, E>>) {
		this.run = ctx => {
			try {
				const res = run(ctx);
				if (res instanceof ResultAsync) return res;
				return fromPromise(res as Promise<Result<T, E>>, e => err(e as any)).andThen(v => v) as any;
			} catch (e) {
				return errAsync(e as any);
			}
		};
	}

	/**
	 * Creates a Task from a Promise and an error mapper.
	 * @param fn function that returns a Promise
	 * @param onError function that maps an unknown error to an error of type E
	 * @returns a Task
	 */
	static from<T, E>(fn: () => Promise<T>, onError: (e: unknown) => E): Task<T, E> {
		return new Task(() => fromPromise(fn(), onError));
	}

	/**
	 * Creates a Task that returns the current context.
	 *
	 * @returns a Task
	 */
	static ask<C>(): Task<C, never> {
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
	): Extract<Y, Task<unknown, unknown> | ResultAsync<unknown, unknown>> extends never
		? Task<T, UnwrapErr<Y>>
		: Task<T, UnwrapErr<Y>>;
	static go<Y, T>(generator: () => AsyncGenerator<Y, T, unknown>): Task<T, UnwrapErr<Y>>;
	static go(generator: () => Generator<any, any, any> | AsyncGenerator<any, any, any>): Task<any, any> {
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
	static all<T, E>(tasks: Iterable<Task<T, E>>): Task<T[], E> {
		return new Task(ctx => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx));
			return resultAllAsync(asyncResults) as unknown as ResultAsync<T[], E>;
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
	static race<T, E>(tasks: Iterable<Task<T, E>>): Task<T, E> {
		return new Task(ctx => {
			const promises = Array.from(tasks).map(t => t.run(ctx));
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
	static any<T, E>(tasks: Iterable<Task<T, E>>): Task<T, E[]> {
		return new Task(ctx => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx));
			return resultAnyAsync(asyncResults) as unknown as ResultAsync<T, E[]>;
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
	static collect<T, E>(tasks: Iterable<Task<T, E>>): Task<T[], E[]> {
		return new Task(ctx => {
			const asyncResults = Array.from(tasks).map(t => t.run(ctx));
			return resultCollectAsync(asyncResults) as unknown as ResultAsync<T[], E[]>;
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
	static parallel<T, E>(tasks: Iterable<Task<T, E>>, concurrency: number): Task<T[], E> {
		return new Task(ctx => {
			const taskArray = Array.from(tasks);
			if (taskArray.length === 0)
				return ResultAsync.fromSafePromise(Promise.resolve([] as T[])) as unknown as ResultAsync<T[], E>;

			const results: T[] = new Array(taskArray.length);
			let completedCount = 0;
			let startedCount = 0;
			let firstError: E | undefined;
			let resolvePromise: (res: Result<T[], E>) => void = () => {};

			const promise = new Promise<Result<T[], E>>(resolve => {
				resolvePromise = resolve;
			});

			const next = () => {
				if (firstError !== undefined) return;
				if (completedCount === taskArray.length) {
					resolvePromise(ok(results));
					return;
				}

				while (startedCount < taskArray.length && startedCount - completedCount < concurrency) {
					const index = startedCount++;
					const task = taskArray[index];
					if (!task) continue;
					task.run(ctx).then(res => {
						if (firstError !== undefined) return;
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
	static void(): Task<void, never> {
		return new Task(() => ResultAsync.fromSafePromise(Promise.resolve(undefined as void)));
	}

	/**
	 * Creates a Task from an Option.
	 * @param option Option to convert
	 * @param onNone function that returns an error if the Option is None
	 * @returns a Task
	 */
	static fromOption<T, E>(option: Option<T>, onNone: () => E): Task<T, E> {
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
	provide(context: any): Task<T, E> {
		return new Task(() => this.run(context));
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
	static using<R, T, E>(
		acquire: Task<R, E>,
		release: (res: R) => Promise<void> | void,
		use: (res: R) => Task<T, E>
	): Task<T, E> {
		return new Task(ctx => {
			return acquire.run(ctx).andThen(res => {
				return new ResultAsync(
					Promise.resolve(
						use(res)
							.run(ctx)
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
	chain<U>(next: (arg: T) => Task<U, E>): Task<U, E> {
		return new Task(
			ctx => this.run(ctx).andThen(val => next(val).run(ctx)) // short-circuits on error
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
	map<U>(fn: (arg: T) => U): Task<U, E> {
		return new Task(ctx => this.run(ctx).map(fn));
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
	mapErr<F>(fn: (error: E) => F): Task<T, F> {
		return new Task(ctx => this.run(ctx).mapErr(fn));
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
	retry(count: number, options?: { delay?: number; factor?: number }): Task<T, E> {
		return new Task(ctx => {
			const delay = options?.delay ?? 0;
			const factor = options?.factor ?? 1;

			const attempt = (remaining: number, currentDelay: number): ResultAsync<T, E> => {
				return this.run(ctx).orElse(error => {
					if (remaining <= 0) return errAsync(error);

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
	circuitBreaker(options: { threshold: number; resetTimeout: number }): Task<T, E> {
		let failures = 0;
		let lastFailureTime = 0;
		let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

		return new Task(ctx => {
			const now = Date.now();

			if (state === 'OPEN') {
				if (now - lastFailureTime > options.resetTimeout) {
					state = 'HALF_OPEN';
				} else {
					return errAsync('CIRCUIT_OPEN' as any);
				}
			}

			return this.run(ctx)
				.tap(() => {
					if (state === 'HALF_OPEN') {
						state = 'CLOSED';
						failures = 0;
					}
				})
				.tapErr(() => {
					failures++;
					lastFailureTime = Date.now();
					if (failures >= options.threshold) {
						state = 'OPEN';
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
	throttle(concurrency: number): Task<T, E> {
		let active = 0;
		const queue: Array<() => void> = [];

		const next = () => {
			if (queue.length > 0 && active < concurrency) {
				const run = queue.shift()!;
				run();
			}
		};

		return new Task(ctx => {
			return new ResultAsync(
				new Promise<Result<T, E>>((resolve, reject) => {
					const execute = () => {
						active++;
						this.run(ctx).then(
							res => {
								active--;
								next();
								resolve(res);
							},
							e => {
								active--;
								next();
								reject(e);
							}
						);
					};

					if (active < concurrency) {
						execute();
					} else {
						queue.push(execute);
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
	orElse<F>(fn: (error: E) => Task<T, F>): Task<T, F> {
		return new Task(ctx => this.run(ctx).orElse(e => fn(e).run(ctx) as any) as any);
	}

	/**
	 * Explicit fallback to another task if this one fails.
	 * Semantic alias for orElse.
	 *
	 * @param other The task to run if this one fails.
	 * @returns a Task
	 */
	fallback(other: Task<T, E>): Task<T, E> {
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
	catchTag<Target extends CatchTarget, E2 = never>(
		target: Target,
		handler: (error: [E] extends [TaggedErr] ? Extract<E, { _tag: CatchTag<Target> }> : any) => Task<T, E2>
	): Task<T, [E] extends [TaggedErr] ? Exclude<E, { _tag: CatchTag<Target> }> | E2 : E | E2> {
		return new Task(ctx => this.run(ctx).catchTag(target as any, e => handler(e as any).run(ctx) as any) as any);
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
	tap(fn: (value: T) => void | Promise<void>): Task<T, E> {
		return new Task(ctx => this.run(ctx).tap(fn));
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
	tapErr(fn: (error: E) => void | Promise<void>): Task<T, E> {
		return new Task(ctx => this.run(ctx).tapErr(fn));
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
	timeout(ms: number, onTimeout: () => E): Task<T, E> {
		return new Task(ctx => {
			const timeoutPromise = new Promise<Result<T, E>>((_, reject) =>
				setTimeout(() => reject('TIMEOUT_INTERNAL'), ms)
			);
			return new ResultAsync(
				Promise.race([this.run(ctx).then(res => res), timeoutPromise]).catch(e =>
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
	delay(ms: number): Task<T, E> {
		return new Task(ctx => {
			const wait = new Promise(resolve => setTimeout(resolve, ms));
			return new ResultAsync(wait.then(() => this.run(ctx).then(res => res)));
		});
	}

	/**
	 * Binds an AbortSignal to the task. If the signal is aborted, the task will fail with the abort reason.
	 *
	 * @param signal The signal to bind.
	 * @returns a Task
	 */
	withSignal(signal: AbortSignal): Task<T, E> {
		return new Task(ctx => {
			if (signal.aborted) return errAsync(signal.reason ?? 'ABORTED');
			const abortPromise = new Promise<Result<T, E>>((_, reject) => {
				signal.addEventListener('abort', () => reject(signal.reason ?? 'ABORTED'), { once: true });
			});
			return new ResultAsync(Promise.race([this.run(ctx), abortPromise]).catch(e => err(e)));
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
		if (signal) return this.withSignal(signal).run(undefined);
		return this.run(undefined);
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
		return this.run(undefined).then(res => res.unwrap());
	}

	*[Symbol.iterator](): Generator<ResultAsync<T, E>, T, any> {
		return yield* this.run(undefined);
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any> {
		return yield* this.run(undefined);
	}

	/**
	 * Memoization for Task. Only executes once and caches the result.
	 *
	 * @returns a Task
	 */
	once(): Task<T, E> {
		let cached: ResultAsync<T, E> | undefined;
		return new Task(ctx => {
			if (cached) return cached;
			cached = this.run(ctx);
			return cached;
		});
	}

	/**
	 * Memoization with TTL and error handling.
	 *
	 * @param options configuration for caching.
	 * @returns a Task
	 */
	memoize(options?: { ttl?: number; cacheErr?: boolean }): Task<T, E> {
		let cached: { result: Result<T, E>; timestamp: number } | undefined;
		let pending: Promise<Result<T, E>> | undefined;

		return new Task(ctx => {
			const now = Date.now();
			if (cached && (!options?.ttl || now - cached.timestamp < options.ttl)) {
				return ResultAsync.fromSafePromise(Promise.resolve(cached.result)) as unknown as ResultAsync<T, E>;
			}

			if (pending) return new ResultAsync(pending);

			const p = this.run(ctx).then(res => {
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
	cache(key: string, store: TaskCache, options?: { ttl?: number }): Task<T, E> {
		return new Task(ctx => {
			return new ResultAsync(
				Promise.resolve(
					(async () => {
						const cached = await store.get<Result<T, E>>(key);
						if (cached) return cached;

						const res = await this.run(ctx);
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
