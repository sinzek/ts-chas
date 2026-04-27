import { type Guard, type InferGuard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { factory, transformer, property } from '../base/helper-markers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface MapHelpers<K, V, Modifier extends 'readonly' | 'mutable' = 'mutable'> {
	/** Validates that the map is non-empty. */
	nonEmpty: MapGuard<K, V, Modifier>;
	/** Validates that the map is empty. */
	empty: MapGuard<K, V, Modifier>;
	/** Validates that the map has exactly `n` entries. */
	size: (n: number) => MapGuard<K, V, Modifier>;
	/** Validates that the map has at least `n` entries. */
	minSize: (n: number) => MapGuard<K, V, Modifier>;
	/** Validates that the map has at most `n` entries. */
	maxSize: (n: number) => MapGuard<K, V, Modifier>;
	/** Validates that the map contains a specific key. */
	hasKey: (key: K) => MapGuard<K, V, Modifier>;
	/** Validates that the map contains a specific value. */
	hasValue: (value: V) => MapGuard<K, V, Modifier>;
	/** Validates that the map is readonly. */
	readonly: MapGuard<K, V, 'readonly'>;
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
			fn: (v: unknown): v is Readonly<Map<any, any>> => target(v),
			meta: {
				name: `${target.meta.name}.readonly`,
			},
			transform: (v: any) => (v instanceof Map ? Object.freeze(v) : v),
		})) as any
	),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface MapGuard<K, V, Modifier extends 'readonly' | 'mutable' = 'mutable'> extends Guard<
	Modifier extends 'readonly' ? Readonly<Map<K, V>> : Map<K, V>,
	MapHelpers<K, V, Modifier>,
	MapGuard<K, V, Modifier>
> {}

export interface MapGuardFactory {
	/** Creates an unnarrowed Map guard (any key/value types). */
	(): MapGuard<unknown, unknown>;
	/** Creates a Map guard with typed keys and values. */
	<KG extends Guard<any, any, any>, VG extends Guard<any, any, any>>(
		keyGuard: KG,
		valueGuard: VG
	): MapGuard<InferGuard<KG>, InferGuard<VG>>;
}

export const MapGuardFactory: MapGuardFactory = (keyGuard?: Guard<any, any, any>, valueGuard?: Guard<any, any, any>) =>
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
