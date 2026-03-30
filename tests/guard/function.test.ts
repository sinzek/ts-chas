/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.function', () => {
	it('validates that a value is a function', () => {
		const guard = is.function({ input: [is.number], output: is.string });
		expect(guard(() => {})).toBe(true);
		expect(guard(123)).toBe(false);
	});

	it('validates input and output types via .impl', () => {
		const guard = is.function({
			input: [is.number, is.number],
			output: is.number,
		});

		const add = guard.impl((a: number, b: number) => a + b);

		// Valid call
		expect(add(2, 3)).toBe(5);

		// Invalid input call
		expect(() => add(2, '3' as any)).toThrow(/args\[1\]: Expected number/);

		// Invalid output call
		const badAdd = guard.impl(((a: number, b: number) => 'not a number') as any);
		expect(() => badAdd(2, 3)).toThrow(/return: Expected number/);
	});

	it('works with optional output', () => {
		const guard = is.function({ input: [is.string] });
		const log = guard.impl((s: string) => console.log(s));

		expect(() => log('hello')).not.toThrow();
		expect(() => log(123 as any)).toThrow(/args\[0\]: Expected string/);
	});

	it('validates async functions via .implAsync', async () => {
		const guard = is.function({
			input: [is.string],
			output: is.string,
		});

		const fetchData = guard.implAsync(async (id: string) => `data for ${id}`);

		// Valid call
		const res = await fetchData('123');
		expect(res).toBe('data for 123');

		// Invalid input
		await expect(fetchData(123 as any)).rejects.toThrow(/args\[0\]: Expected string/);

		// Invalid output
		const badFetch = guard.implAsync(async (id: string) => 123 as any);
		await expect(badFetch('123')).rejects.toThrow(/return: Expected string/);
	});

	it('validates functions without throwing using .implResult', () => {
		const guard = is.function({
			input: [is.number, is.number],
			output: is.number,
		});

		const add = guard.implResult((a: number, b: number) => a + b);

		// Valid call
		const okRes = add(2, 3);
		expect(okRes.isOk()).toBe(true);
		expect(okRes.unwrap()).toBe(5);

		// Invalid input call
		const errRes = add(2, '3' as any);
		expect(errRes.isErr()).toBe(true);
		expect(errRes.unwrapErr().message).toMatch(/args\[1\]: Expected number/);
	});

	it('validates async functions without throwing using .implResultAsync', async () => {
		const guard = is.function({
			input: [is.string],
			output: is.string,
		});

		const fetchData = guard.implResultAsync(async (id: string) => `data for ${id}`);

		// Valid call
		const okRes = await fetchData('123');
		expect(okRes.isOk()).toBe(true);
		expect(okRes.unwrap()).toBe('data for 123');

		// Invalid input
		const errRes = await fetchData(123 as any);
		expect(errRes.isErr()).toBe(true);
		expect(errRes.unwrapErr().message).toMatch(/args\[0\]: Expected string/);
	});

	it('does NOT call the function during the base guard check', () => {
		let called = false;
		const guard = is.function({
			input: [is.number],
			output: is.number,
		});

		const myFn = (n: number) => {
			called = true;
			return n;
		};

		expect(guard(myFn)).toBe(true);
		expect(called).toBe(false); // Base guard should not trigger side effects
	});
});
