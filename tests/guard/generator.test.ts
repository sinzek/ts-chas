import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Generator Guards', () => {
	it('validates generators structurally', () => {
		const guard = is.generator;
		
		function* gen() { yield 1; }
		const g = gen();

		expect(guard(g)).toBe(true);
		expect(guard([])).toBe(false);
	});

	it('validates async generators structurally', () => {
		const guard = is.asyncGenerator;
		
		async function* asyncGen() { yield 1; }
		const ag = asyncGen();

		expect(guard(ag)).toBe(true);
		expect(guard(function*() {}())).toBe(false);
	});

	it('.of performs exhaustive synchronous element validation', () => {
		const guard = is.generator.of(is.number);
		
		function* validGen() { yield 1; yield 2; }
		function* invalidGen() { yield 1; yield '2'; }
		
		expect(guard(validGen())).toBe(true);
		expect(guard(invalidGen())).toBe(false);
	});

	it('.of on asyncGenerator returns AsyncGuard for exhaustive validation', async () => {
		const guard = is.asyncGenerator.of(is.number);
		
		async function* validAsyncGen() { yield 1; yield 2; }
		async function* invalidAsyncGen() { yield 1; yield '2'; }
		
		const result = await guard.parseAsync(validAsyncGen());
		expect(result.ok).toBe(true);

		const invalidResult = await guard.parseAsync(invalidAsyncGen());
		expect(invalidResult.ok).toBe(false);
	});
});
