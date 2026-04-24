import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('refinement pinpoint error messages', () => {
	it('identifies the failing value helper in a multi-step chain', () => {
		const guard = is.number.positive.int;
		// 3.5 is positive but not int → fails at .int
		const nonInt = guard.parse(3.5);
		expect(nonInt.unwrapErr().message).toContain('.int');
		// -5 is neither positive nor int → first failure is .positive
		const negative = guard.parse(-5);
		expect(negative.unwrapErr().message).toContain('.positive');
	});

	it('identifies the failing factory helper', () => {
		const guard = is.string.min(3).max(10);
		// "ab" passes base type but fails .min(3)
		const tooShort = guard.parse('ab');
		expect(tooShort.unwrapErr().message).toContain('.min(3)');
		// "abcdefghijk" passes .min(3) but fails .max(10)
		const tooLong = guard.parse('abcdefghijk');
		expect(tooLong.unwrapErr().message).toContain('.max(10)');
	});

	it('identifies the failing transformer helper', () => {
		const guard = is.number.where(n => n > 100);
		const low = guard.parse(50);
		expect(low.unwrapErr().message).toContain('.where');
	});

	it('reports the step closest to the root that fails (not just the last one)', () => {
		const guard = is.string.min(3).max(10).email;
		const tooShort = guard.parse('a');
		expect(tooShort.unwrapErr().message).toContain('.min(3)');
		// Chain-walk should NOT report .email when .min fails first
		expect(tooShort.unwrapErr().message).not.toContain('.email');
	});

	it('does not append step info on type mismatches (only refinement failures)', () => {
		const guard = is.number.positive;
		const mismatch = guard.parse('hello');
		expect(mismatch.unwrapErr().message).toMatch(/^Expected number/);
		expect(mismatch.unwrapErr().message).not.toContain('.positive');
	});

	it('leaves the message untouched for base-type guards with no refinements', () => {
		const result = is.number.parse('hello');
		// Pure type mismatch — no refinement chain to walk
		expect(result.unwrapErr().message).toMatch(/^Expected number, but got string/);
	});

	it('exposes _parent on chained guards for tooling', () => {
		const guard = is.number.positive.int;
		expect(guard.meta._parent).toBeDefined();
		expect(guard.meta._parent?.meta.name).toBe('number.positive');
		expect(guard.meta._parent?.meta._parent?.meta.name).toBe('number');
	});

	it('root guard has no _parent', () => {
		expect(is.number.meta._parent).toBeUndefined();
	});
});
