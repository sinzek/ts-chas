import { it, expect, describe } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Guard Coercion', () => {
	describe('is.number.coerce', () => {
		it('coerces strings to numbers', () => {
			const guard = is.number.coerce;
			expect(guard.parse('123').unwrap()).toBe(123);
			expect(guard.parse('12.3').unwrap()).toBe(12.3);
			expect(guard.parse('').unwrap()).toBe(0);
		});

		it('coerces booleans to numbers', () => {
			const guard = is.number.coerce;
			expect(guard.parse(true).unwrap()).toBe(1);
			expect(guard.parse(false).unwrap()).toBe(0);
		});

		it('supports chaining after coercion', () => {
			const guard = is.number.coerce.gt(10).multipleOf(2);
			expect(guard.parse('12').unwrap()).toBe(12);
			expect(guard.parse('8').isOk()).toBe(false);
		});
	});

	describe('other coercion attempts', () => {
		it('does not allow unsupported coercions', () => {
			const guard = is.number.coerce;
			expect(guard.parse(null).isOk()).toBe(false);
			expect(guard.parse(undefined).isOk()).toBe(false);
		});
	});

	describe('is.string.coerce', () => {
		it('coerces numbers and booleans to strings', () => {
			const guard = is.string.coerce;
			expect(guard.parse(123).unwrap()).toBe('123');
			expect(guard.parse(true).unwrap()).toBe('true');
			expect(guard.parse(null).unwrap()).toBe('null');
		});

		it('coerces dates to strings', () => {
			const guard = is.string.coerce;
			const date = new Date('2023-01-01T00:00:00Z');
			expect(guard.parse(date).unwrap()).toBe(date.toISOString());
		});

		it('supports chaining with string helpers', () => {
			const guard = is.string.coerce.trim().min(5);
			expect(guard.parse('  123456  ').unwrap()).toBe('123456');
			expect(guard.parse(12345).unwrap()).toBe('12345');
		});
	});

	describe('is.boolean.coerce', () => {
		it('coerces common truthy/falsy values', () => {
			const guard = is.boolean.coerce;
			expect(guard.parse('true').unwrap()).toBe(true);
			expect(guard.parse('false').unwrap()).toBe(false);
			expect(guard.parse(1).unwrap()).toBe(true);
			expect(guard.parse(0).unwrap()).toBe(false);
			expect(guard.parse('on').unwrap()).toBe(true);
		});

		it('returns original value if not coercible (allowing validation to fail)', () => {
			const guard = is.boolean.coerce;
			const result = guard.parse('not-a-bool');
			expect(result.isOk()).toBe(false);
		});
	});

	describe('is.date.coerce', () => {
		it('coerces strings and numbers to Dates', () => {
			const guard = is.date.coerce;
			const now = Date.now();
			expect(guard.parse(now).unwrap().getTime()).toBe(now);
			expect(guard.parse('2023-01-01').unwrap().toISOString()).toBe(new Date('2023-01-01').toISOString());
		});

		it('validates after coercion', () => {
			const guard = is.date.coerce.after(new Date('2020-01-01'));
			expect(guard.parse('2023-01-01').isOk()).toBe(true);
			expect(guard.parse('2019-01-01').isOk()).toBe(false);
		});
	});

	describe('is.object-like coercion', () => {
		it('coerces JSON strings to objects', () => {
			const guard = is.object({ a: is.number }).coerce;
			expect(guard.parse('{"a": 123}').unwrap()).toEqual({ a: 123 });
		});

		it('coerces JSON strings to arrays', () => {
			const guard = is.array(is.number).coerce;
			expect(guard.parse('[1, 2, 3]').unwrap()).toEqual([1, 2, 3]);
		});

		it('supports nested recursion via component coercion', () => {
			// Outer object coerces string -> object
			// Inner field coerces string -> number
			const guard = is.object({
				a: is.number.coerce,
			}).coerce;

			expect(guard.parse('{"a": "123"}').unwrap()).toEqual({ a: 123 });
		});
	});

	describe('is.bigint.coerce', () => {
		it('coerces strings and numbers to BigInt', () => {
			const guard = is.bigint.coerce;
			expect(guard.parse('123').unwrap()).toBe(123n);
			expect(guard.parse(123).unwrap()).toBe(123n);
		});
	});

	describe('Type Lie Awareness', () => {
		it('returns true for coercible values in predicate mode', () => {
			const guard = is.number.coerce;
			// This is the "type lie" - it returns true because it COULD be a number
			expect(guard('123')).toBe(true);
		});

		it('handles validation failures for non-coercible values', () => {
			const guard = is.number.coerce;
			expect(guard.parse('not-a-number').isOk()).toBe(false);
		});
	});

	describe('is.result().coerce', () => {
		it('revives stripped POJO Ok Results seamlessly', () => {
			const guard = is.result(is.number, is.unknown).coerce;
			const res = guard.parse({ ok: true, value: 42 });
			
			expect(res.isOk()).toBe(true);
			const revived = res.unwrap();
			expect(revived.isOk()).toBe(true);
			expect(revived.unwrap()).toBe(42);
			expect(typeof revived.map).toBe('function'); // Verified methods are there
		});

		it('revives stripped POJO Err Results seamlessly', () => {
			const guard = is.result(is.unknown, is.string).coerce;
			const res = guard.parse({ ok: false, error: 'failure' });
			
			expect(res.isOk()).toBe(true);
			const revived = res.unwrap();
			expect(revived.isErr()).toBe(true);
			expect(revived.unwrapErr()).toBe('failure');
		});

		it('gracefully falls back and fails validation on non-objects', () => {
			const guard = is.result().coerce;
			expect(guard.parse('not an object').isOk()).toBe(false);
			expect(guard.parse(null).isOk()).toBe(false);
		});
	});
});
