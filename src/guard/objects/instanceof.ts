import { makeGuard, type Guard, type InferGuard } from '../shared.js';

export interface InstanceofGuardFactory {
	/**
	 * Creates a Guard that validates that a value is an instance of the given constructor.
	 *
	 * Optionally, you can provide a schema to validate specific properties of the instance.
	 *
	 * @example
	 * is.instanceof(URL, { protocol: is.literal('https:') });
	 */
	<T, S extends Partial<Record<keyof T, any>> = {}>(
		ctor: abstract new (...args: any[]) => T,
		schema?: S
	): Guard<T & { [K in keyof S]: InferGuard<S[K]> }, typeof instanceofHelpers>;
}

const instanceofHelpers = {};

export const InstanceofGuardFactory: InstanceofGuardFactory = (ctor, schema) =>
	makeGuard(
		(v: unknown): v is any => {
			if (!(v instanceof ctor)) return false;
			if (!schema) return true;

			for (const key in schema) {
				const guard = schema[key];
				if (typeof guard === 'function' && !guard((v as any)[key])) {
					return false;
				}
			}
			return true;
		},
		{
			name: schema
				? `instanceof<${ctor.name}>({ ${Object.keys(schema).join(', ')} })`
				: `instanceof<${ctor.name}>`,
			id: ctor.name,
			shape: schema as any,
		},
		instanceofHelpers
	);
