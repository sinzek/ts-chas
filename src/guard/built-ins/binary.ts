import { type Guard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { factory } from '../base/helper-markers.js';

export interface BinaryHelpers<GuardType extends Guard<any, BinaryHelpers<any>>> {
	min: (bytes: number) => GuardType;
	max: (bytes: number) => GuardType;
	size: (bytes: number) => GuardType;
}

const binaryHelpers = {
	min: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength >= bytes),
	max: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength <= bytes),
	size: factory((bytes: number) => (v: any) => v && typeof v.byteLength === 'number' && v.byteLength === bytes),
};

(binaryHelpers.min as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n });
(binaryHelpers.max as any)[JSON_SCHEMA] = (n: number) => ({ maxLength: n });
(binaryHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n, maxLength: n });

export interface Uint8ArrayGuard extends Guard<Uint8Array, BinaryHelpers<Uint8ArrayGuard>, Uint8ArrayGuard> {}
export const Uint8ArrayGuard: Uint8ArrayGuard = makeGuard(
	(v: unknown): v is Uint8Array => v instanceof Uint8Array,
	{ name: 'uint8Array', id: 'uint8Array' },
	binaryHelpers as any
);

// We need a conditional type for Buffer to avoid failing in browsers without Buffer polyfill.
export interface BufferGuard extends Guard<any, BinaryHelpers<BufferGuard>, BufferGuard> {}
export const BufferGuard: BufferGuard = makeGuard(
	(v: unknown): v is any => typeof Buffer !== 'undefined' && Buffer.isBuffer(v),
	{ name: 'buffer', id: 'buffer' },
	binaryHelpers as any
);

export interface ArrayBufferGuard extends Guard<ArrayBuffer, BinaryHelpers<ArrayBufferGuard>, ArrayBufferGuard> {}
export const ArrayBufferGuard: ArrayBufferGuard = makeGuard(
	(v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer,
	{ name: 'arrayBuffer', id: 'arrayBuffer' },
	binaryHelpers as any
);

export interface DataViewGuard extends Guard<DataView, BinaryHelpers<DataViewGuard>, DataViewGuard> {}
export const DataViewGuard: DataViewGuard = makeGuard(
	(v: unknown): v is DataView => v instanceof DataView,
	{ name: 'dataView', id: 'dataView' },
	binaryHelpers as any
);
