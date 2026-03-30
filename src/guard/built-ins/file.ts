import { makeGuard, factory, type Guard } from '../shared.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface FileHelpers {
	/** Validates the MIME type of the file. */
	type: (mime: string | RegExp) => Guard<Blob, FileHelpers>;
	/** Validates the file extension (e.g., '.pdf', 'jpg'). */
	extension: (ext: string | string[]) => Guard<Blob, FileHelpers>;
	/** Validates the exact size of the file in bytes. */
	size: (bytes: number) => Guard<Blob, FileHelpers>;
	/** Validates the minimum size of the file in bytes. */
	minSize: (bytes: number) => Guard<Blob, FileHelpers>;
	/** Validates the maximum size of the file in bytes. */
	maxSize: (bytes: number) => Guard<Blob, FileHelpers>;
	/** Validates the name of the file (only if it's a File object, not a Blob). */
	name: (pattern: string | RegExp) => Guard<Blob, FileHelpers>;
	/** Validates the last modified date of the file (only if it's a File object). */
	lastModified: (date: Date | number) => Guard<Blob, FileHelpers>;
}

const fileHelpers: FileHelpers = {
	type: factory((mime: string | RegExp) => (v: unknown) => {
		if (!(v instanceof Blob)) return false;
		return typeof mime === 'string' ? v.type === mime : mime.test(v.type);
	}),
	extension: factory((ext: string | string[]) => (v: unknown) => {
		if (!(v instanceof File)) return false;
		const name = v.name.toLowerCase();
		const extensions = Array.isArray(ext) ? ext : [ext];
		return extensions.some(e => {
			const normalized = e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`;
			return name.endsWith(normalized);
		});
	}),
	size: factory((bytes: number) => (v: unknown) => v instanceof Blob && v.size === bytes),
	minSize: factory((bytes: number) => (v: unknown) => v instanceof Blob && v.size >= bytes),
	maxSize: factory((bytes: number) => (v: unknown) => v instanceof Blob && v.size <= bytes),
	name: factory((pattern: string | RegExp) => (v: unknown) => {
		if (!(v instanceof File)) return false;
		return typeof pattern === 'string' ? v.name === pattern : pattern.test(v.name);
	}),
	lastModified: factory((date: Date | number) => (v: unknown) => {
		if (!(v instanceof File)) return false;
		const target = date instanceof Date ? date.getTime() : date;
		return v.lastModified === target;
	}),
};

export interface FileGuard extends Guard<Blob, FileHelpers> {}

/**
 * Validates that a value is a File or Blob.
 *
 * Provides helpers to validate MIME type, size, extension, and other properties.
 * Note that 'name', 'extension', and 'lastModified' require a File object (not a Blob).
 */
export const FileGuard: FileGuard = makeGuard(
	(v: unknown): v is Blob => v instanceof Blob,
	{ name: 'file', id: 'file' },
	fileHelpers
);
