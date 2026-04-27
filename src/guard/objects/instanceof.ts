import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { property, transformer } from '../base/helper-markers.js';

export interface InstanceofGuard<T extends object, S extends Partial<Record<keyof T, any>> = {}> extends Guard<
	T & { [K in keyof S]: InferGuard<S[K]> },
	InstanceofHelpers<T, S>,
	InstanceofGuard<T, S>
> {}

interface InstanceofHelpers<T extends object, S extends Partial<Record<keyof T, any>> = {}> {
	/**
	 * Makes the guard resilient across different JavaScript realms (e.g. iframes, Web Workers, Node's `vm` module).
	 * By default, `v instanceof ctor` fails when checking an object created in another realm.
	 * Chaining `.realmSafe` adds a duck-typed fallback that checks `Symbol.toStringTag` and `constructor.name`.
	 */
	realmSafe: InstanceofGuard<T, S>;
}

export interface InstanceofGuardFactory {
	/**
	 * Creates a Guard that validates that a value is an instance of the given constructor.
	 *
	 * Optionally, you can provide a schema to validate specific properties of the instance.
	 *
	 * @example
	 * is.instanceof(URL, { protocol: is.literal('https:') });
	 */
	<T extends object, S extends Partial<Record<keyof T, any>> = {}>(
		ctor: abstract new (...args: any[]) => T,
		schema?: S
	): InstanceofGuard<T, S>;
}

const instanceofHelpers: InstanceofHelpers<any, any> = {
	realmSafe: property(
		transformer<any, any, [], any>(target => {
			const ctor = target.meta['ctor'];
			const schema = target.meta.shape;
			const nextFn = (v: unknown): v is any => {
				if (v == null || (typeof v !== 'object' && typeof v !== 'function')) return false;

				let isMatch = v instanceof ctor;

				if (!isMatch) {
					const tag = (v as any)[Symbol.toStringTag];
					if (tag && tag === ctor.name) {
						isMatch = true;
					} else if (v.constructor && v.constructor.name === ctor.name) {
						isMatch = true;
					}
				}

				if (!isMatch) return false;
				if (!schema) return true;

				for (const key in schema) {
					const guard = schema[key];
					if (typeof guard === 'function' && !guard((v as any)[key])) {
						return false;
					}
				}
				return true;
			};
			return {
				fn: nextFn,
				meta: { name: `${target.meta.name}.realmSafe` },
			};
		})
	) as any,
};

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
			ctor,
			shape: schema as any,
		},
		instanceofHelpers
	);
