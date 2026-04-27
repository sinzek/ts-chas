import { err, ok } from '../../result/result.js';
import type { StandardSchemaV1 } from '../../standard-schema.js';
import { GlobalErrs } from '../../tagged-errs.js';
import { safeStringify, type Prettify } from '../../utils.js';
import { FACTORY, PROPERTY, TERMINAL, TRANSFORMER } from './helper-markers.js';
import {
	buildGuardErr,
	evaluateDefault,
	evaluateFallback,
	JSON_SCHEMA,
	type Guard,
	type GuardMeta,
	type JsonSchemaNode,
} from './shared.js';
import { universalHelpers } from './universal-helpers.js';

/**
 * Creates a new guard from a type predicate, metadata, and optional chainable helpers.
 *
 * This is the low-level constructor for guards. Use it to build custom guards
 * that go beyond what the built-in `is.*` guards offer, such as domain-specific
 * types with their own helper chains.
 *
 * The returned guard is wrapped in a `Proxy` that provides all universal methods
 * (`.parse()`, `.assert()`, `.where()`, `.transform()`, etc.) and surfaces any
 * helpers you pass in as chainable properties.
 *
 * Every chain step returns a new guard. Nothing is ever mutated.
 *
 * @typeParam T - The type this guard narrows to.
 * @typeParam H - The helpers object type (inferred from `helpers` if provided).
 *
 * @param fn - A TypeScript type predicate function: `(value: unknown) => value is T`.
 * @param meta - Guard metadata. `name` and `id` are required; all other fields are optional.
 *   - `name`: The display name for the guard chain (appears in error messages and `.meta.name`).
 *   - `id`: A stable base-type identifier (e.g. `'money'`). Does not change when helpers are chained.
 * @param helpers - An optional object of chainable helpers. Each value can be:
 *   - A bare predicate `(v) => boolean` (value helper, AND-composed with the guard)
 *   - A `factory(...)` (parameterized predicate)
 *   - A `transformer(...)` (replaces predicate/meta/helpers/transform)
 *   - A `terminal(...)` (ends the chain, returns a non-guard value)
 *   - A `property(transformer(...))` (auto-invoked on access, no `()` needed)
 *
 * @returns A fully proxied `Guard<T, H>` with universal methods and the provided helpers.
 *
 * @example
 * ```ts
 * import { makeGuard, factory } from 'ts-chas/guard';
 *
 * // Simple guard with no helpers
 * const isFiniteNumber = makeGuard(
 *   (v: unknown): v is number => typeof v === 'number' && isFinite(v),
 *   { name: 'finiteNumber', id: 'number' },
 * );
 * isFiniteNumber.parse(42);       // Ok(42)
 * isFiniteNumber.parse(Infinity); // Err(...)
 *
 * // Guard with custom chainable helpers
 * const currencyHelpers = {
 *   positive: ((v: number) => v > 0) as (v: number) => boolean,
 *   precision: factory((decimals: number) => (v: number) =>
 *     Number(v.toFixed(decimals)) === v
 *   ),
 * };
 *
 * const isMoney = makeGuard(
 *   (v: unknown): v is number => typeof v === 'number' && isFinite(v),
 *   { name: 'money', id: 'money' },
 *   currencyHelpers,
 * );
 *
 * isMoney.positive.precision(2).parse(19.99); // Ok(19.99)
 * isMoney.positive.precision(2).parse(19.999); // Err(...)
 * ```
 */

export function makeGuard<T, H extends Record<string, any> = {}>(
	fn: (value: unknown) => value is T,
	meta: Prettify<Pick<GuardMeta, 'name' | 'id'> & Partial<GuardMeta>>,
	helpers?: H
): Guard<T, H> {
	const guard = Object.assign(fn, {
		meta: { schema: undefined, error: undefined, path: [], ...meta },
	});
	return createProxy(guard, helpers ?? {}) as Guard<T, H>;
}

/**
 * @internal
 * Wraps a guard function in a Proxy that intercepts all property access.
 * This is the single chaining mechanism — universal methods, type-specific
 * helpers, and composition all flow through here.
 */
