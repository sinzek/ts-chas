/**
 * Guards for the `Result<T, E>` type.
 *
 * `is.result` is a factory that creates a Guard for Result values.
 * Call `is.result()` for unnarrowed validation, or pass inner guards
 * to validate the Ok value and Err error types.
 *
 * @example
 * ```ts
 * is.result()(ok(42));              // true
 * is.result()(err('fail'));         // true
 * is.result()('not a result');      // false
 *
 * // Narrowed by inner types
 * is.result(is.number, is.string)(ok(42));     // true
 * is.result(is.number, is.string)(ok('nope')); // false
 *
 * // Ok/Err variant narrowing
 * is.result().ok()(ok(42));                 // true
 * is.result().ok(is.number)(ok(42));        // true (Ok<number>)
 * is.result().err(is.string)(err('fail'));  // true (Err<string>)
 * ```
 */

import { type Result } from '../../result/result.js';
import type { Err, Ok } from '../../result/shared.js';
import { makeGuard, transformer, type Guard, type InferGuard } from '../shared.js';

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
	 * Narrows to the `Ok` variant. Call with no arguments for an unnarrowed Ok guard,
	 * or pass an inner guard to validate the Ok value type.
	 *
	 * @example
	 * ```ts
	 * is.result().ok()(ok(42));            // true (any Ok)
	 * is.result().ok()(err('fail'));        // false
	 * is.result().ok(is.number)(ok(42));    // true (Ok<number>)
	 * is.result().ok(is.string)(ok(42));    // false
	 * ```
	 */
	ok: {
		(): Guard<Ok<T> & Result<T, never>>;
		<G extends Guard<any, any>>(innerGuard: G): Guard<Ok<InferGuard<G>> & Result<InferGuard<G>, never>>;
	};

	/**
	 * Narrows to the `Err` variant. Call with no arguments for an unnarrowed Err guard,
	 * or pass an inner guard to validate the Err error type.
	 *
	 * @example
	 * ```ts
	 * is.result().err()(err('fail'));          // true (any Err)
	 * is.result().err()(ok(42));               // false
	 * is.result().err(is.string)(err('fail')); // true (Err<string>)
	 * is.result().err(is.number)(err('fail')); // false
	 * ```
	 */
	err: {
		(): Guard<Err<E> & Result<never, E>>;
		<G extends Guard<any, any>>(innerGuard: G): Guard<Err<InferGuard<G>> & Result<never, InferGuard<G>>>;
	};
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

export interface ResultGuardFactory {
	/** Creates an unnarrowed Result guard. */
	(): Guard<Result<unknown, unknown>, ResultHelpers>;
	/** Creates a Result guard narrowed by Ok value and Err error types. */
	<OkG extends Guard<any, any>, ErrG extends Guard<any, any>>(
		okGuard: OkG,
		errGuard: ErrG
	): Guard<Result<InferGuard<OkG>, InferGuard<ErrG>>, ResultHelpers<InferGuard<OkG>, InferGuard<ErrG>>>;
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
