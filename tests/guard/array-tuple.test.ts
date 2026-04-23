import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.array (v2)', () => {
	it('basic array validation', () => {
		const example = is.array(is.number, is.string);
		expect(example([1, 2, 3, 'a'])).toBe(true);
		expect(is.array()([])).toBe(true);
		expect(is.array()({})).toBe(false);
		expect(is.array()(null)).toBe(false);
	});

	it('array with element guard', () => {
		const guard = is.array(is.string);
		expect(guard(['a', 'b'])).toBe(true);
		expect(guard(['a', 1])).toBe(false);
	});

	describe('Refinements', () => {
		it('nonEmpty / empty', () => {
			expect(is.array().nonEmpty([1])).toBe(true);
			expect(is.array().nonEmpty([])).toBe(false);
			expect(is.array().empty([])).toBe(true);
			expect(is.array().empty([1])).toBe(false);
		});

		it('unique', () => {
			expect(is.array(is.number).unique([1, 2, 3])).toBe(true);
			expect(is.array(is.number).unique([1, 2, 1])).toBe(false);
		});

		it('min / max / size', () => {
			expect(is.array(is.number, is.string).min(2)([1, 2])).toBe(true);
			expect(is.array(is.number).min(2)([1])).toBe(false);
			expect(is.array(is.number).max(2)([1, 2])).toBe(true);
			expect(is.array(is.number).max(2)([1, 2, 3])).toBe(false);
			expect(is.array(is.number).size(2)([1, 2])).toBe(true);
			expect(is.array(is.number).size(2)([1, 2, 3])).toBe(false);
		});

		it('includes / excludes', () => {
			expect(is.array(is.number).includes(1)([1, 2])).toBe(true);
			expect(is.array().includes(3)([1, 2])).toBe(false);
			expect(is.array().excludes(3)([1, 2])).toBe(true);
			expect(is.array().excludes(1)([1, 2])).toBe(false);
		});
	});

	describe('.array universal helper', () => {
		it('is.string.array validates string arrays', () => {
			expect(is.string.array(['a', 'b', 'c'])).toBe(true);
			expect(is.string.array(['a', 1])).toBe(false);
			expect(is.string.array([])).toBe(true);
			expect(is.string.array('not array')).toBe(false);
		});

		it('is.number.array validates number arrays', () => {
			expect(is.number.array([1, 2, 3])).toBe(true);
			expect(is.number.array([1, 'two'])).toBe(false);
		});

		it('chains with refinements', () => {
			expect(is.number.positive.array([1, 2, 3])).toBe(true);
			expect(is.number.positive.array([1, -2, 3])).toBe(false);
		});

		it('is.boolean.array validates boolean arrays', () => {
			expect(is.boolean.array([true, false])).toBe(true);
			expect(is.boolean.array([true, 1])).toBe(false);
		});

		it('narrows to T[]', () => {
			const value: unknown = ['a', 'b'];
			if (is.string.array(value)) {
				const narrowed: string[] = value;
				expect(narrowed).toEqual(['a', 'b']);
			}
		});

		it('.parse() works', () => {
			expect(is.string.array.parse(['a', 'b']).isOk()).toBe(true);
			expect(is.string.array.parse([1, 2]).isErr()).toBe(true);
		});

		it('has array helpers (min, max, nonEmpty, etc.)', () => {
			expect(is.string.array.nonEmpty(['a'])).toBe(true);
			expect(is.string.array.nonEmpty([])).toBe(false);
			expect(is.string.array.min(2)(['a', 'b', 'c'])).toBe(true);
			expect(is.string.array.min(2)(['a'])).toBe(false);
			expect(is.string.array.max(2)(['a'])).toBe(true);
			expect(is.string.array.max(2)(['a', 'b', 'c'])).toBe(false);
			expect(is.string.array.size(2)(['a', 'b'])).toBe(true);
			expect(is.string.array.unique(['a', 'b'])).toBe(true);
			expect(is.string.array.unique(['a', 'a'])).toBe(false);
			expect(is.number.array.includes(1)([1, 2, 3])).toBe(true);
			expect(is.number.array.excludes(4)([1, 2, 3])).toBe(true);
		});

		it('works on object guards', () => {
			const guard = is.object({ x: is.number }).array;
			expect(guard([{ x: 1 }, { x: 2 }])).toBe(true);
			expect(guard([{ x: 1 }, { x: 'two' }])).toBe(false);
			expect(guard({ x: 1 })).toBe(false); // not an array
		});
	});

	describe('Chaining & Universal', () => {
		it('should chain refinements', () => {
			const guard = is.array(is.number).min(2).unique;
			expect(guard([1, 2])).toBe(true);
			expect(guard([1, 2, 1])).toBe(false); // not unique
			expect(guard([1])).toBe(false); // too short
		});

		it('nullable / optional', () => {
			expect(is.array().nullable(null)).toBe(true);
			expect(is.array().optional(undefined)).toBe(true);
		});

		it('or', () => {
			expect(is.array().or(is.string)([])).toBe(true);
			expect(is.array().or(is.string)('foo')).toBe(true);
		});

		it('parse', () => {
			const res = is.array().min(2).parse([1]);
			expect(res.isErr()).toBe(true);
			if (res.isErr()) {
				expect(res.error._tag).toBe('GuardErr');
				expect(res.error.actual).toBe('array');
			}
		});
	});

	describe('readonly', () => {
		it('basic readonly array validation', () => {
			const guard = is.array().readonly;
			expect(guard([1, 2, 3])).toBe(true);
			expect(guard([1, 2, 3])).toBe(true);
		});

		it('narrows to readonly T[]', () => {
			const value: unknown = [1, 2, 3];
			if (is.array(is.number).readonly(value)) {
				const narrowed: readonly number[] = value;
				expect(narrowed).toEqual([1, 2, 3]);
			}
		});
	});

	describe('is.tuple', () => {
		it('basic tuple validation', () => {
			const guard = is.tuple([is.string, is.number]);
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['a', 1, 2])).toBe(false);
			expect(guard(['a'])).toBe(false);
			expect(guard([1, 'a'])).toBe(false);
			expect(guard(null)).toBe(false);
			expect(guard(undefined)).toBe(false);
			expect(guard({})).toBe(false);
		});
	});

	describe('is.tuple array helpers', () => {
		it('supports .nonEmpty()', () => {
			const guard = is.tuple([is.string]).nonEmpty;
			expect(guard(['a'])).toBe(true);
			// Note: is.tuple([]) would already fail on length, so .nonEmpty is mostly useful for variadic tuples
			const variadic = is.tuple([], is.string).nonEmpty;
			expect(variadic(['a'])).toBe(true);
			expect(variadic([])).toBe(false);
		});

		it('supports .min() / .max()', () => {
			const guard = is.tuple([is.string], is.number).min(3);
			expect(guard(['a', 1, 2])).toBe(true);
			expect(guard(['a', 1])).toBe(false);

			const capped = is.tuple([is.string], is.number).max(2);
			expect(capped(['a', 1])).toBe(true);
			expect(capped(['a', 1, 2])).toBe(false);
		});

		it('supports .unique', () => {
			const guard = is.tuple([is.number, is.number]).unique;
			expect(guard([1, 2])).toBe(true);
			expect(guard([1, 1])).toBe(false);
		});

		it('supports .includes() / .excludes()', () => {
			const guard = is.tuple([is.string, is.number]).includes('a');
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['b', 1])).toBe(false);

			const ex = is.tuple([is.string, is.number]).excludes(1);
			expect(ex(['a', 2])).toBe(true);
			expect(ex(['a', 1])).toBe(false);
		});

		it('preserves tuple type after refinements (type check)', () => {
			const guard = is.tuple([is.string, is.number]).min(1);
			const value: unknown = ['a', 1];
			if (guard(value)) {
				// This line would fail to compile if the type collapsed to (string | number)[]
				const [s, n]: [string, number] = value;
				expect(typeof s).toBe('string');
				expect(typeof n).toBe('number');
			}
		});
	});
});
