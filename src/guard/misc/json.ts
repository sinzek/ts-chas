import { makeGuard, type Guard, transformer, property } from '../shared.js';

export interface JsonHelpers {
	/** Narrows the JSON value to an object. */
	object: Guard<JsonObject, JsonHelpers>;
	/** Narrows the JSON value to an array. */
	array: Guard<JsonArray, JsonHelpers>;
	/** Narrows the JSON value to a primitive (string, number, boolean, or null). */
	primitive: Guard<string | number | boolean | null, JsonHelpers>;
	/** Transforms the validated JSON value into a string via `JSON.stringify()`. */
	stringify: Guard<Json, JsonHelpers> & { parse: (v: unknown) => any };
}

const jsonHelpers: JsonHelpers = {
	object: property(
		transformer(target => ({
			fn: (v: unknown): v is JsonObject => target(v) && typeof v === 'object' && v !== null && !Array.isArray(v),
			meta: { name: 'json.object' },
		}))
	) as any,
	array: property(
		transformer(target => ({
			fn: (v: unknown): v is JsonArray => target(v) && Array.isArray(v),
			meta: { name: 'json.array' },
		}))
	) as any,
	primitive: property(
		transformer(target => ({
			fn: (v: unknown): v is string | number | boolean | null =>
				target(v) && (typeof v !== 'object' || v === null),
			meta: { name: 'json.primitive' },
		}))
	) as any,
	stringify: property(
		transformer(target => ({
			fn: (v: unknown): v is Json => target(v),
			meta: { name: `${target.meta.name}.stringify` },
			transform: (v: Json) => JSON.stringify(v),
		}))
	) as any,
};

export interface JsonGuard extends Guard<Json, JsonHelpers> {}

export const JsonGuard: JsonGuard = makeGuard(
	(value: unknown): value is Json => {
		const fn = (v: unknown): v is Json => {
			if (v === null) return true;
			const t = typeof v;
			if (t === 'string' || t === 'boolean') return true;
			if (t === 'number') return Number.isFinite(v as number);
			if (Array.isArray(v)) return v.every(fn);
			if (t === 'object') {
				// Only plain objects are JSON — reject Date, Map, Set, RegExp, class instances, etc.
				const proto = Object.getPrototypeOf(v);
				if (proto !== null && proto !== Object.prototype) return false;
				return Object.values(v as object).every(fn);
			}
			return false;
		};

		return fn(value);
	},
	{ name: 'json', id: 'json' },
	jsonHelpers
);

export type Json = string | number | boolean | null | JsonArray | JsonObject;

export type JsonArray = Json[];
export type JsonObject = {
	[key: string]: Json;
};
