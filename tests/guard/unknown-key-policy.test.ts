import { describe, expect, it, beforeEach } from 'vitest';
import { is } from '../../src/guard/index.js';
import { setDefaultUnknownKeyPolicy, getDefaultUnknownKeyPolicy } from '../../src/guard/config.js';

describe('Unknown Key Policy (1.2)', () => {
	const initialPolicy = getDefaultUnknownKeyPolicy();

	beforeEach(() => {
		// Reset back to whatever the default was before each test
		setDefaultUnknownKeyPolicy(initialPolicy);
	});

	it('passthrough (default) allows and retains extra keys', () => {
		setDefaultUnknownKeyPolicy('passthrough');
		const obj = is.object({ a: is.number });
		
		const result = obj.parse({ a: 1, b: 2 });
		expect(result.unwrap()).toEqual({ a: 1, b: 2 });
	});

	it('strip allows extra keys but removes them in transform', () => {
		setDefaultUnknownKeyPolicy('strip');
		const obj = is.object({ a: is.number });
		
		const result = obj.parse({ a: 1, b: 2 });
		expect(result.unwrap()).toEqual({ a: 1 }); // b should be stripped
	});

	it('strict rejects extra keys', () => {
		setDefaultUnknownKeyPolicy('strict');
		const obj = is.object({ a: is.number });
		
		expect(obj({ a: 1 })).toBe(true);
		expect(obj({ a: 1, b: 2 })).toBe(false);
		
		const result = obj.parse({ a: 1, b: 2 });
		expect(result.isErr()).toBe(true);
	});

	it('explicit .strict overrides strip policy', () => {
		setDefaultUnknownKeyPolicy('strip');
		const obj = is.object({ a: is.number }).strict; // explicit strict
		
		expect(obj({ a: 1, b: 2 })).toBe(false); // fails early instead of stripping
	});

	it('explicit .catchall() overrides strict policy', () => {
		setDefaultUnknownKeyPolicy('strict');
		const obj = is.object({ a: is.number }).catchall(is.number);
		
		expect(obj({ a: 1, b: 2 })).toBe(true); // allowed by catchall
		expect(obj({ a: 1, b: 'bad' })).toBe(false); // rejected by catchall
	});

	it('policy is captured at guard creation time', () => {
		setDefaultUnknownKeyPolicy('strip');
		const stripObj = is.object({ a: is.number });

		setDefaultUnknownKeyPolicy('strict');
		const strictObj = is.object({ a: is.number });

		expect(stripObj.parse({ a: 1, b: 2 }).unwrap()).toEqual({ a: 1 });
		expect(strictObj({ a: 1, b: 2 })).toBe(false);
	});
});
