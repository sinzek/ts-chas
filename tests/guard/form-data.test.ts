import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('FormDataGuard', () => {
	it('validates FormData instances', () => {
		const guard = is.formData;
		const fd = new FormData();
		expect(guard(fd)).toBe(true);
		expect(guard({})).toBe(false);
		expect(guard(null)).toBe(false);
	});

	it('validates nonEmpty / empty', () => {
		const emptyFd = new FormData();
		const nonEmptyFd = new FormData();
		nonEmptyFd.append('a', '1');

		expect(is.formData.empty(emptyFd)).toBe(true);
		expect(is.formData.empty(nonEmptyFd)).toBe(false);

		expect(is.formData.nonEmpty(emptyFd)).toBe(false);
		expect(is.formData.nonEmpty(nonEmptyFd)).toBe(true);
	});

	it('validates has(...keys)', () => {
		const fd = new FormData();
		fd.append('foo', '1');
		fd.append('bar', '2');

		expect(is.formData.has('foo')(fd)).toBe(true);
		expect(is.formData.has('bar', 'foo')(fd)).toBe(true);
		expect(is.formData.has('baz')(fd)).toBe(false);
		expect(is.formData.has('foo', 'baz')(fd)).toBe(false);
	});
});
