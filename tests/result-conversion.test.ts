import { describe, it, expect } from 'vitest';
import { ok, ResultAsync } from '../src/result/result.js';
import { revive, reviveAsync } from '../src/result/result-helpers.js';

describe('chas.revive()', () => {
	it('should successfully restore an Ok value from a POJO', () => {
		const raw = { ok: true, value: 42 };
		const result = revive<number, never>(raw);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
		expect(typeof result.map).toBe('function'); // Proof methods are attached
	});

	it('should successfully restore an Err value from a POJO', () => {
		const raw = { ok: false, error: 'failure' };
		const result = revive<never, string>(raw);
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBe('failure');
		expect(typeof result.mapErr).toBe('function');
	});

	it('should handle JSON.stringify() stripping undefined values (Ok<void> edge case)', () => {
		const resultOriginal = ok();
		const stringified = JSON.stringify(resultOriginal); // '{"ok":true}'
		const parsed = JSON.parse(stringified);

		const resultRevived = revive(parsed);
		expect(resultRevived.isOk()).toBe(true);
		expect(resultRevived.unwrap()).toBeUndefined();
	});

	it('should safely bypass and return exact instance if passed an already hydrated Result', () => {
		const original = ok('hello');
		const result = revive(original);
		expect(result).toBe(original);
		expect(result.unwrap()).toBe('hello');
	});

	it('should execute and evaluate thunks', () => {
		const thunk = () => ({ ok: true, value: 'evaluated' });
		const result = revive<string, never>(thunk);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe('evaluated');
	});

	it('should throw an error if passed invalid primitives', () => {
		const inputs = [null, undefined, 42, 'string', true, []];
		inputs.forEach(input => {
			expect(() => revive(input)).toThrow(/Invalid Result object/);
		});
	});

	it('should throw an error if passed objects lacking the "ok" boolean', () => {
		const inputs = [
			{ notOk: true },
			{ ok: 'true' }, // string instead of boolean
			{},
			{ value: 42 },
		];
		inputs.forEach(input => {
			expect(() => revive(input)).toThrow(/Invalid Result object/);
		});
	});
});

describe('chas.reviveAsync()', () => {
	it('should correctly restore an Ok from a resolved promise', async () => {
		const promise = Promise.resolve({ ok: true, value: 100 });
		const resultAsync = reviveAsync<number, never>(promise);

		expect(resultAsync).toBeInstanceOf(ResultAsync);
		const result = await resultAsync;
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(100);
	});

	it('should correctly restore an Err from a resolved promise', async () => {
		const promise = Promise.resolve({ ok: false, error: 'error' });
		const resultAsync = reviveAsync(promise);

		const result = await resultAsync;
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr()).toBe('error');
	});

	it('should successfully pass through an existing ResultAsync untouched via the Promise execution unrolling', async () => {
		const original = ResultAsync.fromSafePromise(Promise.resolve(42));
		const resultAsync = reviveAsync(original);

		const result = await resultAsync;
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);
	});

	it('should evaluate a thunk returning a Promise of a POJO', async () => {
		const thunk = () => Promise.resolve({ ok: true, value: 'thunked' });
		const result = await reviveAsync<string, never>(thunk);

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe('thunked');
	});

	it('should effectively unwrap a Promise<ResultAsync> correctly', async () => {
		const innerAsync = ResultAsync.fromSafePromise(Promise.resolve('deeply nested'));
		const outerPromise = Promise.resolve(innerAsync);

		const result = await reviveAsync(outerPromise);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe('deeply nested');
	});

	it('should handle simulated end-to-end serialized network responses', async () => {
		const serverAction = async () => {
			const res = ok({ id: 1, name: 'Alice' });
			return JSON.parse(JSON.stringify(res)); // Simulate network serialization
		};

		const result = await reviveAsync(serverAction());
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ id: 1, name: 'Alice' });
		expect(typeof result.map).toBe('function');
	});
});
