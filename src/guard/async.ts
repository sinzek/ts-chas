import { ok, ResultAsync, type Result } from '../result/result.js';
import { GlobalErrs } from '../tagged-errs.js';
import type { Guard, GuardMeta, GuardErr } from './shared.js';
import { buildGuardErrMsg, evaluateError, evaluateFallback, getType } from './shared.js';

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

	async #run(value: unknown, errMsg?: string): Promise<Result<T, GuardErr>> {
		const predicate = this.#syncGuard as unknown as (v: unknown) => boolean;
		const meta = this.#syncGuard.meta;

		// 1. Sync predicate — mirrors the inline parse terminal logic
		if (!predicate(value)) {
			if ('fallback' in meta) {
				return ok(evaluateFallback(meta.fallback, meta, value) as T);
			}
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
