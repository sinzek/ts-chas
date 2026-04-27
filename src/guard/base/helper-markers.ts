// The proxy uses these symbols to decide how to compose each helper with the
// parent guard. There are five categories:
//
// 1. **Value helper** (no symbol): a bare predicate `(v) => boolean`. The proxy
//    AND-composes it with the parent: `target(v) && helper(v)`.
//    Example: `nonEmpty`, `email`, `positive`.
//
// 2. **Factory** (`FACTORY`): a function that takes arguments and returns a
//    predicate. The proxy calls `helper(...args)` first, then AND-composes the
//    result with the parent.
//    Example: `min(5)`, `gt(10)`, `regex(/foo/)`.
//
// 3. **Transformer** (`TRANSFORMER`): receives the current guard and returns a
//    `TransformerResult` that can replace the predicate, metadata, helpers, and
//    transformation pipeline. The most powerful helper type.
//    Example: `trim()`, `partial()`, `brand('Email')`.
//
// 4. **Terminal** (`TERMINAL`): receives the current guard plus user args and
//    returns a non-guard value, ending the chain.
//    Example: `parse(value)`, `assert(value)`.
//
// 5. **Property** (`PROPERTY`): wraps a transformer so it executes on property
//    access without needing `()`. Must be combined with `transformer`.
//    Example: `.nullable`, `.optional`, `.strict`.

import type { Guard, GuardMeta } from './shared.js';

/** @internal Symbol that marks a helper as a factory. */
export const FACTORY = Symbol('factory');
/** @internal Symbol that marks a helper as a transformer. */
export const TRANSFORMER = Symbol('transformer');
/** @internal Symbol that marks a helper as a terminal. */
export const TERMINAL = Symbol('terminal');
/** @internal Symbol that marks a helper as a property-style access. */
export const PROPERTY = Symbol('property');

// ---------------------------------------------------------------------------
// Helper authoring utilities
// ---------------------------------------------------------------------------

/**
 * Creates a **factory helper**: a function that accepts arguments and returns
 * a predicate. The proxy calls the factory with the user's args, then
 * AND-composes the resulting predicate with the parent guard.
 *
 * Use this for parameterized refinements where the user supplies thresholds,
 * patterns, or other configuration.
 *
 * @param fn - A function that takes user arguments and returns a predicate `(value) => boolean`.
 * @returns A factory-marked function that the proxy recognizes and composes correctly.
 *
 * @example
 * ```ts
 * import { factory } from 'ts-chas/guard';
 *
 * const min = factory((n: number) => (v: number) => v >= n);
 * const max = factory((n: number) => (v: number) => v <= n);
 * const between = factory((lo: number, hi: number) => (v: number) => v >= lo && v <= hi);
 *
 * const numberHelpers = { min, max, between };
 * ```
 */
export function factory<Args extends any[], R extends (value: any) => boolean, H extends Record<string, any> = {}>(
	fn: (...args: Args) => R
): ((...args: Args) => Guard<any, H>) & { [FACTORY]: true } {
	return Object.assign(fn, { [FACTORY]: true as const }) as any;
}

/**
 * The object returned by a transformer's callback function.
 *
 * Controls what the new guard looks like after the transformation:
 * its predicate, metadata, helpers, transformation pipeline, and
 * whether helpers are merged or replaced.
 *
 * @typeParam T - The output type of the new guard.
 * @typeParam H - The helper type for the new guard.
 */
export interface TransformerResult<T, H> {
	/**
	 * The new type predicate for this guard.
	 * Replaces the parent guard's predicate entirely.
	 */
	fn: (v: unknown) => v is T;
	/**
	 * Metadata fields to merge into the parent's metadata.
	 * At minimum, you should set `name` to reflect the new chain step.
	 */
	meta: Partial<GuardMeta>;
	/**
	 * New helpers to attach to the guard.
	 *
	 * By default, these are **merged** with the parent's helpers, so existing
	 * chain methods remain available. Set `replaceHelpers: true` to discard
	 * the parent's helpers entirely (useful when the output type changes).
	 */
	helpers?: H;
	/**
	 * A value transformation applied during `.parse()` and `.assert()`.
	 *
	 * Transformations compose sequentially: if the parent already has a transform,
	 * `createProxy` chains them so the parent's transform runs first, then this one.
	 *
	 * @param v - The value (after any prior transforms in the chain).
	 * @param original - The original raw input, preserved across the entire chain.
	 *
	 * @example
	 * ```ts
	 * is.string.trim().toLowerCase().email
	 * // Chain order:
	 * // 1. Validate that the value is a string
	 * // 2. Trim the value
	 * // 3. Convert to lowercase
	 * // 4. Validate that the result is an email
	 * ```
	 */
	transform?: ((v: any, original: any) => any) | undefined;
	/**
	 * If `true`, `helpers` completely replaces the current helper context
	 * instead of merging with it.
	 *
	 * Use `true` when the output type changes and the parent's helpers no longer apply
	 * (e.g. `string.transform(s => s.length)` produces a number, not a string).
	 *
	 * Use `false` or omit when the type stays the same and parent helpers should remain
	 * (e.g. `string.trim()` is still a string).
	 */
	replaceHelpers?: boolean;
}

