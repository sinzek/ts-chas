/**
 * Guards for the `Option<T>` type.
 *
 * `is.option` is a factory that creates a Guard for Option values.
 * Call `is.option()` for unnarrowed validation, or `is.option(innerGuard)`
 * to validate the inner Some value type.
 *
 * Since Options are implemented as Results under the hood (`Some = Ok`, `None = Err<never>`),
 * the detection checks for Result structure plus the Option-specific `isSome`/`isNone` methods.
 *
 * @example
 * ```ts
 * is.option()(some(42));           // true
 * is.option()(none());             // true
 * is.option()('hello');            // false
 *
 * is.option().some()(some(42));    // true
 * is.option().some()(none());      // false
 *
 * // Narrow the inner value type
 * is.option(is.number)(some(42));            // true
 * is.option().some(is.number)(some(42));     // true
 * is.option().some(is.string)(some(42));     // false
 * ```
 */

import type { Option, Some, None } from '../../option.js';
import { makeGuard, property, transformer, type Guard, type InferGuard } from '../shared.js';

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

export interface OptionHelpers<T = unknown> {
	/**
	 * Narrows to the `Some` variant. Call with no arguments for an unnarrowed Some guard,
	 * or pass an inner guard to validate the Some value type.
	 *
	 * @example
	 * ```ts
	 * is.option().some()(some(42));          // true (any Some)
	 * is.option().some()(none());            // false
	 * is.option().some(is.number)(some(42)); // true (Some<number>)
	 * is.option().some(is.string)(some(42)); // false
	 * ```
	 */
	some: {
		(): Guard<Some<T>>;
		<G extends Guard<any, any>>(innerGuard: G): Guard<Some<InferGuard<G>>>;
	};

	/**
	 * Validates that the value is a `None` Option (no value).
	 * Accessed as a property (no parentheses needed).
	 *
	 * @example
	 * ```ts
	 * is.option().none(none());    // true
	 * is.option().none(some(42));  // false
	 * ```
	 */
	none: Guard<None>;
}

// ---------------------------------------------------------------------------
// Helpers implementation
// ---------------------------------------------------------------------------

const optionHelpers: OptionHelpers = {
	some: transformer(
		<T>(target: Guard<Option<T>, Record<string, any>>, innerGuard?: Guard<T, Record<string, any>>) => ({
			fn: (v: unknown): v is Some<T> =>
				target(v) &&
				v.ok === true &&
				(v as any).value != null &&
				(innerGuard ? innerGuard((v as any).value) : true),
			meta: { name: `option.some${innerGuard ? `<${innerGuard.meta.name}>` : ''}`, id: 'option' },
			helpers: {},
			replaceHelpers: true,
		})
	) as any,

	none: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is None => target(v) && (v.ok === false || (v as any).value == null),
			meta: { name: 'option.none', id: 'option' },
			helpers: {},
			replaceHelpers: true,
		}))
	) as any,
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface OptionGuardFactory {
	/** Creates an unnarrowed Option guard. */
	(): Guard<Option<unknown>, OptionHelpers>;
	/** Creates an Option guard narrowed by the Some value type. */
	<G extends Guard<any, any>>(innerGuard: G): Guard<Option<InferGuard<G>>, OptionHelpers<InferGuard<G>>>;
}

export const OptionGuardFactory: OptionGuardFactory = (innerGuard?: Guard<any, Record<string, any>>) =>
	makeGuard(
		<T>(v: unknown): v is Option<T> => {
			if (!isOptionValue(v)) return false;
			if (innerGuard && v.ok === true && (v as any).value != null && !innerGuard((v as any).value)) return false;
			return true;
		},
		{ name: 'option', id: 'option' },
		optionHelpers as any
	);
