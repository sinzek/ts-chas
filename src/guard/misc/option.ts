/**
 * Guards for the `Option<T>` type.
 *
 * `is.option` validates that a value is an Option (Some or None).
 * Since Options are implemented as Results under the hood (`Some = Ok`, `None = Err<never>`),
 * the detection checks for Result structure plus the Option-specific `isSome`/`isNone` methods.
 *
 * @example
 * ```ts
 * is.option(some(42));     // true
 * is.option(none());       // true
 * is.option(ok(42));       // true  (Ok is structurally a Some)
 * is.option('hello');      // false
 *
 * is.option.some(some(42));   // true
 * is.option.some(none());     // false
 *
 * // Narrow the inner value type
 * is.option.someOf(is.number)(some(42));   // true
 * is.option.someOf(is.string)(some(42));   // false
 * ```
 */

import type { Option, Some, None } from '../../option.js';
import { makeGuard, factory, property, transformer, type Guard, type GuardType } from '../shared.js';

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Checks if a value is a Result-like structure (which Options are).
 * Options are Results under the hood, so this is the same structural check.
 */
function isOptionValue(v: unknown): v is Option<unknown> {
	return (
		v !== null &&
		typeof v === 'object' &&
		'ok' in v &&
		typeof (v as any).isSome === 'function' &&
		typeof (v as any).isNone === 'function'
	);
}

// ---------------------------------------------------------------------------
// Option helpers
// ---------------------------------------------------------------------------

export interface OptionHelpers {
	/**
	 * Validates that the value is a `Some` Option (contains a non-nullish value).
	 *
	 * @example
	 * ```ts
	 * is.option.some(some(42));  // true
	 * is.option.some(none());    // false
	 * ```
	 */
	some: Guard<Some<unknown>, OptionSomeHelpers>;

	/**
	 * Validates that the value is a `None` Option (no value).
	 *
	 * @example
	 * ```ts
	 * is.option.none(none());    // true
	 * is.option.none(some(42));  // false
	 * ```
	 */
	none: Guard<None>;

	/**
	 * Validates that the value is a `Some` Option whose inner value satisfies the given guard.
	 *
	 * @example
	 * ```ts
	 * is.option.someOf(is.number)(some(42));     // true
	 * is.option.someOf(is.string)(some(42));     // false
	 * is.option.someOf(is.number)(none());       // false
	 * ```
	 */
	someOf: <G extends Guard<any, any>>(guard: G) => Guard<Some<GuardType<G>>, OptionSomeHelpers>;
}

/**
 * Helpers available after narrowing to `is.option.some`.
 */
export interface OptionSomeHelpers {
	/**
	 * Validates that the Some Option's inner `.value` satisfies the given guard.
	 *
	 * @example
	 * ```ts
	 * is.option.some.valueIs(is.number)(some(42));     // true
	 * is.option.some.valueIs(is.string)(some(42));     // false
	 * ```
	 */
	valueIs: <G extends Guard<any, any>>(guard: G) => Guard<Some<GuardType<G>>, OptionSomeHelpers>;
}

// ---------------------------------------------------------------------------
// Helpers implementation
// ---------------------------------------------------------------------------

const optionSomeHelpers: OptionSomeHelpers = {
	valueIs: factory((guard: Guard<any, any>) => (v: unknown) => {
		return isOptionValue(v) && v.ok === true && v.value != null && guard(v.value);
	}),
};

const optionHelpers: OptionHelpers = {
	some: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is Some<unknown> => isOptionValue(v) && v.ok === true && (v as any).value != null,
			meta: { name: 'option.some', id: 'option' },
			helpers: optionSomeHelpers,
			replaceHelpers: true,
		}))
	) as any,

	none: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is None => isOptionValue(v) && (v.ok === false || (v as any).value == null),
			meta: { name: 'option.none', id: 'option' },
			helpers: {},
			replaceHelpers: true,
		}))
	) as any,

	someOf: factory((guard: Guard<any, any>) => (v: unknown) => {
		return isOptionValue(v) && v.ok === true && (v as any).value != null && guard((v as any).value);
	}),
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface OptionGuard extends Guard<Option<unknown>, OptionHelpers> {}

export const OptionGuard: OptionGuard = makeGuard(
	(v: unknown): v is Option<unknown> => isOptionValue(v),
	{ name: 'option', id: 'option' },
	optionHelpers as any
) as OptionGuard;
