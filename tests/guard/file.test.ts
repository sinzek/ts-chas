import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.file', () => {
	it('validates Blobs and Files', () => {
		const blob = new Blob([''], { type: 'text/plain' });
		const file = new File([''], 'test.txt', { type: 'text/plain' });

		expect(is.file(blob)).toBe(true);
		expect(is.file(file)).toBe(true);
		expect(is.file({})).toBe(false);
		expect(is.file(null)).toBe(false);
	});

	it('validates MIME type', () => {
		const txt = new File([''], 'test.txt', { type: 'text/plain' });
		const png = new File([''], 'image.png', { type: 'image/png' });

		expect(is.file.type('text/plain')(txt)).toBe(true);
		expect(is.file.type('text/plain')(png)).toBe(false);
		expect(is.file.type(/^image\//)(png)).toBe(true);
		expect(is.file.type(/^image\//)(txt)).toBe(false);
	});

	it('validates extension', () => {
		const txt = new File([''], 'test.txt');
		const jpeg = new File([''], 'photo.JPEG');
		const blob = new Blob(['']);

		expect(is.file.extension('txt')(txt)).toBe(true);
		expect(is.file.extension('.txt')(txt)).toBe(true);
		expect(is.file.extension(['jpg', 'jpeg'])(jpeg)).toBe(true);
		expect(is.file.extension('png')(txt)).toBe(false);
		expect(is.file.extension('txt')(blob)).toBe(false); // Blob has no name
	});

	it('validates size constraints', () => {
		const small = new Blob(['hello']); // 5 bytes
		const large = new Blob(['a'.repeat(100)]); // 100 bytes

		expect(is.file.size(5)(small)).toBe(true);
		expect(is.file.size(5)(large)).toBe(false);

		expect(is.file.minSize(50)(large)).toBe(true);
		expect(is.file.minSize(50)(small)).toBe(false);

		expect(is.file.maxSize(10)(small)).toBe(true);
		expect(is.file.maxSize(10)(large)).toBe(false);
	});

	it('validates name pattern', () => {
		const file = new File([''], 'report_2024.pdf');

		expect(is.file.name('report_2024.pdf')(file)).toBe(true);
		expect(is.file.name(/report_\d{4}\.pdf/)(file)).toBe(true);
		expect(is.file.name('other.pdf')(file)).toBe(false);
	});

	it('validates lastModified', () => {
		const now = Date.now();
		const file = new File([''], 'test.txt', { lastModified: now });

		expect(is.file.lastModified(now)(file)).toBe(true);
		expect(is.file.lastModified(new Date(now))(file)).toBe(true);
		expect(is.file.lastModified(now + 1000)(file)).toBe(false);
	});

	it('chains multiple helpers', () => {
		const file = new File(['some content'], 'image.png', { type: 'image/png' });

		const imageGuard = is.file
			.type(/^image\//)
			.extension(['png', 'jpg'])
			.minSize(10);

		expect(imageGuard(file)).toBe(true);
		expect(imageGuard(new File([''], 'image.png', { type: 'image/png' }))).toBe(false); // too small
		expect(imageGuard(new File(['long enough'], 'test.txt', { type: 'text/plain' }))).toBe(false); // wrong type/ext
	});
});
