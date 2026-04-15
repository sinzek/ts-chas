/**
 * Test data generation for the Guard API.
 *
 * Builds fast-check `Arbitrary<T>` instances from guard metadata, so the
 * same source of truth (the guard) drives both validation and test data.
 *
 * Uses a dynamic import so `fast-check` is only loaded when actually needed.
 * If `fast-check` is not installed a clear error is thrown.
 */

import { GlobalErrs } from '../tagged-errs.js';
import type { Guard } from './shared.js';

/** @internal Lazily resolved fast-check module. */
let fc: typeof import('fast-check') | undefined;

async function loadFc(): Promise<typeof import('fast-check')> {
	if (fc) return fc;
	try {
		fc = await import('fast-check');
		return fc;
	} catch (e) {
		throw GlobalErrs.ChasErr({
			message: `[ts-chas] fast-check is required for .generate() and .arbitrary(); install it with \`npm install fast-check\``,
			origin: "import('fast-check');",
			cause: e,
		});
	}
}

// ---------------------------------------------------------------------------
// Arbitrary builder
// ---------------------------------------------------------------------------

/** @internal Builds a fast-check Arbitrary for the given guard. */
export function buildArbitrary(guard: Guard<any>, fc: typeof import('fast-check')): any {
	const meta = guard.meta;
	// Cast to any: JsonSchemaNode uses an index signature so dot-notation is blocked by TS
	const js: any = meta.jsonSchema ?? {};

	// ---- Leaf types --------------------------------------------------------

	if ((meta.id === 'literal' || meta.id === 'enum') && meta.values) {
		return fc.constantFrom(...meta.values);
	}

	if (meta.id === 'templateLiteral' && meta['parts']) {
		return fc.constantFrom(...meta['parts']);
	}

	if (meta.id === 'boolean' || meta.id === 'Boolean') {
		if (js.const === true) return fc.constant(true);
		if (js.const === false) return fc.constant(false);
		return fc.boolean();
	}

	if (meta.id === 'bigint') {
		return bigintArbitrary(js, fc);
	}

	if (meta.id === 'null') {
		return fc.constant(null);
	}

	if (meta.id === 'undefined') {
		return fc.constant(undefined);
	}

	if (meta.id === 'date' || meta.id === 'Date') {
		// Default to the safe range so extreme dates never cause toISOString() to throw.
		// Explicit minimum/maximum from helper annotations (e.g. after(), before()) override these.
		const constraints: import('fast-check').DateConstraints = {
			min: SAFE_DATE_CONSTRAINTS.min,
			max: SAFE_DATE_CONSTRAINTS.max,
		};
		if (js.minimum !== undefined) constraints.min = new Date(js.minimum);
		if (js.maximum !== undefined) constraints.max = new Date(js.maximum);
		let dateArb = fc.date(constraints);
		// Apply post-generation filters for semantic date constraints
		if (js._dateFilter === 'weekend') dateArb = dateArb.filter((d: Date) => d.getDay() === 0 || d.getDay() === 6);
		if (js._dateFilter === 'weekday') dateArb = dateArb.filter((d: Date) => d.getDay() > 0 && d.getDay() < 6);
		if (js._dateDay !== undefined) dateArb = dateArb.filter((d: Date) => d.getDay() === js._dateDay);
		if (js._dateMonth !== undefined) dateArb = dateArb.filter((d: Date) => d.getMonth() === js._dateMonth);
		if (js._dateDayOfMonth !== undefined) dateArb = dateArb.filter((d: Date) => d.getDate() === js._dateDayOfMonth);
		if (js._dateHour !== undefined) dateArb = dateArb.filter((d: Date) => d.getHours() === js._dateHour);
		if (js._dateMinute !== undefined) dateArb = dateArb.filter((d: Date) => d.getMinutes() === js._dateMinute);
		if (js._dateSecond !== undefined) dateArb = dateArb.filter((d: Date) => d.getSeconds() === js._dateSecond);
		if (js._dateMs !== undefined) dateArb = dateArb.filter((d: Date) => d.getMilliseconds() === js._dateMs);
		return dateArb;
	}

	if (meta.id === 'string') {
		return stringArbitrary(js, fc);
	}

	if (meta.id === 'number') {
		return numberArbitrary(js, fc);
	}

	// ---- Composite types ---------------------------------------------------

	if ((meta.id === 'union' || meta.id === 'xor') && Array.isArray(meta['guards'])) {
		return fc.oneof(...(meta['guards'] as Guard<any>[]).map(g => buildArbitrary(g, fc)));
	}

	if (meta.id === 'intersection' && Array.isArray(meta['guards'])) {
		// Intersection is hard to generate correctly; best-effort: generate from the first guard
		return buildArbitrary((meta['guards'] as Guard<any>[])[0]!, fc);
	}

	if (meta.id === 'discriminatedUnion' && meta['variantMap'] && meta['discriminantKey']) {
		const variantArbs = Object.entries(meta['variantMap'] as Record<string, Guard<any>>).map(
			([disc, variantGuard]) => {
				const base = buildArbitrary(variantGuard, fc);
				// Inject the discriminant key via map
				return base.map((v: any) => ({ ...v, [meta['discriminantKey'] as string]: disc }));
			}
		);
		return fc.oneof(...variantArbs);
	}

	if (meta.id === 'object') {
		return objectArbitrary(guard, fc);
	}

	if (meta.id === 'array') {
		return arrayArbitrary(guard, fc);
	}

	if (meta.id === 'tuple') {
		const tupleGuards = meta['tupleGuards'] as Guard<any>[] | undefined;
		const restGuard = meta['restGuard'] as Guard<any> | undefined;
		const fixedArbs = (tupleGuards ?? []).map(g => buildArbitrary(g, fc));
		if (!fixedArbs.length) return fc.constant([]);
		const fixedArb = fc.tuple(...fixedArbs);
		if (!restGuard) return fixedArb;
		const restArb = fc.array(buildArbitrary(restGuard, fc));
		return fc.tuple(fixedArb, restArb).map(([fixed, rest]: [any[], any[]]) => [...fixed, ...rest]);
	}

	if (meta.id === 'record') {
		const keyGuard = meta['keyGuard'] as Guard<any> | undefined;
		const valGuard = meta['valueGuard'] as Guard<any> | undefined;
		const keyArb = keyGuard ? buildArbitrary(keyGuard, fc) : fc.string();
		const valueArb = valGuard ? buildArbitrary(valGuard, fc) : fc.anything();
		const constraints: import('fast-check').ArrayConstraints = {};
		if (js.minProperties !== undefined) constraints.minLength = js.minProperties;
		if (js.maxProperties !== undefined) constraints.maxLength = js.maxProperties;
		return fc
			.array(fc.tuple(keyArb, valueArb), constraints)
			.map((entries: [any, any][]) => Object.fromEntries(entries));
	}

	if (meta.id === 'URL') {
		return urlArbitrary(js, fc);
	}

	if (meta.id === 'map') {
		const keyGuard = meta['keyGuard'] as Guard<any> | undefined;
		const valueGuard = meta['valueGuard'] as Guard<any> | undefined;
		const keyArb = keyGuard ? buildArbitrary(keyGuard, fc) : fc.anything();
		const valueArb = valueGuard ? buildArbitrary(valueGuard, fc) : fc.anything();
		const constraints: import('fast-check').ArrayConstraints = {};
		if (js.minItems !== undefined) constraints.minLength = js.minItems;
		if (js.maxItems !== undefined) constraints.maxLength = js.maxItems;
		return fc.array(fc.tuple(keyArb, valueArb), constraints).map((entries: [any, any][]) => new Map(entries));
	}

	if (meta.id === 'set') {
		const elementGuard = meta['elementGuard'] as Guard<any> | undefined;
		const elementArb = elementGuard ? buildArbitrary(elementGuard, fc) : fc.anything();
		const constraints: import('fast-check').ArrayConstraints = {};
		if (js.minItems !== undefined) constraints.minLength = js.minItems;
		if (js.maxItems !== undefined) constraints.maxLength = js.maxItems;
		// uniqueArray prevents duplicate entries from shrinking the Set below minItems
		return (fc as any).uniqueArray(elementArb, constraints).map((items: any[]) => new Set(items));
	}

	// ---- nullable / optional wrapping (id stays the base type) ------------
	// These are handled inline above via js._nullable / js._optional.
	// If we reach here for 'lazy', 'custom', etc. fall back to fc.anything().

	return fc.anything();
}

