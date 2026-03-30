/**
 * A successful result.
 *
 * ```ts
 * import { chas } from './index.js';
 *
 * const x: chas.Ok<number> = { ok: true, value: 1 };
 * ```
 */
export type Ok<T> = {
	readonly ok: true;
	readonly value: T;
};

/**
 * An error result.
 *
 * ```ts
 * import { chas } from './index.js';
 *
 * const x: chas.Err<string> = { ok: false, error: 'error' };
 * ```
 */
export type Err<E> = {
	readonly ok: false;
	readonly error: E;
};

/**
 * Helper to safely extract the error type from a union of Results.
 */
export type UnwrapErr<U> = U extends { ok: false; error: infer E }
	? E
	: U extends PromiseLike<infer R>
		? R extends { ok: false; error: infer E }
			? E
			: never
		: never;

/**
 * Distributes over a union to safely extract the value from an `Ok` branch
 */
export type ExtractOkValue<T> = T extends { ok: true; value: infer U } ? U : never;

/**
 * Distributes over a union to safely extract the error from an `Err` branch
 */
export type ExtractErrError<T> = T extends { ok: false; error: infer E } ? E : never;
