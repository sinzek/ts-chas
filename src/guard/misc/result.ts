/**
 * Guards for the `Result<T, E>` type.
 *
 * `is.result` validates that a value is a Result (Ok or Err).
 * Chainable helpers let you narrow further into `.ok` or `.err` variants,
 * and optionally validate the inner value or error type.
 *
 * @example
 * ```ts
 * is.result(ok(42));          // true
 * is.result(err('fail'));     // true
 * is.result({ ok: true });   // false (not a real Result instance)
 *
 * is.result.ok(ok(42));      // true
 * is.result.ok(err('fail')); // false
 *
 * // Narrow the inner value type
 * is.result.okOf(is.number)(ok(42));     // true
 * is.result.okOf(is.string)(ok(42));     // false
 * is.result.errOf(is.string)(err('x'));  // true
 * ```
 */

import { type Result, type Ok, type Err } from '../../result.js';
import { makeGuard, transformer, type Guard } from '../shared.js';

function isResultValue(v: unknown): v is Result<unknown, unknown> {
	return (
		v !== null &&
		typeof v === 'object' &&
		'ok' in v &&
		typeof (v as any).isOk === 'function' &&
		typeof (v as any).isErr === 'function'
	);
}

export interface ResultHelpers<T = unknown, E = unknown> {
	/**
	 * Validates that the value is an `Ok` Result.
	 *
	 * @example
	 * ```ts
	 * is.result.ok(ok(42));      // true
	 * is.result.ok(err('fail')); // false
	 * ```
	 */
	ok: Guard<Ok<T> & Result<T, never>>;

	/**
	 * Validates that the value is an `Err` Result.
	 *
	 * @example
	 * ```ts
	 * is.result.err(err('fail')); // true
	 * is.result.err(ok(42));      // false
	 * ```
	 */
	err: Guard<Err<E> & Result<never, E>>;
}

const resultHelpers: ResultHelpers = {
	ok: transformer(
		<T, E>(target: Guard<Result<T, E>, Record<string, any>>, innerGuard?: Guard<T, Record<string, any>>) => ({
			fn: (v: unknown): v is Ok<T> & Result<T, never> =>
				target(v) && v.ok === true && (innerGuard ? innerGuard(v.value) : true),
			meta: { name: `result.ok<${innerGuard?.meta.name ?? 'unknown'}>`, id: 'result' },
			replaceHelpers: true,
		})
	) as any,

	err: transformer(
		<T, E>(target: Guard<Result<T, E>, Record<string, any>>, innerGuard?: Guard<E, Record<string, any>>) => ({
			fn: (v: unknown): v is Err<E> & Result<never, E> =>
				target(v) && v.ok === false && (innerGuard ? innerGuard(v.error) : true),
			meta: { name: `result.err<${innerGuard?.meta.name ?? 'unknown'}>`, id: 'result' },
			replaceHelpers: true,
		})
	) as any,
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ResultGuardFactory {
	<T = unknown, E = unknown>(): Guard<Result<T, E>, ResultHelpers<T, E>>;
	<T = unknown, E = unknown>(
		okGuard?: Guard<T, Record<string, any>>,
		errGuard?: Guard<E, Record<string, any>>
	): Guard<Result<T, E>, ResultHelpers<T, E>>;
}

export const ResultGuardFactory: ResultGuardFactory = (
	okGuard?: Guard<any, Record<string, any>>,
	errGuard?: Guard<any, Record<string, any>>
) =>
	makeGuard(
		<T, E>(v: unknown): v is Result<T, E> => {
			if (!isResultValue(v)) return false;
			if (okGuard && v.isOk() && !okGuard(v.value)) return false;
			if (errGuard && v.isErr() && !errGuard(v.error)) return false;
			return true;
		},
		{ name: 'result', id: 'result' },
		resultHelpers as any
	);
