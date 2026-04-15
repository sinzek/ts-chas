import { sha1, md5 } from '@noble/hashes/legacy.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { getObjectDepth, isSafeObject } from '../../utils.js';
import { factory, makeGuard, type Guard, transformer, property, JSON_SCHEMA } from '../shared.js';

const ENC = {
	hex: {
		encode: (bytes: Uint8Array) => bytesToHex(bytes),
		decode: (str: string) => hexToBytes(str),
	},
	base64: {
		encode: (bytes: Uint8Array) => {
			if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
			return btoa(String.fromCharCode(...bytes));
		},
		decode: (str: string) => {
			if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
			return Uint8Array.from(atob(str), c => c.charCodeAt(0));
		},
	},
	base64url: {
		encode: (bytes: Uint8Array) => {
			if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64url');
			return btoa(String.fromCharCode(...bytes))
				.replace(/\+/g, '-')
				.replace(/\//g, '_')
				.replace(/=/g, '');
		},
		decode: (str: string) => {
			if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64url'));
			const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
			return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
		},
	},
};

const HASH = { sha1, sha256, sha384, sha512, md5 };

/**
 * Constant-time byte comparison to prevent timing attacks.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) {
		out |= a[i]! ^ b[i]!;
	}
	return out === 0;
}

export interface StringGuard extends Guard<string, StringHelpers> {}

export interface IsoHelpers {
	/** Validates ISO 8601 date-only format: YYYY-MM-DD */
	date: Guard<string, StringHelpers & IsoHelpers>;
	/**
	 * Validates ISO 8601 time format.
	 * By default seconds are optional and arbitrary sub-second precision is allowed.
	 * @param options.precision -1 = minute only (HH:MM), 0 = seconds required (HH:MM:SS),
	 *   1+ = exact sub-second digits (HH:MM:SS.s, HH:MM:SS.ss, etc.)
	 */
	time: (options?: { precision?: number }) => Guard<string, StringHelpers & IsoHelpers>;
	/**
	 * Validates full ISO 8601 datetime.
	 * By default, requires a timezone offset (Z or ±HH:MM) and arbitrary sub-second precision.
	 * @param options.offset If true (default), requires timezone offset. If false, forbids it.
	 * @param options.local If true, allows unqualified (timezone-less) datetimes.
	 * @param options.precision -1 = minute only, 0 = seconds required,
	 *   1+ = exact sub-second digits. Default: arbitrary.
	 */
	datetime: (options?: {
		offset?: boolean;
		local?: boolean;
		precision?: number;
	}) => Guard<string, StringHelpers & IsoHelpers>;
}

export interface BoolStrParsed {
	asBool: Guard<boolean, {}>;
}

export interface BoolStrHelpers extends BoolStrParsed {
	truthy: (options?: {
		caseSensitive?: boolean;
		values?: readonly string[];
	}) => Guard<string, StringHelpers & BoolStrParsed>;
	falsy: (options?: {
		caseSensitive?: boolean;
		values?: readonly string[];
	}) => Guard<string, StringHelpers & BoolStrParsed>;
}

const boolStrVals = {
	truthy: new Set<string>(['true', '1', 'yes', 'y', 'on', 'active', 'enabled']),
	truthyCapitalized: new Set<string>(['True', 'Yes', 'On', 'Active', 'Enabled']),
	truthyAllCaps: new Set<string>(['TRUE', 'YES', 'ON', 'ACTIVE', 'ENABLED']),
	falsy: new Set<string>(['false', '0', 'no', 'n', 'off', 'inactive', 'disabled']),
	falsyCapitalized: new Set<string>(['False', 'No', 'Off', 'Inactive', 'Disabled']),
	falsyAllCaps: new Set<string>(['FALSE', 'NO', 'OFF', 'INACTIVE', 'DISABLED']),
};

export interface HashHelpers {
	/**
	 * Verifies that the hashed value matches the hash of the provided input.
	 * @param input The plain text input to hash and compare.
	 */
	verify: (input: string) => Guard<string, StringHelpers & HashHelpers>;
}

type JWTSigningAlgorithm =
	| 'HS256'
	| 'HS384'
	| 'HS512'
	| 'RS256'
	| 'RS384'
	| 'RS512'
	| 'ES256'
	| 'ES384'
	| 'ES512'
	| 'PS256'
	| 'PS384'
	| 'PS512'
	| 'EdDSA'
	| (string & {});

