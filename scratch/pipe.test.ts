import { describe, it, expect } from 'vitest';
import { chas } from '../src/index.js';

describe('pipe', () => {
	it('should work with Result (Ok)', () => {
		const res = chas.ok(5).pipe(r => r.map(v => v * 2));
		expect(res.unwrap()).toBe(10);
	});

	it('should work with Result (Err)', () => {
		const res = chas.err<string, number>('error').pipe(r => r.map(v => v * 2));
		expect(res.unwrapErr()).toBe('error');
	});

	it('should work with ResultAsync (Ok)', async () => {
		const res = await chas.okAsync(5).pipe(r => r.map(v => v * 2));
		expect(res.unwrap()).toBe(10);
	});

	it('should work with ResultAsync (Err)', async () => {
		const res = await chas.errAsync<string, number>('error').pipe(r => r.map(v => v * 2));
		expect(res.unwrapErr()).toBe('error');
	});

	it('should allow chaining multiple pipe calls', () => {
		const res = chas
			.ok(5)
			.pipe(r => r.map(v => v * 2))
			.pipe(r => r.map(v => v + 1));
		expect(res.unwrap()).toBe(11);
	});

	it('should support external operators', () => {
		const double = (r: chas.Result<number, never>) => r.map(v => v * 2);
		const res = chas
			.ok(5)
			.pipe(double)
			.pipe(r1 => r1.expect('is not okay'));
		expect(res).toBe(10);
	});
});
