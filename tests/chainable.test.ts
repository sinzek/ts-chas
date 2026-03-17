import { describe, it, expect } from 'vitest';
import { is } from '../src/guard';

describe('Chainable Guards', () => {
	describe('number', () => {
		it('should chain simple guards', () => {
			const positiveEven = is.number.positive.even;
			expect(positiveEven(2)).toBe(true);
			expect(positiveEven(3)).toBe(false);
			expect(positiveEven(-2)).toBe(false);
		});

		it('should chain factories', () => {
			const range = is.number.gt(10).lt(20);
			expect(range(15)).toBe(true);
			expect(range(10)).toBe(false);
			expect(range(20)).toBe(false);
		});

		it('should chain static guards and factories', () => {
			const oddRange = is.number.odd.between(150, 500).integer;
			expect(oddRange(151)).toBe(true);
			expect(oddRange(150)).toBe(false);
			expect(oddRange(152)).toBe(false);
			expect(oddRange(153.5)).toBe(false);
		});
	});

	describe('string', () => {
		it('should chain simple guards', () => {
			const nonEmptyEmail = is.string.nonEmpty.email;
			expect(nonEmptyEmail('test@example.com')).toBe(true);
			expect(nonEmptyEmail('')).toBe(false);
			expect(nonEmptyEmail('not-an-email')).toBe(false);
		});

		it('should chain length factories', () => {
			const code = is.string.length(4).alphanumeric;
			expect(code('A1B2')).toBe(true);
			expect(code('A1B')).toBe(false);
			expect(code('A1B2C')).toBe(false);
			expect(code('A1B!')).toBe(false);
		});

		it('should support nested chainables', () => {
			const s = is.string.alphanumeric.nonEmpty;
			expect(s('hello')).toBe(true);
			expect(s('')).toBe(false);

			// Note: is.string.alphanumeric with spaces override
			const withSpaces = is.string.alphanumeric.spaces(1);
			expect(withSpaces('hello world')).toBe(true);
		});
	});

	describe('array', () => {
		it('should chain array guards', () => {
			const s = is.array(is.string).min(1).unique;
			expect(s(['a', 'b'])).toBe(true);
			expect(s(['a', 'a'])).toBe(false);
			expect(s([])).toBe(false);
		});

		it('should support static array chaining', () => {
			const s = is.array.min(2).nonEmpty;
			expect(s([1, 2])).toBe(true);
			expect(s([1])).toBe(false);
		});
	});

	describe('spaces', () => {
		it('should chain spaces', () => {
			const s = is.string.spaces(1, 2);
			expect(s('hello world')).toBe(true);
			expect(s('hello')).toBe(false);
			expect(s('hello world world')).toBe(true);
		});
	});

	describe('symbols', () => {
		it('should chain symbols', () => {
			const s = is.string.symbols(1, 2);
			expect(s('hello world!')).toBe(true);
			expect(s('hello?')).toBe(true);
			expect(s('hello world world')).toBe(false);
		});
	});

	describe('numbers', () => {
		it('should chain numbers', () => {
			const s = is.string.numbers(1, 2);
			expect(s('hello world1')).toBe(true);
			expect(s('hello')).toBe(false);
			expect(s('hello world world')).toBe(false);
		});
	});

	describe('letters', () => {
		it('should chain letters', () => {
			const s = is.string.letters('uppercase', 1, 2);
			expect(s('Hello world')).toBe(true);
			expect(s('hello')).toBe(false);
			expect(s('hello world world')).toBe(false);
		});
	});

	describe('uuid', () => {
		it('should chain uuid', () => {
			const v1 = is.string.uuid('v1');
			expect(v1('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
			expect(v1('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(false);

			const v4 = is.string.uuid('v4');
			expect(v4('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
			expect(v4('550e8400-e29b-11d4-a716-446655440000')).toBe(false);

			const all = is.string.uuid();
			expect(all('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
			expect(all('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
			expect(all('invalid-uuid')).toBe(false);
		});
	});

	describe('where', () => {
		it('should allow adding custom guards', () => {
			const s = is.string.where(value => value.length > 5);
			expect(s('hello')).toBe(false);
			expect(s('hello world')).toBe(true);
		});
	});

	describe('date', () => {
		it('should chain date comparisons', () => {
			const now = new Date();
			const past = new Date(now.getTime() - 1000);
			const future = new Date(now.getTime() + 1000);

			expect(is.date.before(future)(now)).toBe(true);
			expect(is.date.before(past)(now)).toBe(false);

			expect(is.date.after(past)(now)).toBe(true);
			expect(is.date.after(future)(now)).toBe(false);

			expect(is.date.between(past, future)(now)).toBe(true);
		});

		it('should chain date properties', () => {
			const sunday = new Date(2024, 2, 17); // Sunday, March 17, 2024
			const monday = new Date(2024, 2, 18); // Monday, March 18, 2024

			expect(is.date.weekend(sunday)).toBe(true);
			expect(is.date.weekend(monday)).toBe(false);

			expect(is.date.weekday(monday)).toBe(true);
			expect(is.date.weekday(sunday)).toBe(false);
		});
	});

	describe('boolean', () => {
		it('should chain boolean constants', () => {
			expect(is.boolean.true(true)).toBe(true);
			expect(is.boolean.true(false)).toBe(false);

			expect(is.boolean.false(false)).toBe(true);
			expect(is.boolean.false(true)).toBe(false);
		});

		it('should chain boolean where', () => {
			const alwaysTrue = is.boolean.where(v => v === true);
			expect(alwaysTrue(true)).toBe(true);
			expect(alwaysTrue(false)).toBe(false);
		});
	});
});