export interface StringHelpers {
	/** Validates an RFC 5322 compliant email address. To use your own regex pattern, use `.regex()` instead. */
	email: Guard<string, StringHelpers>;
	/** Validates any WHATWG-compliant URL. Isomorphic support via integrated parser. */
	url: Guard<string, StringHelpers>;
	/** Validates a URL with 'http:' or 'https:' protocols. */
	httpUrl: Guard<string, StringHelpers>;
	/** Validates a hostname format. Does not verify DNS records. */
	hostname: Guard<string, StringHelpers>;
	/** Validates that a string includes at least one emoji. */
	emoji: Guard<string, StringHelpers>;
	/** Validates that the entire string matches its uppercase form. */
	uppercase: Guard<string, StringHelpers>;
	/** Validates that the entire string matches its lowercase form. */
	lowercase: Guard<string, StringHelpers>;
	/** Validates a cuid (deprecated). */
	cuid: Guard<string, StringHelpers>;
	/** Validates a cuid2. */
	cuid2: Guard<string, StringHelpers>;
	/** Validates a ULID (Universally Unique Lexicographically Sortable Identifier). */
	ulid: Guard<string, StringHelpers>;
	/** Validates an IPv4 address. */
	ipv4: Guard<string, StringHelpers>;
	/** Validates an IPv6 address. */
	ipv6: Guard<string, StringHelpers>;
	/** Validates an IPv4 address with CIDR mask (e.g. 192.168.1.0/24). */
	cidrv4: Guard<string, StringHelpers>;
	/** Validates an IPv6 address with CIDR mask (e.g. 2001:db8::/32). */
	cidrv6: Guard<string, StringHelpers>;
	/** Validates a GUID/UUID format (any version). For strict RFC variant checks, use .uuid(). */
	guid: Guard<string, StringHelpers>;

	/**
	 * Validates a boolean string. If `caseSensitive` is set to false, it will convert the string to lowercase before validating.
	 *
	 * @remarks
	 * This guard is case-insensitive by default and accepts the following values:
	 *
	 * **True values:**
	 * - true, True, TRUE
	 * - 1
	 * - yes, Yes, YES
	 * - y, Y
	 * - on, On, ON
	 * - enabled, Enabled, ENABLED
	 * - active, Active, ACTIVE
	 *
	 * **False values:**
	 * - false, False, FALSE
	 * - 0
	 * - no, No, NO
	 * - n, N
	 * - off, Off, OFF
	 * - disabled, Disabled, DISABLED
	 * - inactive, Inactive, INACTIVE
	 */
	boolStr: Guard<string, StringHelpers & BoolStrHelpers>;
	/**
	 * Validates a MAC address with an optional custom delimiter.
	 * @param options.delimiter - The character separating byte pairs (':', '-', '.', or 'none'). Default: ':'.
	 */
	mac: (options?: { delimiter?: ':' | '-' | '.' | 'none' }) => Guard<string, StringHelpers>;
	/**
	 * Validates a UUID with optional version check. Enforces RFC 9562/4122 variant bits
	 * (Byte 8 must be 8, 9, a, or b).
	 * @param options.version - The specific UUID version to enforce ('v1' through 'v8').
	 */
	uuid: (options?: {
		version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8';
	}) => Guard<string, StringHelpers>;
	/** Convenience helper for v4 UUID validation. */
	uuidv4: Guard<string, StringHelpers>;
	/** Convenience helper for v6 UUID validation. */
	uuidv6: Guard<string, StringHelpers>;
	/** Convenience helper for v7 UUID validation. */
	uuidv7: Guard<string, StringHelpers>;
	/** Validates minimum string length (inclusive). */
	min: (min: number) => Guard<string, StringHelpers>;
	/** Validates maximum string length (inclusive). */
	max: (max: number) => Guard<string, StringHelpers>;
	/** Validates exact string length. */
	length: (length: number) => Guard<string, StringHelpers>;
	/** Validates string against a custom regular expression. */
	regex: (regex: RegExp) => Guard<string, StringHelpers>;
	/** Validates that string includes a substring. */
	includes: (sub: string) => Guard<string, StringHelpers>;
	/** Validates that string starts with a prefix. */
	startsWith: (pfx: string) => Guard<string, StringHelpers>;
	/** Validates that string ends with a suffix. */
	endsWith: (sfx: string) => Guard<string, StringHelpers>;
	/**
	 * Validates Base64 encoding. Use options for strict padding control. Isomorphic support.
	 * @param options.padding - Whether padding is 'required', 'optional', or 'forbidden'. Default: 'optional'.
	 */
	base64: (options?: { padding?: 'required' | 'optional' | 'forbidden' }) => Guard<string, StringHelpers>;
	/**
	 * Validates Hexadecimal encoding. Use options for prefix management (0x) and case control.
	 * @param options.prefix - If true, requires '0x' or '0X' prefix. If false, forbids it. Default: optional.
	 * @param options.evenLength - If true, requires an even number of digits.
	 * @param options.case - Enforce 'lower', 'upper', or 'mixed' casing. Default: 'mixed'.
	 */
	hex: (options?: {
		prefix?: boolean;
		evenLength?: boolean;
		case?: 'lower' | 'upper' | 'mixed';
	}) => Guard<string, StringHelpers>;
	/**
	 * Validates a NanoID with an optional exact length.
	 * @param options.length - The exact number of characters expected. Default: 21.
	 */
	nanoid: (options?: { length?: number }) => Guard<string, StringHelpers>;
	/**
	 * Validates cryptographic hash formats and provides verification helpers.
	 * Utilizes `@noble/hashes` for cross-platform, isomorphic (browser/node/edge) support.
	 * Use .verify('plaintext') to recompute and compare.
	 *
	 * @param options.alg - The hashing algorithm to expect ('sha1', 'sha256', 'sha384', 'sha512', 'md5'). Default: 'sha256'.
	 * @param options.enc - The encoding of the hash string ('hex', 'base64', 'base64url'). Default: 'hex'.
	 * @param options.padding - For base64/base64url, controls padding rules.
	 */
	hash: (options?: {
		alg?: 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'md5';
		enc?: 'hex' | 'base64' | 'base64url';
		padding?: 'required' | 'optional' | 'forbidden';
	}) => Guard<string, StringHelpers & HashHelpers>;
	/**
	 * Validates JSON Web Token (JWT) structure. Isomorphic support (client/server safe).
	 * Optionally validates JSON structure of header/payload and enforces signing algorithms.
	 *
	 * @param options.validateJson - If true, attempts to parse both the header and payload as JSON.
	 * @param options.alg - A specific algorithm or list of allowed algorithms (e.g., 'HS256', 'RS256').
	 */
	jwt: (options?: {
		validateJson?: boolean;
		alg?: JWTSigningAlgorithm | JWTSigningAlgorithm[];
	}) => Guard<string, StringHelpers>;

