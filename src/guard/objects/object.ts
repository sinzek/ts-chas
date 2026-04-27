import { type Guard, type InferGuard, hasForbiddenKey } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { objectHelpers, type ObjectHelpers } from './object-helpers.js';
import { getDefaultUnknownKeyPolicy } from '../config.js';
import type { Prettify } from '../../utils.js';

export type InferObjectSchema<S extends Record<string, Guard<any, any>>> = Prettify<
	{
		[K in keyof S as undefined extends InferGuard<S[K]> ? never : K]: InferGuard<S[K]>;
	} & {
		[K in keyof S as undefined extends InferGuard<S[K]> ? K : never]?: InferGuard<S[K]>;
	}
>;

export interface ObjectGuardFactory {
	(): ObjectGuard;
	<S extends Record<string, Guard<any>>>(schema: S): ObjectGuard<InferObjectSchema<S>>;
}

export interface ObjectGuard<T extends object = Record<string, any>> extends Guard<
	T,
	ObjectHelpers<T>,
	ObjectGuard<T>
> {}

export const ObjectGuardFactory: ObjectGuardFactory = (...args: any[]) => {
	const schema: Record<string, Guard<any, Record<string, any>>> | undefined = args[0];
	if (schema === undefined) {
		return makeGuard(
			(v: unknown): v is object => v != null && typeof v === 'object' && !Array.isArray(v) && !hasForbiddenKey(v),
			{ name: 'object', id: 'object', unknownKeyPolicy: getDefaultUnknownKeyPolicy() },
			objectHelpers as any
		);
	}
	const names = Object.keys(schema)
		.map(k => `${k}: ${schema[k]!.meta.name ?? 'unknown'}`)
		.join(', ');
	return makeGuard(
		(() => {
			const capturedPolicy = getDefaultUnknownKeyPolicy();
			const schemaKeys = new Set(Object.keys(schema));
			return (v: unknown): v is Record<string, unknown> => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
				if (hasForbiddenKey(v)) return false;
				const obj = v as Record<string, unknown>;
				for (const key of Object.keys(schema)) {
					if (!schema[key]!(obj[key])) return false;
				}

				if (capturedPolicy === 'strict') {
					for (const key of Object.keys(obj)) {
						if (!schemaKeys.has(key)) return false;
					}
				}

				return true;
			};
		})(),
		{
			name: `object<${names}>`,
			id: 'object',
			shape: schema,
			unknownKeyPolicy: getDefaultUnknownKeyPolicy(),
			transform: (() => {
				const policy = getDefaultUnknownKeyPolicy();
				return (v: unknown) => {
					if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
					const obj = v as Record<string, any>;
					const result: Record<string, any> = {};
					const schemaKeys = new Set(Object.keys(schema));

					for (const key of Object.keys(obj)) {
						if (schemaKeys.has(key)) {
							const child = schema[key];
							const val = obj[key];
							const transformerFn = child?.meta.transform;
							result[key] = transformerFn ? transformerFn(val, val) : val;
						} else if (policy !== 'strip') {
							// For 'passthrough' and 'strict' (which is enforced before transform),
							// we retain the key. We only drop it for 'strip'.
							result[key] = obj[key];
						}
					}
					return result;
				};
			})(),
		},
		objectHelpers as any
	);
};
