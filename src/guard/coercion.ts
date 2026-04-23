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

	/**
	 * Coerces base64 strings and number arrays to `Uint8Array`.
	 *
	 * - **Base64 string**: decoded via `atob()` (standard base64).
	 *   Data-URI prefixes (`data:...;base64,`) are stripped automatically.
	 * - **Array of numbers**: wrapped with `new Uint8Array(arr)`.
	 *   Non-integer or out-of-range values are clamped by the Uint8Array constructor.
	 * - **ArrayBuffer**: wrapped with `new Uint8Array(buf)`.
	 */
	uint8array: v => {
		if (typeof v === 'string') return decodeBase64ToUint8Array(v);
		if (Array.isArray(v) && v.every(x => typeof x === 'number')) return new Uint8Array(v);
		if (v instanceof ArrayBuffer) return new Uint8Array(v);
		return v;
	},

	/**
	 * Coerces base64 strings and number arrays to Node.js `Buffer`.
	 * Falls through gracefully in environments where `Buffer` is unavailable.
	 *
	 * - **Base64 string**: decoded via `Buffer.from(str, 'base64')`.
	 * - **Array of numbers**: wrapped with `Buffer.from(arr)`.
	 * - **ArrayBuffer / Uint8Array**: wrapped with `Buffer.from(buf)`.
	 */
	buffer: v => {
		if (typeof Buffer === 'undefined') return v;
		if (typeof v === 'string') {
			try {
				const clean = stripDataUri(v);
				return Buffer.from(clean, 'base64');
			} catch {
				return v;
			}
		}
		if (Array.isArray(v) && v.every(x => typeof x === 'number')) return Buffer.from(v);
		if (v instanceof Uint8Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
		if (v instanceof ArrayBuffer) return Buffer.from(new Uint8Array(v));
		return v;
	},

	/**
	 * Coerces base64 strings and number arrays to `ArrayBuffer`.
	 *
	 * - **Base64 string**: decoded to Uint8Array, then `.buffer` is extracted.
	 * - **Array of numbers**: wrapped with `new Uint8Array(arr).buffer`.
	 * - **Uint8Array / Buffer**: extracts the underlying `.buffer`.
	 */
	arraybuffer: v => {
		if (typeof v === 'string') {
			const u8 = decodeBase64ToUint8Array(v);
			return u8 instanceof Uint8Array ? u8.buffer : v;
		}
		if (Array.isArray(v) && v.every(x => typeof x === 'number')) return new Uint8Array(v).buffer;
		if (v instanceof Uint8Array) return v.buffer;
		return v;
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strips a `data:...;base64,` prefix if present. */
function stripDataUri(s: string): string {
	const idx = s.indexOf(';base64,');
	return idx >= 0 ? s.slice(idx + 8) : s;
}

/** Decodes a base64 (or data-URI) string to a Uint8Array. Returns the original string on failure. */
function decodeBase64ToUint8Array(s: string): Uint8Array | string {
	try {
		const clean = stripDataUri(s);
		const binary = atob(clean);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	} catch {
		return s;
	}
}
