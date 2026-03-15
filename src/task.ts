/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from './result.js';
import { type TaggedError } from './tagged-errs.js';

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
	constructor(private readonly run: () => ResultAsync<T, E>) {}

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
		return new Task(() => {
			const asyncResults = Array.from(tasks).map(t => t.run());
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
		return new Task(() => {
			const promises = Array.from(tasks).map(t => t.run());
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
		return new Task(() => {
			const asyncResults = Array.from(tasks).map(t => t.run());
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
		return new Task(() => {
			const asyncResults = Array.from(tasks).map(t => t.run());
			return resultCollectAsync(asyncResults) as unknown as ResultAsync<T[], E[]>;
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
			() => this.run().andThen(val => next(val).run()) // short-circuits on error
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
		return new Task(() => this.run().map(fn));
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
		return new Task(() => this.run().mapErr(fn));
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
		return new Task(() => {
			const delay = options?.delay ?? 0;
			const factor = options?.factor ?? 1;

			const attempt = (remaining: number, currentDelay: number): ResultAsync<T, E> => {
				return this.run().orElse(error => {
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

		return new Task(() => {
			const now = Date.now();

			if (state === 'OPEN') {
				if (now - lastFailureTime > options.resetTimeout) {
					state = 'HALF_OPEN';
				} else {
					return errAsync('CIRCUIT_OPEN' as any);
				}
			}

			return this.run()
				.inspect(() => {
					if (state === 'HALF_OPEN') {
						state = 'CLOSED';
						failures = 0;
					}
				})
				.inspectErr(() => {
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

		return new Task(() => {
			return new ResultAsync(
				new Promise<Result<T, E>>((resolve, reject) => {
					const execute = () => {
						active++;
						this.run().then(
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
		return new Task(() => this.run().orElse(e => fn(e).run() as any) as any);
	}

	/**
	 * Special recovery operator for TaggedErrors.
	 *
	 * @param tag The tag to match.
	 * @param handler The function to apply to the error.
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).catchTag('error', e => chas.Task.from(() => Promise.resolve(e + 1)));
	 * const result = await task.execute(); // Ok(1) or Err(error)
	 * ```
	 */
	catchTag<Tag extends string, E2 = never>(
		tag: Tag,
		handler: (error: [E] extends [TaggedError] ? Extract<E, { _tag: Tag }> : any) => Task<T, E2>
	): Task<T, [E] extends [TaggedError] ? Exclude<E, { _tag: Tag }> | E2 : E | E2> {
		return new Task(() => this.run().catchTag(tag, e => handler(e).run() as any) as any);
	}

	/**
	 * Side-effect operator for success that does not affect the result.
	 *
	 * @param fn function to apply to the value
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).inspect(v => console.log(v));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	inspect(fn: (value: T) => void | Promise<void>): Task<T, E> {
		return new Task(() => this.run().inspect(fn));
	}

	/**
	 * Side-effect operator for failure that does not affect the result.
	 *
	 * @param fn function to apply to the error
	 * @returns a Task
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1)).inspectErr(e => console.log(e));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	inspectErr(fn: (error: E) => void | Promise<void>): Task<T, E> {
		return new Task(() => this.run().inspectErr(fn));
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
		return new Task(() => {
			const timeoutPromise = new Promise<Result<T, E>>((_, reject) =>
				setTimeout(() => reject('TIMEOUT_INTERNAL'), ms)
			);
			return new ResultAsync(
				Promise.race([this.run().then(res => res), timeoutPromise]).catch(e =>
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
		return new Task(() => {
			const wait = new Promise(resolve => setTimeout(resolve, ms));
			return new ResultAsync(wait.then(() => this.run().then(res => res)));
		});
	}

	/**
	 * Executes the task and returns the result.
	 *
	 * @returns a Promise of the result
	 *
	 * @example
	 * ```ts
	 * const task = chas.Task.from(() => Promise.resolve(1));
	 * const result = await task.execute(); // Ok(1)
	 * ```
	 */
	async execute(): Promise<Result<T, E>> {
		return this.run();
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
		return this.run().then(res => res.unwrap());
	}

	*[Symbol.iterator](): Generator<ResultAsync<T, E>, T, any> {
		return yield* this.run();
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<Result<T, E>, T, any> {
		return yield* this.run();
	}
}