/**
 * Creates a **transformer helper**: receives the current guard and returns a
 * {@link TransformerResult} that can replace the guard's predicate, metadata,
 * helpers, and transformation pipeline.
 *
 * This is the most powerful helper type. Use it when you need to:
 * - Change the guard's validation logic (new `fn`)
 * - Modify or replace the guard's type (new `fn` with different type predicate)
 * - Add, merge, or replace helpers (via `helpers` and `replaceHelpers`)
 * - Insert a value transformation into the pipeline (via `transform`)
 *
 * The proxy automatically passes the current guard as the first argument to your callback.
 * Any additional arguments come from the user's call site.
 *
 * @param fn - Receives `(target, ...userArgs)` and returns a `TransformerResult`.
 * @returns A transformer-marked function the proxy recognizes and applies correctly.
 *
 * @example
 * ```ts
 * import { transformer } from 'ts-chas/guard';
 *
 * // A transformer that clamps a number to a range
 * const clamp = transformer((target, min: number, max: number) => ({
 *   fn: (v: unknown): v is number => target(v),
 *   meta: { name: `${target.meta.name}.clamp(${min}, ${max})` },
 *   transform: (v: number) => Math.min(max, Math.max(min, v)),
 * }));
 *
 * // A transformer that changes the output type (drops helpers)
 * const toLength = transformer((target) => ({
 *   fn: (v: unknown): v is number => target(v),
 *   meta: { name: `${target.meta.name}.toLength` },
 *   transform: (v: string) => v.length,
 *   helpers: {},
 *   replaceHelpers: true,
 * }));
 * ```
 */
export function transformer<
	CurGuardType,
	NewGuardType,
	FactoryArgs extends any[],
	NewHelpers extends Record<string, any> = {},
>(
	fn: (
		target: Guard<CurGuardType, Record<string, any>>,
		...args: FactoryArgs
	) => TransformerResult<NewGuardType, NewHelpers>
): ((...args: FactoryArgs) => Guard<NewGuardType, NewHelpers>) & { [TRANSFORMER]: true } {
	return Object.assign(fn, { [TRANSFORMER]: true as const }) as any;
}

/**
 * Creates a **terminal helper**: receives the current guard plus user arguments
 * and returns a non-guard value, ending the chain.
 *
 * Use this for operations that produce a final result rather than another guard,
 * such as parsing, assertion, or serialization.
 *
 * The proxy passes the current guard as the first argument. Any additional
 * arguments come from the user's call site.
 *
 * @param fn - Receives `(target, ...userArgs)` and returns any value.
 * @returns A terminal-marked function the proxy recognizes.
 *
 * @example
 * ```ts
 * import { terminal } from 'ts-chas/guard';
 *
 * // A terminal that returns the guard's JSON schema representation
 * const toJsonSchema = terminal((target) => ({
 *   type: target.meta.id,
 *   description: target.meta.name,
 * }));
 *
 * const helpers = { toJsonSchema };
 * // Usage: is.string.email.toJsonSchema() => { type: 'string', description: 'string.email' }
 * ```
 */
export function terminal<F extends (...args: any[]) => any>(fn: F): F & { [TERMINAL]: true } {
	return Object.assign(fn, { [TERMINAL]: true as const }) as any;
}

/**
 * Wraps a transformer so it executes on property access instead of requiring `()`.
 *
 * This is syntactic sugar for zero-argument transformers. The proxy detects the
 * `PROPERTY` symbol and invokes the transformer immediately when the property
 * is accessed, rather than returning a function that waits to be called.
 *
 * Must wrap a `transformer()`. Combining with other helper types is not supported.
 *
 * @param fn - A transformer (created via `transformer()`) that takes no user arguments.
 * @returns A property-marked transformer the proxy auto-invokes on access.
 *
 * @example
 * ```ts
 * import { property, transformer } from 'ts-chas/guard';
 *
 * const strict = property(
 *   transformer((target) => ({
 *     fn: (v: unknown): v is any => {
 *       if (!target(v)) return false;
 *       const schema = target.meta.shape;
 *       if (!schema) return true;
 *       return Object.keys(v as object).every(k => k in schema);
 *     },
 *     meta: { name: `${target.meta.name}.strict` },
 *   }))
 * );
 *
 * const helpers = { strict };
 * // Usage: is.object({ name: is.string }).strict  (no parentheses)
 * ```
 */
export function property<F extends (...args: any[]) => any>(fn: F): F & { [PROPERTY]: true } {
	return Object.assign(fn, { [PROPERTY]: true as const }) as any;
}