export function createProxy<T, H extends Record<string, any>>(
	target: { (value: unknown): value is T; meta: GuardMeta },
	helpers: H
): Guard<T, H> {
	return new Proxy(target, {
		apply(_target, _thisArg, args) {
			return target(args[0]);
		},

		get(target, prop: string) {
			if (prop === '$infer') {
				throw GlobalErrs.ChasErr({
					message:
						`[ts-chas] The .$infer property is a type-level helper and cannot be accessed at runtime. ` +
						`Use it only with 'typeof' (e.g., type T = typeof guard.$infer).`,
					origin: 'infer',
				});
			}
			if (prop === 'helpers') return helpers;

			if (prop === 'meta') return target.meta;

			if (prop === '~standard') {
				return {
					version: 1,
					vendor: 'chas',
					validate: (v: unknown): StandardSchemaV1.Result<T> => {
						if (v === undefined && 'default' in target.meta) {
							return { value: evaluateDefault(target.meta.default, target.meta) as T };
						}
						if (target(v)) {
							try {
								const val = target.meta.transform ? target.meta.transform(v, v) : v;
								return { value: val as T };
							} catch (transformErr) {
								if ('fallback' in target.meta) {
									const error = buildGuardErr(target, v);
									return { value: evaluateFallback(target.meta.fallback, target.meta, v, error) as T };
								}
								throw transformErr;
							}
						}

						const error = buildGuardErr(target, v);
						if ('fallback' in target.meta) {
							return { value: evaluateFallback(target.meta.fallback, target.meta, v, error) as T };
						}
						return {
							issues: [{ message: error.message, path: error.path }],
						};
					},
				};
			}

			// Universal methods (terminal)
			if (prop === 'parse') {
				return (v: unknown) => {
					if (v === undefined && 'default' in target.meta) {
						return ok(evaluateDefault(target.meta.default, target.meta) as T);
					}
					if (target(v)) {
						try {
							return ok((target.meta.transform ? target.meta.transform(v, v) : v) as T);
						} catch (transformErr) {
							if ('fallback' in target.meta) {
								const error = buildGuardErr(target, v);
								return ok(evaluateFallback(target.meta.fallback, target.meta, v, error) as T);
							}
							throw transformErr;
						}
					}

					const error = buildGuardErr(target, v);
					if ('fallback' in target.meta) {
						return ok(evaluateFallback(target.meta.fallback, target.meta, v, error) as T);
					}
					return err(error);
				};
			}
			if (prop === 'assert') {
				return (v: unknown) => {
					if (v === undefined && 'default' in target.meta) {
						return evaluateDefault(target.meta.default, target.meta) as T;
					}
					if (target(v)) {
						try {
							return (target.meta.transform ? target.meta.transform(v, v) : v) as T;
						} catch (transformErr) {
							if ('fallback' in target.meta) {
								const error = buildGuardErr(target, v);
								return evaluateFallback(target.meta.fallback, target.meta, v, error) as T;
							}
							throw transformErr;
						}
					}

					const error = buildGuardErr(target, v);
					if ('fallback' in target.meta) {
						return evaluateFallback(target.meta.fallback, target.meta, v, error) as T;
					}
					throw error;
				};
			}

			// --- Let symbols and internal props pass through ---
			if (typeof prop === 'symbol') {
				return (target as any)[prop];
			}

			// --- Lookup helper (Universal first, then specific) ---
			const helper = helpers[prop] ?? universalHelpers[prop];
			if (!helper) {
				return (target as any)[prop];
			}

			// 1. Terminal helpers - execution ends the chain or returns a non-guard value
			if (helper[TERMINAL]) {
				return (...args: any[]) => helper(target, ...args);
			}

			// 2. Transformer helpers - these return a new Guard with modified logic/meta/type/helpers
			if (helper[TRANSFORMER]) {
				const execute = (...args: any[]) => {
					const result = helper(target, ...args);
					const next = Object.assign(result.fn, {
						meta: {
							...target.meta,
							...result.meta,
							_parent: target,
							transform: result.transform
								? (v: any, original: any) => {
										const parentVal = target.meta.transform
											? target.meta.transform(v, original)
											: v;
										const newVal = result.transform!(parentVal, original);
										return newVal;
									}
								: target.meta.transform,
						} as GuardMeta,
					});
					const nextHelpers = result.helpers
						? result.replaceHelpers
							? result.helpers
							: { ...helpers, ...result.helpers }
						: helpers;
					return createProxy(next, nextHelpers);
				};

				// If marked as a property, execute immediately with no extra args
				if (helper[PROPERTY]) {
					return execute();
				}

				return execute;
			}

			// 3. Factory helpers - these take args and return a predicate to be combined with the target
			if (helper[FACTORY]) {
				return (...args: any[]) => {
					const predicate = helper(...args);
					const jsonContrib: Partial<JsonSchemaNode> | undefined = (helper as any)[JSON_SCHEMA]
						? (helper as any)[JSON_SCHEMA](...args)
						: undefined;
					const refinementName = `${String(prop)}(${args.map(a => safeStringify(a)).join(', ')})`;
					const next = Object.assign(
						(v: unknown): v is T => {
							if (!target(v)) return false;
							const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
							return predicate(transformed);
						},
						{
							meta: {
								...target.meta,
								_parent: target,
								name: `${target.meta.name}.${refinementName}`,
								_refinements: [...(target.meta._refinements ?? []), { predicate, name: refinementName }],
								...(jsonContrib && {
									jsonSchema: { ...target.meta.jsonSchema, ...jsonContrib },
								}),
							},
						}
					);
					return createProxy(next, helpers);
				};
			}

			// 4. Value helpers — simple predicates, compose immediately
			const jsonContrib: Partial<JsonSchemaNode> | undefined = (helper as any)[JSON_SCHEMA]
				? (helper as any)[JSON_SCHEMA]()
				: undefined;
			const refinementName = String(prop);
			const next = Object.assign(
				(v: unknown): v is T => {
					if (!target(v)) return false;
					const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
					return helper(transformed);
				},
				{
					meta: {
						...target.meta,
						_parent: target,
						name: `${target.meta.name}.${refinementName}`,
						_refinements: [...(target.meta._refinements ?? []), { predicate: helper, name: refinementName }],
						...(jsonContrib && {
							jsonSchema: { ...target.meta.jsonSchema, ...jsonContrib },
						}),
					},
				}
			);
			return createProxy(next, helpers);
		},
	}) as Guard<T, H>;
}
