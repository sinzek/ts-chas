import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.boolean (v2)', () => {
	it('basic boolean validation', () => {
		expect(is.boolean(true)).toBe(true);
		expect(is.boolean(false)).toBe(true);
		expect(is.boolean(0)).toBe(false);
		expect(is.boolean('true')).toBe(false);
	});

	it('is.boolean.true', () => {
		expect(is.boolean.true(true)).toBe(true);
		expect(is.boolean.true(false)).toBe(false);
	});

	it('is.boolean.false', () => {
		expect(is.boolean.false(false)).toBe(true);
		expect(is.boolean.false(true)).toBe(false);
	});

	it('is.boolean.asString', () => {
		const trueStr = is.boolean.asString.parse(true).unwrap();
		expect(trueStr).toBe('true');
		expect(typeof trueStr).toBe('string');

		const falseStr = is.boolean.asString.parse(false).unwrap();
		expect(falseStr).toBe('false');
		expect(typeof falseStr).toBe('string');
	});
});
