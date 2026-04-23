import { makeGuard, factory, type Guard, type InferGuard, property, transformer, JSON_SCHEMA } from '../shared.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface SetHelpers<T, TSet = Set<T>> {
	/** Validates that the set is non-empty. */
	nonEmpty: Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set is empty. */
	empty: Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set has exactly `n` elements. */
	size: (n: number) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set has at least `n` elements. */
	minSize: (n: number) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set has at most `n` elements. */
	maxSize: (n: number) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set contains a specific value. */
	has: (value: T) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set is a subset of another set or array. */
	subsetOf: (superset: Iterable<T>) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set is a superset of another set or array. */
	supersetOf: (subset: Iterable<T>) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set is disjoint from another set or array (no common elements). */
	disjointFrom: (other: Iterable<T>) => Guard<TSet, SetHelpers<T, TSet>>;
	/** Validates that the set is readonly. */
	readonly: Guard<Readonly<TSet>, SetHelpers<T, Readonly<TSet>>>;
}

const setHelpers: SetHelpers<any> = {
	nonEmpty: ((v: Set<any>) => v.size > 0) as any,
	empty: ((v: Set<any>) => v.size === 0) as any,
	size: factory((n: number) => (v: Set<any>) => v.size === n),
	minSize: factory((n: number) => (v: Set<any>) => v.size >= n),
	maxSize: factory((n: number) => (v: Set<any>) => v.size <= n),
	has: factory((value: any) => (v: Set<any>) => v.has(value)),
	subsetOf: factory((superset: Iterable<any>) => {
		const supersetSet = superset instanceof Set ? superset : new Set(superset);
		return (v: Set<any>) => {
			for (const item of v) {
				if (!supersetSet.has(item)) return false;
			}
			return true;
		};
	}),
	supersetOf: factory((subset: Iterable<any>) => {
		const subsetArr = [...subset];
		return (v: Set<any>) => subsetArr.every(item => v.has(item));
	}),
	disjointFrom: factory((other: Iterable<any>) => {
		const otherSet = other instanceof Set ? other : new Set(other);
		return (v: Set<any>) => {
			for (const item of v) {
				if (otherSet.has(item)) return false;
			}
			return true;
		};
	}),
	readonly: property(
		transformer(target => ({
			fn: (v: unknown): v is Readonly<Set<any>> => target(v),
			meta: {
				name: `${target.meta.name}.readonly`,
			},
			transform: (v: any) => (v instanceof Set ? Object.freeze(v) : v),
		})) as any
	),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type SetGuard<T> = Guard<Set<T>, SetHelpers<T>>;

export interface SetGuardFactory {
	/** Creates an unnarrowed Set guard (any value type). */
	(): SetGuard<unknown>;
	/** Creates a Set guard with typed values. */
	<G extends Guard<any>>(valueGuard: G): SetGuard<InferGuard<G>>;
}

export const SetGuardFactory: SetGuardFactory = (valueGuard?: Guard<any>) =>
	makeGuard(
		(v: unknown): v is Set<any> => {
			if (!(v instanceof Set)) return false;
			if (!valueGuard) return true;
			for (const item of v) {
				if (!valueGuard(item)) return false;
			}
			return true;
		},
		{
			name: valueGuard ? `set<${valueGuard.meta.name}>` : 'set',
			id: 'set',
			...(valueGuard && { elementGuard: valueGuard }),
		},
		setHelpers as any
	);

// JSON Schema contributions — size constraints reuse minItems/maxItems.
(setHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minItems: 1 });
(setHelpers.empty as any)[JSON_SCHEMA] = () => ({ minItems: 0, maxItems: 0 });
(setHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n, maxItems: n });
(setHelpers.minSize as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n });
(setHelpers.maxSize as any)[JSON_SCHEMA] = (n: number) => ({ maxItems: n });
