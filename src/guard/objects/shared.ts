import type { DeepReadonly, Prettify } from '../../utils.js';
import {
	factory,
	transformer,
	type Guard,
	type InferGuard,
	property,
	JSON_SCHEMA,
	type GuardMeta,
	hasForbiddenKey,
	FORBIDDEN_KEYS,
} from '../shared.js';
import { type EnumHelpers, EnumGuardFactory } from '../misc/enum.js';

export type ObjectHelpers<T> = {
	/**
	 * Makes the object schema partial. With no arguments, all keys become optional.
	 * When keys are specified, only those keys become optional while the rest remain as-is.
	 *
	 * **Ordering:** chain structure-altering helpers (`partial`, `required`, `pick`,
	 * `omit`, `extend`) before value-level refinements (`.where`, `.size`, `.minSize`,
	 * `.has`). The structure-altering helpers rebuild the predicate from `meta.shape`
	 * alone, which silently discards any refinements chained earlier.
	 *
	 * @example
	 * ```ts
	 * is.object({ a: is.string, b: is.number }).partial();      // Guard<{ a?: string; b?: number }>
	 * is.object({ a: is.string, b: is.number }).partial('b');    // Guard<{ a: string; b?: number }>
	 * ```
	 */
	partial: {
		(): Guard<Partial<T>, ObjectHelpers<Partial<T>>>;
		<K extends keyof T>(
			...keys: K[]
		): Guard<Prettify<Omit<T, K> & Partial<Pick<T, K>>>, ObjectHelpers<Omit<T, K> & Partial<Pick<T, K>>>>;
	};
	/**
	 * Makes the object schema required. With no arguments, all keys become required.
	 * When keys are specified, only those keys become required while the rest remain as-is.
	 *
	 * **Ordering:** like `partial`, chain before value-level refinements. The rebuilt
	 * predicate does not preserve `.where`, `.size`, `.has`, etc. chained earlier.
	 *
	 * @example
	 * ```ts
	 * is.object({ a: is.string.optional, b: is.number.optional }).required();      // Guard<{ a: string; b: number }>
	 * is.object({ a: is.string.optional, b: is.number.optional }).required('a');    // Guard<{ a: string; b?: number }>
	 * ```
	 */
	required: {
		(): Guard<Required<T>, ObjectHelpers<Required<T>>>;
		<K extends keyof T>(
			...keys: K[]
		): Guard<Prettify<Omit<T, K> & Required<Pick<T, K>>>, ObjectHelpers<Omit<T, K> & Required<Pick<T, K>>>>;
	};
	/**
	 * Picks specific keys from the object schema and makes them the only keys in the resulting schema.
	 *
	 * **Ordering:** chain before value-level refinements. The rebuilt predicate does not
	 * preserve `.where`, `.size`, `.has`, etc. chained earlier.
	 */
	pick: <K extends keyof T>(keys: K[]) => Guard<Prettify<Pick<T, K>>, ObjectHelpers<Pick<T, K>>>;
	/**
	 * Omits specific keys from the object schema.
	 *
	 * **Ordering:** chain before value-level refinements. The rebuilt predicate does not
	 * preserve `.where`, `.size`, `.has`, etc. chained earlier.
	 */
	omit: <K extends keyof T>(keys: K[]) => Guard<Prettify<Omit<T, K>>, ObjectHelpers<Omit<T, K>>>;
	/**
	 * Extends the object schema with another schema. The resulting schema will have all keys from both schemas.
	 *
	 * **Ordering:** chain before value-level refinements. The rebuilt predicate does not
	 * preserve `.where`, `.size`, `.has`, etc. chained earlier.
	 */
	extend: <S extends Record<string, Guard<any>>>(
		schema: S
	) => Guard<
		Prettify<T & { [K in keyof S]: InferGuard<S[K]> }>,
		ObjectHelpers<T & { [K in keyof S]: InferGuard<S[K]> }>
	>;
	/**
	 * Ensures the object has NO extra keys not defined in the schema.
	 */
	strict: Guard<T, ObjectHelpers<T>>;
	/**
	 * Transforms the validated value to contain **only** the keys declared in the
	 * schema, dropping any extra keys from the output. Unlike `.strict`, which
	 * rejects inputs with extra keys, `.strip` accepts them and discards them.
	 *
	 * Use this when parsing untrusted input (e.g. HTTP bodies) to avoid leaking
	 * unknown fields into downstream code.
	 *
	 * @example
	 * ```ts
	 * const User = is.object({ name: is.string, age: is.number }).strip;
	 * User.parse({ name: 'x', age: 1, extra: 'ignored' });
	 * // Ok({ name: 'x', age: 1 }) — 'extra' dropped
	 * ```
	 */
	strip: Guard<T, ObjectHelpers<T>>;
	/**
	 * Allows any extra keys not defined in the schema, but only if they satisfy the provided guard.
	 */
	catchall: <TCatchall extends Guard<any>>(
		guard: TCatchall
	) => Guard<T & Record<string, InferGuard<TCatchall>>, ObjectHelpers<T & Record<string, InferGuard<TCatchall>>>>;

	/**
	 * Validates that the object has exactly n keys.
	 * @param n The exact number of keys the object must have.
	 */
	size: (n: number) => Guard<T, ObjectHelpers<T>>;
	/**
	 * Validates that the object has at least n keys.
	 * @param n The minimum number of keys the object must have.
	 */
	minSize: (n: number) => Guard<T, ObjectHelpers<T>>;
	/**
	 * Validates that the object has at most n keys.
	 * @param n The maximum number of keys the object must have.
	 */
	maxSize: (n: number) => Guard<T, ObjectHelpers<T>>;
	/**
	 * Validates that the object has a key, optionally narrowing the key's type.
	 *
	 * @example
	 * ```ts
	 * is.object({ a: is.string }).has('b');              // Guard<{ a: string } & { b: unknown }>
	 * is.object({ a: is.string }).has('b', is.number);   // Guard<{ a: string } & { b: number }>
	 * ```
	 */
	has: {
		<K extends string>(
			key: K
		): Guard<Prettify<T & { [P in K]: unknown }>, ObjectHelpers<T & { [P in K]: unknown }>>;
		<K extends string, G extends Guard<any>>(
			key: K,
			guard: G
		): Guard<Prettify<T & { [P in K]: InferGuard<G> }>, ObjectHelpers<T & { [P in K]: InferGuard<G> }>>;
	};
	/**
	 * Validates that the object has all the specified keys.
	 * @param keys The keys to check for.
	 */
	hasAll: (keys: string[]) => Guard<T, ObjectHelpers<T>>;
	/**
	 * Validates that the object has only the specified keys.
	 * @param keys The keys to check for.
	 */
	hasOnly: (keys: string[]) => Guard<T, ObjectHelpers<T>>;
	/**
	 * Returns an enum guard of the object's schema keys.
	 * Useful for deriving a key guard from an existing object schema.
	 *
	 * @example
	 * ```ts
	 * const User = is.object({ name: is.string, age: is.number });
	 * const UserKey = User.keyof; // Guard<'name' | 'age'>
	 * UserKey('name');  // true
	 * UserKey('email'); // false
	 * ```
	 */
	keyof: Guard<keyof T & string, EnumHelpers<keyof T & string>>;
	/**
	 * Transforms the object schema to be readonly with Object.freeze().
	 *
	 * Note that further refinements will throw runtime errors.
	 */
	readonly: Guard<DeepReadonly<T>, ObjectHelpers<DeepReadonly<T>>>;
	/**
	 * Opts out of the default rejection of keys that can pollute an object's
	 * prototype chain (`__proto__`, `constructor`, `prototype`).
	 *
	 * By default, object and record guards reject input whose own keys include
	 * any of these names, so validated values are safe to pass to downstream
	 * code that assigns by computed key (e.g. `target[k] = value`). Use this
	 * escape hatch when you genuinely need to accept such keys.
	 *
	 * **Ordering matters:** chain `.allowProtoKeys` immediately after
	 * `is.object(...)` / `is.record(...)`, before any helper that re-validates
	 * the shape (`.partial`, `.pick`, `.omit`, `.extend`, `.required`). Those
	 * helpers honor the flag only if it is already set on the parent meta.
	 *
	 * @example
	 * ```ts
	 * const safe = is.object({ a: is.string });
	 * safe({ a: 'x', __proto__: { polluted: true } }); // false — rejected
	 *
	 * const lax = is.object({ a: is.string }).allowProtoKeys;
	 * lax({ a: 'x', __proto__: { polluted: true } }); // true
	 * ```
	 */
	allowProtoKeys: Guard<T, ObjectHelpers<T>>;
};

