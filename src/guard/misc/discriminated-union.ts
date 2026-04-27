import { type Guard, type InferGuard, hasForbiddenKey } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

/**
 * Infers the output type of a discriminated union.
 *
 * For each key D in the variant map M, takes the inferred type of the guard
 * and intersects it with `{ [K]: D }` to add the discriminant property.
 */
export type DiscriminatedUnionType<K extends string, M extends Record<string, Guard<any>>> = {
	[D in keyof M & string]: InferGuard<M[D]> & { [key in K]: D };
}[keyof M & string];

export interface DiscriminatedUnionGuard<K extends string, M extends Record<string, Guard<any>>> extends Guard<
	DiscriminatedUnionType<K, M>,
	{},
	DiscriminatedUnionGuard<K, M>
> {}

export interface DiscriminatedUnionGuardFactory {
	<K extends string, M extends Record<string, Guard<any>>>(key: K, variants: M): DiscriminatedUnionGuard<K, M>;
}

const discriminatedUnionHelpers = {};

/**
 * Creates a Guard for a discriminated union — a union of object types that share
 * a common literal key used to distinguish variants.
 *
 * Unlike `is.union()` which tries every variant (O(n)), `is.discriminatedUnion()`
 * reads the discriminant key and jumps directly to the matching variant in O(1).
 * This also enables clearer error messages: failing due to a missing key,
 * an unknown discriminant value, or an invalid variant shape are all distinct cases.
 *
 * @param key - The name of the discriminant property present on all variants.
 * @param variants - A record mapping each discriminant value to its object guard.
 *
 * @example
 * ```ts
 * const ShapeGuard = is.discriminatedUnion('kind', {
 *   circle: is.object({ radius: is.number }),
 *   square: is.object({ side: is.number }),
 *   rectangle: is.object({ width: is.number, height: is.number }),
 * });
 *
 * ShapeGuard({ kind: 'circle', radius: 5 });        // true
 * ShapeGuard({ kind: 'square', side: 10 });          // true
 * ShapeGuard({ kind: 'triangle', base: 3 });         // false — unknown variant
 * ShapeGuard({ radius: 5 });                         // false — missing discriminant
 * ShapeGuard({ kind: 'circle', radius: 'big' });     // false — invalid variant shape
 *
 * type Shape = InferGuard<typeof ShapeGuard>;
 * // { kind: 'circle'; radius: number }
 * // | { kind: 'square'; side: number }
 * // | { kind: 'rectangle'; width: number; height: number }
 * ```
 *
 * @example
 * ```ts
 * // Works with .parse() for detailed error info
 * const result = ShapeGuard.parse({ kind: 'circle', radius: 'big' });
 * // Err: "Value ... failed validation for discriminatedUnion<kind: circle | square | rectangle>"
 * ```
 */
export const DiscriminatedUnionGuardFactory: DiscriminatedUnionGuardFactory = <
	K extends string,
	M extends Record<string, Guard<any>>,
>(
	key: K,
	variants: M
) => {
	const variantKeys = Object.keys(variants);
	const variantMap = new Map<string, Guard<any>>(variantKeys.map(k => [k, variants[k]!]));

	const fn = (value: unknown): value is DiscriminatedUnionType<K, M> => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
		if (hasForbiddenKey(value)) return false;
		const discriminant = (value as Record<string, unknown>)[key];
		if (typeof discriminant !== 'string' && typeof discriminant !== 'number') return false;
		const guard = variantMap.get(String(discriminant));
		if (!guard) return false;
		return guard(value);
	};

	return makeGuard(
		fn,
		{
			name: `discriminatedUnion<${key}: ${variantKeys.join(' | ')}>`,
			id: 'discriminatedUnion',

			// referenced by error messages
			values: new Set(variantKeys),

			// for json schema
			discriminantKey: key,
			variantMap: variants,
		},
		discriminatedUnionHelpers
	);
};
