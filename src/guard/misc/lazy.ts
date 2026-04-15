import { makeGuard, type Guard, type InferGuard } from '../shared.js';

export type LazyGuard<T> = Guard<T>;

export interface LazyGuardFactory {
	<G extends Guard<any>>(fn: () => G): LazyGuard<InferGuard<G>>;
}

/**
 * Creates a lazily-evaluated guard by deferring resolution until the first call.
 *
 * This is the only way to create guards for recursive or mutually-recursive types.
 * The thunk `fn` is called at most once and the result is cached.
 *
 * @param fn - A zero-argument function that returns the guard to delegate to.
 * @returns A guard that resolves and delegates to the inner guard on first use.
 *
 * @example
 * ```ts
 * // Recursive tree node
 * type Node = { value: number; children: Node[] };
 *
 * const NodeGuard: Guard<Node> = is.object({
 *   value: is.number,
 *   children: is.lazy(() => is.array(NodeGuard)),
 * });
 *
 * NodeGuard({ value: 1, children: [{ value: 2, children: [] }] }); // true
 * NodeGuard({ value: 1, children: [{ value: 2, children: [1] }] }); // false
 * ```
 *
 * @example
 * ```ts
 * // Mutually recursive types
 * type Category = { name: string; subcategories: Category[] };
 *
 * const CategoryGuard: Guard<Category> = is.object({
 *   name: is.string,
 *   subcategories: is.lazy(() => is.array(CategoryGuard)),
 * });
 * ```
 */
export const LazyGuardFactory: LazyGuardFactory = <G extends Guard<any>>(fn: () => G) => {
	let resolved: G | undefined;

	const resolve = (): G => {
		if (!resolved) resolved = fn();
		return resolved;
	};

	const predicate = (value: unknown): value is InferGuard<G> =>
		(resolve() as (v: unknown) => v is InferGuard<G>)(value);

	return makeGuard(predicate, { name: 'lazy', id: 'lazy' });
};