/**
 * @internal Returns `false` if `obj` has forbidden keys and the current meta
 * has not opted out via `.allowProtoKeys`. Returns `true` otherwise.
 *
 * Helpers should short-circuit their predicate with this before doing any
 * further validation, and must propagate `meta.allowProtoKeys` forward so
 * downstream chain steps honor the opt-out.
 */
export function checkProtoKeys(meta: GuardMeta, obj: object): boolean {
	if (meta['allowProtoKeys'] === true) return true;
	return !hasForbiddenKey(obj);
}

/**
 * @internal Reads the current object's extra-key policy from meta.
 * - `strict: true` from a prior `.strict` call rejects unknown keys.
 * - `catchall: Guard<any>` from a prior `.catchall(g)` requires unknown keys to match g.
 * - Neither set means "allow any extra keys" (the default).
 */
function checkExtraKeys(meta: GuardMeta, obj: Record<string, any>, schema: Record<string, Guard<any>>): boolean {
	const isStrict = meta['strict'] === true;
	const catchall = meta['catchall'] as Guard<any> | undefined;
	if (!isStrict && !catchall) return true;
	const schemaKeys = new Set(Object.keys(schema));
	for (const k of Object.keys(obj)) {
		if (schemaKeys.has(k)) continue;
		if (isStrict) return false;
		if (catchall && !catchall(obj[k])) return false;
	}
	return true;
}

