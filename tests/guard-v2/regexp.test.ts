import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';

describe('is.regexp (v2)', () => {
	it('validates any RegExp instance', () => {
		const guard = is.regexp();
		expect(guard(/abc/)).toBe(true);
		expect(guard(new RegExp('abc'))).toBe(true);
		expect(guard('abc')).toBe(false);
		expect(guard.meta.name).toBe('regexp');
	});

	it('validates specific pattern and flags', () => {
		const guard = is.regexp({ pattern: 'abc', flags: 'i' });
		expect(guard(/abc/i)).toBe(true);
		expect(guard(/abc/)).toBe(false);
		expect(guard(/abcd/i)).toBe(false);
		expect(guard.meta.name).toBe('regexp<abc, i>');
	});

	describe('helpers', () => {
		it('flag helpers (global, ignoreCase, etc.)', () => {
			expect(is.regexp().global(/a/g)).toBe(true);
			expect(is.regexp().global(/a/)).toBe(false);

			expect(is.regexp().ignoreCase(/a/i)).toBe(true);
			expect(is.regexp().multiline(/a/m)).toBe(true);
			expect(is.regexp().unicode(/a/u)).toBe(true);
			expect(is.regexp().sticky(/a/y)).toBe(true);
			expect(is.regexp().dotAll(/a/s)).toBe(true);
		});

		it('source', () => {
			const guard = is.regexp().source('^foo$');
			expect(guard(/^foo$/)).toBe(true);
			expect(guard(/foo/)).toBe(false);

			const guard2 = is.regexp().source(/bar/i); // uses source only
			expect(guard2(/bar/)).toBe(true);
			expect(guard2.meta.name).toBe('regexp.source(bar)');
		});

		it('flags', () => {
			const guard = is.regexp().flags('gi');
			expect(guard(/a/gi)).toBe(true);
			expect(guard(/a/gi)).toBe(true); // order doesn't matter
			expect(guard(/a/g)).toBe(false);
		});

		it('test', () => {
			const guard = is.regexp().test('hello');
			expect(guard(/ell/)).toBe(true);
			expect(guard(/world/)).toBe(false);
		});
	});
});
