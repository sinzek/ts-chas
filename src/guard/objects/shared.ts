import type { Prettify } from '../../utils.js';
import { factory, transformer, type Guard, type InferGuard, property } from '../shared.js';
import { type EnumHelpers, EnumGuardFactory } from '../misc/enum.js';

export type ObjectHelpers<T> = {
	/**
	 * Makes the object schema partial. With no arguments, all keys become optional.
	 * When keys are specified, only those keys become optional while the rest remain as-is.
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
	 */
	pick: <K extends keyof T>(keys: K[]) => Guard<Prettify<Pick<T, K>>, ObjectHelpers<Pick<T, K>>>;
	/**
	 * Omits specific keys from the object schema.
	 */
	omit: <K extends keyof T>(keys: K[]) => Guard<Prettify<Omit<T, K>>, ObjectHelpers<Omit<T, K>>>;
	/**
	 * Extends the object schema with another schema. The resulting schema will have all keys from both schemas.
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
		<K extends string, G extends Guard<any, any>>(
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
	readonly: Guard<Readonly<T>, ObjectHelpers<Readonly<T>>>;
};

export const objectHelpers: ObjectHelpers<Record<string, any>> = {
	partial: transformer<any, any, string[], ObjectHelpers<any>>((target, ...partialKeys) => {
		const schema = target.meta.shape;
		// No keys specified = all keys are optional; keys specified = only those are optional
		const isPartialKey = partialKeys.length > 0 ? (key: string) => partialKeys.includes(key) : () => true;
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
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
			return true;
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.partial(${partialKeys.length > 0 ? partialKeys.join(', ') : ''})`,
				shape: schema || {},
			},
		};
	}),
	required: transformer<any, any, string[], ObjectHelpers<any>>((target, ...requiredKeys) => {
		const schema = target.meta.shape;
		// No keys specified = all keys are required; keys specified = only those are required
		const isRequiredKey = requiredKeys.length > 0 ? (key: string) => requiredKeys.includes(key) : () => true;
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
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
			return true;
		};
		return {
			fn: nextFn,
			meta: {
				name: `${target.meta.name}.required(${requiredKeys.length > 0 ? requiredKeys.join(', ') : ''})`,
				shape: schema || {},
			},
		};
	}),
	pick: transformer<any, any, [string[]], ObjectHelpers<any>>((target, keys: string[]) => {
		const schema = target.meta.shape;
		const nextSchema = schema ? Object.fromEntries(Object.entries(schema).filter(([k]) => keys.includes(k))) : {};
		const transform = (v: any) => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
			const picked: any = {};
			for (const k of keys) {
				if (k in v) picked[k] = v[k];
			}
			return picked;
		};
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const transformed = transform(v);
			const schemaObj = nextSchema as Record<string, Guard<any>>;
			for (const key of Object.keys(schemaObj)) {
				if (!schemaObj[key]!(transformed[key])) return false;
			}
			return true;
		};
		return {
			fn: nextFn,
			meta: { name: `${target.meta.name}.pick(${keys.join(', ')})`, shape: nextSchema },
			transform,
		};
	}) as any,
	omit: transformer<any, any, [string[]], ObjectHelpers<any>>((target, keys: string[]) => {
		const schema = target.meta.shape;
		const nextSchema = schema ? Object.fromEntries(Object.entries(schema).filter(([k]) => !keys.includes(k))) : {};
		const transform = (v: any) => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
			const omitted = { ...v };
			for (const k of keys) {
				delete omitted[k];
			}
			return omitted;
		};
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const transformed = transform(v);
			const schemaObj = nextSchema as Record<string, Guard<any>>;
			for (const key of Object.keys(schemaObj)) {
				if (!schemaObj[key]!(transformed[key])) return false;
			}
			return true;
		};
		return {
			fn: nextFn,
			meta: { name: `${target.meta.name}.omit(${keys.join(', ')})`, shape: nextSchema },
			transform,
		};
	}) as any,
	extend: transformer<any, any, [Record<string, Guard<any>>], ObjectHelpers<any>>(
		(target, extension: Record<string, Guard<any>>) => {
			const schema = target.meta.shape ?? {};
			const nextSchema = { ...schema, ...extension };

			const nextFn = (v: unknown): v is any => {
				if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
				const obj = v as any;
				const schemaObj = nextSchema as Record<string, Guard<any>>;
				for (const key of Object.keys(schemaObj)) {
					if (!schemaObj[key]!(obj[key])) return false;
				}
				return true;
			};

			const transform = (prev: any, original: any) => {
				const parent = prev;
				if (parent == null || typeof parent !== 'object' || Array.isArray(parent)) return parent;
				const extObj: any = {};
				for (const k of Object.keys(extension)) {
					if (k in original) extObj[k] = original[k];
				}
				return { ...parent, ...extObj };
			};

			return {
				fn: nextFn,
				meta: {
					name: `${target.meta.name}.extend(${Object.keys(extension).join(', ')})`,
					shape: nextSchema,
				},
				transform,
			};
		}
	),
	strict: property(
		transformer<any, any, [], ObjectHelpers<any>>(target => {
			const schema = target.meta.shape;
			const nextFn = (v: unknown): v is any => {
				if (!target(v)) return false;
				if (!schema) return true;
				const obj = v as any;
				const keys = Object.keys(obj);
				const schemaKeys = Object.keys(schema);
				return keys.every(k => schemaKeys.includes(k));
			};
			return { fn: nextFn, meta: { name: `${target.meta.name}.strict` } };
		})
	) as any,
	catchall: transformer<any, any, [Guard<any>], ObjectHelpers<any>>((target, catchall: Guard<any>) => {
		const schema = target.meta.shape;
		const nextFn = (v: unknown): v is any => {
			if (!target(v)) return false;
			if (!schema) return true;
			const obj = v as any;
			const keys = Object.keys(obj);
			const schemaKeys = Object.keys(schema);
			return keys.every(k => schemaKeys.includes(k) || catchall(obj[k]));
		};
		return { fn: nextFn, meta: { name: `${target.meta.name}.catchall(${catchall.meta.name})` } };
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
			fn: (v: unknown): v is any => target(Object.freeze(v)),
			meta: { name: `${target.meta.name}.readonly` },
		}))
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
			if (!(key in v)) return false;
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
		(keys: string[]) => (v: unknown) => typeof v === 'object' && v !== null && keys.every(key => key in v)
	),
	hasOnly: factory<[string[]], any, ObjectHelpers<any>>(
		(keys: string[]) => (v: unknown) =>
			typeof v === 'object' && v !== null && Object.keys(v).every(key => keys.includes(key))
	),
};
