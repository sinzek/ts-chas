import { makeGuard, factory, transformer, property, type Guard, type InferGuard, JSON_SCHEMA } from '../shared.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface MapHelpers<K, V, T extends Map<K, V> = Map<K, V>> {
	/** Validates that the map is non-empty. */
	nonEmpty: Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map is empty. */
	empty: Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map has exactly `n` entries. */
	size: (n: number) => Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map has at least `n` entries. */
	minSize: (n: number) => Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map has at most `n` entries. */
	maxSize: (n: number) => Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map contains a specific key. */
	hasKey: (key: K) => Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map contains a specific value. */
	hasValue: (value: V) => Guard<T, MapHelpers<K, V, T>>;
	/** Validates that the map is readonly. */
	readonly: Guard<Readonly<T>, MapHelpers<K, V, Readonly<T>>>;
}

const mapHelpers: MapHelpers<any, any> = {
	nonEmpty: ((v: Map<any, any>) => v.size > 0) as any,
	empty: ((v: Map<any, any>) => v.size === 0) as any,
	size: factory((n: number) => (v: Map<any, any>) => v.size === n),
	minSize: factory((n: number) => (v: Map<any, any>) => v.size >= n),
	maxSize: factory((n: number) => (v: Map<any, any>) => v.size <= n),
	hasKey: factory((key: any) => (v: Map<any, any>) => v.has(key)),
	hasValue: factory((value: any) => (v: Map<any, any>) => {
		for (const val of v.values()) {
			if (Object.is(val, value)) return true;
		}
		return false;
	}),
	readonly: property(
		transformer(target => ({
			fn: (v: unknown): v is Readonly<Map<any, any>> => target(Object.freeze(v)),
			meta: {
				name: `${target.meta.name}.readonly`,
			},
		})) as any
	),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type MapGuard<K, V> = Guard<Map<K, V>, MapHelpers<K, V>>;

export interface MapGuardFactory {
	/** Creates an unnarrowed Map guard (any key/value types). */
	(): MapGuard<unknown, unknown>;
	/** Creates a Map guard with typed keys and values. */
	<KG extends Guard<any>, VG extends Guard<any>>(
		keyGuard: KG,
		valueGuard: VG
	): MapGuard<InferGuard<KG>, InferGuard<VG>>;
}

export const MapGuardFactory: MapGuardFactory = (
	keyGuard?: Guard<any, Record<string, any>>,
	valueGuard?: Guard<any, Record<string, any>>
) =>
	makeGuard(
		(v: unknown): v is Map<any, any> => {
			if (!(v instanceof Map)) return false;
			if (!keyGuard && !valueGuard) return true;
			for (const [key, val] of v) {
				if (keyGuard && !keyGuard(key)) return false;
				if (valueGuard && !valueGuard(val)) return false;
			}
			return true;
		},
		{
			name:
				keyGuard || valueGuard ? `map<${keyGuard?.meta.name ?? '?'}, ${valueGuard?.meta.name ?? '?'}>` : 'map',
			id: 'map',
			...(keyGuard && { keyGuard }),
			...(valueGuard && { valueGuard }),
		},
		mapHelpers as any
	);

// JSON Schema contributions — size constraints reuse minItems/maxItems (same semantics as arrays).
(mapHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minItems: 1 });
(mapHelpers.empty as any)[JSON_SCHEMA] = () => ({ minItems: 0, maxItems: 0 });
(mapHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n, maxItems: n });
(mapHelpers.minSize as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n });
(mapHelpers.maxSize as any)[JSON_SCHEMA] = (n: number) => ({ maxItems: n });
