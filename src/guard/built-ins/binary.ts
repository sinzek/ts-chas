import { makeGuard, factory, type Guard } from '../shared.js';

export interface BinaryHelpers<T> {
	min: (bytes: number) => Guard<T, BinaryHelpers<T>>;
	max: (bytes: number) => Guard<T, BinaryHelpers<T>>;
	size: (bytes: number) => Guard<T, BinaryHelpers<T>>;
}

const binaryHelpers = {
	min: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength >= bytes),
	max: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength <= bytes),
	size: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength === bytes),
};

import { JSON_SCHEMA } from '../shared.js';

(binaryHelpers.min as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n });
(binaryHelpers.max as any)[JSON_SCHEMA] = (n: number) => ({ maxLength: n });
(binaryHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n, maxLength: n });

export interface Uint8ArrayGuard extends Guard<Uint8Array, BinaryHelpers<Uint8Array>> {}
export const Uint8ArrayGuard: Uint8ArrayGuard = makeGuard(
	(v: unknown): v is Uint8Array => v instanceof Uint8Array,
	{ name: 'uint8Array', id: 'uint8Array' },
	binaryHelpers as any
);

// We need a conditional type for Buffer to avoid failing in browsers without Buffer polyfill.
export interface BufferGuard extends Guard<any, BinaryHelpers<any>> {}
export const BufferGuard: BufferGuard = makeGuard(
	(v: unknown): v is any => typeof Buffer !== 'undefined' && Buffer.isBuffer(v),
	{ name: 'buffer', id: 'buffer' },
	binaryHelpers as any
);

export interface ArrayBufferGuard extends Guard<ArrayBuffer, BinaryHelpers<ArrayBuffer>> {}
export const ArrayBufferGuard: ArrayBufferGuard = makeGuard(
	(v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer,
	{ name: 'arrayBuffer', id: 'arrayBuffer' },
	binaryHelpers as any
);

export interface DataViewGuard extends Guard<DataView, BinaryHelpers<DataView>> {}
export const DataViewGuard: DataViewGuard = makeGuard(
	(v: unknown): v is DataView => v instanceof DataView,
	{ name: 'dataView', id: 'dataView' },
	binaryHelpers as any
);
