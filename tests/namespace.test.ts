import { describe, it, expect } from 'vitest';
import { chas, Result, ResultAsync, Option, Task, is, TaggedErrs, Guard } from '../src/index.js';

describe('Namespace Structure', () => {
	describe('Result Namespace', () => {
		it('has ok and err', () => {
			expect(Result.ok(1).unwrap()).toBe(1);
			expect(Result.err('e').unwrapErr()).toBe('e');
		});

		it('has utility methods', () => {
			expect(Result.all([Result.ok(1)])).toBeDefined();
			expect(
				Result.tryCatch(
					() => 1,
					() => 'e'
				)
			).toBeDefined();
		});

		it('has async aliases', () => {
			expect(Result.okAsync(1)).toBeDefined();
		});

		it('merges type and value', () => {
			const r: Result<number, string> = Result.ok(1);
			expect(r.ok).toBe(true);
		});
	});

	describe('ResultAsync Namespace (Class Statics)', () => {
		it('has all static methods', () => {
			expect(ResultAsync.ok(1)).toBeDefined();
			expect(ResultAsync.fromSafePromise(Promise.resolve(1))).toBeDefined();
		});
	});

	describe('Option Namespace', () => {
		it('has some and none', () => {
			expect(Option.some(1).value).toBe(1);
			expect(Option.none().isNone()).toBe(true);
		});

		it('merges type and value', () => {
			const o: Option<number> = Option.some(1);
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
			expect(TaggedErrs.define).toBeDefined();
			expect(TaggedErrs.match).toBeDefined();
			expect(TaggedErrs.matchAsync).toBeDefined();
			expect(TaggedErrs.matchPartial).toBeDefined();
			expect(TaggedErrs.matchPartialAsync).toBeDefined();
			expect(TaggedErrs.is).toBeDefined();
			expect(TaggedErrs.isAny).toBeDefined();
		});
	});

	describe('Backward Compatibility', () => {
		it('still has top-level exports in chas object', () => {
			expect(chas.ok(1)).toBeDefined();
			expect(chas.some(1)).toBeDefined();
			expect(chas.fromNullable(null)).toBeDefined();
		});

		it('still has named exports', () => {
			expect(is).toBeDefined();
			expect(Result).toBeDefined();
		});
	});

	describe('Guard Namespace', () => {
		it('has static methods', () => {
			expect(Guard.assert).toBeDefined();
			expect(Guard.ensure).toBeDefined();
			expect(Guard.is).toBeDefined();
			expect(Guard.is.tagged).toBeDefined();
		});
	});
});
