import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.object (v2)', () => {
	it('basic object validation', () => {
		expect(is.object()({ a: 1 })).toBe(true);
		expect(is.object()({})).toBe(true);
		expect(is.object()(null)).toBe(false);
		expect(is.object()([])).toBe(false);
	});

	it('object with schema', () => {
		const guard = is.object({
			a: is.string,
			b: is.number,
		});
		expect(guard({ a: 'foo', b: 123 })).toBe(true);
		expect(guard({ a: 'foo' })).toBe(false); // missing b
		expect(guard({ a: 'foo', b: '123' })).toBe(false); // b is not a number
	});

	describe('is.record', () => {
		it('validate record keys and values', () => {
			const guard = is.record(is.string, is.number);
			expect(guard({ a: 1, b: 2 })).toBe(true);
			expect(guard({ a: 1, b: '2' })).toBe(false);
		});

		it('should chain refinements on record', () => {
			const guard = is.record(is.string, is.number).size(2).has('a');
			expect(guard({ a: 1, b: 2 })).toBe(true);
			expect(guard({ a: 1 })).toBe(false); // size 1
			expect(guard({ b: 2, c: 3 })).toBe(false); // missing 'a'
		});
	});

	describe('Transformations', () => {
		const base = is.object({
			a: is.string,
			b: is.number.optional,
		});

		it('partial', () => {
			const guard = base.partial();
			expect(guard({})).toBe(true);
			expect(guard({ a: 'foo' })).toBe(true);
			expect(guard({ a: 123 })).toBe(false); // still checks types if present
		});

		it('pick', () => {
			const guard = base.pick(['a']);
			expect(guard({ a: 'foo' })).toBe(true);
			expect(guard({ a: 'foo', b: 123 })).toBe(true); // pick doesn't (strictly) forbid extra keys unless .strict() is used
		});

		it('omit', () => {
			const guard = base.omit(['a']);
			expect(guard({ b: 123 })).toBe(true);
			expect(guard({})).toBe(true); // b is optional
		});

		it('extend', () => {
			const guard = base.extend({ c: is.boolean });
			expect(guard({ a: 'foo', b: 1, c: true })).toBe(true);
			expect(guard({ a: 'foo', b: 1 })).toBe(false); // missing c
		});

		it('strict', () => {
			const guard = is.object({ a: is.number }).strict;
			expect(guard({ a: 1 })).toBe(true);
			expect(guard({ a: 1, b: 2 })).toBe(false);
		});
	});

	describe('Refinements & Valuations', () => {
		it('size / minSize / maxSize', () => {
			expect(is.object().size(2)({ a: 1, b: 2 })).toBe(true);
			expect(is.object().size(2)({ a: 1 })).toBe(false);
			expect(is.object().minSize(2)({ a: 1, b: 2, c: 3 })).toBe(true);
			expect(is.object().maxSize(2)({ a: 1 })).toBe(true);
		});

		it('has / hasAll / hasOnly', () => {
			expect(is.object().has('a')({ a: 1 })).toBe(true);
			expect(is.object().hasAll(['a', 'b'])({ a: 1, b: 2 })).toBe(true);
			expect(is.object().hasOnly(['a'])({ a: 1 })).toBe(true);
			expect(is.object().hasOnly(['a'])({ a: 1, b: 2 })).toBe(false);
		});
	});

	describe('Chaining with Transformations', () => {
		it('should chain pick and size', () => {
			// pick(['a']) transforms the object to ONLY have 'a'
			const guard = is.object({ a: is.string, b: is.number }).pick(['a']).size(1);
			expect(guard({ a: 'foo', b: 123 })).toBe(true);
		});

		it('should chain omit and has', () => {
			// omit(['b']) transforms the object to NOT have 'b'
			const guard = is.object({ a: is.string, b: is.number }).omit(['b']).has('b');
			expect(guard({ a: 'foo', b: 123 })).toBe(false);
		});
	});

	describe('Universal Methods', () => {
		it('nullable / optional', () => {
			expect(is.object().nullable(null)).toBe(true);
			expect(is.object().optional(undefined)).toBe(true);
		});

		it('or', () => {
			expect(is.object().or(is.string)({})).toBe(true);
			expect(is.object().or(is.string)('foo')).toBe(true);
		});
	});
});
