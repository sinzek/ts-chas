/* eslint-disable @typescript-eslint/no-unused-vars */

import type { Prettify } from '../../utils.js';
import {
	factory,
	transformer,
	type Guard,
	type GuardType,
	FACTORY,
	TRANSFORMER,
	PROPERTY,
	property,
} from '../shared.js';

export type ObjectHelpers<T> = {
	/**
	 * Makes the object schema partial. All keys will be optional by default, but you can specify keys to keep required.
	 */
	partial: {
		(): Guard<Partial<T>, ObjectHelpers<Partial<T>>>;
		<K extends keyof T>(
			...keys: K[]
		): Guard<Prettify<Pick<T, K> & Partial<Omit<T, K>>>, ObjectHelpers<Pick<T, K> & Partial<Omit<T, K>>>>;
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
		Prettify<T & { [K in keyof S]: GuardType<S[K]> }>,
		ObjectHelpers<T & { [K in keyof S]: GuardType<S[K]> }>
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
	) => Guard<T & Record<string, GuardType<TCatchall>>, ObjectHelpers<T & Record<string, GuardType<TCatchall>>>>;

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
	 * Validates that the object has a key.
	 * @param key The key to check for.
	 */
	has: (key: string) => Guard<T, ObjectHelpers<T>>;
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
};

export const objectHelpers: ObjectHelpers<Record<string, any>> = {
	partial: transformer<any, any, string[], ObjectHelpers<any>>((target, ...requiredKeys) => {
		const schema = target.meta.shape;
		const nextFn = (v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			if (!schema) return true;
			const obj = v as any;
			for (const key of Object.keys(schema)) {
				const isRequired = requiredKeys.includes(key);
				const value = obj[key];

				if (isRequired) {
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
				name: `${target.meta.name}.partial(${requiredKeys.length > 0 ? requiredKeys.join(', ') : ''})`,
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
	}),
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
	}),
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
	has: factory<[string], any, ObjectHelpers<any>>(
		(key: string) => (v: unknown) => typeof v === 'object' && v !== null && key in v
	),
	hasAll: factory<[string[]], any, ObjectHelpers<any>>(
		(keys: string[]) => (v: unknown) => typeof v === 'object' && v !== null && keys.every(key => key in v)
	),
	hasOnly: factory<[string[]], any, ObjectHelpers<any>>(
		(keys: string[]) => (v: unknown) =>
			typeof v === 'object' && v !== null && Object.keys(v).every(key => keys.includes(key))
	),
};
