import { describe, it, expect } from 'vitest';
import { is, defineSchemas } from '../src/guard.js';

describe('Guard API Improvements', () => {
	const schemas = defineSchemas({
		User: {
			name: is.string,
			age: is.number.gt(18),
		},
	});

	it('provides property paths in parse errors', () => {
		const result = schemas.User.parse({ name: 123, age: 10 });
		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr();
		expect(errors).toContain('User.name failed validation: expected condition but got 123');
		expect(errors).toContain('User.age failed validation: expected condition but got 10');
	});

	it('provides property paths in assert errors', () => {
		expect(() => schemas.User.assert({ name: 'John', age: 10 })).toThrow(
			'User.age failed validation: expected condition but got 10'
		);
	});

	it('optimizes performance (basic check)', () => {
		const start = Date.now();
		for (let i = 0; i < 10000; i++) {
			schemas.User.parse({ name: 'John', age: 25 });
		}
		const end = Date.now();
		console.log(`Parsed 10,000 times in ${end - start}ms`);
		expect(end - start).toBeLessThan(100); // Very loose check
	});

	it('supports namespace extensibility via is.extend', () => {
		const myIs = is.extend('app', {
			positiveEven: (v: unknown): v is number => is.number.positive(v) && is.number.even(v),
		});

		expect(myIs.app.positiveEven(4)).toBe(true);
		expect(myIs.app.positiveEven(3)).toBe(false);
		expect(myIs.app.positiveEven(-2)).toBe(false);

		// Core guards still work
		expect(myIs.string('hello')).toBe(true);
	});
});