	/** Trims whitespace from both ends of the string before validation. Transforms value. */
	trim: () => Guard<string, StringHelpers>;
	/** Transforms the string to lowercase before validation. Transforms value. */
	toLowerCase: () => Guard<string, StringHelpers>;
	/** Transforms the string to uppercase before validation. Transforms value. */
	toUpperCase: () => Guard<string, StringHelpers>;
	/**
	 * Transforms the string using the provided Unicode normalization form (NFC, NFD, etc).
	 * @param options.form - The normalization form to use ('NFC', 'NFD', 'NFKC', or 'NFKD'). Default: 'NFC'.
	 */
	normalize: (options?: { form?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' }) => Guard<string, StringHelpers>;

	/** Validates full ISO 8601 formatting. Use sub-properties for specific date/time formats. */
	iso: Guard<string, StringHelpers & IsoHelpers>;

	/**
	 * Transforms the string into a parsed JSON value. Chained helpers after
	 * .parsedJson validate the resulting data, NOT the string. The resulting guard will be typed as whatever the provided schema is typed as. If no schema is provided, it will be typed as unknown.
	 *
	 * @param options.schema - An optional Guard to validate the parsed JSON result against.
	 * @param options.type - Enforce that the top-level JSON structure is an 'object' or 'array'.
	 * @param options.maxDepth - Maximum depth for nested objects/arrays to prevent stack overflow.
	 * @param options.safe - If true, uses a safer JSON.parse implementation that prevents prototype pollution.
	 */
	parsedJson: <TParsed = unknown>(options?: {
		schema?: Guard<TParsed>;
		type?: 'object' | 'array';
		maxDepth?: number;
		safe?: boolean;
	}) => Guard<TParsed, {}>;

	/**
	 * Validates that string is parsable as JSON. Optionally enforces a schema or type
	 * on the parsed result. The resulting guard will still be typed as Guard<string>
	 *
	 * @param options.schema - An optional Guard to validate the parsed JSON result against.
	 * @param options.type - Enforce that the top-level JSON structure is an 'object' or 'array'.
	 * @param options.maxLength - Maximum allowed length of the raw JSON string.
	 * @param options.maxDepth - Maximum depth for nested objects/arrays.
	 * @param options.safe - Use safe parsing to prevent prototype pollution.
	 */
	json: (options?: {
		schema?: Guard<any>;
		type?: 'object' | 'array';
		maxLength?: number;
		maxDepth?: number;
		safe?: boolean;
	}) => Guard<string, StringHelpers>;
}

const RGX = {
	email: /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-.]*)[a-z0-9_+-]@([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/i,
	uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	emoji: /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/,
};

const stringHelpers: StringHelpers = {
	email: ((v: string) => RGX.email.test(v)) as any,
	url: ((v: string) => {
		try {
			new URL(v);
			return true;
		} catch {
			return false;
		}
	}) as any,
	httpUrl: ((v: string) => {
		try {
			const url = new URL(v);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}) as any,
	hostname: ((v: string) => {
		if (typeof v !== 'string' || v.length === 0 || v.length > 253) return false;
		// RFC 952/1123: labels are alphanumeric + hyphens, separated by dots.
		// Labels must not start or end with a hyphen.
		return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(v);
	}) as any,
	emoji: ((v: string) => RGX.emoji.test(v)) as any,
	uppercase: ((v: string) => v === v.toUpperCase()) as any,
	lowercase: ((v: string) => v === v.toLowerCase()) as any,
	cuid: ((v: string) => /^c[a-z0-9]{24}$/.test(v)) as any,
	cuid2: ((v: string) => /^[a-z][a-z0-9]{1,}$/.test(v)) as any,
	ulid: ((v: string) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(v)) as any,
	ipv4: ((v: string) => {
		const parts = v.split('.');
		if (parts.length !== 4) return false;

		return parts.every(p => {
			if (!/^\d+$/.test(p)) return false;
			const n = Number(p);
			return n >= 0 && n <= 255;
		});
	}) as any,
	ipv6: ((v: string) => {
		try {
			return new URL(`http://[${v}]`).hostname === `[${v}]`;
		} catch {
			return false;
		}
	}) as any,
	cidrv4: ((v: string) => {
		const [ip, mask] = v.split('/');
		if (!ip || !mask) return false;

		const parts = ip.split('.');
		if (parts.length !== 4) return false;
		const isIpv4 = parts.every(p => {
			if (!/^\d+$/.test(p)) return false;
			const n = Number(p);
			return n >= 0 && n <= 255;
		});
		if (!isIpv4) return false;

		const n = Number(mask);
		return Number.isInteger(n) && n >= 0 && n <= 32;
	}) as any,
	cidrv6: ((v: string) => {
		const [ip, mask] = v.split('/');
		if (!ip || !mask) return false;

		try {
			if (new URL(`http://[${ip}]`).hostname !== `[${ip}]`) return false;
		} catch {
			return false;
		}

		const n = Number(mask);
		return Number.isInteger(n) && n >= 0 && n <= 128;
	}) as any,
	guid: ((v: string) => RGX.uuid.test(v)) as any,

	mac: factory<[{ delimiter?: ':' | '-' | '.' | 'none' }?], (v: string) => boolean, StringHelpers>(
		(options?: { delimiter?: ':' | '-' | '.' | 'none' }) => {
			const d = options?.delimiter;
			let re: RegExp;
			if (d === ':') re = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
			else if (d === '-') re = /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/;
			else if (d === '.') re = /^([0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$/;
			else if (d === 'none') re = /^[0-9A-Fa-f]{12}$/;
			else re = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
			return (v: string) => re.test(v);
		}
	),
	uuid: factory<
		[{ version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8' }?],
		(v: string) => boolean,
		StringHelpers
	>((options?: { version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8' }) => (v: string) => {
		if (!RGX.uuid.test(v)) return false;
		// RFC 9562/4122: variant bits — byte 8 (position 19) must be 8, 9, a, or b
		if (!/[89ab]/i.test(v[19]!)) return false;
		if (options?.version) {
			const versionChar = options.version[1]; // 'v4' → '4'
			return v[14] === versionChar;
		}
		return true;
	}),
	uuidv4: ((v: string): v is string => {
		if (!RGX.uuid.test(v)) return false;
		return /[89ab]/i.test(v[19]!) && v[14] === '4';
	}) as any,
	uuidv6: ((v: string): v is string => {
		if (!RGX.uuid.test(v)) return false;
		return /[89ab]/i.test(v[19]!) && v[14] === '6';
	}) as any,
	uuidv7: ((v: string): v is string => {
		if (!RGX.uuid.test(v)) return false;
		return /[89ab]/i.test(v[19]!) && v[14] === '7';
	}) as any,

	min: factory<[number], (v: string) => boolean, StringHelpers>((min: number) => (v: string) => v.length >= min),
	max: factory<[number], (v: string) => boolean, StringHelpers>((max: number) => (v: string) => v.length <= max),
	length: factory<[number], (v: string) => boolean, StringHelpers>(
		(length: number) => (v: string) => v.length === length
	),
	regex: factory<[RegExp], (v: string) => boolean, StringHelpers>((regex: RegExp) => (v: string) => regex.test(v)),
	includes: factory<[string], (v: string) => boolean, StringHelpers>((sub: string) => (v: string) => v.includes(sub)),
	startsWith: factory<[string], (v: string) => boolean, StringHelpers>(
		(pfx: string) => (v: string) => v.startsWith(pfx)
	),
	endsWith: factory<[string], (v: string) => boolean, StringHelpers>((sfx: string) => (v: string) => v.endsWith(sfx)),
	base64: factory<[any?], (v: string) => boolean, StringHelpers>(
		(options: { padding?: 'required' | 'optional' | 'forbidden' } = { padding: 'optional' }) =>
			(v: string) => {
				if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;

				const normalized = options.padding === 'forbidden' ? v.replace(/=+$/, '') : v;

				try {
					const decoded = Buffer.from(normalized, 'base64');
					const reencoded = decoded.toString('base64');

					return normalized.replace(/=+$/, '') === reencoded.replace(/=+$/, '');
				} catch {
					return false;
				}
			}
	),
	hex: factory<[any?], (v: string) => boolean, StringHelpers>(
		(options?: { prefix?: boolean; evenLength?: boolean; case?: 'lower' | 'upper' | 'mixed' }) => (v: string) => {
			if (v.length === 0) return false;

			let str = v;

			if (options?.prefix) {
				if (str.startsWith('0x') || str.startsWith('0X')) str = str.slice(2);
			} else if (str.startsWith('0x') || str.startsWith('0X')) return false;

			if (!/^[0-9A-Fa-f]+$/.test(str)) return false;

			if (options?.case === 'lower' && /[A-F]/.test(str)) return false;
			if (options?.case === 'upper' && /[a-f]/.test(str)) return false;
			if (options?.evenLength && str.length % 2 !== 0) return false;

			return true;
		}
	),
	nanoid: factory<[{ length?: number }?], (v: string) => boolean, StringHelpers>(
		(options?: { length?: number }) => (v: string) =>
			new RegExp(`^[A-Za-z0-9_-]{${options?.length ?? 21}}$`).test(v)
	),
	hash: transformer<
		string,
		string,
		[
			{
				alg?: 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'md5';
				enc?: 'hex' | 'base64' | 'base64url';
				padding?: 'required' | 'optional' | 'forbidden';
			}?,
		],
		HashHelpers
	>((target, options) => {
		const alg = options?.alg ?? 'sha256';
		const enc = options?.enc ?? 'hex';

		const byteLengths = {
			md5: 16,
			sha1: 20,
			sha256: 32,
			sha384: 48,
			sha512: 64,
		} as const;

		const bytes = byteLengths[alg];

		const formatPredicate = (v: string): boolean => {
			if (enc === 'hex') {
				const len = bytes * 2;
				return new RegExp(`^[a-fA-F0-9]{${len}}$`).test(v);
			}

			const base64Len = Math.ceil(bytes / 3) * 4;

			if (enc === 'base64') {
				if (!/^[A-Za-z0-9+/=]+$/.test(v)) return false;
				if (v.length !== base64Len) return false;
				try {
					return ENC.base64.decode(v).length === bytes;
				} catch {
					return false;
				}
			}

			if (enc === 'base64url') {
				if (!/^[A-Za-z0-9_-]+$/.test(v)) return false;
				try {
					const buf = ENC.base64url.decode(v);
					if (buf.length !== bytes) return false;
					if (options?.padding === 'required' && !v.endsWith('=')) return false;
					if (options?.padding === 'forbidden' && v.includes('=')) return false;
					return true;
				} catch {
					return false;
				}
			}
			return false;
		};

		const hashHelpers: any = {
			verify: transformer((innerTarget, input: string) => {
				const hasher = HASH[alg];
				const hashBytes = hasher(utf8ToBytes(input));

				return {
					fn: (v: unknown): v is string =>
						typeof v === 'string' && innerTarget(v) && timingSafeEqual(ENC[enc].decode(v), hashBytes),
					meta: { name: `${innerTarget.meta.name}.verify` },
					helpers: hashHelpers,
				};
			}),
		};

		return {
			fn: (v: unknown): v is string => typeof v === 'string' && target(v) && formatPredicate(v),
			meta: {
				name: `${target.meta.name}.hash`,
				jsonSchema: { ...target.meta.jsonSchema, _format: 'hash', _hashAlg: alg, _hashEnc: enc },
			},
			helpers: hashHelpers,
		} as any;
	}) as any,
	jwt: factory<[any?], (v: string) => boolean, StringHelpers>(
		(options?: { validateJson?: boolean; alg?: JWTSigningAlgorithm | JWTSigningAlgorithm[] }) => (v: string) => {
			const parts = v.split('.');
			if (parts.length !== 3) return false;

			if (!parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return false;

			if (options?.validateJson || options?.alg) {
				try {
					const decode = (s: string) => {
						const bytes = ENC.base64url.decode(s);
						if (typeof TextDecoder !== 'undefined') return JSON.parse(new TextDecoder().decode(bytes));
						return JSON.parse(Array.from(bytes, b => String.fromCharCode(b as number)).join(''));
					};

					const header = decode(parts[0]!);
					if (options?.validateJson) {
						decode(parts[1]!); // Also validate payload
					}

					if (options?.alg) {
						const algs = Array.isArray(options.alg) ? options.alg : [options.alg];
						if (!algs.includes(header.alg)) return false;
					}
				} catch {
					return false;
				}
			}

			return true;
		}
	),
	json: factory<[any?], (v: string) => boolean, StringHelpers>(
		(options?: {
			schema?: Guard<any>;
			type?: 'object' | 'array';
			maxLength?: number;
			maxDepth?: number;
			safe?: boolean;
		}) =>
			(v: string) => {
				if (options?.maxLength && v.length > options.maxLength) return false;

				try {
					const parsed = JSON.parse(v);

					if (
						options?.type === 'object' &&
						(typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
					)
						return false;
					if (options?.type === 'array' && !Array.isArray(parsed)) return false;

					if (options?.schema && !options.schema(parsed)) return false;

					if (options?.safe && !isSafeObject(parsed)) return false;

					if (options?.maxDepth && getObjectDepth(parsed) > options.maxDepth) return false;

					return true;
				} catch {
					return false;
				}
			}
	),

	trim: transformer<string, string, [], StringHelpers>(target => ({
		fn: (v: unknown): v is string => {
			const val = target.meta.transform ? target.meta.transform(v, v) : v;
			return typeof val === 'string' && target(val.trim());
		},
		meta: { name: `${target.meta.name}.trim` },
		transform: (v: string) => v.trim(),
	})),

	toLowerCase: transformer<string, string, [], StringHelpers>(target => ({
		fn: (v: unknown): v is string => {
			const val = target.meta.transform ? target.meta.transform(v, v) : v;
			return typeof val === 'string' && target(val.toLowerCase());
		},
		meta: { name: `${target.meta.name}.toLowerCase` },
		transform: (v: string) => v.toLowerCase(),
	})),

	toUpperCase: transformer<string, string, [], StringHelpers>(target => ({
		fn: (v: unknown): v is string => {
			const val = target.meta.transform ? target.meta.transform(v, v) : v;
			return typeof val === 'string' && target(val.toUpperCase());
		},
		meta: { name: `${target.meta.name}.toUpperCase` },
		transform: (v: string) => v.toUpperCase(),
	})),

	normalize: transformer<string, string, [any?], StringHelpers>(
		(target, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFC') => ({
			fn: (v: unknown): v is string => {
				const val = target.meta.transform ? target.meta.transform(v, v) : v;
				return typeof val === 'string' && target(val.normalize(form));
			},
			meta: { name: `${target.meta.name}.normalize` },
			transform: (v: string) => v.normalize(form),
		})
	),
	iso: property(
		transformer<string, string, [], IsoHelpers>(target => {
			const ISO_RE = /^\d{4}-\d{2}-\d{2}/;
			return {
				fn: (v: unknown): v is string => {
					if (typeof v !== 'string') return false;
					const val = target.meta.transform ? target.meta.transform(v, v) : v;
					return typeof val === 'string' && ISO_RE.test(val) && !isNaN(Date.parse(val)) && target(v);
				},
				meta: {
					name: `${target.meta.name}.iso`,
					jsonSchema: { ...target.meta.jsonSchema, format: 'date-time' },
				},
				helpers: {
					date: property(
						transformer<string, string, [], IsoHelpers>(target => ({
							fn: (v: unknown): v is string => {
								const val = target.meta.transform ? target.meta.transform(v, v) : v;
								return (
									typeof val === 'string' &&
									/^\d{4}-\d{2}-\d{2}$/.test(val) &&
									!isNaN(Date.parse(val)) &&
									target(v)
								);
							},
							meta: {
								name: `${target.meta.name}.iso.date`,
								jsonSchema: { ...target.meta.jsonSchema, format: 'date' },
							},
						}))
					),
					time: transformer<string, string, [{ precision?: number }?], IsoHelpers>(
						(target, options?: { precision?: number }) => {
							const p = options?.precision;
							let re: RegExp;
							if (p === undefined) {
								re = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
							} else if (p === -1) {
								re = /^\d{2}:\d{2}$/;
							} else if (p === 0) {
								re = /^\d{2}:\d{2}:\d{2}$/;
							} else {
								re = new RegExp(`^\\d{2}:\\d{2}:\\d{2}\\.\\d{${p}}$`);
							}
							return {
								fn: (v: unknown): v is string => {
									const val = target.meta.transform ? target.meta.transform(v, v) : v;
									// Note: we don't call target(v) for sub-helpers to avoid being blocked by parent's strict predicate
									return typeof val === 'string' && re.test(val);
								},
								meta: { name: `${target.meta.name}.iso.time` },
							};
						}
					),
					datetime: transformer<
						string,
						string,
						[{ offset?: boolean; local?: boolean; precision?: number }?],
						IsoHelpers
					>((target, options?: { offset?: boolean; local?: boolean; precision?: number }) => {
						const p = options?.precision;
						const allowOffset = options?.offset !== false;
						const allowLocal = options?.local === true;

						// Build time portion regex
						let timePart: string;
						if (p === undefined) {
							timePart = '\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?';
						} else if (p === -1) {
							timePart = '\\d{2}:\\d{2}';
						} else if (p === 0) {
							timePart = '\\d{2}:\\d{2}:\\d{2}';
						} else {
							timePart = `\\d{2}:\\d{2}:\\d{2}\\.\\d{${p}}`;
						}

						// Build timezone suffix regex
						let tzPart: string;
						if (allowOffset && allowLocal) {
							tzPart = '(Z|[+-]\\d{2}:\\d{2})?';
						} else if (allowOffset) {
							tzPart = '(Z|[+-]\\d{2}:\\d{2})';
						} else {
							tzPart = '';
						}

						const re = new RegExp(`^\\d{4}-\\d{2}-\\d{2}T${timePart}${tzPart}$`);
						return {
							fn: (v: unknown): v is string => {
								const val = target.meta.transform ? target.meta.transform(v, v) : v;
								return typeof val === 'string' && re.test(val) && !isNaN(Date.parse(val));
							},
							meta: {
								name: `${target.meta.name}.iso.datetime`,
								jsonSchema: {
									...target.meta.jsonSchema,
									format: 'date-time',
									// Preserved for generate() — lets the arbitrary builder match
									// the exact constraints rather than always using toISOString().
									_isoDatetime: true,
									_isoOffset: allowOffset,
									_isoLocal: allowLocal,
									_isoPrecision: p,
								},
							},
						};
					}),
				} as any,
			};
		})
	) as any,
	boolStr: property(
		transformer<string, string, [], BoolStrHelpers>(target => {
			const asBool = property(
				transformer<string, boolean, [], {}>((innerTarget: Guard<string>) => ({
					fn: (v: unknown): v is boolean => innerTarget(v),
					meta: { name: `${innerTarget.meta.name}.asBool`, id: 'boolean' },
					transform: (v: string) => boolStrVals.truthy.has(v.toLowerCase()),
					replaceHelpers: true,
				}))
			);

			const truthy = transformer<
				string,
				string,
				[{ caseSensitive?: boolean; values?: readonly string[] }?],
				StringHelpers & BoolStrParsed
			>((innerTarget, options) => ({
				fn: (v: unknown): v is string => {
					const val = innerTarget.meta.transform ? innerTarget.meta.transform(v, v) : v;
					if (typeof val !== 'string') return false;
					const str = val as string;

					if (options?.values) {
						if (options.caseSensitive) return options.values.includes(str);
						const s = str.toLowerCase();
						return options.values.some(v_loop => v_loop.toLowerCase() === s);
					}

					const s = options?.caseSensitive ? str : str.toLowerCase();
					if (options?.caseSensitive) {
						return (
							boolStrVals.truthy.has(s) ||
							boolStrVals.truthyCapitalized.has(s) ||
							boolStrVals.truthyAllCaps.has(s)
						);
					}

					return boolStrVals.truthy.has(s);
				},
				meta: { name: `${innerTarget.meta.name}.truthy`, id: 'string' },
				helpers: { asBool } as any,
			}));

			const falsy = transformer<
				string,
				string,
				[{ caseSensitive?: boolean; values?: readonly string[] }?],
				StringHelpers & BoolStrParsed
			>((innerTarget, options) => ({
				fn: (v: unknown): v is string => {
					const val = innerTarget.meta.transform ? innerTarget.meta.transform(v, v) : v;
					if (typeof val !== 'string') return false;
					const str = val as string;

					if (options?.values) {
						if (options.caseSensitive) return options.values.includes(str);
						const s = str.toLowerCase();
						return options.values.some(v_loop => v_loop.toLowerCase() === s);
					}

					const s = options?.caseSensitive ? str : str.toLowerCase();
					if (options?.caseSensitive) {
						return (
							boolStrVals.falsy.has(s) ||
							boolStrVals.falsyCapitalized.has(s) ||
							boolStrVals.falsyAllCaps.has(s)
						);
					}

					return boolStrVals.falsy.has(s);
				},
				meta: { name: `${innerTarget.meta.name}.falsy`, id: 'string' },
				helpers: { asBool } as any,
			}));

			return {
				fn: (v: unknown): v is string => {
					if (!target(v)) return false;
					const val = target.meta.transform ? target.meta.transform(v, v) : v;
					if (typeof val !== 'string') return false;
					const s = val.toLowerCase();
					return boolStrVals.truthy.has(s) || boolStrVals.falsy.has(s);
				},
				meta: { name: `${target.meta.name}.boolStr`, id: 'string', jsonSchema: { ...target.meta.jsonSchema, _format: 'boolStr' } },
				helpers: { truthy: truthy as any, falsy: falsy as any, asBool: asBool as any } as any,
			};
		})
	) as any,
	parsedJson: transformer<string, any, [any?], {}>(
		<TParsed = unknown>(
			target: Guard<string, Record<string, any>>,
			options?: {
				schema?: Guard<TParsed>;
				type?: 'object' | 'array';
				maxDepth?: number;
				safe?: boolean;
			}
		) => ({
			fn: (v: unknown): v is string => {
				if (!target(v)) return false;
				const val = target.meta.transform ? target.meta.transform(v, v) : v;
				if (typeof val !== 'string') return false;
				try {
					const parsed = JSON.parse(val);
					if (
						options?.type === 'object' &&
						(typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
					)
						return false;
					if (options?.type === 'array' && !Array.isArray(parsed)) return false;
					if (options?.schema && !options.schema(parsed)) return false;
					if (options?.safe && !isSafeObject(parsed)) return false;
					if (options?.maxDepth && getObjectDepth(parsed) > options.maxDepth) return false;
					return true;
				} catch {
					return false;
				}
			},
			meta: { name: `${target.meta.name}.parsedJson` },
			transform: (v: string) => {
				const parsed = JSON.parse(v);
				return options?.schema?.meta.transform ? options.schema.meta.transform(parsed, parsed) : parsed;
			},
			helpers: {},
			replaceHelpers: true,
		})
	),
};

// JSON Schema contributions — picked up by the proxy when these helpers are applied.
(stringHelpers.email as any)[JSON_SCHEMA] = () => ({ format: 'email' });
(stringHelpers.url as any)[JSON_SCHEMA] = () => ({ format: 'uri' });
(stringHelpers.httpUrl as any)[JSON_SCHEMA] = () => ({ format: 'uri' });
(stringHelpers.hostname as any)[JSON_SCHEMA] = () => ({ format: 'hostname' });
(stringHelpers.emoji as any)[JSON_SCHEMA] = () => ({ _format: 'emoji' });
(stringHelpers.guid as any)[JSON_SCHEMA] = () => ({ format: 'uuid' });
(stringHelpers.uuidv4 as any)[JSON_SCHEMA] = () => ({ format: 'uuid' });
(stringHelpers.uuidv6 as any)[JSON_SCHEMA] = () => ({ format: 'uuid' });
(stringHelpers.uuidv7 as any)[JSON_SCHEMA] = () => ({ format: 'uuid' });
(stringHelpers.ipv4 as any)[JSON_SCHEMA] = () => ({ format: 'ipv4' });
(stringHelpers.ipv6 as any)[JSON_SCHEMA] = () => ({ format: 'ipv6' });
(stringHelpers.ulid as any)[JSON_SCHEMA] = () => ({ format: 'ulid' });
(stringHelpers.cuid as any)[JSON_SCHEMA] = () => ({ pattern: '^c[a-z0-9]{24}$' });
(stringHelpers.cuid2 as any)[JSON_SCHEMA] = () => ({ pattern: '^[a-z][a-z0-9]{1,}$' });
(stringHelpers.cidrv4 as any)[JSON_SCHEMA] = () => ({ _format: 'cidrv4' });
(stringHelpers.cidrv6 as any)[JSON_SCHEMA] = () => ({ _format: 'cidrv6' });
(stringHelpers.lowercase as any)[JSON_SCHEMA] = () => ({ pattern: '^[^A-Z]*$' });
(stringHelpers.uppercase as any)[JSON_SCHEMA] = () => ({ pattern: '^[^a-z]*$' });
// Factory helpers — receive the same args as the factory, return JSON Schema constraint.
(stringHelpers.min as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n });
(stringHelpers.max as any)[JSON_SCHEMA] = (n: number) => ({ maxLength: n });
(stringHelpers.length as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n, maxLength: n });
(stringHelpers.regex as any)[JSON_SCHEMA] = (re: RegExp) => ({ pattern: re.source });
(stringHelpers.includes as any)[JSON_SCHEMA] = (sub: string) => ({
	pattern: sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
});
(stringHelpers.startsWith as any)[JSON_SCHEMA] = (pfx: string) => ({
	pattern: `^${pfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
});
(stringHelpers.endsWith as any)[JSON_SCHEMA] = (sfx: string) => ({
	pattern: `${sfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
});
(stringHelpers.uuid as any)[JSON_SCHEMA] = () => ({ format: 'uuid' });
(stringHelpers.mac as any)[JSON_SCHEMA] = (options?: { delimiter?: ':' | '-' | '.' | 'none' }) => ({
	_format: 'mac',
	_macDelimiter: options?.delimiter ?? ':',
});
(stringHelpers.nanoid as any)[JSON_SCHEMA] = (options?: { length?: number }) => ({
	_format: 'nanoid',
	_nanoidLength: options?.length ?? 21,
});
(stringHelpers.base64 as any)[JSON_SCHEMA] = () => ({ _format: 'base64' });
(stringHelpers.hex as any)[JSON_SCHEMA] = (options?: {
	prefix?: boolean;
	evenLength?: boolean;
	case?: 'lower' | 'upper' | 'mixed';
}) => ({
	_format: 'hex',
	_hexPrefix: options?.prefix ?? false,
	_hexCase: options?.case ?? 'mixed',
	_hexEvenLength: options?.evenLength ?? false,
});
(stringHelpers.jwt as any)[JSON_SCHEMA] = () => ({ _format: 'jwt' });
(stringHelpers.json as any)[JSON_SCHEMA] = () => ({ _format: 'json' });

export const StringGuard: StringGuard = makeGuard(
	(v: unknown): v is string => typeof v === 'string',
	{
		name: 'string',
		id: 'string',
	},
	stringHelpers
);
