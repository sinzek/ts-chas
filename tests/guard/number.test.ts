import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import { InferGuard } from '../../src/guard/base/shared.js';

describe('is.number (v2)', () => {
	it('basic number validation', () => {
		expect(is.number(123)).toBe(true);
		expect(is.number(1.23)).toBe(true);
		expect(is.number('123')).toBe(false);
		expect(is.number(NaN)).toBe(false);
		expect(is.number(Infinity)).toBe(false);
	});

	describe('Integer Guards', () => {
		it('is.number.int (safe integer)', () => {
			expect(is.number.int(123)).toBe(true);
			expect(is.number.int(1.23)).toBe(false);
			expect(is.number.int(Number.MAX_SAFE_INTEGER)).toBe(true);
			expect(is.number.int(Number.MIN_SAFE_INTEGER)).toBe(true);

			// These are integers but not SAFE integers
			const unsafePlus = Number.MAX_SAFE_INTEGER + 1;
			expect(is.number.int(unsafePlus)).toBe(false);
		});

		it('is.number.int32', () => {
			expect(is.number.int32(123)).toBe(true);
			expect(is.number.int32(2147483647)).toBe(true);
			expect(is.number.int32(-2147483648)).toBe(true);

			expect(is.number.int32(2147483648)).toBe(false);
			expect(is.number.int32(-2147483649)).toBe(false);
			expect(is.number.int32(1.23)).toBe(false);
		});
	});

	describe('Comparisons', () => {
		it('gt / gte / lt / lte', () => {
			expect(is.number.gt(5)(6)).toBe(true);
			expect(is.number.gt(5)(5)).toBe(false);
			expect(is.number.gte(5)(5)).toBe(true);
			expect(is.number.lt(5)(4)).toBe(true);
			expect(is.number.lte(5)(5)).toBe(true);
		});

		it('between', () => {
			expect(is.number.between(1, 10)(5)).toBe(true);
			expect(is.number.between(1, 10)(1)).toBe(true);
			expect(is.number.between(1, 10)(10)).toBe(true);
			expect(is.number.between(1, 10)(0.9)).toBe(false);
			expect(is.number.between(1, 10)(10.1)).toBe(false);
		});

		it('positive / nonnegative / negative / nonpositive', () => {
			expect(is.number.positive(1)).toBe(true);
			expect(is.number.positive(0)).toBe(false);
			expect(is.number.nonnegative(0)).toBe(true);
			expect(is.number.negative(-1)).toBe(true);
			expect(is.number.negative(0)).toBe(false);
			expect(is.number.nonpositive(0)).toBe(true);
		});

		it('unit', () => {
			expect(is.number.unit(0)).toBe(true);
			expect(is.number.unit(0.5)).toBe(true);
			expect(is.number.unit(1)).toBe(true);
			expect(is.number.unit(-0.1)).toBe(false);
			expect(is.number.unit(1.1)).toBe(false);
		});
	});

	describe('Arithmetic & Formatting', () => {
		it('even / odd', () => {
			expect(is.number.even(2)).toBe(true);
			expect(is.number.even(3)).toBe(false);
			expect(is.number.odd(3)).toBe(true);
			expect(is.number.odd(2)).toBe(false);
		});

		it('multipleOf', () => {
			expect(is.number.multipleOf(3)(9)).toBe(true);
			expect(is.number.multipleOf(3)(10)).toBe(false);
		});

		it('digits', () => {
			expect(is.number.digits(3)(123)).toBe(true);
			expect(is.number.digits(3)(1.23)).toBe(true);
			expect(is.number.digits(3)(12)).toBe(false);
			expect(is.number.digits(3)(1234)).toBe(false);
		});

		it('precision', () => {
			expect(is.number.precision(2)(1.23)).toBe(true);
			expect(is.number.precision(2)(1.2)).toBe(true);
			expect(is.number.precision(2)(1)).toBe(true);
			expect(is.number.precision(2)(1.234)).toBe(false);
		});
	});

	describe('Specialized', () => {
		it('port', () => {
			expect(is.number.port(80)).toBe(true);
			expect(is.number.port(65535)).toBe(true);
			expect(is.number.port(0)).toBe(true);
			expect(is.number.port(-1)).toBe(false);
			expect(is.number.port(65536)).toBe(false);
			expect(is.number.port(80.5)).toBe(false);
		});
	});

	describe('NaN', () => {
		it('is.nan', () => {
			expect(is.nan(NaN)).toBe(true);
			expect(is.nan(123)).toBe(false);
		});

		it('type narrowing', () => {
			const x = 123;
			if (is.nan(x)) {
				const y: InferGuard<typeof is.nan> = x;
				expect(y).toBe(NaN);
			}
		});
	});
});
