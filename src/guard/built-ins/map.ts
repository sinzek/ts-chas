// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { makeGuard, factory, transformer, property, type Guard, type InferGuard } from '../shared.js';

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

export interface MapGuardFactory {
	/** Creates an unnarrowed Map guard (any key/value types). */
	(): Guard<Map<unknown, unknown>, MapHelpers<unknown, unknown>>;
	/** Creates a Map guard with typed keys and values. */
	<KG extends Guard<any, any>, VG extends Guard<any, any>>(
		keyGuard: KG,
		valueGuard: VG
	): Guard<Map<InferGuard<KG>, InferGuard<VG>>, MapHelpers<InferGuard<KG>, InferGuard<VG>>>;
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
		},
		mapHelpers as any
	);
