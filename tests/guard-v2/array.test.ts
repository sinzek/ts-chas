import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.array (v2)', () => {
	it('basic array validation', () => {
		expect(is.array(is.number, is.string)([1, 2, 3])).toBe(true);
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
});
