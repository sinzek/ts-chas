import { type Guard, type InferGuard, makeGuard } from '../shared.js';
import { objectHelpers, type ObjectHelpers } from './shared.js';

export interface ObjectGuardFactory {
	(): Guard<object, ObjectHelpers<object>>;
	<S extends Record<string, Guard<any, Record<string, any>>>>(
		schema: S
	): Guard<{ [K in keyof S]: InferGuard<S[K]> }, ObjectHelpers<{ [K in keyof S]: InferGuard<S[K]> }>>;
}

export const ObjectGuardFactory: ObjectGuardFactory = (...args: any[]) => {
	const schema: Record<string, Guard<any, Record<string, any>>> | undefined = args[0];
	if (schema === undefined) {
		return makeGuard(
			(v: unknown): v is object => v != null && typeof v === 'object' && !Array.isArray(v),
			{ name: 'object', id: 'object' },
			objectHelpers as any
		);
	}
	const names = Object.keys(schema)
		.map(k => `${k}: ${schema[k]!.meta.name ?? 'unknown'}`)
		.join(', ');
	return makeGuard(
		(v: unknown): v is Record<string, unknown> => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const obj = v as Record<string, unknown>;
			for (const key of Object.keys(schema)) {
				if (!schema[key]!(obj[key])) return false;
			}
			return true;
		},
		{
			name: `object<${names}>`,
			id: 'object',
			shape: schema,
			transform: (v: unknown) => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
				const obj = v as Record<string, any>;
				const result: Record<string, any> = { ...obj };
				for (const key of Object.keys(schema)) {
					const child = schema[key];
					if (child) {
						const val = obj[key];
						result[key] = child.meta.transform ? child.meta.transform(val, val) : val;
					}
				}
				return result;
			},
		},
		objectHelpers as any
	);
};
