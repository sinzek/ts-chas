import { describe, it, expect } from 'vitest';
import { chas } from './index.js';

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
			expect(chas.ok(42).mapOrElse(() => 100, v => v * 2)).toBe(84);
			expect(chas.err('error').mapOrElse(e => e.length, (v: number) => v * 2)).toBe(5);
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
			expect(chas.ok(1).andThen(v => chas.ok(v + 1)).unwrap()).toBe(2);
			expect(chas.ok<number, string>(1).andThen(() => chas.err('error')).unwrapErr()).toBe('error');
			expect(chas.err<string, number>('error').andThen(v => chas.ok(v + 1)).unwrapErr()).toBe('error');
		});

		it('orElse', () => {
			expect(chas.ok(1).orElse(() => chas.ok(2)).unwrap()).toBe(1);
			expect(chas.ok<number, string>(1).orElse(() => chas.err('error')).unwrap()).toBe(1);
			expect(chas.err<string, number>('error1').orElse(() => chas.ok(2)).unwrap()).toBe(2);
			expect(chas.err('error1').orElse(e => chas.err(e + ' modified')).unwrapErr()).toBe('error1 modified');
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

		it('inspect', () => {
			let val = 0;
			const res = chas.ok(1).inspect(v => { val = v; });
			expect(val).toBe(1);
			expect(res.unwrap()).toBe(1);

			chas.err('error').inspect(() => { val = 2; });
			expect(val).toBe(1); // Not called
		});

		it('inspectErr', () => {
			let errStr = '';
			const res = chas.err('error').inspectErr(e => { errStr = e; });
			expect(errStr).toBe('error');
			expect(res.unwrapErr()).toBe('error');

			chas.ok(1).inspectErr(() => { errStr = 'err2'; });
			expect(errStr).toBe('error'); // Not called
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

		it('match', async () => {
			const res1 = await chas.okAsync(42).match({ ok: v => v * 2, err: () => 0 });
			expect(res1).toBe(84);

			const res2 = await chas.errAsync('error').match({ ok: () => 0, err: e => e.length });
			expect(res2).toBe(5);
		});
	});

	describe('Utility Functions', () => {
		it('tryCatch', () => {
			const res1 = chas.tryCatch(() => 42, () => 'error');
			expect(res1.unwrap()).toBe(42);

			const res2 = chas.tryCatch(() => { throw new Error('fail'); }, e => (e as Error).message);
			expect(res2.unwrapErr()).toBe('fail');
		});

		it('all', () => {
			const res1 = chas.all([chas.ok(1), chas.ok(2), chas.ok(3)]);
			expect(res1.unwrap()).toEqual([1, 2, 3]);

			const res2 = chas.all([
				chas.ok(1),
				chas.err('error'),
				chas.ok(3)
			] as chas.Result<number, string>[]);
			expect(res2.unwrapErr()).toBe('error');
		});

		it('allAsync', async () => {
			const res1 = await chas.allAsync([
				chas.okAsync(1),
				Promise.resolve(chas.ok(2)),
				Promise.resolve(chas.ok(3))
			] as Iterable<PromiseLike<chas.Result<number, never>>>);
			expect(res1.unwrap()).toEqual([1, 2, 3]);

			const res2 = await chas.allAsync([
				chas.okAsync(1),
				chas.errAsync('error'),
				Promise.resolve(chas.ok(3))
			] as Iterable<PromiseLike<chas.Result<number, string>>>);
			expect(res2.unwrapErr()).toBe('error');
		});

		it('withResult', () => {
			const fn = chas.withResult((a: number, b: number) => {
				if (b === 0) throw new Error('div by 0');
				return a / b;
			}, e => (e as Error).message);

			expect(fn(4, 2).unwrap()).toBe(2);
			expect(fn(4, 0).unwrapErr()).toBe('div by 0');
		});

		it('withResultAsync', async () => {
			const fn = chas.withResultAsync(async (a: number, b: number) => {
				if (b === 0) throw new Error('div by 0');
				return a / b;
			}, e => (e as Error).message);

			expect((await fn(4, 2)).unwrap()).toBe(2);
			expect((await fn(4, 0)).unwrapErr()).toBe('div by 0');
		});

		it('partition', () => {
			const results = [
				chas.ok(1),
				chas.err('e1'),
				chas.ok(2),
				chas.err('e2')
			] as chas.Result<number, string>[];
			const { oks, errs } = chas.partition(results);
			expect(oks).toEqual([1, 2]);
			expect(errs).toEqual(['e1', 'e2']);
		});

		it('partitionAsync', async () => {
			const promises = [
				chas.okAsync(1),
				Promise.resolve(chas.err('e1')),
				Promise.resolve(chas.ok(2)),
				chas.errAsync('e2')
			] as Iterable<PromiseLike<chas.Result<number, string>>>;
			const { oks, errs } = await chas.partitionAsync(promises);
			expect(oks).toEqual([1, 2]);
			expect(errs).toEqual(['e1', 'e2']);
		});
	});
});
