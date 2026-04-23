import { describe, it, expect, expectTypeOf } from 'vitest';
import { is, type InferGuard } from '../../src/guard/index.js';

describe('is.from', () => {
	describe('broad inference (default)', () => {
		it('infers primitives broadly', () => {
			const strGuard = is.from('hello');
			expectTypeOf<InferGuard<typeof strGuard>>().toEqualTypeOf<string>();
			expect(strGuard('world')).toBe(true);
			expect(strGuard(1)).toBe(false);

			const numGuard = is.from(42);
			expectTypeOf<InferGuard<typeof numGuard>>().toEqualTypeOf<number>();
			expect(numGuard(100)).toBe(true);

			const boolGuard = is.from(true);
			expectTypeOf<InferGuard<typeof boolGuard>>().toEqualTypeOf<boolean>();
			expect(boolGuard(false)).toBe(true);

			const nullGuard = is.from(null);
			expectTypeOf<InferGuard<typeof nullGuard>>().toEqualTypeOf<null>();
			expect(nullGuard(null)).toBe(true);

			const undefGuard = is.from(undefined);
			expectTypeOf<InferGuard<typeof undefGuard>>().toEqualTypeOf<undefined>();
			expect(undefGuard(undefined)).toBe(true);
		});

		it('infers objects broadly', () => {
			const guard = is.from({ name: 'Alice', age: 30 });
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<{ name: string; age: number }>();

			// Valid objects:
			expect(guard({ name: 'Bob', age: 25 })).toBe(true);
			// Missing keys:
			expect(guard({ name: 'Bob' })).toBe(false);
			// Extra keys are allowed by default in base objects
			expect(guard({ name: 'Bob', age: 25, extra: true })).toBe(true);
		});

		it('infers arrays broadly', () => {
			const guard = is.from(['string', 'another']);
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<string[]>();

			expect(guard(['test'])).toBe(true);
			expect(guard(['test', 'more', 'items'])).toBe(true);
			// Fails due to incorrect nested type
			expect(guard(['test', 1])).toBe(false);
		});

		it('falls back to base classes', () => {
			const guard = is.from(new Date());
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<Date>();

			expect(guard(new Date('2022-01-01'))).toBe(true);
			expect(guard('2022-01-01')).toBe(false);
		});
	});

	describe('strict literal inference ({ literal: true })', () => {
		it('infers primitives explicitly', () => {
			const strGuard = is.from('hello', { literal: true });
			expectTypeOf<InferGuard<typeof strGuard>>().toEqualTypeOf<'hello'>();
			expect(strGuard('hello')).toBe(true);
			expect(strGuard('world')).toBe(false);

			const numGuard = is.from(42, { literal: true });
			expectTypeOf<InferGuard<typeof numGuard>>().toEqualTypeOf<42>();
			expect(numGuard(42)).toBe(true);
			expect(numGuard(100)).toBe(false);

			const boolGuard = is.from(true, { literal: true });
			expectTypeOf<InferGuard<typeof boolGuard>>().toEqualTypeOf<true>();
			expect(boolGuard(true)).toBe(true);
			expect(boolGuard(false)).toBe(false);
		});

		it('infers objects strictly', () => {
			const guard = is.from({ status: 'active', meta: 'data' }, { literal: true });
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<{ status: 'active'; meta: 'data' }>();

			// Valid exact match:
			expect(guard({ status: 'active', meta: 'data' })).toBe(true);

			// Fails incorrect values:
			expect(guard({ status: 'pending', meta: 'data' })).toBe(false);

			// Fails extra keys (is.object.strict applied):
			expect(guard({ status: 'active', meta: 'data', extra: 1 })).toBe(false);
		});

		it('infers tuples accurately', () => {
			const guard = is.from(['vip', 1], { literal: true });

			// Depending on <const T> depth, it might infer exactly 'vip' | 1 tuple fields.
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<['vip', 1]>();

			expect(guard(['vip', 1])).toBe(true);
			// Fails different values:
			expect(guard(['vip', 2])).toBe(false);
			// Fails incorrect lengths:
			expect(guard(['vip', 1, 2])).toBe(false);
			expect(guard(['vip'])).toBe(false);
		});

		it('handles complex nested strict structures', () => {
			const guard = is.from(
				{
					env: 'prod',
					ports: [80, 443],
					options: {
						secure: true,
					},
				},
				{ literal: true }
			);

			// Verify type inferences recursively
			expectTypeOf<InferGuard<typeof guard>>().toEqualTypeOf<{
				env: 'prod';
				ports: [80, 443];
				options: { secure: true };
			}>();

			expect(
				guard({
					env: 'prod',
					ports: [80, 443],
					options: { secure: true },
				})
			).toBe(true);

			expect(
				guard({
					env: 'dev',
					ports: [80, 443],
					options: { secure: true },
				})
			).toBe(false);

			// Should be structured as a tuple, so extra port fails
			expect(
				guard({
					env: 'prod',
					ports: [80, 443, 8080],
					options: { secure: true },
				})
			).toBe(false);

			// Nested object should be strict
			expect(
				guard({
					env: 'prod',
					ports: [80, 443],
					options: { secure: true, extra: 1 },
				})
			).toBe(false);
		});
	});
});
