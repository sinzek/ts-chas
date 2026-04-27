import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { arrayHelpers } from '../base/array-helpers.js';
import type { DeepReadonly } from '../../utils.js';

type Mutable<T extends readonly any[]> = [...T];
type GuardArrayToTuple<G extends readonly Guard<any, any, any>[]> = {
	[K in keyof G]: InferGuard<G[K]>;
};

// generic now has regular tuple instead of a tuple of guards
// for instance instead of TupleGuard<[StringGuard, NumberGuard]> it is TupleGuard<[string, number]>
export interface TupleGuard<
	Tuple extends readonly any[],
	Modifier extends 'readonly' | 'mutable' = 'mutable',
	Rest = undefined,
> extends Guard<
	Rest extends undefined
		? Modifier extends 'readonly'
			? DeepReadonly<{ [K in keyof Tuple]: Tuple[K] }>
			: Mutable<{ [K in keyof Tuple]: Tuple[K] }>
		: Modifier extends 'readonly'
			? DeepReadonly<[...{ [K in keyof Tuple]: Tuple[K] }, ...Rest[]]>
			: Mutable<[...{ [K in keyof Tuple]: Tuple[K] }, ...Rest[]]>,
	TupleHelpers<
		Rest extends undefined
			? Modifier extends 'readonly'
				? DeepReadonly<{ [K in keyof Tuple]: Tuple[K] }>
				: Mutable<{ [K in keyof Tuple]: Tuple[K] }>
			: Modifier extends 'readonly'
				? DeepReadonly<[...{ [K in keyof Tuple]: Tuple[K] }, ...Rest[]]>
				: Mutable<[...{ [K in keyof Tuple]: Tuple[K] }, ...Rest[]]>
	>,
	TupleGuard<Tuple, Modifier, Rest>
> {}

export interface TupleGuardFactory {
	/**
	 * Creates a fixed-length tuple guard.
	 * @param guards - The guards for each element in the tuple.
	 * @example
	 * ```ts
	 * const unknownValue: unknown = ['hello', 123];
	 * const tupleGuard = is.tuple([is.string, is.number]);
	 * if (tupleGuard(unknownValue)) {
	 *   const [name, age] = unknownValue; // [string, number]
	 * }
	 * ```
	 */
	<G extends readonly Guard<any, any, any>[]>(guards: [...G]): TupleGuard<GuardArrayToTuple<G>>;

	/**
	 * Creates a variadic tuple guard.
	 * @param guards - The guards for each element in the tuple.
	 * @param rest - The optional guard for the rest of the elements in the tuple.
	 * @example
	 * ```ts
	 * const unknownValue: unknown = ['hello', 123, true];
	 * const tupleGuardWithRest = is.tuple([is.string, is.number], is.boolean);
	 * if (tupleGuardWithRest(unknownValue)) {
	 *   const [name, age, active] = unknownValue; // [string, number, ...boolean[]]
	 * }
	 * ```
	 */
	<G extends readonly Guard<any, any, any>[], R extends Guard<any, any, any>>(
		guards: [...G],
		rest: R
	): TupleGuard<GuardArrayToTuple<[...G, ...R[]]>, 'mutable', InferGuard<R>>;
}

export interface TupleHelpers<
	T extends readonly any[],
	Modifier extends 'readonly' | 'mutable' = 'mutable',
	Rest = undefined,
> {
	/** Validates that the tuple is non-empty. */
	nonEmpty: TupleGuard<T, Modifier, Rest>;
	/** Validates that all elements in the tuple are unique (deep equality). */
	unique: TupleGuard<T, Modifier, Rest>;
	/** Validates that the tuple length is at least `n`. */
	min: (n: number) => TupleGuard<T, Modifier, Rest>;
	/** Validates that the tuple length is at most `n`. */
	max: (n: number) => TupleGuard<T, Modifier, Rest>;
	/** Validates that the tuple length is exactly `n`. */
	size: (n: number) => TupleGuard<T, Modifier, Rest>;
	/** Validates that the tuple contains a specific value. */
	includes: (item: T[number]) => TupleGuard<T, Modifier, Rest>;
	/** Validates that the tuple does not contain a specific value. */
	excludes: (item: T[number]) => TupleGuard<T, Modifier, Rest>;
	/** Wraps the tuple in `Object.freeze()` during validation. Since tuples are already readonly, this is not strictly necessary but is included for consistency with other collection guards. */
	readonly: TupleGuard<T, 'readonly', Rest>;
}

export const tupleHelpers: TupleHelpers<any> = arrayHelpers as any;

export const TupleGuardFactory: TupleGuardFactory = (guards: readonly Guard<any, any, any>[], rest?: Guard<any, any, any>) => {
	const fn = (value: unknown): value is any => {
		if (!Array.isArray(value)) return false;
		if (rest) {
			if (value.length < guards.length) return false;
			for (let i = 0; i < guards.length; i++) {
				if (!guards[i]!(value[i])) return false;
			}
			for (let i = guards.length; i < value.length; i++) {
				if (!rest(value[i])) return false;
			}
			return true;
		}
		if (value.length !== guards.length) return false;
		return guards.every((guard, i) => guard(value[i]));
	};

	const name = rest
		? `tuple<${guards.map(g => g.meta.name).join(', ')}, ...${rest.meta.name}[]>`
		: `tuple<${guards.map(g => g.meta.name).join(', ')}>`;

	return makeGuard(fn, { name, id: 'tuple', tupleGuards: [...guards], restGuard: rest }, tupleHelpers);
};
