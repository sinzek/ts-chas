import { ok, err, ResultAsync, type Result } from '../result/result.js';
import { GlobalErrs } from '../tagged-errs.js';
import type { Guard, GuardMeta, GuardErr } from './base/shared.js';
import {
	buildGuardErr,
	buildGuardErrMsg,
	evaluateDefault,
	evaluateError,
	evaluateFallback,
	getType,
} from './base/shared.js';

// ---------------------------------------------------------------------------
// Internal step types
// ---------------------------------------------------------------------------

type AsyncStep =
	| { kind: 'predicate'; fn: (v: unknown) => Promise<boolean> }
	| { kind: 'transform'; fn: (v: unknown) => Promise<unknown> };

// ---------------------------------------------------------------------------
// AsyncGuard<T>
// ---------------------------------------------------------------------------

/**
 * A guard that accumulates async predicates and transforms on top of a sync guard.
 *
 * Constructed by calling `.whereAsync()`, `.refineAsync()`, or `.transformAsync()`
 * on any `Guard<T>`. Sync helpers cannot be chained after entering async mode —
 * add them to the sync guard first.
 *
 * ### Composition rules
 *
 * 1. **Sync-first.** Build up any sync helpers (`.email`, `.min`, `.where`, etc.)
 *    on the base guard before calling `.whereAsync`/`.refineAsync`/`.transformAsync`.
 *    Once you have an `AsyncGuard<T>`, you can only chain other async steps.
 * 2. **Order is preserved.** Async steps run sequentially in declaration order
 *    against the value returned by the previous step, so later steps may depend
 *    on earlier `refineAsync`/`transformAsync` output.
 * 3. **Fail-fast.** Sync validation runs first; if it fails, no async steps run.
 *    The first failing async predicate short-circuits the chain with a `GuardErr`.
 * 4. **Type narrowing.** `transformAsync<U>` changes the guard's type parameter;
 *    `refineAsync` preserves it. `whereAsync` is a pure predicate (no rewrite).
 * 5. **Not composable with union/intersection.** `AsyncGuard` is a terminal shape —
 *    it cannot be passed to `is.union`, `is.object`, or used as a tuple element.
 *    Compose at the sync layer, then go async once, at the edge of validation.
 *
 * @example
 * ```ts
 * const UniqueEmail = is.string.email.whereAsync(async v => {
 *   return !(await db.users.exists({ email: v }));
 * });
 *
 * UniqueEmail.parseAsync(input)  // ResultAsync<string, GuardErr>
 *   .andThen(email => sendVerification(email))
 *   .match({ ok: () => 'sent', err: e => e.message });
 * ```
 */
export class AsyncGuard<T> {
	readonly #syncGuard: Guard<any>;
	readonly #steps: ReadonlyArray<AsyncStep>;

	constructor(syncGuard: Guard<any>, steps: ReadonlyArray<AsyncStep>) {
		this.#syncGuard = syncGuard;
		this.#steps = steps;
	}

	get meta(): GuardMeta {
		return this.#syncGuard.meta;
	}

	/**
	 * Appends an async predicate check. Resolving `false` fails validation.
	 */
	whereAsync(fn: (value: T) => Promise<boolean>): AsyncGuard<T> {
		return new AsyncGuard<T>(this.#syncGuard, [
			...this.#steps,
			{ kind: 'predicate', fn: fn as (v: unknown) => Promise<boolean> },
		]);
	}

	/**
	 * Appends an async same-type transformation. The resolved value replaces
	 * the current value and is passed to subsequent steps.
	 */
	refineAsync(fn: (value: T) => Promise<T>): AsyncGuard<T> {
		return new AsyncGuard<T>(this.#syncGuard, [
			...this.#steps,
			{ kind: 'transform', fn: fn as (v: unknown) => Promise<unknown> },
		]);
	}

	/**
	 * Appends an async type-changing transformation. The resolved value becomes
	 * the new type parameter of the returned `AsyncGuard<U>`.
	 */
	transformAsync<U>(fn: (value: T) => Promise<U>): AsyncGuard<U> {
		return new AsyncGuard<U>(this.#syncGuard, [
			...this.#steps,
			{ kind: 'transform', fn: fn as (v: unknown) => Promise<unknown> },
		]);
	}

	/**
	 * Validates `value` through the sync guard then all async steps in order.
	 *
	 * Returns a `ResultAsync<T, GuardErr>` with the full monadic API
	 * (`.map()`, `.andThen()`, `.match()`, `.unwrap()`, etc.).
	 *
	 * Use `.unwrap()` on the result for throw-on-failure behaviour:
	 * ```ts
	 * const user = await guard.parseAsync(input).unwrap(); // throws GuardErr on failure
	 * ```
	 */
	parseAsync(value: unknown, errMsg?: string): ResultAsync<T, GuardErr> {
		return new ResultAsync<T, GuardErr>(this.#run(value, errMsg));
	}

	/**
	 * Validates `value` through the sync guard then all async steps in order.
	 *
	 * Resolves with the validated (and possibly transformed) value, or rejects
	 * with a `GuardErr` if any step fails.
	 *
	 * @example
	 * ```ts
	 * const email = await UniqueEmail.assertAsync(input);
	 * // throws GuardErr if sync check or async predicate fails
	 * ```
	 */
	async assertAsync(value: unknown, errMsg?: string): Promise<T> {
		const result = await this.#run(value, errMsg);
		if (result.isOk()) return result.value;
		throw result.error;
	}

	async #run(value: unknown, errMsg?: string): Promise<Result<T, GuardErr>> {
		const predicate = this.#syncGuard as unknown as (v: unknown) => boolean;
		const meta = this.#syncGuard.meta;

		// 1. Default short-circuit: if input is `undefined` and a default is set,
		//    use it without running the predicate (mirrors the sync parse terminal).
		if (value === undefined && 'default' in meta) {
			return ok(evaluateDefault(meta.default, meta) as T);
		}

		// 2. Sync predicate — mirrors the inline parse terminal logic
		if (!predicate(value)) {
			const error = buildGuardErr(this.#syncGuard, value, errMsg);
			if ('fallback' in meta) {
				return ok(evaluateFallback(meta.fallback, meta, value, error) as T);
			}
			return err(error) as unknown as Result<T, GuardErr>;
		}

		// 2. Apply sync transform, then run async steps in declaration order
		let current: unknown = meta.transform ? meta.transform(value, value) : value;
		for (const step of this.#steps) {
			if (step.kind === 'predicate') {
				if (!(await step.fn(current))) {
					const message = evaluateError(meta.error, meta, value, errMsg);
					return GlobalErrs.GuardErr.err({
						message: message ?? buildGuardErrMsg(meta, value),
						path: meta.path,
						expected: meta.id,
						actual: getType(value),
						values: meta.values,
						name: meta.name,
					}) as unknown as Result<T, GuardErr>;
				}
			} else {
				current = await step.fn(current);
			}
		}
		return ok(current as T);
	}
}
