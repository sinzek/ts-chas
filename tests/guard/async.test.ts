import { describe, it, expect, vi } from 'vitest';
import { is, AsyncGuard } from '../../src/guard/index.js';
import { ResultAsync } from '../../src/result/result.js';

describe('AsyncGuard', () => {
	// ---- Construction ---------------------------------------------------------

	it('.whereAsync() returns an AsyncGuard', () => {
		const guard = is.string.whereAsync(async () => true);
		expect(guard).toBeInstanceOf(AsyncGuard);
	});

	it('.refineAsync() returns an AsyncGuard', () => {
		const guard = is.string.refineAsync(async v => v.trim());
		expect(guard).toBeInstanceOf(AsyncGuard);
	});

	it('.transformAsync() returns an AsyncGuard<U>', () => {
		const guard = is.string.transformAsync(async v => parseInt(v, 10));
		expect(guard).toBeInstanceOf(AsyncGuard);
	});

	// ---- parseAsync — predicate (whereAsync) ----------------------------------

	it('parseAsync resolves ok when sync + async predicates pass', async () => {
		const guard = is.string.email.whereAsync(async () => true);
		const result = await guard.parseAsync('test@example.com');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe('test@example.com');
	});

	it('parseAsync resolves err when sync check fails — async steps not called', async () => {
		const asyncFn = vi.fn(async () => true);
		const guard = is.string.email.whereAsync(asyncFn);
		const result = await guard.parseAsync('not-an-email');
		expect(result.ok).toBe(false);
		expect(asyncFn).not.toHaveBeenCalled();
	});

	it('parseAsync resolves err when async predicate returns false', async () => {
		const guard = is.string.whereAsync(async () => false);
		const result = await guard.parseAsync('hello');
		expect(result.ok).toBe(false);
	});

	it('parseAsync short-circuits — second predicate not called if first fails', async () => {
		const second = vi.fn(async () => true);
		const guard = is.string.whereAsync(async () => false).whereAsync(second);
		await guard.parseAsync('hello');
		expect(second).not.toHaveBeenCalled();
	});

	// ---- parseAsync — refineAsync (same-type transform) -----------------------

	it('parseAsync applies refineAsync transform to ok value', async () => {
		const guard = is.string.refineAsync(async v => v.toUpperCase());
		const result = await guard.parseAsync('hello');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe('HELLO');
	});

	it('refineAsync can chain multiple transforms', async () => {
		const guard = is.string.refineAsync(async v => v.trim()).refineAsync(async v => v.toUpperCase());
		const result = await guard.parseAsync('  hello  ');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe('HELLO');
	});

	// ---- parseAsync — transformAsync (type-changing) --------------------------

	it('parseAsync applies transformAsync and changes type', async () => {
		const guard = is.string.transformAsync(async v => parseInt(v, 10));
		const result = await guard.parseAsync('42');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(42);
	});

	it('transformAsync<U> infers new type — chained value is U', async () => {
		const guard = is.number.int.transformAsync(async n => String(n));
		const result = await guard.parseAsync(7);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe('7');
	});

	// ---- Mixed steps ----------------------------------------------------------

	it('predicate → transform: predicate passes, then transform is applied', async () => {
		const guard = is.string.whereAsync(async v => v.length > 0).refineAsync(async v => v.toUpperCase());
		const result = await guard.parseAsync('hello');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe('HELLO');
	});

	it('transform → predicate: transformed value is passed to subsequent predicate', async () => {
		const guard = is.string.refineAsync(async v => v.trim()).whereAsync(async v => v.length > 0);
		const emptyResult = await guard.parseAsync('   ');
		expect(emptyResult.ok).toBe(false);

		const validResult = await guard.parseAsync('  hello  ');
		expect(validResult.ok).toBe(true);
	});

	// ---- ResultAsync integration ----------------------------------------------

	it('parseAsync returns a ResultAsync instance', async () => {
		const guard = is.string.whereAsync(async () => true);
		const ra = guard.parseAsync('hello');
		expect(ra).toBeInstanceOf(ResultAsync);
	});

	it('ResultAsync .map() chains on ok result', async () => {
		const guard = is.number.int.whereAsync(async () => true);
		const result = await guard.parseAsync(5).map(n => n * 2);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toBe(10);
	});

	it('.unwrap() resolves to value on success', async () => {
		const guard = is.string.whereAsync(async () => true);
		const value = await guard.parseAsync('hello').unwrap();
		expect(value).toBe('hello');
	});

	it('.unwrap() rejects on failure', async () => {
		const guard = is.string.whereAsync(async () => false);
		await expect(guard.parseAsync('hello').unwrap()).rejects.toBeDefined();
	});

	// ---- Custom error message -------------------------------------------------

	it('parseAsync(value, errMsg) uses custom message on async predicate failure', async () => {
		const guard = is.string.whereAsync(async () => false);
		const result = await guard.parseAsync('hello', 'custom error');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toBe('custom error');
	});

	// ---- Sync transforms are preserved ----------------------------------------

	it('sync transform from the underlying guard is applied before async steps', async () => {
		const guard = is.string.transform(v => v.split('')).whereAsync(async arr => arr.length > 0);
		const result = await guard.parseAsync('abc');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toEqual(['a', 'b', 'c']);
	});

	// ---- Meta access ----------------------------------------------------------

	it('.meta returns the underlying sync guard meta', () => {
		const guard = is.string.email.whereAsync(async () => true);
		expect(guard.meta.id).toBe('string');
	});
});
