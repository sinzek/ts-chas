import { makeGuard, type Guard, transformer, property, factory } from '../shared.js';

/**
 * Default hard caps applied to `is.json` to make it DoS-resistant against
 * deeply nested or oversized payloads. Use `.maxDepth(n)` / `.maxProperties(n)`
 * to override per-guard, or `is.json.unbounded` to disable entirely.
 */
export const JSON_DEFAULT_MAX_DEPTH = 256;
export const JSON_DEFAULT_MAX_PROPERTIES = 100_000;

function validateJson(
	value: unknown,
	maxDepth: number,
	maxProperties: number
): boolean {
	let propertyCount = 0;
	const walk = (v: unknown, depth: number): boolean => {
		if (depth > maxDepth) return false;
		if (v === null) return true;
		const t = typeof v;
		if (t === 'string' || t === 'boolean') return true;
		if (t === 'number') return Number.isFinite(v as number);
		if (Array.isArray(v)) {
			propertyCount += v.length;
			if (propertyCount > maxProperties) return false;
			for (const item of v) {
				if (!walk(item, depth + 1)) return false;
			}
			return true;
		}
		if (t === 'object') {
			// Only plain objects are JSON — reject Date, Map, Set, RegExp, class instances, etc.
			const proto = Object.getPrototypeOf(v);
			if (proto !== null && proto !== Object.prototype) return false;
			const entries = Object.values(v as object);
			propertyCount += entries.length;
			if (propertyCount > maxProperties) return false;
			for (const item of entries) {
				if (!walk(item, depth + 1)) return false;
			}
			return true;
		}
		return false;
	};
	return walk(value, 0);
}

export interface JsonHelpers {
	/** Narrows the JSON value to an object. */
	object: Guard<JsonObject, JsonHelpers>;
	/** Narrows the JSON value to an array. */
	array: Guard<JsonArray, JsonHelpers>;
	/** Narrows the JSON value to a primitive (string, number, boolean, or null). */
	primitive: Guard<string | number | boolean | null, JsonHelpers>;
	/** Transforms the validated JSON value into a string via `JSON.stringify()`. */
	stringify: Guard<Json, JsonHelpers> & { parse: (v: unknown) => any };
	/**
	 * Overrides the maximum nesting depth allowed (default: {@link JSON_DEFAULT_MAX_DEPTH}).
	 * Deeper values are rejected to prevent stack overflow on hostile input.
	 */
	maxDepth: (n: number) => Guard<Json, JsonHelpers>;
	/**
	 * Overrides the maximum total number of array elements + object property
	 * values observed across the whole tree (default: {@link JSON_DEFAULT_MAX_PROPERTIES}).
	 * Prevents memory DoS on payloads that are shallow but wide.
	 */
	maxProperties: (n: number) => Guard<Json, JsonHelpers>;
	/**
	 * Disables the default depth/property caps. Use only when the input source is
	 * trusted — unbounded validation on hostile input is a DoS vector.
	 */
	unbounded: Guard<Json, JsonHelpers>;
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
	maxDepth: factory<[number], (v: Json) => boolean, JsonHelpers>(
		(n: number) => (v: Json) => validateJson(v, n, JSON_DEFAULT_MAX_PROPERTIES)
	),
	maxProperties: factory<[number], (v: Json) => boolean, JsonHelpers>(
		(n: number) => (v: Json) => validateJson(v, JSON_DEFAULT_MAX_DEPTH, n)
	),
	unbounded: property(
		transformer(() => ({
			fn: (v: unknown): v is Json => validateJson(v, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
			meta: { name: 'json.unbounded' },
		}))
	) as any,
};

export interface JsonGuard extends Guard<Json, JsonHelpers> {}

export const JsonGuard: JsonGuard = makeGuard(
	(value: unknown): value is Json => validateJson(value, JSON_DEFAULT_MAX_DEPTH, JSON_DEFAULT_MAX_PROPERTIES),
	{ name: 'json', id: 'json' },
	jsonHelpers
);

export type Json = string | number | boolean | null | JsonArray | JsonObject;

export type JsonArray = Json[];
export type JsonObject = {
	[key: string]: Json;
};
