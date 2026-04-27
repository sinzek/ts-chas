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

import { isResult, type Result } from '../../result/result.js';
import type { Err, Ok } from '../../result/shared.js';
import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { transformer } from '../base/helper-markers.js';

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
		(): OkGuard<T>;
		<G extends Guard<any, any, any>>(innerGuard: G): OkGuard<InferGuard<G>>;
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
		(): ErrGuard<E>;
		<G extends Guard<any, any, any>>(innerGuard: G): ErrGuard<InferGuard<G>>;
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
	(): ResultGuard<unknown, unknown>;
	/** Creates a Result guard narrowed by Ok value and Err error types. */
	<OkG extends Guard<any, any, any>, ErrG extends Guard<any, any, any>>(
		okGuard: OkG,
		errGuard: ErrG
	): ResultGuard<InferGuard<OkG>, InferGuard<ErrG>>;
}

export interface ResultGuard<T, E> extends Guard<Result<T, E>, ResultHelpers<T, E>, ResultGuard<T, E>> {}
export interface OkGuard<T> extends Guard<Ok<T> & ResultHelpers<T, never>, {}, OkGuard<T>> {}
export interface ErrGuard<E> extends Guard<Err<E> & ResultHelpers<never, E>, {}, ErrGuard<E>> {}

export const ResultGuardFactory: ResultGuardFactory = (
	okGuard?: Guard<any, Record<string, any>>,
	errGuard?: Guard<any, Record<string, any>>
) =>
	makeGuard(
		<T, E>(v: unknown): v is Result<T, E> => {
			if (!isResult(v)) return false;
			if (okGuard && v.isOk() && !okGuard(v.value)) return false;
			if (errGuard && v.isErr() && !errGuard(v.error)) return false;
			return true;
		},
		{ name: 'result', id: 'result' },
		resultHelpers as any
	);
