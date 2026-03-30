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
		const fn = (value: unknown): value is Json =>
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean' ||
			value === null ||
			(Array.isArray(value) && value.every(fn)) ||
			(typeof value === 'object' && Object.values(value).every(fn));

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
