import { makeGuard, type Guard } from '../shared.js';
import { type ObjectHelpers, objectHelpers } from './shared.js';

export type RecordGuard<K extends string | number | symbol, V> = Guard<Record<K, V>, ObjectHelpers<Record<K, V>>>;

/**
 * Creates a Guard that validates an object as a `Record<K, V>`.
 *
 * When the key guard has a finite set of known values (e.g., `is.enum` or `is.literal`),
 * the record guard performs **exhaustive key checking** — all keys must be present in the
 * input, matching TypeScript's `Record<'a' | 'b', V>` semantics. Extra keys not in the
 * set are rejected.
 *
 * When the key guard is open-ended (e.g., `is.string`), the record validates that every
 * existing key/value pair satisfies the guards, without requiring specific keys.
 *
 * Use `.partial` on the result to make all keys optional (i.e., `Partial<Record<K, V>>`).
 *
 * Note: JavaScript objects require keys to be strings or symbols. If you need to validate
 * other key types, use `is.map` instead.
 *
 * @example
 * ```ts
 * // Open-ended — any string keys, number values
 * const scores = is.record(is.string, is.number);
 * scores({ math: 95, english: 87 }); // true
 * scores({}); // true — no keys required
 *
 * // Exhaustive — all enum keys required
 * const Keys = is.enum(['id', 'name', 'email'] as const);
 * const person = is.record(Keys, is.string);
 * person({ id: '1', name: 'Alice', email: 'a@b.com' }); // true
 * person({ id: '1', name: 'Alice' }); // false — missing 'email'
 * person({ id: '1', name: 'Alice', email: 'a@b.com', extra: 'x' }); // false — unknown key 'extra'
 *
 * // Exhaustive — with literals
 * const person2 = is.record(is.literal('a', 'b'), is.number);
 * person2({ a: 1, b: 2 }); // true
 * person2({ a: 1 }); // false — missing 'b'
 *
 * // Partial exhaustive — keys are optional
 * const partial = is.record(Keys, is.string).partial;
 * partial({ id: '1' }); // true — other keys optional
 * ```
 */
export interface RecordGuardFactory {
	<K extends string | number | symbol, V>(
		keyGuard: Guard<K>,
		valGuard: Guard<V, Record<string, any>>
	): RecordGuard<K, V>;
}

export const RecordGuardFactory: RecordGuardFactory = <K extends string | number | symbol, V>(
	keyGuard: Guard<K>,
	valGuard: Guard<V, Record<string, any>>
) => {
	const requiredKeys: Set<any> | undefined = keyGuard.meta.values instanceof Set ? keyGuard.meta.values : undefined;

	return makeGuard(
		(v: unknown): v is Record<K, V> => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const obj = v as Record<string, unknown>;
			const keys = Object.keys(obj);

			if (requiredKeys) {
				if (keys.length !== requiredKeys.size) return false;
				for (const key of requiredKeys) {
					if (!(key in obj) || !valGuard(obj[key])) return false;
				}
				for (const key of keys) {
					if (!requiredKeys.has(key)) return false;
				}
				return true;
			}

			for (const key of keys) {
				if (!keyGuard(key as K) || !valGuard(obj[key])) return false;
			}
			return true;
		},
		{ name: `record<${keyGuard.meta.name}, ${valGuard.meta.name}>`, id: 'record' },
		objectHelpers as any
	);
};
