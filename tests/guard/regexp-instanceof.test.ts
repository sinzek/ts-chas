import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

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

describe('is.instanceof', () => {
	it('validates any instance', () => {
		const guard = is.instanceof(RegExp);
		expect(guard(/abc/)).toBe(true);
		expect(guard(new RegExp('abc'))).toBe(true);
		expect(guard('abc')).toBe(false);
	});

	it('validates instance properties', () => {
		const httpsGuard = is.instanceof(URL, {
			protocol: is.literal('https:'),
			hostname: is.string.where(s => s.endsWith('.com')),
		});

		expect(httpsGuard(new URL('https://google.com'))).toBe(true);
		expect(httpsGuard(new URL('http://google.com'))).toBe(false); // wrong protocol
		expect(httpsGuard(new URL('https://google.org'))).toBe(false); // wrong hostname suffix
		expect(httpsGuard('https://google.com')).toBe(false); // not a URL instance
	});

	it('validates Error message and name', () => {
		const typeErrorGuard = is.instanceof(TypeError, {
			name: is.literal('TypeError'),
			message: is.string.where(m => m.includes('bad')),
		});

		expect(typeErrorGuard(new TypeError('something bad happened'))).toBe(true);
		expect(typeErrorGuard(new Error('something bad happened'))).toBe(false); // not a TypeError
		expect(typeErrorGuard(new TypeError('it is okay'))).toBe(false); // message mismatch
	});
});
