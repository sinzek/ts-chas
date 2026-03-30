/**
 * Guard factory for tagged errors created by `defineErrs`.
 *
 * `is.tagged` accepts either an error factory (from `defineErrs`), a plain
 * string tag, or the entire error factories object to create a union guard.
 *
 * @example
 * ```ts
 * const AppError = defineErrs({
 *   NotFound: (resource: string, id: string) => ({ resource, id }),
 *   Generic: (message: string) => ({ message }),
 * });
 *
 * // Using an error factory — full type narrowing
 * is.tagged(AppError.NotFound)(AppError.NotFound('user', '1')); // true
 * // value is typed as TaggedErr & { _tag: 'NotFound', resource: string, id: string }
 *
 * // Using a string tag — narrows to TaggedErr & { _tag: Tag }
 * is.tagged('NotFound')(AppError.NotFound('user', '1')); // true
 * // value is typed as TaggedErr & { _tag: 'NotFound' }
 *
 * // Using the full factories object — union of all error types
 * is.tagged(AppError)(someErr); // true if any variant matches
 * // value is typed as NotFoundErr | GenericErr
 * ```
 */

import type { TaggedErr } from '../../tagged-errs.js';
import { makeGuard, type Guard, type InferGuard } from '../shared.js';

/**
 * Identifies a single error factory produced by `defineErrs`.
 * Any object with an `.is()` type guard qualifies.
 */
type ErrorFactory<T = any> = { is: (err: unknown) => err is T };

/** Extracts a single error type from a factory. */
type InferFactory<T extends ErrorFactory> = T['is'] extends (err: unknown) => err is infer U ? U : never;

/** Extracts the union of all error types from an error factories object. */
type InferFactoriesUnion<T extends Record<string, ErrorFactory>> = T[keyof T] extends infer F
	? F extends ErrorFactory
		? InferFactory<F>
		: never
	: never;

export interface TaggedErrGuardFactory {
	/**
	 * Creates a guard using a single error factory from `defineErrs`.
	 * The returned guard narrows to the full factory return type (with custom properties).
	 *
	 * @example
	 * ```ts
	 * if (is.tagged(AppError.NotFound)(value)) {
	 *   value.resource; // string — fully typed
	 *   value.id;       // string
	 * }
	 * ```
	 */
	<T extends ErrorFactory>(factory: T): Guard<InferGuard<T['is']>>;

	/**
	 * Creates a guard from the full error factories object (from `defineErrs`).
	 * The returned guard matches any variant and narrows to their union type.
	 *
	 * @example
	 * ```ts
	 * const guard = is.tagged(AppError);
	 * if (guard(value)) {
	 *   value._tag; // 'NotFound' | 'Generic'
	 * }
	 * ```
	 */
	<T extends Record<string, ErrorFactory>>(factories: T): Guard<InferFactoriesUnion<T>>;

	/**
	 * Creates a guard using a string tag.
	 * The returned guard narrows to `TaggedErr & { readonly _tag: Tag }`.
	 *
	 * @example
	 * ```ts
	 * if (is.tagged('NotFound')(value)) {
	 *   value._tag; // 'NotFound'
	 * }
	 * ```
	 */
	<Tag extends string>(tag: Tag): Guard<TaggedErr & { readonly _tag: Tag }>;
}

export const TaggedErrGuardFactory: TaggedErrGuardFactory = (
	tagOrFactory: string | ErrorFactory | Record<string, ErrorFactory>
) => {
	// String tag
	if (typeof tagOrFactory === 'string') {
		return makeGuard(
			(v: unknown): v is any => !!v && typeof v === 'object' && '_tag' in v && v._tag === tagOrFactory,
			{ name: `tagged(${tagOrFactory})`, id: 'tagged' }
		);
	}

	// Single factory — has .is() directly as a type guard function
	if ('is' in tagOrFactory && typeof (tagOrFactory as ErrorFactory).is === 'function') {
		const factory = tagOrFactory as ErrorFactory;
		return makeGuard(
			(v: unknown): v is any => !!factory.is(v),
			{ name: `tagged(factory)`, id: 'tagged' }
		);
	}

	// Factories map — check all variants
	const map = tagOrFactory as Record<string, ErrorFactory>;
	const factories = Object.values(map);
	const tags = Object.keys(map);
	return makeGuard(
		(v: unknown): v is any => factories.some((f) => !!f.is(v)),
		{ name: `tagged(${tags.join(' | ')})`, id: 'tagged' }
	);
};
