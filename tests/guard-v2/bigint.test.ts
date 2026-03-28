import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.bigint (v2)', () => {
	it('basic bigint validation', () => {
		expect(is.bigint(123n)).toBe(true);
		expect(is.bigint(123)).toBe(false);
	});

	describe('Integer Range Guards', () => {
		it('is.bigint.int32', () => {
			expect(is.bigint.int32(123n)).toBe(true);
			expect(is.bigint.int32(2147483647n)).toBe(true);
			expect(is.bigint.int32(-2147483648n)).toBe(true);
			
			expect(is.bigint.int32(2147483648n)).toBe(false);
			expect(is.bigint.int32(-2147483649n)).toBe(false);
		});

		it('is.bigint.int64', () => {
			expect(is.bigint.int64(123n)).toBe(true);
			expect(is.bigint.int64(9223372036854775807n)).toBe(true);
			expect(is.bigint.int64(-9223372036854775808n)).toBe(true);
			
			expect(is.bigint.int64(9223372036854775808n)).toBe(false);
			expect(is.bigint.int64(-9223372036854775809n)).toBe(false);
		});
	});

	describe('Comparisons', () => {
		it('gt / gte / lt / lte', () => {
			expect(is.bigint.gt(5n)(6n)).toBe(true);
			expect(is.bigint.gt(5n)(5n)).toBe(false);
			expect(is.bigint.gte(5n)(5n)).toBe(true);
			expect(is.bigint.lt(5n)(4n)).toBe(true);
			expect(is.bigint.lte(5n)(5n)).toBe(true);
		});

		it('between', () => {
			expect(is.bigint.between(1n, 10n)(5n)).toBe(true);
			expect(is.bigint.between(1n, 10n)(1n)).toBe(true);
			expect(is.bigint.between(1n, 10n)(10n)).toBe(true);
			expect(is.bigint.between(1n, 10n)(0n)).toBe(false);
			expect(is.bigint.between(1n, 10n)(11n)).toBe(false);
		});

		it('positive / nonnegative / negative / nonpositive', () => {
			expect(is.bigint.positive(1n)).toBe(true);
			expect(is.bigint.positive(0n)).toBe(false);
			expect(is.bigint.nonnegative(0n)).toBe(true);
			expect(is.bigint.negative(-1n)).toBe(true);
			expect(is.bigint.negative(0n)).toBe(false);
			expect(is.bigint.nonpositive(0n)).toBe(true);
		});
	});

	describe('Arithmetic & Formatting', () => {
		it('even / odd', () => {
			expect(is.bigint.even(2n)).toBe(true);
			expect(is.bigint.even(3n)).toBe(false);
			expect(is.bigint.odd(3n)).toBe(true);
			expect(is.bigint.odd(2n)).toBe(false);
		});

		it('multipleOf', () => {
			expect(is.bigint.multipleOf(3n)(9n)).toBe(true);
			expect(is.bigint.multipleOf(3n)(10n)).toBe(false);
		});

		it('digits', () => {
			expect(is.bigint.digits(3)(123n)).toBe(true);
			expect(is.bigint.digits(3)(-123n)).toBe(true);
			expect(is.bigint.digits(3)(12n)).toBe(false);
			expect(is.bigint.digits(3)(1234n)).toBe(false);
		});
	});
});
