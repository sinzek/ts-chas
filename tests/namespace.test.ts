import { describe, it, expect } from 'vitest';
import { chas } from '../src/index.js';
import {
	ok,
	err,
	all,
	tryCatch,
	okAsync,
	fromSafePromise,
	Task,
	is,
	type Option,
	Result,
	ResultAsync,
	some,
	none,
	defineErrs,
	matchErr,
	matchErrAsync,
	matchErrPartial,
	matchErrPartialAsync,
	isErrWithTag,
	isAnyErrWithTag,
	GlobalErrs,
} from '../src/chas.js';

describe('Namespace Structure', () => {
	describe('Result Namespace', () => {
		it('has ok and err', () => {
			expect(ok(1).unwrap()).toBe(1);
			expect(err('e').unwrapErr()).toBe('e');
		});

		it('has utility methods', () => {
			expect(all([ok(1)])).toBeDefined();
			expect(
				tryCatch(
					() => 1,
					() => 'e'
				)
			).toBeDefined();
		});

		it('has async aliases', () => {
			expect(okAsync(1)).toBeDefined();
		});

		it('merges type and value', () => {
			const r: Result<number, string> = ok(1);
			expect(r.ok).toBe(true);
		});
	});

	describe('ResultAsync Namespace (Class Statics)', () => {
		it('has all static methods', () => {
			expect(okAsync(1)).toBeDefined();
			expect(fromSafePromise(Promise.resolve(1))).toBeDefined();
		});
	});

	describe('Option Namespace', () => {
		it('has some and none', () => {
			expect(some(1).value).toBe(1);
			expect(none().isNone()).toBe(true);
		});

		it('merges type and value', () => {
			const o: Option<number> = some(1);
			expect(o.isSome()).toBe(true);
		});
	});

	describe('Task Namespace', () => {
		it('has static methods', () => {
			expect(Task.all([])).toBeDefined();
		});
	});

	describe('TaggedErrs Namespace', () => {
		it('has match and define', () => {
			expect(defineErrs).toBeDefined();
			expect(matchErr).toBeDefined();
			expect(matchErrAsync).toBeDefined();
			expect(matchErrPartial).toBeDefined();
			expect(matchErrPartialAsync).toBeDefined();
			expect(isErrWithTag).toBeDefined();
			expect(isAnyErrWithTag).toBeDefined();
			expect(GlobalErrs).toBeDefined();
		});
	});

	describe('Backward Compatibility', () => {
		it('still has top-level exports in chas object', () => {
			expect(chas.ok(1)).toBeDefined();
			expect(chas.some(1)).toBeDefined();
			expect(chas.nullable(null)).toBeDefined();
		});

		it('still has named exports', () => {
			expect(is).toBeDefined();
			expect(ResultAsync).toBeDefined();
		});
	});
});
