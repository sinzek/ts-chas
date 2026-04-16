import { describe, it, expect, vi } from 'vitest';
import { ok, err, ResultAsync } from '../src/result/result.js';
import { wrap, wrapAsync } from '../src/result/result-helpers.js';

// ---------------------------------------------------------------------------
// wrap
// ---------------------------------------------------------------------------

describe('wrap — wrap-a-thrower workflow', () => {
	it('returns Ok when the function succeeds', () => {
		const safe = wrap((x: number) => x * 2);
		expect(safe(5).unwrap()).toBe(10);
	});

	it('returns Err when the function throws, error typed as unknown by default', () => {
		const safe = wrap(() => {
			throw new Error('boom');
		});
		const result = safe();
		expect(result.isErr()).toBe(true);
		expect((result.unwrapErr() as Error).message).toBe('boom');
	});

	it('maps the thrown value through onThrow', () => {
		const safe = wrap(
			(s: string) => JSON.parse(s),
			e => `parse error: ${(e as Error).message}`
		);
		expect(safe('{"a":1}').unwrap()).toEqual({ a: 1 });
		expect(safe('bad json').unwrapErr()).toMatch(/parse error/);
	});

	it('passes multiple arguments through unchanged', () => {
		const safe = wrap((a: number, b: number) => a / b);
		expect(safe(10, 2).unwrap()).toBe(5);
	});

	it('wraps the return value in ok() automatically', () => {
		const safe = wrap(() => 42);
		const result = safe();
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
	});
});

describe('wrap — define-with-Result workflow', () => {
	it('passes an ok() return through as-is', () => {
		const divide = wrap((a: number, b: number) => {
			if (b === 0) return err('division by zero' as const);
			return ok(a / b);
		});
		expect(divide(10, 2).unwrap()).toBe(5);
	});

	it('passes an err() return through as-is', () => {
		const divide = wrap((a: number, b: number) => {
			if (b === 0) return err('division by zero' as const);
			return ok(a / b);
		});
		expect(divide(10, 0).unwrapErr()).toBe('division by zero');
	});

	it('still catches a throw from inside a Result-returning function', () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const risky = wrap((_: number) => {
			throw new RangeError('out of range');
			return ok(0); // unreachable
		});
		const result = risky(1);
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBeInstanceOf(RangeError);
	});

	it('maps a throw through onThrow even in Result-returning mode', () => {
		const risky = wrap(
			() => {
				throw new Error('fail');
				return ok('never');
			},
			e => (e as Error).message
		);
		expect(risky().unwrapErr()).toBe('fail');
	});

	it('preserves the error type from err() without double-wrapping', () => {
		const fn = wrap(() => err({ code: 404 }));
		const result = fn();
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toEqual({ code: 404 });
	});
});

// ---------------------------------------------------------------------------
// wrapAsync
// ---------------------------------------------------------------------------

describe('wrapAsync — wrap-a-thrower workflow', () => {
	it('returns Ok when the promise resolves', async () => {
		const safe = wrapAsync(async (x: number) => x * 2);
		expect((await safe(5)).unwrap()).toBe(10);
	});

	it('returns Err when the promise rejects, error typed as unknown by default', async () => {
		const safe = wrapAsync(async () => {
			throw new Error('network error');
		});
		const result = await safe();
		expect(result.isErr()).toBe(true);
		expect((result.unwrapErr() as Error).message).toBe('network error');
	});

	it('maps the rejection through onThrow', async () => {
		const safe = wrapAsync(
			async (url: string) => {
				if (!url.startsWith('https')) throw new TypeError('insecure url');
				return url;
			},
			e => `fetch failed: ${(e as Error).message}`
		);
		expect((await safe('https://ok.com')).unwrap()).toBe('https://ok.com');
		expect((await safe('http://bad.com')).unwrapErr()).toMatch(/fetch failed/);
	});

	it('returns a ResultAsync instance', () => {
		const safe = wrapAsync(async () => 1);
		expect(safe()).toBeInstanceOf(ResultAsync);
	});

	it('catches a synchronous throw that happens before the first await', async () => {
		const safe = wrapAsync(
			(flag: boolean) => {
				if (flag) throw new Error('sync throw');
				return Promise.resolve('ok');
			},
			e => (e as Error).message
		);
		expect((await safe(true)).unwrapErr()).toBe('sync throw');
		expect((await safe(false)).unwrap()).toBe('ok');
	});
});

describe('wrapAsync — define-with-Result workflow', () => {
	it('passes an ok() return through as-is', async () => {
		const find = wrapAsync(async (id: number) => {
			if (id < 0) return err('NOT_FOUND' as const);
			return ok({ id });
		});
		expect((await find(1)).unwrap()).toEqual({ id: 1 });
	});

	it('passes an err() return through as-is', async () => {
		const find = wrapAsync(async (id: number) => {
			if (id < 0) return err('NOT_FOUND' as const);
			return ok({ id });
		});
		expect((await find(-1)).unwrapErr()).toBe('NOT_FOUND');
	});

	it('still catches a throw from inside a Result-returning async function', async () => {
		const risky = wrapAsync(async () => {
			throw new Error('unexpected');
			return ok('never');
		});
		const result = await risky();
		expect(result.isErr()).toBe(true);
		expect((result.unwrapErr() as Error).message).toBe('unexpected');
	});

	it('maps a throw through onThrow even in Result-returning mode', async () => {
		const risky = wrapAsync(
			async () => {
				throw new Error('fail');
				return ok('never');
			},
			e => (e as Error).message
		);
		expect((await risky()).unwrapErr()).toBe('fail');
	});

	it('supports chaining .map() on the ResultAsync', async () => {
		const double = wrapAsync(async (n: number) => ok(n));
		const result = await double(21).map(n => n * 2);
		expect(result.unwrap()).toBe(42);
	});

	it('can be awaited directly to get the inner Result', async () => {
		const fn = wrapAsync(async (s: string) => ok(s.toUpperCase()));
		const result = await fn('hello');
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe('HELLO');
	});

	it('preserves the error type from err() without double-wrapping', async () => {
		const fn = wrapAsync(async () => err({ code: 404 }));
		const result = await fn();
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toEqual({ code: 404 });
	});

	it('called function is invoked exactly once per call', async () => {
		const impl = vi.fn(async (x: number) => ok(x));
		const fn = wrapAsync(impl);
		await fn(1);
		await fn(2);
		expect(impl).toHaveBeenCalledTimes(2);
		expect(impl).toHaveBeenNthCalledWith(1, 1);
		expect(impl).toHaveBeenNthCalledWith(2, 2);
	});
});
