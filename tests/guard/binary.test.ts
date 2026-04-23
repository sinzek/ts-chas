import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Binary Guards', () => {
	it('validates Uint8Array', () => {
		const guard = is.uint8Array;
		const a = new Uint8Array([1, 2, 3]);
		expect(guard(a)).toBe(true);
		expect(guard([])).toBe(false);
	});

	it('validates Buffer', () => {
		const guard = is.buffer;
		const b = Buffer.from([1, 2, 3]);
		expect(guard(b)).toBe(true);
		expect(guard(new Uint8Array())).toBe(false);
	});

	it('validates ArrayBuffer', () => {
		const guard = is.arrayBuffer;
		const ab = new ArrayBuffer(4);
		expect(guard(ab)).toBe(true);
		expect(guard(new Uint8Array())).toBe(false);
	});

	it('validates DataView', () => {
		const guard = is.dataView;
		const dv = new DataView(new ArrayBuffer(4));
		expect(guard(dv)).toBe(true);
		expect(guard(new ArrayBuffer(4))).toBe(false);
	});

	it('validates sizing constraints', () => {
		const a = new Uint8Array([1, 2, 3, 4, 5]);

		expect(is.uint8Array.min(3)(a)).toBe(true);
		expect(is.uint8Array.min(10)(a)).toBe(false);

		expect(is.uint8Array.max(10)(a)).toBe(true);
		expect(is.uint8Array.max(4)(a)).toBe(false);

		expect(is.uint8Array.size(5)(a)).toBe(true);
		expect(is.uint8Array.size(6)(a)).toBe(false);
	});
});