// ---------------------------------------------------------------------------
// Type-specific helpers
// ---------------------------------------------------------------------------

/** Safe date range: years 1000–9000 always produce standard 4-digit-year ISO strings. */
const SAFE_DATE_CONSTRAINTS = {
	min: new Date('1000-01-01T00:00:00.000Z'),
	max: new Date('9000-12-31T23:59:59.999Z'),
};

function hostnameArbitrary(fc: typeof import('fast-check')): any {
	const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
	const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
	// Build a label: starts with a letter, followed by 1-7 alphanumeric chars
	const firstChar = fc.nat({ max: 25 }).map((i: number) => ALPHA[i]!);
	const restChars = fc
		.array(fc.nat({ max: 35 }), { minLength: 1, maxLength: 7 })
		.map((a: number[]) => a.map(i => ALNUM[i]).join(''));
	const tld = fc.constantFrom('com', 'org', 'net', 'io', 'dev', 'app', 'co', 'info');
	return fc
		.tuple(firstChar, restChars, tld)
		.map(([first, rest, t]: [string, string, string]) => `${first}${rest}.${t}`);
}

function stringArbitrary(js: any, fc: typeof import('fast-check')): any {
	// Enum-constrained string (e.g. from .asString on a boolean, or literal sets)
	if (Array.isArray(js.enum)) {
		return fc.constantFrom(...js.enum);
	}

	// Format-specific arbitraries (fast-check has dedicated generators for common formats)
	switch (js.format) {
		case 'email':
			// fc.emailAddress() can produce quoted/special-char local parts that fail
			// strict email regexes. Use nat→base36 to build a clean alphanumeric template.
			return fc
				.tuple(
					fc.nat({ max: 999999 }).map((n: number) => (n + 100000).toString(36)),
					fc.nat({ max: 99999 }).map((n: number) => (n + 10000).toString(36)),
					fc.constantFrom('com', 'org', 'net', 'io', 'dev')
				)
				.map((parts: any[]) => `${parts[0]}@${parts[1]}.${parts[2]}`);
		case 'uuid':
			return fc.uuid();
		case 'ipv4':
			return fc.ipV4();
		case 'ipv6':
			return fc.ipV6();
		case 'uri':
		case 'url':
			return fc.webUrl();
		case 'hostname':
			return hostnameArbitrary(fc);
		case 'ulid': {
			const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
			return fc
				.array(fc.nat({ max: 31 }), { minLength: 26, maxLength: 26 })
				.map((a: number[]) => a.map(i => ULID_CHARS[i]).join(''));
		}
		case 'date-time':
			if (js._isoDatetime) return isoDatetimeArbitrary(js, fc);
			// Constrain to years 1000–9000 so toISOString() always produces the
			// standard 4-digit-year format rather than the extended ±YYYYYY form.
			return fc
				.date({ min: new Date('1000-01-01T00:00:00.000Z'), max: new Date('9000-12-31T23:59:59.999Z') })
				.map((d: Date) => d.toISOString());
		case 'date':
			return fc.date(SAFE_DATE_CONSTRAINTS).map((d: Date) => d.toISOString().split('T')[0]!);
	}

	// Custom _format markers — more specific than generic pattern/length constraints
	if (js._format === 'emoji') {
		const EMOJIS = ['😀', '😂', '❤️', '🔥', '✅', '🚀', '🎉', '👍', '🌍', '💡', '🎸', '🌈', '⭐', '🦊', '🍕'];
		return fc.tuple(fc.string(), fc.constantFrom(...EMOJIS)).map(([s, e]: [string, string]) => `${s}${e}`);
	}

	if (js._format === 'cidrv4') {
		return fc
			.tuple(
				fc.nat({ max: 255 }),
				fc.nat({ max: 255 }),
				fc.nat({ max: 255 }),
				fc.nat({ max: 255 }),
				fc.nat({ max: 32 })
			)
			.map(([a, b, c, d, mask]: number[]) => `${a}.${b}.${c}.${d}/${mask}`);
	}

	if (js._format === 'cidrv6') {
		return fc
			.tuple(fc.array(fc.nat({ max: 0xffff }), { minLength: 8, maxLength: 8 }), fc.nat({ max: 128 }))
			.map(([groups, mask]: [number[], number]) => {
				const raw = groups.map((n: number) => n.toString(16)).join(':');
				// Normalize via the URL parser so the guard's hostname comparison passes
				const normalized = new URL(`http://[${raw}]`).hostname.slice(1, -1);
				return `${normalized}/${mask}`;
			});
	}

	if (js._format === 'boolStr') {
		return fc.constantFrom('true', 'false', '1', '0', 'yes', 'no', 'on', 'off');
	}

	if (js._format === 'mac') {
		const delimiter: string = js._macDelimiter ?? ':';
		const hexByte = fc.nat({ max: 255 }).map((n: number) => n.toString(16).padStart(2, '0'));
		if (delimiter === 'none') {
			return fc.array(hexByte, { minLength: 6, maxLength: 6 }).map((bytes: string[]) => bytes.join(''));
		} else if (delimiter === '.') {
			const hexWord = fc.nat({ max: 0xffff }).map((n: number) => n.toString(16).padStart(4, '0'));
			return fc.array(hexWord, { minLength: 3, maxLength: 3 }).map((words: string[]) => words.join('.'));
		} else {
			return fc.array(hexByte, { minLength: 6, maxLength: 6 }).map((bytes: string[]) => bytes.join(delimiter));
		}
	}

	if (js._format === 'nanoid') {
		const NANOID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
		const len: number = js._nanoidLength ?? 21;
		return fc
			.array(fc.nat({ max: 63 }), { minLength: len, maxLength: len })
			.map((a: number[]) => a.map(i => NANOID_CHARS[i]).join(''));
	}

	if (js._format === 'base64') {
		return fc.uint8Array({ minLength: 1, maxLength: 48 }).map((bytes: Uint8Array) => {
			if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
			return btoa(String.fromCharCode(...bytes));
		});
	}

	if (js._format === 'hex') {
		const hexCase: string = js._hexCase ?? 'mixed';
		const withPrefix: boolean = js._hexPrefix ?? false;
		const evenLength: boolean = js._hexEvenLength ?? false;
		// Always generate whole bytes so length is always even (satisfies evenLength constraint too)
		return fc.uint8Array({ minLength: 1, maxLength: 16 }).map((bytes: Uint8Array) => {
			let hex = Array.from(bytes)
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');
			if (hexCase === 'upper') hex = hex.toUpperCase();
			else if (hexCase === 'lower') hex = hex.toLowerCase();
			// 'mixed' — keep as lowercase (passes the guard's mixed constraint)
			if (!evenLength) {
				// Strip a leading zero to occasionally produce odd-length strings
				// only when even length is not required; but since we build from
				// whole bytes it is always even, which is always valid.
			}
			return withPrefix ? `0x${hex}` : hex;
		});
	}

	if (js._format === 'jwt') {
		const b64url = (obj: object): string => {
			const json = JSON.stringify(obj);
			if (typeof Buffer !== 'undefined') return Buffer.from(json).toString('base64url');
			return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
		};
		return fc
			.tuple(
				fc.constantFrom('HS256', 'HS384', 'HS512', 'RS256'),
				fc.nat({ max: 999999 }).map((n: number) => `sub${n}`)
			)
			.map(([alg, sub]: [string, string]) => {
				const header = b64url({ alg, typ: 'JWT' });
				const payload = b64url({ sub, iat: Math.floor(Date.now() / 1000) });
				// Signature is a fixed base64url string (structurally valid, not cryptographically real)
				return `${header}.${payload}.fakesignature`;
			});
	}

	if (js._format === 'json') {
		const valueArb = (fc as any).jsonValue ? (fc as any).jsonValue() : fc.constant(null);
		return valueArb.map((v: unknown) => JSON.stringify(v));
	}

	if (js._format === 'hash') {
		const alg: string = js._hashAlg ?? 'sha256';
		const enc: string = js._hashEnc ?? 'hex';
		const byteLengths: Record<string, number> = {
			md5: 16,
			sha1: 20,
			sha256: 32,
			sha384: 48,
			sha512: 64,
		};
		const byteCount = byteLengths[alg] ?? 32;

		if (enc === 'hex') {
			return fc.uint8Array({ minLength: byteCount, maxLength: byteCount }).map((b: Uint8Array) =>
				Array.from(b)
					.map(byte => byte.toString(16).padStart(2, '0'))
					.join('')
			);
		} else if (enc === 'base64') {
			return fc.uint8Array({ minLength: byteCount, maxLength: byteCount }).map((b: Uint8Array) => {
				if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
				return btoa(String.fromCharCode(...b));
			});
		} else {
			// base64url
			return fc.uint8Array({ minLength: byteCount, maxLength: byteCount }).map((b: Uint8Array) => {
				if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64url');
				return btoa(String.fromCharCode(...b))
					.replace(/\+/g, '-')
					.replace(/\//g, '_')
					.replace(/=/g, '');
			});
		}
	}

	// Pattern-based arbitrary
	if (js.pattern) {
		try {
			return (fc as any).stringMatching(new RegExp(js.pattern));
		} catch {
			// stringMatching not available in older fast-check versions — fall through
		}
	}

	// Length-constrained string
	const constraints: import('fast-check').StringConstraints = {};
	if (js.minLength !== undefined) constraints.minLength = js.minLength;
	if (js.maxLength !== undefined) constraints.maxLength = js.maxLength;
	return fc.string(constraints);
}

function isoDatetimeArbitrary(js: any, fc: typeof import('fast-check')): any {
	const allowOffset: boolean = js._isoOffset !== false; // default true
	const precision: number | undefined = js._isoPrecision;

	return fc.date(SAFE_DATE_CONSTRAINTS).map((d: Date) => {
		const datePart = d.toISOString().split('T')[0]!; // YYYY-MM-DD

		const h = String(d.getUTCHours()).padStart(2, '0');
		const m = String(d.getUTCMinutes()).padStart(2, '0');
		const s = String(d.getUTCSeconds()).padStart(2, '0');
		const ms = String(d.getUTCMilliseconds()).padStart(3, '0');

		// Build the time portion according to precision
		let timePart: string;
		if (precision === -1) {
			timePart = `${h}:${m}`;
		} else if (precision === 0) {
			timePart = `${h}:${m}:${s}`;
		} else if (precision !== undefined) {
			// Exactly N sub-second digits — pad or truncate the 3-digit ms value
			const subSec = ms.padEnd(precision, '0').slice(0, precision);
			timePart = `${h}:${m}:${s}.${subSec}`;
		} else {
			// Arbitrary precision — use milliseconds (always 3 digits)
			timePart = `${h}:${m}:${s}.${ms}`;
		}

		// Build the timezone suffix
		// offset=false  → no suffix (local datetime)
		// offset=true   → Z always (satisfies the required-timezone constraint)
		// local=true    → timezone optional, use Z (always valid)
		const tzPart = allowOffset ? 'Z' : '';

		return `${datePart}T${timePart}${tzPart}`;
	});
}

function numberArbitrary(js: any, fc: typeof import('fast-check')): any {
	const isInt = js.type === 'integer';

	let min: number | undefined = js.minimum;
	let max: number | undefined = js.maximum;

	if (typeof js.exclusiveMinimum === 'number') {
		min = isInt ? js.exclusiveMinimum + 1 : js.exclusiveMinimum + Number.EPSILON;
	}
	if (typeof js.exclusiveMaximum === 'number') {
		max = isInt ? js.exclusiveMaximum - 1 : js.exclusiveMaximum - Number.EPSILON;
	}

	// _digits: generate a positive integer with exactly n digits (e.g. n=3 → 100–999)
	if (js._digits !== undefined) {
		const n: number = js._digits;
		const lo = n === 1 ? 0 : Math.pow(10, n - 1);
		const hi = Math.pow(10, n) - 1;
		return fc.integer({ min: lo, max: hi });
	}

	// multipleOf: generate a multiple of n, optionally within bounds.
	// Also used by `even` (multipleOf: 2).
	if (js.multipleOf !== undefined) {
		const step: number = js.multipleOf;
		const minK = min !== undefined ? Math.ceil(min / step) : -1000;
		const maxK = max !== undefined ? Math.floor(max / step) : 1000;
		return fc.integer({ min: minK, max: maxK }).map((k: number) => k * step);
	}

	// _oddNumber: generate an odd integer via the bijection k → 2k + 1
	if (js._oddNumber) {
		const minI = Math.ceil(min ?? -999);
		const maxI = Math.floor(max ?? 999);
		const kMin = Math.ceil((minI - 1) / 2);
		const kMax = Math.floor((maxI - 1) / 2);
		return fc.integer({ min: kMin, max: kMax }).map((k: number) => 2 * k + 1);
	}

	// _precision: generate a number with at most n decimal places by dividing
	// an integer by 10^n (trailing zeros are dropped by JS automatically).
	if (js._precision !== undefined) {
		const n: number = js._precision;
		const scale = Math.pow(10, n);
		const safeMin = min ?? -1e6;
		const safeMax = max ?? 1e6;
		return fc
			.integer({ min: Math.ceil(safeMin * scale), max: Math.floor(safeMax * scale) })
			.map((k: number) => k / scale);
	}

	if (isInt) {
		const constraints: import('fast-check').IntegerConstraints = {};
		if (min !== undefined) constraints.min = Math.ceil(min);
		if (max !== undefined) constraints.max = Math.floor(max);
		return fc.integer(constraints);
	}

	// fc.float() can generate NaN/Infinity which guard predicates reject.
	// fc.double() with noNaN + finite bounds is reliable.
	const safeMin = min ?? -1e9;
	const safeMax = max ?? 1e9;
	return fc.double({ min: safeMin, max: safeMax, noNaN: true });
}

function bigintArbitrary(js: any, fc: typeof import('fast-check')): any {
	let min: bigint = -1000000n;
	let max: bigint = 1000000n;

	if (js._bigintMin !== undefined) min = BigInt(js._bigintMin);
	if (js._bigintExclusiveMin !== undefined) min = BigInt(js._bigintExclusiveMin) + 1n;
	if (js._bigintMax !== undefined) max = BigInt(js._bigintMax);
	if (js._bigintExclusiveMax !== undefined) max = BigInt(js._bigintExclusiveMax) - 1n;

	// _bigintDigits: exactly n-digit positive bigint (e.g. n=3 → 100–999)
	if (js._bigintDigits !== undefined) {
		const n: number = js._bigintDigits;
		const lo = n === 1 ? 0n : BigInt(Math.pow(10, n - 1));
		const hi = BigInt(Math.pow(10, n)) - 1n;
		return fc.bigInt({ min: lo, max: hi });
	}

	// _bigintMultipleOf: generate a multiple of n within the bounds
	if (js._bigintMultipleOf !== undefined) {
		const step = BigInt(js._bigintMultipleOf);
		const minK = min / step;
		const maxK = max / step;
		return fc.bigInt({ min: minK, max: maxK }).map((k: bigint) => k * step);
	}

	// _bigintEven: generate even bigint via k → 2k
	if (js._bigintEven) {
		return fc.bigInt({ min: min / 2n, max: max / 2n }).map((k: bigint) => k * 2n);
	}

	// _bigintOdd: generate odd bigint via k → 2k+1
	if (js._bigintOdd) {
		const kMin = (min - 1n) / 2n;
		const kMax = (max - 1n) / 2n;
		return fc.bigInt({ min: kMin, max: kMax }).map((k: bigint) => 2n * k + 1n);
	}

	return fc.bigInt({ min, max });
}

function urlArbitrary(js: any, fc: typeof import('fast-check')): any {
	const protocol: string | undefined = js._urlProtocol;
	const isLocal: boolean = js._urlLocal ?? false;

	if (isLocal) {
		return fc.nat({ max: 8999 }).map((n: number) => {
			let url = `http://localhost:${n + 1000}`;
			if (js._urlHasSearch) url += '?q=test';
			if (js._urlHasHash) url += '#section';
			return url;
		});
	}

	const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
	const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const firstChar = fc.nat({ max: 25 }).map((i: number) => ALPHA[i]!);
	const restChars = fc
		.array(fc.nat({ max: 35 }), { minLength: 1, maxLength: 7 })
		.map((a: number[]) => a.map(i => ALNUM[i]).join(''));
	const tld = fc.constantFrom('com', 'org', 'net', 'io', 'dev', 'app');
	const proto = protocol ? fc.constant(protocol) : fc.constantFrom('http', 'https');
	const portPart = js._urlPort !== undefined ? fc.constant(`:${js._urlPort}`) : fc.constant('');
	const searchPart = js._urlHasSearch ? fc.constant('?q=test') : fc.constant('');
	const hashPart = js._urlHasHash ? fc.constant('#section') : fc.constant('');

	return fc
		.tuple(proto, firstChar, restChars, tld, portPart, searchPart, hashPart)
		.map(
			([p, first, rest, t, port, search, hash]: string[]) => `${p}://${first}${rest}.${t}${port}${search}${hash}`
		);
}

function objectArbitrary(guard: Guard<any>, fc: typeof import('fast-check')): any {
	const shape = guard.meta.shape as Record<string, Guard<any>> | undefined;
	const js = guard.meta.jsonSchema ?? {};
	if (!shape || Object.keys(shape).length === 0) {
		if (js.minProperties !== undefined || js.maxProperties !== undefined) {
			const minLen: number = js.minProperties ?? 0;
			const maxLen: number = js.maxProperties ?? Math.max(minLen, 5);
			return fc
				.array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.anything()), {
					minLength: minLen,
					maxLength: maxLen,
				})
				.map((entries: [string, any][]) => Object.fromEntries(entries));
		}
		return fc.object();
	}

	const record: Record<string, any> = {};
	for (const [key, fieldGuard] of Object.entries(shape)) {
		let arb = buildArbitrary(fieldGuard, fc);
		const fieldJs = fieldGuard.meta.jsonSchema ?? {};
		if (fieldJs._nullable) arb = fc.oneof(arb, fc.constant(null));
		if (fieldJs._optional) arb = fc.option(arb, { nil: undefined });
		record[key] = arb;
	}
	return fc.record(record);
}

