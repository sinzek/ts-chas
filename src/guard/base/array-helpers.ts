import type { ArrayGuard } from '../objects/array.js';
import { factory, property, transformer } from './helper-markers.js';
import { JSON_SCHEMA } from './shared.js';

// defined here to allow both is.array and the universal .array helper to use them
export interface ArrayHelpers<T, Modifier extends 'readonly' | 'mutable' = 'mutable'> {
	/**
	 * Validates that the array is non-empty.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).nonEmpty;
	 * guard.parse([]); // Err('Expected non-empty array')
	 * guard.parse(['a']); // Ok(['a'])
	 * ```
	 */
	nonEmpty: ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array is empty.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).empty;
	 * guard.parse([]); // Ok([])
	 * guard.parse(['a']); // Err('Expected empty array')
	 * ```
	 */
	empty: ArrayGuard<T, Modifier>;
	/**
	 * Validates that all elements in the array are unique (deep equality).
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).unique;
	 * guard.parse(['a', 'b', 'c']); // Ok(['a', 'b', 'c'])
	 * guard.parse(['a', 'b', 'a']); // Err('Expected unique elements')
	 * ```
	 */
	unique: ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array length is at least `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).min(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a']); // Err('Expected array of length at least 2')
	 * ```
	 */
	min: (n: number) => ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array length is at most `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).max(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a', 'b', 'c']); // Err('Expected array of length at most 2')
	 * ```
	 */
	max: (n: number) => ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array length is exactly `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).size(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a']); // Err('Expected array of length 2')
	 * ```
	 */
	size: (n: number) => ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array contains a specific value.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).includes('a');
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['b', 'c']); // Err('Expected array to include "a"')
	 * ```
	 */
	includes: (item: T) => ArrayGuard<T, Modifier>;
	/**
	 * Validates that the array does not contain a specific value.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).excludes('a');
	 * guard.parse(['b', 'c']); // Ok(['b', 'c'])
	 * guard.parse(['a', 'b']); // Err('Expected array to not include "a"')
	 * ```
	 */
	excludes: (item: T) => ArrayGuard<T, Modifier>;
	/**
	 * Wraps the array in `Object.freeze()` during validation, returning a readonly array when parsed. Since arrays are already readonly, this is not strictly necessary but is included for consistency with other collection guards.
	 *
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).readonly;
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a', 'b']); // Err('Expected array of length 2')
	 * ```
	 */
	readonly: ArrayGuard<T, 'readonly'>;
}

export const arrayHelpers: ArrayHelpers<any> = {
	nonEmpty: ((v: unknown) => Array.isArray(v) && v.length > 0) as any,
	empty: ((v: unknown) => Array.isArray(v) && v.length === 0) as any,
	unique: ((v: unknown) => Array.isArray(v) && new Set(v as any[]).size === (v as any[]).length) as any,
	min: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length >= n
	),
	max: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length <= n
	),
	size: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length === n
	),
	includes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && v.includes(item)
	),
	excludes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && !v.includes(item)
	),
	readonly: property(
		transformer(target => ({
			fn: (v: unknown): v is any => target(Object.freeze(v)),
			meta: { name: `${target.meta.name}.readonly` },
		})) as any
	),
};

// JSON Schema contributions for array helpers
(arrayHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minItems: 1 });
(arrayHelpers.empty as any)[JSON_SCHEMA] = () => ({ minItems: 0, maxItems: 0 });
(arrayHelpers.unique as any)[JSON_SCHEMA] = () => ({ uniqueItems: true });
(arrayHelpers.min as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n });
(arrayHelpers.max as any)[JSON_SCHEMA] = (n: number) => ({ maxItems: n });
(arrayHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n, maxItems: n });
(arrayHelpers.includes as any)[JSON_SCHEMA] = (item: unknown) => ({ _arrayIncludes: item });
(arrayHelpers.excludes as any)[JSON_SCHEMA] = (item: unknown) => ({ _arrayExcludes: item });
