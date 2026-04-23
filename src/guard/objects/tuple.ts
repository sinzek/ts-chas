import { makeGuard, type Guard, type InferGuard, arrayHelpers } from '../shared.js';

type Mutable<T extends readonly any[]> = [...T];

export type TupleGuard<G extends readonly any[]> = Guard<
	Mutable<{ [K in keyof G]: InferGuard<G[K]> }>,
	TupleHelpers<Mutable<{ [K in keyof G]: InferGuard<G[K]> }>>
>;

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
	<G extends readonly Guard<any, Record<string, any>>[]>(guards: [...G]): TupleGuard<G>;

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
	<G extends readonly Guard<any, Record<string, any>>[], R extends Guard<any, Record<string, any>>>(
		guards: [...G],
		rest: R
	): Guard<
		[...{ [K in keyof G]: InferGuard<G[K]> }, ...InferGuard<R>[]],
		TupleHelpers<[...{ [K in keyof G]: InferGuard<G[K]> }, ...InferGuard<R>[]]>
	>;
}

export interface TupleHelpers<T extends readonly any[]> {
	/** Validates that the tuple is non-empty. */
	nonEmpty: Guard<T, TupleHelpers<T>>;
	/** Validates that all elements in the tuple are unique (deep equality). */
	unique: Guard<T, TupleHelpers<T>>;
	/** Validates that the tuple length is at least `n`. */
	min: (n: number) => Guard<T, TupleHelpers<T>>;
	/** Validates that the tuple length is at most `n`. */
	max: (n: number) => Guard<T, TupleHelpers<T>>;
	/** Validates that the tuple length is exactly `n`. */
	size: (n: number) => Guard<T, TupleHelpers<T>>;
	/** Validates that the tuple contains a specific value. */
	includes: (item: T[number]) => Guard<T, TupleHelpers<T>>;
	/** Validates that the tuple does not contain a specific value. */
	excludes: (item: T[number]) => Guard<T, TupleHelpers<T>>;
	/** Wraps the tuple in `Object.freeze()` during validation. Since tuples are already readonly, this is not strictly necessary but is included for consistency with other collection guards. */
	readonly: Guard<Readonly<T>, TupleHelpers<T>>;
}

export const tupleHelpers: TupleHelpers<any> = arrayHelpers as any;

export const TupleGuardFactory: TupleGuardFactory = (
	guards: readonly Guard<any, Record<string, any>>[],
	rest?: Guard<any, Record<string, any>>
) => {
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