function arrayArbitrary(guard: Guard<any>, fc: typeof import('fast-check')): any {
	const elementGuards = guard.meta['elementGuards'] as Guard<any>[] | undefined;
	const js = guard.meta.jsonSchema ?? {};

	const itemArb = elementGuards?.length
		? elementGuards.length === 1
			? buildArbitrary(elementGuards[0]!, fc)
			: fc.oneof(...elementGuards.map(g => buildArbitrary(g, fc)))
		: fc.anything();

	const constraints: import('fast-check').ArrayConstraints = {};
	if (js.minItems !== undefined) constraints.minLength = js.minItems;
	if (js.maxItems !== undefined) constraints.maxLength = js.maxItems;

	// uniqueItems: use uniqueArray so shrinking can't produce duplicates
	if (js.uniqueItems) {
		return (fc as any).uniqueArray(itemArb, constraints);
	}

	let arb = fc.array(itemArb, constraints);

	// _arrayIncludes: the required item must always be present in generated arrays
	if (js['_arrayIncludes'] !== undefined) {
		const required = js['_arrayIncludes'];
		arb = arb.map((items: any[]) => [required, ...items.filter((i: any) => i !== required)]);
	}

	return arb;
}

// ---------------------------------------------------------------------------
// Public terminal implementations (called by shared.ts)
// ---------------------------------------------------------------------------

/**
 * Returns a Promise that resolves to a fast-check `Arbitrary<T>` for this guard.
 *
 * Use this when you want to integrate with fast-check's property testing directly.
 *
 * @example
 * ```ts
 * import * as fc from 'fast-check';
 * const arb = await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).arbitrary();
 * fc.assert(fc.property(arb, user => validate(user)));
 * ```
 */
export async function arbitraryTerminal(guard: Guard<any>): Promise<any> {
	const fc = await loadFc();
	return buildArbitrary(guard, fc);
}

/**
 * Generates `n` valid values (default: 1) that satisfy this guard.
 *
 * Returns a single value when called with no argument, or an array of `n` values.
 *
 * @example
 * ```ts
 * is.string.email.generate()        // 'x@example.com'
 * is.number.int.between(1, 100).generate(5)  // [7, 42, 3, 88, 15]
 * ```
 */
export async function generateTerminal(guard: Guard<any>, n?: number): Promise<any> {
	const fc = await loadFc();
	const arb = buildArbitrary(guard, fc);
	const samples = fc.sample(arb, n ?? 1);
	return n === undefined ? samples[0] : samples;
}
