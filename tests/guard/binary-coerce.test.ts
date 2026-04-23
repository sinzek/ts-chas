import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('binary coercion', () => {
	const hello = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
	const helloBase64 = btoa('Hello'); // "SGVsbG8="

	describe('is.uint8Array.coerce', () => {
		it('passes through existing Uint8Array', () => {
			const result = is.uint8Array.coerce.parse(hello);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(hello);
		});

		it('coerces base64 string', () => {
			const result = is.uint8Array.coerce.parse(helloBase64);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(hello);
		});

		it('coerces data URI string', () => {
			const dataUri = `data:application/octet-stream;base64,${helloBase64}`;
			const result = is.uint8Array.coerce.parse(dataUri);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(hello);
		});

		it('coerces number array', () => {
			const result = is.uint8Array.coerce.parse([72, 101, 108, 108, 111]);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(hello);
		});

		it('coerces ArrayBuffer', () => {
			const buf = hello.buffer.slice(hello.byteOffset, hello.byteOffset + hello.byteLength);
			const result = is.uint8Array.coerce.parse(buf);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(hello);
		});

		it('rejects invalid base64', () => {
			expect(is.uint8Array.coerce.parse('not!valid!base64!!!').isOk()).toBe(false);
		});

		it('rejects non-coercible types', () => {
			expect(is.uint8Array.coerce.parse(42).isOk()).toBe(false);
			expect(is.uint8Array.coerce.parse(true).isOk()).toBe(false);
			expect(is.uint8Array.coerce.parse({}).isOk()).toBe(false);
		});

		it('works with .size constraint after coerce', () => {
			const guard = is.uint8Array.coerce.size(5);
			expect(guard.parse(helloBase64).isOk()).toBe(true);
			expect(guard.parse(btoa('Hi')).isOk()).toBe(false); // 2 bytes ≠ 5
		});
	});

	describe('is.buffer.coerce', () => {
		it('coerces base64 string', () => {
			const result = is.buffer.coerce.parse(helloBase64);
			expect(result.isOk()).toBe(true);
			expect(Buffer.isBuffer(result.unwrap())).toBe(true);
			expect(result.unwrap().toString()).toBe('Hello');
		});

		it('coerces number array', () => {
			const result = is.buffer.coerce.parse([72, 101, 108, 108, 111]);
			expect(result.isOk()).toBe(true);
			expect(Buffer.isBuffer(result.unwrap())).toBe(true);
		});

		it('coerces Uint8Array', () => {
			const result = is.buffer.coerce.parse(hello);
			expect(result.isOk()).toBe(true);
			expect(Buffer.isBuffer(result.unwrap())).toBe(true);
		});

		it('coerces ArrayBuffer', () => {
			const buf = hello.buffer.slice(hello.byteOffset, hello.byteOffset + hello.byteLength);
			const result = is.buffer.coerce.parse(buf);
			expect(result.isOk()).toBe(true);
			expect(Buffer.isBuffer(result.unwrap())).toBe(true);
		});

		it('rejects non-coercible types', () => {
			expect(is.buffer.coerce.parse(42).isOk()).toBe(false);
			expect(is.buffer.coerce.parse({}).isOk()).toBe(false);
		});
	});

	describe('is.arrayBuffer.coerce', () => {
		it('coerces base64 string', () => {
			const result = is.arrayBuffer.coerce.parse(helloBase64);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(ArrayBuffer);
		});

		it('coerces number array', () => {
			const result = is.arrayBuffer.coerce.parse([72, 101, 108, 108, 111]);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(ArrayBuffer);
		});

		it('coerces Uint8Array', () => {
			const result = is.arrayBuffer.coerce.parse(hello);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBeInstanceOf(ArrayBuffer);
		});

		it('rejects non-coercible types', () => {
			expect(is.arrayBuffer.coerce.parse(42).isOk()).toBe(false);
			expect(is.arrayBuffer.coerce.parse({}).isOk()).toBe(false);
		});
	});
});
