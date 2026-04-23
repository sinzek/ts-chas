import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('nullable, optional, nullish', () => {
	it('nullable', () => {
		const guard = is.nullable(is.number);
		expect(guard(123)).toBe(true);
		expect(guard(null)).toBe(true);
		expect(guard(undefined)).toBe(false);
		expect(guard('hello')).toBe(false);
	});

	it('optional', () => {
		const guard = is.optional(is.number);
		expect(guard(123)).toBe(true);
		expect(guard(undefined)).toBe(true);
		expect(guard(null)).toBe(false);
		expect(guard('hello')).toBe(false);
	});

	it('nullish', () => {
		const guard = is.nullish(is.number);
		expect(guard(123)).toBe(true);
		expect(guard(null)).toBe(true);
		expect(guard(undefined)).toBe(true);
		expect(guard('hello')).toBe(false);
	});
});