export const objectHelpers: ObjectHelpers<Record<string, any>> = {
	partial: transformer<any, any, string[], ObjectHelpers<any>>((target, ...partialKeys) => {
		const schema = target.meta.shape;
		const parentMeta = target.meta;
		// No keys specified = all keys are optional; keys specified = only those are optional
		const isPartialKey = partialKeys.length > 0 ? (key: string) => partialKeys.includes(key) : () => true;
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			if (!checkProtoKeys(parentMeta, v)) return false;
			if (!schema) return true;
			const obj = v as any;
			for (const key of Object.keys(schema)) {
				const value = obj[key];
				if (isPartialKey(key)) {
					if (value !== undefined && !(schema as any)[key](value)) return false;
				} else {
					if (value === undefined || !(schema as any)[key](value)) return false;
				}
			}
			// Preserve strict/catchall policy from the parent so `.strict.partial` still
			// rejects unknown keys (and `.catchall(g).partial` still validates them).
			return checkExtraKeys(parentMeta, obj, schema as Record<string, Guard<any>>);
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.partial(${partialKeys.length > 0 ? partialKeys.join(', ') : ''})`,
				shape: schema || {},
				...(parentMeta['strict'] === true && { strict: true }),
				...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
				...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
			},
		};
	}),
	required: transformer<any, any, string[], ObjectHelpers<any>>((target, ...requiredKeys) => {
		const schema = target.meta.shape;
		const parentMeta = target.meta;
		// No keys specified = all keys are required; keys specified = only those are required
		const isRequiredKey = requiredKeys.length > 0 ? (key: string) => requiredKeys.includes(key) : () => true;
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			if (!checkProtoKeys(parentMeta, v)) return false;
			if (!schema) return true;
			const obj = v as any;
			for (const key of Object.keys(schema)) {
				const value = obj[key];
				if (isRequiredKey(key)) {
					if (value === undefined || !(schema as any)[key](value)) return false;
				} else {
					if (value !== undefined && !(schema as any)[key](value)) return false;
				}
			}
			return checkExtraKeys(parentMeta, obj, schema as Record<string, Guard<any>>);
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.required(${requiredKeys.length > 0 ? requiredKeys.join(', ') : ''})`,
				shape: schema || {},
				...(parentMeta['strict'] === true && { strict: true }),
				...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
				...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
			},
		};
	}),
	pick: transformer<any, any, [string[]], ObjectHelpers<any>>((target, keys: string[]) => {
		const schema = target.meta.shape;
		const parentMeta = target.meta;
		const nextSchema = schema ? Object.fromEntries(Object.entries(schema).filter(([k]) => keys.includes(k))) : {};
		const transform = (v: any) => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
			// Use defineProperty so the __proto__ setter is never triggered, even if
			// a user explicitly picks `__proto__` via .allowProtoKeys.pick(['__proto__']).
			const picked: any = {};
			for (const k of keys) {
				if (Object.hasOwn(v, k)) {
					Object.defineProperty(picked, k, {
						value: v[k],
						writable: true,
						enumerable: true,
						configurable: true,
					});
				}
			}
			return picked;
		};
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			if (!checkProtoKeys(parentMeta, v)) return false;
			// Enforce extra-key policy against the ORIGINAL value, using the picked schema
			// as the allowed-key set, so `.strict.pick(['a'])` rejects `{a:1, b:2}`.
			if (!checkExtraKeys(parentMeta, v as any, nextSchema as Record<string, Guard<any>>)) return false;
			const transformed = transform(v);
			const schemaObj = nextSchema as Record<string, Guard<any>>;
			for (const key of Object.keys(schemaObj)) {
				if (!schemaObj[key]!(transformed[key])) return false;
			}
			return true;
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.pick(${keys.join(', ')})`,
				shape: nextSchema,
				...(parentMeta['strict'] === true && { strict: true }),
				...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
				...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
			},
			transform,
		};
	}) as any,
	omit: transformer<any, any, [string[]], ObjectHelpers<any>>((target, keys: string[]) => {
		const schema = target.meta.shape;
		const parentMeta = target.meta;
		const nextSchema = schema ? Object.fromEntries(Object.entries(schema).filter(([k]) => !keys.includes(k))) : {};
		const omitKeys = new Set(keys);
		const transform = (v: any) => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
			// Use defineProperty so that copying across __proto__ as an own key never
			// triggers the native Object.prototype setter. A plain `{ ...v }` followed
			// by `delete` would invoke the setter for that one iteration.
			const out: any = {};
			for (const k of Object.keys(v)) {
				if (omitKeys.has(k)) continue;
				Object.defineProperty(out, k, {
					value: (v as any)[k],
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}
			return out;
		};
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			if (!checkProtoKeys(parentMeta, v)) return false;
			// Enforce extra-key policy against the remaining (omitted) view, so .strict is preserved.
			const transformed = transform(v);
			if (!checkExtraKeys(parentMeta, transformed, nextSchema as Record<string, Guard<any>>)) return false;
			const schemaObj = nextSchema as Record<string, Guard<any>>;
			for (const key of Object.keys(schemaObj)) {
				if (!schemaObj[key]!(transformed[key])) return false;
			}
			return true;
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.omit(${keys.join(', ')})`,
				shape: nextSchema,
				...(parentMeta['strict'] === true && { strict: true }),
				...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
				...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
			},
			transform,
		};
	}) as any,
	extend: transformer<any, any, [Record<string, Guard<any>>], ObjectHelpers<any>>(
		(target, extension: Record<string, Guard<any>>) => {
			const schema = target.meta.shape ?? {};
			const parentMeta = target.meta;
			const nextSchema = { ...schema, ...extension };

			const nextFn = (v: unknown): v is any => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
				if (!checkProtoKeys(parentMeta, v)) return false;
				const obj = v as any;
				const schemaObj = nextSchema as Record<string, Guard<any>>;
				for (const key of Object.keys(schemaObj)) {
					if (!schemaObj[key]!(obj[key])) return false;
				}
				// Preserve strict/catchall against the extended schema's key set.
				return checkExtraKeys(parentMeta, obj, nextSchema as Record<string, Guard<any>>);
			};

			const transform = (prev: any, original: any) => {
				const parent = prev;
				if (parent == null || typeof parent !== 'object' || Array.isArray(parent)) return parent;
				// Use defineProperty for extension writes so a forbidden key in the extension
				// schema can't trigger the __proto__ setter on a fresh object.
				const extObj: any = {};
				for (const k of Object.keys(extension)) {
					if (Object.hasOwn(original, k)) {
						Object.defineProperty(extObj, k, {
							value: original[k],
							writable: true,
							enumerable: true,
							configurable: true,
						});
					}
				}
				return { ...parent, ...extObj };
			};

			return {
				fn: nextFn,
				meta: {
					name: `${target.meta.name}.extend(${Object.keys(extension).join(', ')})`,
					shape: nextSchema,
					...(parentMeta['strict'] === true && { strict: true }),
					...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
					...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
				},
				transform,
			};
		}
	),
	strict: property(
		transformer<any, any, [], ObjectHelpers<any>>(target => {
			const schema = target.meta.shape;
			const parentMeta = target.meta;
			const nextFn = (v: unknown): v is any => {
				if (!target(v)) return false;
				if (!schema) return true;
				const obj = v as any;
				const keys = Object.keys(obj);
				const schemaKeys = Object.keys(schema);
				return keys.every(k => schemaKeys.includes(k));
			};
			return {
				fn: nextFn,
				meta: {
					name: `${target.meta.name}.strict`,
					// Flag so that downstream partial/pick/omit/extend/required can re-apply this constraint.
					strict: true,
					jsonSchema: { ...(target.meta.jsonSchema ?? {}), additionalProperties: false },
					...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
				},
			};
		})
	) as any,
	strip: property(
		transformer<any, any, [], ObjectHelpers<any>>(target => {
			const schema = target.meta.shape;
			const parentMeta = target.meta;
			const allowedKeys = schema ? new Set(Object.keys(schema)) : undefined;
			return {
				fn: (v: unknown): v is any => target(v),
				meta: {
					name: `${target.meta.name}.strip`,
					...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
					...(parentMeta['strict'] === true && { strict: true }),
					...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
					...(schema && { shape: schema }),
				},
				transform: (v: any) => {
					if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
					if (!allowedKeys) return v;
					const out: any = {};
					for (const k of Object.keys(v)) {
						if (!allowedKeys.has(k)) continue;
						Object.defineProperty(out, k, {
							value: (v as any)[k],
							writable: true,
							enumerable: true,
							configurable: true,
						});
					}
					return out;
				},
			};
		})
	) as any,
	catchall: transformer<any, any, [Guard<any>], ObjectHelpers<any>>((target, catchall: Guard<any>) => {
		const schema = target.meta.shape;
		const parentMeta = target.meta;
		const nextFn = (v: unknown): v is any => {
			if (!target(v)) return false;
			if (!schema) return true;
			const obj = v as any;
			const keys = Object.keys(obj);
			const schemaKeys = Object.keys(schema);
			return keys.every(k => {
				if (schemaKeys.includes(k)) return true;
				// Prototype-pollution keys are structural, not data. Refuse to accept them
				// as catchall extras even when `.allowProtoKeys` was chained — if the user
				// genuinely wants to accept them they must name them in the schema.
				if (FORBIDDEN_KEYS.has(k)) return false;
				return catchall(obj[k]);
			});
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.catchall(${catchall.meta.name})`,
				// Flag so that downstream partial/pick/omit/extend/required preserve this constraint.
				catchall,
				...(parentMeta['allowProtoKeys'] === true && { allowProtoKeys: true }),
			},
		};
	}),
	keyof: property(
		transformer<any, any, [], any>(target => {
			const shape = target.meta.shape;
			const keys = shape ? Object.keys(shape) : [];
			return {
				fn: EnumGuardFactory(keys),
				meta: { name: `keyof<${keys.join(' | ')}>`, id: 'enum', values: new Set(keys) },
				replaceHelpers: true,
			};
		})
	) as any,
	readonly: property(
		transformer<any, any, [], ObjectHelpers<any>>(target => ({
			fn: (v: unknown): v is any => target(v),
			meta: { name: `${target.meta.name}.readonly` },
			transform: (v: any) => (v != null && typeof v === 'object' ? Object.freeze(v) : v),
		}))
	) as any,
	// `.allowProtoKeys` must be chained BEFORE shape-modifying helpers (partial,
	// pick, omit, extend, required). Those helpers bail out on forbidden keys
	// unless parent meta already has `allowProtoKeys: true`, so ordering matters.
	// We rebuild the base predicate here from `target.meta.shape` (plus any
	// strict/catchall the parent carried) so that `is.object(s).allowProtoKeys`
	// starts from a known-safe root.
	allowProtoKeys: property(
		transformer<any, any, [], ObjectHelpers<any>>(target => {
			const schema = target.meta.shape;
			const parentMeta = target.meta;
			const keyGuard = parentMeta['keyGuard'] as Guard<any> | undefined;
			const valueGuard = parentMeta['valueGuard'] as Guard<any> | undefined;
			const nextFn = (v: unknown): v is any => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
				const obj = v as Record<string, unknown>;
				if (schema) {
					for (const key of Object.keys(schema)) {
						if (!(schema as any)[key](obj[key])) return false;
					}
					return checkExtraKeys(parentMeta, obj, schema as Record<string, Guard<any>>);
				}
				// Open-ended record: validate each own entry against the key/value guards.
				// Prototype-pollution keys are passed through unvalidated — that's precisely
				// what `.allowProtoKeys` opts into. Other keys must still satisfy both guards.
				if (keyGuard && valueGuard) {
					for (const key of Object.keys(obj)) {
						if (FORBIDDEN_KEYS.has(key)) continue;
						if (!keyGuard(key) || !valueGuard(obj[key])) return false;
					}
					return true;
				}
				// Raw is.object() with no schema: shape-less check only.
				return true;
			};
			return {
				fn: nextFn,
				meta: {
					name: `${target.meta.name}.allowProtoKeys`,
					allowProtoKeys: true,
					...(schema && { shape: schema }),
					...(keyGuard && { keyGuard }),
					...(valueGuard && { valueGuard }),
					...(parentMeta['strict'] === true && { strict: true }),
					...(parentMeta['catchall'] && { catchall: parentMeta['catchall'] }),
				},
			};
		})
	) as any,

	// --- Valuations ---

	size: factory<[number], any, ObjectHelpers<any>>(
		(n: number) => (v: unknown) => typeof v === 'object' && v !== null && Object.keys(v).length === n
	),
	minSize: factory<[number], any, ObjectHelpers<any>>(
		(n: number) => (v: unknown) => typeof v === 'object' && v !== null && Object.keys(v).length >= n
	),
	maxSize: factory<[number], any, ObjectHelpers<any>>(
		(n: number) => (v: unknown) => typeof v === 'object' && v !== null && Object.keys(v).length <= n
	),
	has: transformer<any, any, [string, Guard<any>?], ObjectHelpers<any>>((target, key: string, guard?: Guard<any>) => {
		const schema = target.meta.shape ?? {};
		const nextSchema = guard ? { ...schema, [key]: guard } : schema;
		const nextFn = (v: unknown): v is any => {
			if (!target(v)) return false;
			if (typeof v !== 'object' || v === null) return false;
			if (!Object.hasOwn(v, key)) return false;
			if (guard && !guard((v as any)[key])) return false;
			return true;
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.has(${key}${guard ? `, ${guard.meta.name}` : ''})`,
				shape: nextSchema,
			},
		};
	}),
	hasAll: factory<[string[]], any, ObjectHelpers<any>>(
		(keys: string[]) => (v: unknown) =>
			typeof v === 'object' && v !== null && keys.every(key => Object.hasOwn(v, key))
	),
	hasOnly: factory<[string[]], any, ObjectHelpers<any>>(
		(keys: string[]) => (v: unknown) =>
			typeof v === 'object' && v !== null && Object.keys(v).every(key => keys.includes(key))
	),
};

// JSON Schema contributions for object helpers
(objectHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minProperties: n, maxProperties: n });
(objectHelpers.minSize as any)[JSON_SCHEMA] = (n: number) => ({ minProperties: n });
(objectHelpers.maxSize as any)[JSON_SCHEMA] = (n: number) => ({ maxProperties: n });
(objectHelpers.hasAll as any)[JSON_SCHEMA] = (keys: string[]) => ({ _hasAllKeys: keys });
(objectHelpers.hasOnly as any)[JSON_SCHEMA] = (keys: string[]) => ({ _hasOnlyKeys: keys });
