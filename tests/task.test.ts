import { describe, it, expect, expectTypeOf } from 'vitest';
import { Task } from '../src/task.js';
import { errAsync, ResultAsync, ok, type Result, okAsync } from '../src/result/index.js';

describe('Task', () => {
	it('creates a Task from a successful promise', async () => {
		const task = Task.from(
			async () => 42,
			() => 'error'
		);
		const result = await task.execute();
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
	});

	it('creates a Task from a failing promise', async () => {
		const task = Task.from(
			async () => {
				throw new Error('fail');
			},
			e => (e as Error).message
		);
		const result = await task.execute();
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBe('fail');
	});

	it('maps a Task value', async () => {
		const task = Task.from(
			async () => 21,
			() => 'error'
		).map(v => v * 2);
		const result = await task.execute();
		expect(result.unwrap()).toBe(42);
	});

	it('chains Tasks', async () => {
		const task = Task.from(
			async () => 21,
			() => 'error'
		).chain(v =>
			Task.from(
				async () => v * 2,
				() => 'error'
			)
		);
		const result = await task.execute();
		expect(result.unwrap()).toBe(42);
	});

	it('short-circuits on error in chain', async () => {
		let secondTaskCalled = false;
		const task = Task.from(
			async () => {
				throw new Error('fail');
			},
			e => (e as Error).message
		).chain(v => {
			secondTaskCalled = true;
			return Task.from(
				async () => v * 2,
				() => 'error'
			);
		});

		const result = await task.execute();
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBe('fail');
		expect(secondTaskCalled).toBe(false);
	});

	it('unwraps Task value', async () => {
		const task = Task.from(
			async () => 42,
			() => 'error'
		);
		expect(await task.unwrap()).toBe(42);
	});

	it('throws on unwrap of failing Task', async () => {
		const task = Task.from(
			async () => {
				throw new Error('fail');
			},
			e => (e as Error).message
		);
		await expect(task.unwrap()).rejects.toThrow('fail');
	});

	it('Task.go (sync)', async () => {
		const task = Task.go(function* () {
			const a = yield* Task.from(
				async () => 5,
				() => 'error'
			);
			const b = yield* Task.from(
				async () => 10,
				() => 'error'
			);
			return a + b;
		});
		expect(await task.unwrap()).toBe(15);
	});

	it('Task.go (async)', async () => {
		const task = Task.go(async function* () {
			const a = yield* Task.from(
				async () => 5,
				() => 'error'
			);
			const b = yield* Task.from(
				async () => 10,
				() => 'error'
			);
			return a + b;
		});
		expect(await task.unwrap()).toBe(15);
	});

	it('Task works in chas.go do-notation', async () => {
		const result = await Task.go(function* () {
			const a = yield* Task.from(
				async () => 5,
				() => 'error'
			);
			const b = yield* Task.from(
				async () => 10,
				() => 'error'
			);
			return a + b;
		}).execute();

		expect(result.unwrap()).toBe(15);
	});

	describe('Composition', () => {
		it('Task.all resolves all tasks', async () => {
			const t1 = Task.from(
				async () => 1,
				() => 'e'
			);
			const t2 = Task.from(
				async () => 2,
				() => 'e'
			);
			const result = await Task.all([t1, t2]).unwrap();
			expect(result).toEqual([1, 2]);
		});

		it('Task.all short-circuits on first error', async () => {
			const t1 = Task.from(
				async () => 1,
				() => 'e1'
			);
			const t2 = Task.from(
				async (): Promise<number> => {
					throw new Error('e2');
				},
				() => 'e2'
			);
			const t3 = Task.from(
				async () => 3,
				() => 'e3'
			);
			const result = await Task.all([t1, t2, t3]).execute();
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe('e2');
		});

		it('Task.any returns first success', async () => {
			const t1 = Task.from(
				async (): Promise<number> => {
					throw new Error('e1');
				},
				() => 'e1'
			);
			const t2 = Task.from(
				async () => 2,
				() => 'e2'
			);
			const result = await Task.any([t1, t2]).unwrap();
			expect(result).toBe(2);
		});

		it('Task.collect returns all values or all errors', async () => {
			const t1 = Task.from(
				async () => {
					throw new Error('e1');
				},
				() => 'e1'
			);
			const t2 = Task.from(
				async () => {
					throw new Error('e2');
				},
				() => 'e2'
			);
			const result = await Task.collect([t1, t2]).execute();
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toEqual(['e1', 'e2']);
		});
	});

	describe('Resilience', () => {
		it('retry with backoff', async () => {
			let attempts = 0;
			const start = Date.now();
			const task = new Task(() => {
				attempts++;
				return errAsync('fail');
			}).retry(2, { delay: 50, factor: 2 });

			const result = await task.execute();
			const duration = Date.now() - start;

			expect(attempts).toBe(3); // Initial + 2 retries
			expect(result.unwrapErr()).toBe('fail');
			// Delay should be 50 + 100 = 150ms total wait
			expect(duration).toBeGreaterThanOrEqual(140);
		});

		it('circuitBreaker trips and resets', async () => {
			let calls = 0;
			const rawTask = new Task(() => {
				calls++;
				return errAsync('fail');
			});

			const cbTask = rawTask.circuitBreaker({ threshold: 2, resetTimeout: 100 });

			await cbTask.execute(); // failure 1
			await cbTask.execute(); // failure 2 -> trips

			const result = await cbTask.execute(); // Trips immediately
			expect(result.unwrapErr()).toBe('CIRCUIT_OPEN');
			expect(calls).toBe(2);

			await new Promise(resolve => setTimeout(resolve, 110));

			const result2 = await cbTask.execute(); // Half-open -> executes
			expect(result2.unwrapErr()).toBe('fail');
			expect(calls).toBe(3);
		});
	});

	describe('Concurrency', () => {
		it('throttle limits execution', async () => {
			let active = 0;
			let maxActive = 0;

			const worker = new Task(() => {
				active++;
				maxActive = Math.max(maxActive, active);
				return new ResultAsync(
					new Promise<Result<number, string>>(resolve => {
						setTimeout(() => {
							active--;
							resolve(ok(1));
						}, 20);
					})
				);
			}).throttle(2);

			await Promise.all([worker.execute(), worker.execute(), worker.execute(), worker.execute()]);

			expect(maxActive).toBe(2);
		});

		it('delay() delays execution', async () => {
			let executed = false;
			const task = new Task(() => {
				executed = true;

				return okAsync(2);
			}).delay(500);
			expect(executed).toBe(false);
			const start = Date.now();
			await task.execute();
			expect(executed).toBe(true);
			expect(Date.now() - start).toBeGreaterThanOrEqual(500);
		});

		it('supports async function in constructor', async () => {
			const task = new Task(async () => {
				return ok(42);
			});
			const result = await task.execute();
			expect(result.unwrap()).toBe(42);
		});
	});

	describe('Functional Parity', () => {
		it('mapErr transforms error', async () => {
			const task = Task.from(
				async () => {
					throw new Error('a');
				},
				() => 'a'
			).mapErr(e => e.toUpperCase());
			const res = await task.execute();
			expect(res.unwrapErr()).toBe('A');
		});

		it('tap and tapErr call side effects', async () => {
			let success = false;
			let failure = false;

			await Task.from(
				async () => 1,
				() => 'e'
			)
				.tap(() => {
					success = true;
				})
				.execute();
			await Task.from(
				async () => {
					throw new Error();
				},
				() => 'e'
			)
				.tapErr(() => {
					failure = true;
				})
				.execute();

			expect(success).toBe(true);
			expect(failure).toBe(true);
		});
	});

	describe('Context typing and AbortSignal', () => {
		it('chains tasks with different contexts', async () => {
			type CtxA = { a: number };
			type CtxB = { b: string };
			const ta = Task.ask<CtxA>().map(c => c.a);
			const tb = Task.ask<CtxB>().map(c => c.b);

			const combined = ta.chain(a => tb.map(b => a + Number(b)));
			// At this point, `combined` requires CtxA & CtxB
			const result = await combined.provide({ a: 10, b: '20' }).execute();
			expect(result.unwrap()).toBe(30);
		});

		it('propagates AbortSignal to the underlying provider', async () => {
			let aborted = false;
			const longTask = Task.from<number, string, void>((ctx, signal) => {
				return new Promise((resolve, reject) => {
					if (signal) {
						signal.addEventListener('abort', () => {
							aborted = true;
							reject('ABORTED_BY_SIGNAL');
						});
					}
					setTimeout(() => resolve(42), 100);
				});
			});

			const controller = new AbortController();
			const p = longTask.execute(controller.signal);
			controller.abort('ABORTED_BY_SIGNAL');

			const result = await p;
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()).toBe('ABORTED_BY_SIGNAL');
			expect(aborted).toBe(true);
		});

		it('shares circuit breaker state when passed explicitly', async () => {
			let calls = 0;
			const sharedState = { failures: 0, lastFailureTime: 0, state: 'CLOSED' as const };

			const makeTask = () =>
				new Task(() => {
					calls++;
					return errAsync('fail');
				}).circuitBreaker({ threshold: 2, resetTimeout: 100 }, sharedState);

			const task1 = makeTask();
			const task2 = makeTask();
			const task3 = makeTask();

			await task1.execute(); // failure 1
			await task2.execute(); // failure 2 -> trips global state

			const result = await task3.execute(); // Trips immediately via shared state
			expect(result.unwrapErr()).toBe('CIRCUIT_OPEN');
			expect(calls).toBe(2);
		});
	});
	describe('Type Tests', () => {
		it('chaining contexts produces union error and intersection context types', () => {
			type CtxA = { a: number };
			type CtxB = { b: string };

			const tA = Task.ask<CtxA>().mapErr(() => 'ErrA' as const);
			const tB = Task.ask<CtxB>().mapErr(() => 'ErrB' as const);

			const combined = tA.chain(a => tB.map(b => ({ a, b })));

			expectTypeOf(combined).toEqualTypeOf<Task<{ a: CtxA; b: CtxB }, 'ErrA' | 'ErrB', CtxA & CtxB>>();
		});

		it('provide strips the context requirement', () => {
			type Env = { user: string };
			const required = Task.ask<Env>().mapErr(() => 'SomeErr' as const);

			expectTypeOf(required).toEqualTypeOf<Task<Env, 'SomeErr', Env>>();

			const provided = required.provide({ user: 'foo' });
			expectTypeOf(provided).toEqualTypeOf<Task<Env, 'SomeErr', void>>();
		});

		it('Task.all handles variadic tuples and intersect contexts', () => {
			const t1 = Task.ask<{ a: 1 }>().mapErr(() => 'E1' as const);
			const t2 = Task.ask<{ b: 2 }>().mapErr(() => 'E2' as const);

			const all = Task.all([t1, t2]);

			expectTypeOf(all).toEqualTypeOf<
				Task<[{ a: 1 }, { b: 2 }], 'E1' | 'E2', { a: 1 } & { b: 2 }>
			>();
		});
		
		it('Task.flatten handles generic unnesting', () => {
			const nested = Task.ask<{ a: 1 }>().mapErr(() => 'E1' as const).map(
				() => Task.ask<{ b: 2 }>().mapErr(() => 'E2' as const)
			);
			
			const flat = nested.flatten();
			expectTypeOf(flat).toEqualTypeOf<Task<{ b: 2 }, 'E1' | 'E2', { a: 1 } & { b: 2 }>>();
		});
	});
});
