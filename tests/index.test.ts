import { describe, it, expect } from 'vitest';
import { chas } from '../src/index.js';

describe('chas', () => {
	describe('ok', () => {
		it('creates an Ok result', () => {
			const result = chas.ok(42);
			expect(result.ok).toBe(true);
			expect(result.isOk()).toBe(true);
			expect(result.isErr()).toBe(false);
			if (result.isOk()) {
				expect(result.value).toBe(42);
			}
		});
	});

	describe('err', () => {
		it('creates an Err result', () => {
			const result = chas.err('error');
			expect(result.ok).toBe(false);
			expect(result.isOk()).toBe(false);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error).toBe('error');
			}
		});
	});

	describe('ResultMethods', () => {
		it('isOkAnd', () => {
			expect(chas.ok(42).isOkAnd(v => v > 40)).toBe(true);
			expect(chas.ok(42).isOkAnd(v => v > 50)).toBe(false);
			expect(chas.err('error').isOkAnd(() => true)).toBe(false);
		});

		it('isErrAnd', () => {
			expect(chas.err('error').isErrAnd(e => e.length === 5)).toBe(true);
			expect(chas.err('error').isErrAnd(e => e.length === 0)).toBe(false);
			expect(chas.ok(42).isErrAnd(() => true)).toBe(false);
		});

		it('map', () => {
			const okResult = chas.ok(42).map(v => v * 2);
			expect(okResult.unwrap()).toBe(84);

			const errResult = chas.err<string, number>('error').map(v => v * 2);
			expect(errResult.unwrapErr()).toBe('error');
		});

		it('asyncMap', async () => {
			const okResult = await chas.ok(42).asyncMap(async v => v * 2);
			expect(okResult.unwrap()).toBe(84);

			const errResult = await chas.err<string, number>('error').asyncMap(async v => v * 2);
			expect(errResult.unwrapErr()).toBe('error');
		});

		it('mapErr', () => {
			const okResult = chas.ok<number, string>(42).mapErr(e => e.toUpperCase());
			expect(okResult.unwrap()).toBe(42);

			const errResult = chas.err('error').mapErr(e => e.toUpperCase());
			expect(errResult.unwrapErr()).toBe('ERROR');
		});

		it('mapOr', () => {
			expect(chas.ok(42).mapOr(100, v => v * 2)).toBe(84);
			expect(chas.err('error').mapOr(100, (v: number) => v * 2)).toBe(100);
		});

		it('mapOrElse', () => {
			expect(
				chas.ok(42).mapOrElse(
					() => 100,
					v => v * 2
				)
			).toBe(84);
			expect(
				chas.err('error').mapOrElse(
					e => e.length,
					(v: number) => v * 2
				)
			).toBe(5);
		});

		it('and', () => {
			expect(chas.ok(1).and(chas.ok(2)).unwrap()).toBe(2);
			expect(chas.ok<number, string>(1).and(chas.err('error')).unwrapErr()).toBe('error');
			expect(chas.err<string, number>('error1').and(chas.ok(2)).unwrapErr()).toBe('error1');
			expect(chas.err<string, string>('error1').and(chas.err('error2')).unwrapErr()).toBe('error1');
		});

		it('or', () => {
			expect(chas.ok(1).or(chas.ok(2)).unwrap()).toBe(1);
			expect(chas.ok<number, string>(1).or(chas.err('error')).unwrap()).toBe(1);
			expect(chas.err<string, number>('error1').or(chas.ok(2)).unwrap()).toBe(2);
			expect(chas.err<string, string>('error1').or(chas.err('error2')).unwrapErr()).toBe('error2');
		});

		it('andThen', () => {
			expect(
				chas
					.ok(1)
					.andThen(v => chas.ok(v + 1))
					.unwrap()
			).toBe(2);
			expect(
				chas
					.ok<number, string>(1)
					.andThen(() => chas.err('error'))
					.unwrapErr()
			).toBe('error');
			expect(
				chas
					.err<string, number>('error')
					.andThen(v => chas.ok(v + 1))
					.unwrapErr()
			).toBe('error');
		});

		it('asyncAndThen', async () => {
			expect((await chas.ok(1).asyncAndThen(v => chas.okAsync(v + 1))).unwrap()).toBe(2);
			expect((await chas.ok<number, string>(1).asyncAndThen(() => chas.errAsync('error'))).unwrapErr()).toBe(
				'error'
			);
			expect((await chas.err<string, number>('error').asyncAndThen(v => chas.okAsync(v + 1))).unwrapErr()).toBe(
				'error'
			);
		});

		it('orElse', () => {
			expect(
				chas
					.ok(1)
					.orElse(() => chas.ok(2))
					.unwrap()
			).toBe(1);
			expect(
				chas
					.ok<number, string>(1)
					.orElse(() => chas.err('error'))
					.unwrap()
			).toBe(1);
			expect(
				chas
					.err<string, number>('error1')
					.orElse(() => chas.ok(2))
					.unwrap()
			).toBe(2);
			expect(
				chas
					.err('error1')
					.orElse(e => chas.err(e + ' modified'))
					.unwrapErr()
			).toBe('error1 modified');
		});

		it('unwrap', () => {
			expect(chas.ok(1).unwrap()).toBe(1);
			expect(() => chas.err('error').unwrap()).toThrow('error');
		});

		it('unwrapErr', () => {
			expect(chas.err('error').unwrapErr()).toBe('error');
			expect(() => chas.ok(1).unwrapErr()).toThrow('Called unwrapErr on an Ok');

			const customError = new Error('custom');
			expect(() => chas.ok(1).unwrapErr(customError)).toThrow(customError);
		});

		it('unwrapOr', () => {
			expect(chas.ok(1).unwrapOr(2)).toBe(1);
			expect(chas.err<string, number>('error').unwrapOr(2)).toBe(2);
		});

		it('unwrapOrElse', () => {
			expect(chas.ok(1).unwrapOrElse(() => 2)).toBe(1);
			expect(chas.err<string, number>('error').unwrapOrElse(e => e.length)).toBe(5);
		});

		it('unwrapOrNull', () => {
			expect(chas.ok(1).unwrapOrNull()).toBe(1);
			expect(chas.err('error').unwrapOrNull()).toBeNull();
		});

		it('unwrapOrUndefined', () => {
			expect(chas.ok(1).unwrapOrUndefined()).toBe(1);
			expect(chas.err('error').unwrapOrUndefined()).toBeUndefined();
		});

		it('expect', () => {
			expect(chas.ok(1).expect('should be ok')).toBe(1);
			expect(() => chas.err('error').expect('should be ok')).toThrow('should be ok');

			const customError = new Error('custom');
			expect(() => chas.err('error').expect('should be ok', customError)).toThrow(customError);
		});

		it('expectErr', () => {
			expect(chas.err('error').expectErr('should be err')).toBe('error');
			expect(() => chas.ok(1).expectErr('should be err')).toThrow('should be err');

			const customError = new Error('custom');
			expect(() => chas.ok(1).expectErr('should be err', customError)).toThrow(customError);
		});

		it('match', () => {
			expect(chas.ok(1).match({ ok: v => v + 1, err: () => 0 })).toBe(2);
			expect(chas.err('error').match({ ok: (v: number) => v + 1, err: e => e.length })).toBe(5);
		});

		it('tap', () => {
			let value = 0;
			chas.ok(5).tap(v => (value = v));
			expect(value).toBe(5);

			let errValue = 0;
			chas.err('error').tap(v => (errValue = v));
			expect(errValue).toBe(0);
		});

		it('asynctap', async () => {
			let value = 0;
			await chas.ok(5).asynctap(async v => {
				value = v;
			});
			expect(value).toBe(5);

			let errValue = 0;
			await chas.err('error').asynctap(async v => {
				errValue = v as unknown as number; // just cast or ignore it for none branch
			});
			expect(errValue).toBe(0);
		});

		it('tapErr', () => {
			let value = '';
			chas.err('error').tapErr(e => (value = e));
			expect(value).toBe('error');

			let okValue = '';
			chas.ok(5).tapErr(e => (okValue = e));
			expect(okValue).toBe('');
		});

		it('tapTag', () => {
			const errors = chas.defineErrs({
				notFound: (message: string) => ({ message }),
				forbidden: () => ({ message: 'forbidden' }),
			});

			const res = errors.notFound.err('not found!');

			let example = '';
			res.tapTag('notFound', e => {
				example = e.message;
			});
			let example2 = '';
			res.tapTag(errors.notFound, e => {
				example2 = e.message;
			});
			expect(example).toBe('not found!');
			expect(example2).toBe('not found!');
		});

		it('asynctapErr', async () => {
			let value = '';
			await chas.err('error').asynctapErr(async e => {
				value = e;
			});
			expect(value).toBe('error');

			let okValue = '';
			await chas.ok(5).asynctapErr(async e => {
				okValue = e as unknown as string;
			});
			expect(okValue).toBe('');
		});

		it('finally', () => {
			let called = 0;
			const res1 = chas.ok(1).finally(() => {
				called++;
			});
			expect(called).toBe(1);
			expect(res1.unwrap()).toBe(1);

			const res2 = chas.err('error').finally(() => {
				called++;
			});
			expect(called).toBe(2);
			expect(res2.unwrapErr()).toBe('error');
		});

		it('filter', () => {
			const res1 = chas.ok(20).filter(
				v => v >= 18,
				() => 'Too young'
			);
			expect(res1.unwrap()).toBe(20);

			const res2 = chas.ok(15).filter(
				v => v >= 18,
				() => 'Too young'
			);
			expect(res2.unwrapErr()).toBe('Too young');

			const res3 = chas.err('error').filter(
				(v: number) => v >= 18,
				() => 'Too young'
			);
			expect(res3.unwrapErr()).toBe('error');
		});

		it('flatten', () => {
			const nestedOk = chas.ok(chas.ok(5));
			expect(nestedOk.flatten().unwrap()).toBe(5);

			const nestedErr = chas.ok(chas.err('error'));
			expect(nestedErr.flatten().unwrapErr()).toBe('error');

			const errOuter = chas.err('outer');
			expect(errOuter.flatten().unwrapErr()).toBe('outer');

			const notNested = chas.ok(5);
			expect(notNested.flatten().unwrap()).toBe(5);
		});

		it('swap', () => {
			const okSwapped = chas.ok(5).swap();
			expect(okSwapped.isErr()).toBe(true);
			expect(okSwapped.unwrapErr()).toBe(5);

			const errSwapped = chas.err('error').swap();
			expect(errSwapped.isOk()).toBe(true);
			expect(errSwapped.unwrap()).toBe('error');
		});
	});

	describe('ResultAsync', () => {
		it('okAsync', async () => {
			const res = chas.okAsync(42);
			const awaited = await res;
			expect(awaited.isOk()).toBe(true);
			expect(awaited.unwrap()).toBe(42);
		});

		it('errAsync', async () => {
			const res = chas.errAsync('error');
			const awaited = await res;
			expect(awaited.isErr()).toBe(true);
			expect(awaited.unwrapErr()).toBe('error');
		});

		it('fromPromise', async () => {
			const res1 = chas.fromPromise(Promise.resolve(42), () => 'error');
			expect((await res1).unwrap()).toBe(42);

			const res2 = chas.fromPromise(Promise.reject(new Error('fail')), e => (e as Error).message);
			expect((await res2).unwrapErr()).toBe('fail');
		});

		it('map', async () => {
			const res = chas.okAsync(42).map(v => v * 2);
			expect((await res).unwrap()).toBe(84);

			const errRes = chas.errAsync<string, number>('error').map(v => v * 2);
			expect((await errRes).unwrapErr()).toBe('error');
		});

		it('mapErr', async () => {
			const res = chas.okAsync<number, string>(42).mapErr(e => e.toUpperCase());
			expect((await res).unwrap()).toBe(42);

			const errRes = chas.errAsync('error').mapErr(e => e.toUpperCase());
			expect((await errRes).unwrapErr()).toBe('ERROR');
		});

		it('andThen', async () => {
			const res1 = chas.okAsync(42).andThen(v => chas.ok(v * 2));
			expect((await res1).unwrap()).toBe(84);

			const res2 = chas.okAsync(42).andThen(v => chas.okAsync(v * 2));
			expect((await res2).unwrap()).toBe(84);

			const res3 = chas.errAsync<string, number>('error').andThen(v => chas.ok(v * 2));
			expect((await res3).unwrapErr()).toBe('error');
		});

		it('tap', async () => {
			let value = 0;
			await chas.okAsync(5).tap(v => {
				value = v;
			});
			expect(value).toBe(5);

			let errValue = 0;
			await chas.errAsync('error').tap(v => {
				errValue = v as unknown as number;
			});
			expect(errValue).toBe(0);

			let asyncVal = 0;
			await chas.okAsync(5).tap(async v => {
				asyncVal = v;
			});
			expect(asyncVal).toBe(5);
		});

		it('tapErr', async () => {
			let value = '';
			await chas.errAsync('error').tapErr(e => {
				value = e;
			});
			expect(value).toBe('error');

			let okValue = '';
			await chas.okAsync(5).tapErr(e => {
				okValue = e as unknown as string;
			});
			expect(okValue).toBe('');

			let asyncStr = '';
			await chas.errAsync('error').tapErr(async e => {
				asyncStr = e;
			});
			expect(asyncStr).toBe('error');
		});

		it('match', async () => {
			const res1 = await chas.okAsync(42).match({ ok: v => v * 2, err: () => 0 });
			expect(res1).toBe(84);

			const res2 = await chas.errAsync('error').match({ ok: () => 0, err: e => e.length });
			expect(res2).toBe(5);
		});

		it('readSuspense', async () => {
			let resolvePromise: (val: chas.Result<number, never>) => void;
			const pendingPromise = new Promise<chas.Result<number, never>>(r => {
				resolvePromise = r;
			});

			const resAsync = new chas.ResultAsync(pendingPromise);

			// Should throw promise while pending
			expect(() => resAsync.readSuspense()).toThrowError();
			try {
				resAsync.readSuspense();
				expect.fail('Should have thrown');
			} catch (thrown) {
				expect(thrown).toBeInstanceOf(Promise);
			}

			// Resolve it
			resolvePromise!(chas.ok(42));
			await pendingPromise; // wait for microticks

			// Delay to ensure next tick processes the `.then` state assignment correctly internally
			await new Promise(r => setTimeout(r, 0));

			expect(resAsync.readSuspense()).toBe(42);

			const errAsync = chas.errAsync('test error');
			await errAsync; // wait to resolve

			// Same delay logic here
			await new Promise(r => setTimeout(r, 0));

			expect(() => errAsync.readSuspense()).toThrowError('test error');
		});

		it('swap', async () => {
			const okSwapped = await chas.okAsync(5).swap();
			expect(okSwapped.isErr()).toBe(true);
			expect(okSwapped.unwrapErr()).toBe(5);

			const errSwapped = await chas.errAsync('error').swap();
			expect(errSwapped.isOk()).toBe(true);
			expect(errSwapped.unwrap()).toBe('error');
		});

		it('fromSafePromise', async () => {
			const res = await chas.ResultAsync.fromSafePromise(Promise.resolve(42));
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe(42);

			// Also test standalone export
			const res2 = await chas.fromSafePromise(Promise.resolve('hello'));
			expect(res2.unwrap()).toBe('hello');
		});

		it('defer', async () => {
			let called = false;
			const deferred = chas.ResultAsync.defer(() => {
				called = true;
				return chas.okAsync(42);
			});

			// fn should not have been called yet during synchronous execution
			expect(called).toBe(false);

			const result = await deferred;
			expect(called).toBe(true);
			expect(result.unwrap()).toBe(42);
		});
	});

	describe('Utility Functions', () => {
		it('tryCatch', () => {
			const res1 = chas.tryCatch(
				() => 42,
				() => 'error'
			);
			expect(res1.unwrap()).toBe(42);

			const res2 = chas.tryCatch(
				() => {
					throw new Error('fail');
				},
				e => (e as Error).message
			);
			expect(res2.unwrapErr()).toBe('fail');
		});

		it('all', () => {
			const res1 = chas.all([chas.ok(1), chas.ok(2), chas.ok(3)]);
			expect(res1.unwrap()).toEqual([1, 2, 3]);

			const arr: chas.Result<number, string>[] = [chas.ok(1), chas.err('error'), chas.ok(3)];
			const res2 = chas.all(arr);
			expect(res2.unwrapErr()).toBe('error');

			// Heterogeneous test
			const res3 = chas.all([chas.ok(1), chas.ok('two')] as const);
			// Under typescript, res3 is Result<[number, string], never>
			expect(res3.unwrap()).toEqual([1, 'two']);
		});

		it('allAsync', async () => {
			const res1 = await chas.allAsync([
				chas.okAsync(1),
				Promise.resolve(chas.ok(2)),
				Promise.resolve(chas.ok(3)),
			]);
			expect(res1.unwrap()).toEqual([1, 2, 3]);

			const arr: PromiseLike<chas.Result<number, string>>[] = [
				chas.okAsync(1),
				chas.errAsync('error'),
				Promise.resolve(chas.ok(3)),
			];
			const res2 = await chas.allAsync(arr);
			expect(res2.unwrapErr()).toBe('error');

			// Heterogeneous test
			const res3 = await chas.allAsync([chas.okAsync(1), chas.okAsync('two')] as const);
			// Under typescript, res3 is Result<[number, string], never>
			expect(res3.unwrap()).toEqual([1, 'two']);
		});

		it('any', () => {
			const arr: chas.Result<number, string>[] = [chas.err('a'), chas.ok(2), chas.err('c')];
			const res1 = chas.any(arr);
			expect(res1.isOk()).toBe(true);
			expect(res1.unwrap()).toBe(2);

			const arr2: chas.Result<number, string>[] = [chas.err('a'), chas.err('b')];
			const res2 = chas.any(arr2);
			expect(res2.isErr()).toBe(true);
			expect(res2.unwrapErr()).toEqual(['a', 'b']);

			// All ok - returns first
			const arr3: chas.Result<number, string>[] = [chas.ok(1), chas.ok(2)];
			const res3 = chas.any(arr3);
			expect(res3.unwrap()).toBe(1);
		});

		it('anyAsync', async () => {
			const arr: PromiseLike<chas.Result<number, string>>[] = [
				chas.errAsync('a'),
				chas.okAsync(2),
				chas.errAsync('c'),
			];
			const res1 = await chas.anyAsync(arr);
			expect(res1.isOk()).toBe(true);
			expect(res1.unwrap()).toBe(2);

			const arr2: PromiseLike<chas.Result<number, string>>[] = [chas.errAsync('a'), chas.errAsync('b')];
			const res2 = await chas.anyAsync(arr2);
			expect(res2.isErr()).toBe(true);
			expect(res2.unwrapErr()).toEqual(['a', 'b']);
		});

		it('race', () => {
			const arr: chas.Result<number, string>[] = [chas.err('a'), chas.ok(2)];
			const res1 = chas.race(arr);
			expect(res1.isErr()).toBe(true);
			expect(res1.unwrapErr()).toBe('a');

			const arr2: chas.Result<number, string>[] = [chas.ok(1), chas.err('b')];
			const res2 = chas.race(arr2);
			expect(res2.isOk()).toBe(true);
			expect(res2.unwrap()).toBe(1);
		});

		it('raceAsync', async () => {
			const p1 = new Promise<chas.Result<number, string>>(resolve =>
				setTimeout(() => resolve(chas.err('a')), 10)
			);
			const p2 = Promise.resolve(chas.ok(2));
			const arr: PromiseLike<chas.Result<number, string>>[] = [p1, p2];
			const res1 = await chas.raceAsync(arr);
			expect(res1.isOk()).toBe(true);
			expect(res1.unwrap()).toBe(2);

			const p3 = Promise.resolve(chas.err('b'));
			const p4 = new Promise<chas.Result<number, string>>(resolve => setTimeout(() => resolve(chas.ok(1)), 10));
			const arr2: PromiseLike<chas.Result<number, string>>[] = [p3, p4];
			const res2 = await chas.raceAsync(arr2);
			expect(res2.isErr()).toBe(true);
			expect(res2.unwrapErr()).toBe('b');
		});

		it('collect', () => {
			const arr: chas.Result<number, string>[] = [chas.ok(1), chas.err('a'), chas.ok(3), chas.err('b')];
			const res1 = chas.collect(arr);
			expect(res1.isErr()).toBe(true);
			expect(res1.unwrapErr()).toEqual(['a', 'b']);

			const arr2: chas.Result<number, string>[] = [chas.ok(1), chas.ok(2), chas.ok(3)];
			const res2 = chas.collect(arr2);
			expect(res2.isOk()).toBe(true);
			expect(res2.unwrap()).toEqual([1, 2, 3]);
		});

		it('collectAsync', async () => {
			const arr: PromiseLike<chas.Result<number, string>>[] = [
				chas.okAsync(1),
				chas.errAsync('a'),
				chas.okAsync(3),
				chas.errAsync('b'),
			];
			const res1 = await chas.collectAsync(arr);
			expect(res1.isErr()).toBe(true);
			expect(res1.unwrapErr()).toEqual(['a', 'b']);

			const arr2: PromiseLike<chas.Result<number, string>>[] = [chas.okAsync(1), chas.okAsync(2)];
			const res2 = await chas.collectAsync(arr2);
			expect(res2.isOk()).toBe(true);
			expect(res2.unwrap()).toEqual([1, 2]);
		});

		it('wrap', () => {
			const fn = chas.wrap(
				(a: number, b: number) => {
					if (b === 0) throw new Error('div by 0');
					return a / b;
				},
				e => (e as Error).message
			);

			expect(fn(4, 2).unwrap()).toBe(2);
			expect(fn(4, 0).unwrapErr()).toBe('div by 0');
		});

		it('wrapAsync', async () => {
			const fn = chas.wrapAsync(
				async (a: number, b: number) => {
					if (b === 0) throw new Error('div by 0');
					return a / b;
				},
				e => (e as Error).message
			);

			expect((await fn(4, 2)).unwrap()).toBe(2);
			expect((await fn(4, 0)).unwrapErr()).toBe('div by 0');
		});

		it('partition', () => {
			const results = [chas.ok(1), chas.err('e1'), chas.ok(2), chas.err('e2')] as chas.Result<number, string>[];
			const { oks, errs } = chas.partition(results);
			expect(oks).toEqual([1, 2]);
			expect(errs).toEqual(['e1', 'e2']);
		});

		it('partitionAsync', async () => {
			const promises = [
				chas.okAsync(1),
				Promise.resolve(chas.err('e1')),
				Promise.resolve(chas.ok(2)),
				chas.errAsync('e2'),
			] as Iterable<PromiseLike<chas.Result<number, string>>>;
			const { oks, errs } = await chas.partitionAsync(promises);
			expect(oks).toEqual([1, 2]);
			expect(errs).toEqual(['e1', 'e2']);
		});

		it('withRetryAsync', async () => {
			let attempts1 = 0;
			const fetchSuccessOnThird = chas.withRetryAsync(
				async () => {
					attempts1++;
					if (attempts1 < 3) throw new Error('fail');
					return 'success';
				},
				{ retries: 3, delayMs: 10, onThrow: e => (e as Error).message }
			);

			const res1 = await fetchSuccessOnThird();
			expect(res1.unwrap()).toBe('success');
			expect(attempts1).toBe(3);

			let attempts2 = 0;
			const fetchAlwaysFail = chas.withRetryAsync(
				async () => {
					attempts2++;
					throw new Error('fail');
				},
				{ retries: 2, delayMs: 10, onThrow: e => (e as Error).message }
			);

			const res2 = await fetchAlwaysFail();
			expect(res2.unwrapErr()).toBe('fail');
			expect(attempts2).toBe(3); // Initial attempt + 2 retries
		});

		it('shape', () => {
			const successShape = chas.shape({
				a: chas.ok(1) as chas.Result<number, string>,
				b: chas.ok('two') as chas.Result<string, string>,
				c: chas.ok(true) as chas.Result<boolean, string>,
			});

			expect(successShape.isOk()).toBe(true);
			expect(successShape.unwrap()).toEqual({ a: 1, b: 'two', c: true });

			const errShape = chas.shape({
				a: chas.ok(1) as chas.Result<number, string>,
				b: chas.err('fail') as chas.Result<number, string>,
				c: chas.ok(3) as chas.Result<number, string>,
			});

			expect(errShape.isErr()).toBe(true);
			expect(errShape.unwrapErr()).toBe('fail');
		});

		it('shapeAsync', async () => {
			const successShape = await chas.shapeAsync({
				a: chas.okAsync(1),
				b: Promise.resolve(chas.ok('two')),
				c: chas.fromPromise(Promise.resolve(true), () => false),
			});

			expect(successShape.isOk()).toBe(true);
			const expectedObj = { a: 1, b: 'two', c: true };
			expect(successShape.unwrap()).toEqual(expectedObj);

			const errShape = await chas.shapeAsync({
				a: chas.okAsync(1),
				b: chas.errAsync('fail'),
				c: chas.okAsync(3),
			});

			expect(errShape.isErr()).toBe(true);
			expect(errShape.unwrapErr()).toBe('fail');
		});

		it('go (do-notation)', () => {
			const successGo = chas.go(function* () {
				const a = yield* chas.ok(5);
				const b = yield* chas.ok(10);
				return a + b;
			});
			expect(successGo.unwrap()).toBe(15);

			let didExecuteAfterErr = false;

			const errGo = chas.go(function* (): Generator<chas.Result<any, string>, number, any> {
				const a = yield* chas.ok(5) as unknown as chas.Result<number, string>;

				const b = yield* chas.err<string, any>('fail!');
				didExecuteAfterErr = true;
				return a + (b as number);
			});

			expect(errGo.unwrapErr()).toBe('fail!');
			expect(didExecuteAfterErr).toBe(false);
		});

		it('go (async do-notation)', async () => {
			const successAsyncGo = chas.go(function* () {
				const a = yield* chas.okAsync(10);
				const b = yield* chas.ok(5);
				return a + b;
			});

			const res = await successAsyncGo;
			expect(res.unwrap()).toBe(15);

			let didExecuteAfterErrAsync = false;

			const errAsyncGo = chas.go(function* (): Generator<chas.ResultAsync<any, string>, number, any> {
				const a = yield* chas.errAsync<string, any>('fail!');
				didExecuteAfterErrAsync = true;

				const b = yield* chas.okAsync(5) as unknown as chas.ResultAsync<number, string>;
				return (a as number) + b;
			});

			const errRes = await errAsyncGo;
			expect(errRes.unwrapErr()).toBe('fail!');
			expect(didExecuteAfterErrAsync).toBe(false);
		});
	});

	describe('Tagged Errors', () => {
		const TestError = chas.defineErrs({
			NotFound: (resource: string, id: string) => ({ resource, id }),
			Validation: (field: string, message: string) => ({ field, message }),
			Unauthorized: () => ({}),
		});

		type TestErrorType = chas.InferErrs<typeof TestError>;

		it('errors() creates tagged error objects', () => {
			const e1 = TestError.NotFound('user', '123');
			expect(e1._tag).toBe('NotFound');
			expect(e1.resource).toBe('user');
			expect(e1.id).toBe('123');

			const e2 = TestError.Validation('email', 'invalid format');
			expect(e2._tag).toBe('Validation');
			expect(e2.field).toBe('email');
			expect(e2.message).toBe('invalid format');

			const e3 = TestError.Unauthorized();
			expect(e3._tag).toBe('Unauthorized');
		});

		it('errors() works with Result', () => {
			const result: chas.Result<string, TestErrorType> = chas.err(
				TestError.NotFound('user', '123') as TestErrorType
			);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr()._tag).toBe('NotFound');
		});

		it('matchError() exhaustively matches tags', () => {
			const err1 = TestError.NotFound('user', '123') as TestErrorType;
			const message1 = chas.matchErr(err1, {
				NotFound: e => `${e.resource} ${e.id} not found`,
				Validation: e => `${e.field}: ${e.message}`,
				Unauthorized: () => 'unauthorized',
			});
			expect(message1).toBe('user 123 not found');

			const err2 = TestError.Validation('email', 'invalid') as TestErrorType;
			const message2 = chas.matchErr(err2, {
				NotFound: e => `${e.resource} not found`,
				Validation: e => `${e.field}: ${e.message}`,
				Unauthorized: () => 'unauthorized',
			});
			expect(message2).toBe('email: invalid');
		});

		it('isErrorTag() narrows the type', () => {
			const err = TestError.NotFound('user', '123') as TestErrorType;

			if (chas.isErrWithTag(err, 'NotFound')) {
				expect(err.resource).toBe('user');
				expect(err.id).toBe('123');
			} else {
				expect.fail('Should have matched NotFound');
			}

			const validationErr = TestError.Validation('email', 'bad') as TestErrorType;
			expect(chas.isErrWithTag(validationErr, 'NotFound')).toBe(false);
			expect(chas.isErrWithTag(validationErr, 'Unauthorized')).toBe(false);
			expect(chas.isErrWithTag(validationErr, 'Validation')).toBe(true);
		});

		it('integrates with Result.match', () => {
			function getUser(id: string): chas.Result<string, TestErrorType> {
				if (!id) return chas.err(TestError.Validation('id', 'required') as TestErrorType);
				if (id === 'missing') return chas.err(TestError.NotFound('user', id) as TestErrorType);
				return chas.ok(`User ${id}`);
			}

			const r1 = getUser('42').match({
				ok: v => v,
				err: e =>
					chas.matchErr(e, {
						NotFound: e => `${e.resource} ${e.id} not found`,
						Validation: e => `Bad ${e.field}: ${e.message}`,
						Unauthorized: () => 'unauthorized',
					}),
			});
			expect(r1).toBe('User 42');

			const r2 = getUser('missing').match({
				ok: v => v,
				err: e =>
					chas.matchErr(e, {
						NotFound: e => `${e.resource} ${e.id} not found`,
						Validation: e => `Bad ${e.field}: ${e.message}`,
						Unauthorized: () => 'unauthorized',
					}),
			});
			expect(r2).toBe('user missing not found');
		});

		it('matchErrorPartial() matches subset with wildcard', () => {
			const err = TestError.NotFound('user', '123') as TestErrorType;
			const msg = chas.matchErrPartial(err, {
				Validation: e => `Bad ${e.field}`,
				_: e => `Fallback: ${e._tag}`,
			});
			expect(msg).toBe('Fallback: NotFound');

			const msg2 = chas.matchErrPartial(TestError.Validation('f', 'm') as TestErrorType, {
				Validation: e => `Bad ${e.field}`,
				_: () => 'fallback',
			});
			expect(msg2).toBe('Bad f');
		});

		it('catchTag() peels off a specific error', () => {
			const err = TestError.NotFound('user', '123') as TestErrorType;
			const res: chas.Result<string, TestErrorType> = chas.err(err);

			const caught = res.catchTag('NotFound', e => {
				expect(e.resource).toBe('user');
				return chas.ok('recovered');
			});

			type RemainingErrors = chas.ExtractErrError<typeof caught>;
			// Check if NotFound is strictly gone from the type
			const _typeCheck: Exclude<TestErrorType, { _tag: 'NotFound' }> = {} as RemainingErrors;
			expect(_typeCheck).toBeDefined();

			// @ts-expect-error - NotFound should be excluded from the union now
			const _shouldFail: RemainingErrors = TestError.NotFound('a', 'b');
			expect(_shouldFail).toBeDefined();

			expect(caught.isOk()).toBe(true);
			expect(caught.unwrap()).toBe('recovered');

			// Unmatched tags pass through
			const res2: chas.Result<string, TestErrorType> = chas.err(TestError.Validation('f', 'm') as TestErrorType);
			const missed = res2.catchTag('NotFound', () => chas.ok('nope'));
			expect(missed.isErr()).toBe(true);
			expect(missed.unwrapErr()._tag).toBe('Validation');
		});

		it('ResultAsync.catchTag() works asynchronously', async () => {
			const res: chas.ResultAsync<string, TestErrorType> = chas.errAsync(
				TestError.NotFound('u', 'i') as TestErrorType
			);
			const caught = await res.catchTag('NotFound', async e => {
				await new Promise(resolve => setTimeout(resolve, 0));
				return chas.ok(`recovered ${e.id}`);
			});

			expect(caught.isOk()).toBe(true);
			expect(caught.unwrap()).toBe('recovered i');
		});

		it('infers exact error type from factory even when Result error is unknown', () => {
			// This matches user's request: "Ensure inferred error types have all of their custom props... e.g NotFoundErr might have a 'resource' prop"
			const res = chas.err(TestError.NotFound('book', '10')) as chas.Result<string, unknown>;

			const recovered = res.catchTag(TestError.NotFound, e => {
				// e should be strongly typed here as the exact NotFound error!
				expect(e.resource).toBe('book'); // Properly typed custom prop!
				expect(e.id).toBe('10');
				return chas.ok('found');
			});

			expect(recovered.isOk()).toBe(true);
			expect(recovered.unwrap()).toBe('found');
			
			// A string tag should just infer `{ readonly _tag: 'NotFound' }` and native Error props.
			const res2 = chas.err(TestError.NotFound('book', '10')) as chas.Result<string, unknown>;
			res2.catchTag('NotFound', e => {
				// @ts-expect-error - string tag only infers the tag itself, not custom props
				void e.resource; 
				expect(e._tag).toBe('NotFound');
				return chas.ok(1);
			});
		});

		it('errors() produces real Error instances with stack traces', () => {
			const err = TestError.NotFound('user', '123');
			expect(err instanceof Error).toBe(true);
			expect(err.stack).toBeDefined();
			expect(err.name).toBe('NotFound');
			expect((err as any).message).toBe('[NotFound]');
		});

		it('supports error wrapping via cause', () => {
			const root = new Error('root cause');
			const AppError = chas.defineErrs({
				Wrapped: (cause: Error) => ({ cause }),
			});

			const err = AppError.Wrapped(root);
			expect((err as any).cause).toBe(root);
			// Native Error support check
			expect((err as unknown as Error).cause).toBe(root);
		});
	});
});
