import { revive } from '../result/result-helpers.js';

/**
 * Default coercion logic for core types.
 *
 * Each coercer takes an unknown value and attempts to cast it to the target type.
 * If coercion is not possible or results in an invalid value (like NaN or Invalid Date),
 * it should return the original value to let the base guard handle the failure naturally.
 */
export const COERCERS: Record<string, (v: unknown) => unknown> = {
	/** Coerces numbers, booleans, and Dates to their string representation. */
	string: v => (v instanceof Date ? v.toISOString() : String(v)),

	/** Coerces numeric strings, booleans, and Dates to numbers. */
	number: v => {
		if (typeof v === 'string') {
			const trimmed = v.trim();
			if (trimmed === '') return 0;
			const n = Number(trimmed);
			return Number.isNaN(n) ? v : n;
		}
		if (typeof v === 'boolean') return v ? 1 : 0;
		if (v instanceof Date) return v.getTime();
		return v;
	},

	/**
	 * Coerces strings and numbers to booleans using common truthy/falsy patterns.
	 * Unlike Boolean(), it recognizes "false", "0", and "no" as false.
	 */
	boolean: v => {
		if (typeof v === 'string') {
			const s = v.toLowerCase().trim();
			if (['true', '1', 'yes', 'on', 'active', 'enabled'].includes(s)) return true;
			if (['false', '0', 'no', 'off', 'inactive', 'disabled'].includes(s)) return false;
			return v;
		}
		if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : v;
		return v;
	},

	/** Coerces ISO strings or timestamps to Date objects. */
	date: v => {
		if (typeof v === 'string' || typeof v === 'number') {
			const d = new Date(v);
			return Number.isNaN(d.getTime()) ? v : d;
		}
		return v;
	},

	/** Coerces strings or numbers to BigInts. Returns original if BigInt() throws. */
	bigint: v => {
		if (typeof v === 'string' || typeof v === 'number') {
			try {
				return BigInt(v);
			} catch {
				return v;
			}
		}
		return v;
	},

	/** Attempts to parse a string as JSON if it looks like an object or array. */
	object: v => {
		if (typeof v === 'string') {
			const trimmed = v.trim();
			if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
				try {
					return JSON.parse(trimmed);
				} catch {
					return v;
				}
			}
		}
		return v;
	},

	/**
	 * Delegates to `COERCERS.object` because a JSON string can decode to either
	 * `{}` or `[]`; the downstream guard (object vs array) decides whether the
	 * parsed value is acceptable.
	 */
	array: v => COERCERS['object']!(v),

	/** Revives a stripped Result POJO back into a fully-featured Result class. */
	result: v => {
		try {
			if (v && typeof v === 'object' && 'ok' in v && typeof v.ok === 'boolean') {
				return revive(v);
			}
		} catch {
			// Ignore ChasErrs thrown by revive if it's deeply malformed
		}
		return v;
	},

	/** Coerces string inputs to `URL` instances. */
	url: v => {
		if (typeof v === 'string') {
			try {
				return new URL(v);
			} catch {
				return v;
			}
		}
		return v;
	},
};
