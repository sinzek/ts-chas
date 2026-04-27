import { describe, it } from 'vitest';
import fc from 'fast-check';
import { is, type Guard } from '../src/guard/index.js';

// Helper to run property-based tests on a given guard
async function testGuard<T>(guard: Guard<T, any>) {
	const arbitrary = await guard.arbitrary();
	fc.assert(
		fc.property(arbitrary, val => {
			return guard(val);
		})
	);
}

describe('Property-based testing (2.1)', () => {
	it('validates primitive constraints', async () => {
		await testGuard(is.string.min(3).max(10));
		await testGuard(is.string.email);
		await testGuard(is.string.uuid());
		await testGuard(is.string.iso.datetime());
		await testGuard(is.number.int.between(-100, 100));
		await testGuard(is.number.positive.multipleOf(5));
		await testGuard(is.bigint.between(0n, 1000n).even);
		await testGuard(is.boolean);
	});

	it('validates literal and enum constraints', async () => {
		await testGuard(is.literal('apple', 'banana', 'cherry'));
		await testGuard(is.enum(['red', 'green', 'blue'] as const));
	});

	it('validates structural object constraints', async () => {
		await testGuard(
			is.object({
				name: is.string.min(1),
				age: is.number.int.gte(0),
				metadata: is.object({
					tags: is.array(is.string).min(1),
					createdAt: is.string.iso.date,
				}),
			})
		);

		await testGuard(
			is
				.object({
					a: is.number,
				})
				.extend({ b: is.string })
				.partial()
		);
	});

	it('validates arrays and tuples', async () => {
		await testGuard(is.array(is.number).min(2).max(5));
		await testGuard(is.tuple([is.string, is.number, is.boolean]));
		await testGuard(is.tuple([is.string], is.number)); // variadic
	});

	it('validates records, maps, and sets', async () => {
		await testGuard(is.record(is.string.max(5), is.number));
		await testGuard(is.map(is.string, is.boolean).minSize(1));
		await testGuard(is.set(is.number.positive).maxSize(10));
	});

	it('validates unions and intersections', async () => {
		await testGuard(is.union(is.string.min(5), is.number.int.positive));
		await testGuard(is.intersection(is.object({ a: is.string }), is.object({ b: is.number })));
	});

	it('validates discriminated unions', async () => {
		await testGuard(
			is.discriminatedUnion('type', {
				circle: is.object({ radius: is.number.positive }),
				rect: is.object({ width: is.number.positive, height: is.number.positive }),
			})
		);
	});

	it('validates built-ins and binaries', async () => {
		await testGuard(is.date.past);
		await testGuard(is.url().https);
		await testGuard(is.uint8Array.size(16));
	});
});
