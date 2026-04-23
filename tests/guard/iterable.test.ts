import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Iterable Guards', () => {
	it('validates iterables structurally', () => {
		const guard = is.iterable;
		expect(guard([])).toBe(true);
		expect(guard('string')).toBe(true);
		expect(guard(new Set())).toBe(true);
		expect(guard(new Map())).toBe(true);

		expect(guard({})).toBe(false);
		expect(guard(123)).toBe(false);
	});

	it('validates async iterables structurally', () => {
		const guard = is.asyncIterable;
		const asyncObj = {
			async *[Symbol.asyncIterator]() {
				yield 1;
			},
		};
		expect(guard(asyncObj)).toBe(true);
		expect(guard([])).toBe(false);
	});

	it('.of performs exhaustive synchronous element validation', () => {
		const guard = is.iterable.of(is.number);

		expect(guard([1, 2, 3])).toBe(true);
		expect(guard([1, '2', 3])).toBe(false);
	});

	it('.of on asyncIterable returns AsyncGuard for exhaustive validation', async () => {
		const guard = is.asyncIterable.of(is.number);

		const validAsyncIterable = {
			async *[Symbol.asyncIterator]() {
				yield 1;
				yield 2;
			},
		};
		const result = await guard.parseAsync(validAsyncIterable);
		expect(result.ok).toBe(true);

		const invalidAsyncIterable = {
			async *[Symbol.asyncIterator]() {
				yield 1;
				yield '2';
			},
		};
		const invalidResult = await guard.parseAsync(invalidAsyncIterable);
		expect(invalidResult.ok).toBe(false);
	});
});
