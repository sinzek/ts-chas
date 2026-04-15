import { describe, it, expect } from 'vitest';
import { is, type Guard } from '../../src/guard/index.js';

// Helper: assert all values pass the guard
function allValid<T>(guard: Guard<T, any>, values: T[]): boolean {
	return values.every(v => guard(v));
}

describe('.generate() and .arbitrary()', () => {
	// ---- primitives -------------------------------------------------------

	it('generates strings', async () => {
		const val = await is.string.generate();
		expect(typeof val).toBe('string');

		const iso = await is.string.iso.generate();
		expect(is.string.iso(iso)).toBe(true);
	});

	it('generates numbers', async () => {
		const val = await is.number.generate();
		expect(typeof val).toBe('number');
	});

	it('generates booleans', async () => {
		const val = await is.boolean.generate();
		expect(typeof val).toBe('boolean');
	});

	it('generates bigints', async () => {
		const val = await is.bigint.generate();
		expect(typeof val).toBe('bigint');
	});

	// ---- n > 1 returns an array -------------------------------------------

	it('generate(n) returns n values', async () => {
		const vals = await is.string.generate(5);
		expect(Array.isArray(vals)).toBe(true);
		expect(vals.length).toBe(5);
	});

	it('generate() (no arg) returns a single value, not an array', async () => {
		const val = await is.number.generate();
		expect(Array.isArray(val)).toBe(false);
	});

	// ---- constraints are respected ----------------------------------------

	it('string.email generates valid emails', async () => {
		const vals = await is.string.email.generate(20);
		expect(allValid(is.string.email, vals)).toBe(true);
	});

	it('string.min(5) generates strings of at least 5 chars', async () => {
		const vals = await is.string.min(5).generate(20);
		expect(vals.every(v => v.length >= 5)).toBe(true);
	});

	it('string.max(10) generates strings of at most 10 chars', async () => {
		const vals = await is.string.max(10).generate(20);
		expect(vals.every(v => v.length <= 10)).toBe(true);
	});

	it('string.min(3).max(8) respects both bounds', async () => {
		const vals = await is.string.min(3).max(8).generate(30);
		expect(vals.every(v => v.length >= 3 && v.length <= 8)).toBe(true);
	});

	it('number.int.gte(0).lte(100) generates integers in range', async () => {
		const vals = await is.number.int.gte(0).lte(100).generate(30);
		expect(vals.every(v => Number.isInteger(v) && v >= 0 && v <= 100)).toBe(true);
	});

	it('number.positive generates positive numbers', async () => {
		const vals = await is.number.positive.generate(20);
		expect(vals.every(v => v > 0)).toBe(true);
	});

	it('number.between(1, 10) stays in range', async () => {
		const vals = await is.number.between(1, 10).generate(20);
		expect(vals.every(v => v >= 1 && v <= 10)).toBe(true);
	});

	it('number.even generates even numbers', async () => {
		const vals = await is.number.even.generate(30);
		expect(vals.every(v => v % 2 === 0)).toBe(true);
		expect(allValid(is.number.even, vals)).toBe(true);
	});

	it('number.odd generates odd numbers', async () => {
		const vals = await is.number.odd.generate(30);
		expect(vals.every(v => Math.abs(v % 2) === 1)).toBe(true);
		expect(allValid(is.number.odd, vals)).toBe(true);
	});

	it('number.multipleOf(3) generates multiples of 3', async () => {
		const vals = await is.number.multipleOf(3).generate(30);
		expect(vals.every(v => v % 3 === 0)).toBe(true);
		expect(allValid(is.number.multipleOf(3), vals)).toBe(true);
	});

	it('number.digits(3) generates 3-digit numbers that pass the guard', async () => {
		const vals = await is.number.digits(3).generate(20);
		expect(vals.every(v => String(v).replace('.', '').length === 3)).toBe(true);
		expect(allValid(is.number.digits(3), vals)).toBe(true);
	});

	it('number.precision(2) generates numbers with at most 2 decimal places', async () => {
		const vals = await is.number.precision(2).generate(30);
		expect(vals.every(v => (v.toString().split('.')[1]?.length ?? 0) <= 2)).toBe(true);
		expect(allValid(is.number.precision(2), vals)).toBe(true);
	});

	// ---- literal / enum ---------------------------------------------------

	it('literal values generate only the specified values', async () => {
		const vals = await is.literal('a', 'b', 'c').generate(30);
		expect(vals.every(v => ['a', 'b', 'c'].includes(v))).toBe(true);
	});

	it('enum values generate only enum members', async () => {
		const guard = is.enum(['red', 'green', 'blue']);
		const vals = await guard.generate(30);
		expect(vals.every(v => ['red', 'green', 'blue'].includes(v))).toBe(true);
	});

	// ---- objects ----------------------------------------------------------

	it('object guard generates objects matching the shape', async () => {
		const guard = is.object({ name: is.string.min(1), age: is.number.int.gte(0) });
		const vals = await guard.generate(20);
		expect(vals.every(v => is.string.min(1)(v.name) && is.number.int.gte(0)(v.age))).toBe(true);
	});

	// ---- arrays -----------------------------------------------------------

	it('array(is.number) generates arrays of numbers', async () => {
		const vals = await is.array(is.number).generate(10);
		expect(vals.every(arr => Array.isArray(arr) && arr.every(v => typeof v === 'number'))).toBe(true);
	});

	// ---- union ------------------------------------------------------------

	it('union generates values from either branch', async () => {
		const guard = is.union(is.string, is.number);
		const vals = await guard.generate(50);
		const hasString = vals.some(v => typeof v === 'string');
		const hasNumber = vals.some(v => typeof v === 'number');
		expect(hasString).toBe(true);
		expect(hasNumber).toBe(true);
	});

	// ---- discriminated union ----------------------------------------------

	it('discriminatedUnion generates values with correct discriminant', async () => {
		const guard = is.discriminatedUnion('kind', {
			circle: is.object({ radius: is.number.positive }),
			square: is.object({ side: is.number.positive }),
		});
		const vals = await guard.generate(30);
		expect(vals.every(v => v.kind === 'circle' || v.kind === 'square')).toBe(true);
		expect(vals.every(v => guard(v))).toBe(true);
	});

	// ---- .arbitrary() returns a fast-check Arbitrary ----------------------

	it('.arbitrary() returns an object with filter/map methods', async () => {
		const arb = await is.string.arbitrary();
		expect(typeof arb.filter).toBe('function');
		expect(typeof arb.map).toBe('function');
	});

	it('.arbitrary() can be used with fc.sample', async () => {
		const fc = await import('fast-check');
		const arb = await is.number.int.between(0, 10).arbitrary();
		const samples = fc.sample(arb, 20);
		expect(samples.every((v: number) => v >= 0 && v <= 10)).toBe(true);
	});

	// ---- UUID / IP / network formats --------------------------------------

	it('string.uuid() generates valid UUIDs', async () => {
		const vals = await is.string.uuid().generate(10);
		// UUID v4 pattern
		const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		expect(vals.every(v => uuidRe.test(v))).toBe(true);
	});

	it('string.ipv4 generates valid IPv4 addresses', async () => {
		const vals = await is.string.ipv4.generate(10);
		const ipv4Re = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
		expect(vals.every(v => ipv4Re.test(v))).toBe(true);
	});

	it('string.hostname generates valid hostnames that pass the guard', async () => {
		const vals = (await is.string.hostname.generate(20)) as string[];
		expect(allValid(is.string.hostname, vals)).toBe(true);
	});

	it('string.cidrv4 generates valid IPv4 CIDR blocks that pass the guard', async () => {
		const vals = (await is.string.cidrv4.generate(20)) as string[];
		expect(allValid(is.string.cidrv4, vals)).toBe(true);
	});

	it('string.cidrv6 generates valid IPv6 CIDR blocks that pass the guard', async () => {
		const vals = (await is.string.cidrv6.generate(20)) as string[];
		expect(allValid(is.string.cidrv6, vals)).toBe(true);
	});

	it('string.mac() generates valid MAC addresses (default colon delimiter)', async () => {
		const vals = (await is.string.mac().generate(20)) as string[];
		expect(allValid(is.string.mac(), vals)).toBe(true);
	});

	it('string.mac({ delimiter: "-" }) generates dash-delimited MACs', async () => {
		const vals = (await is.string.mac({ delimiter: '-' }).generate(20)) as string[];
		const macRe = /^([0-9a-f]{2}-){5}[0-9a-f]{2}$/i;
		expect(vals.every(v => macRe.test(v))).toBe(true);
		expect(allValid(is.string.mac({ delimiter: '-' }), vals)).toBe(true);
	});

	// ---- identifier formats -----------------------------------------------

	it('string.ulid generates valid ULIDs that pass the guard', async () => {
		const vals = (await is.string.ulid.generate(20)) as string[];
		expect(allValid(is.string.ulid, vals)).toBe(true);
	});

	it('string.cuid generates values matching the cuid pattern', async () => {
		const vals = (await is.string.cuid.generate(20)) as string[];
		expect(allValid(is.string.cuid, vals)).toBe(true);
	});

	it('string.cuid2 generates values matching the cuid2 pattern', async () => {
		const vals = (await is.string.cuid2.generate(20)) as string[];
		expect(allValid(is.string.cuid2, vals)).toBe(true);
	});

	it('string.nanoid() generates 21-char NanoIDs that pass the guard', async () => {
		const vals = (await is.string.nanoid().generate(20)) as string[];
		expect(vals.every(v => v.length === 21)).toBe(true);
		expect(allValid(is.string.nanoid(), vals)).toBe(true);
	});

	it('string.nanoid({ length: 10 }) generates 10-char NanoIDs', async () => {
		const vals = (await is.string.nanoid({ length: 10 }).generate(20)) as string[];
		expect(vals.every(v => v.length === 10)).toBe(true);
		expect(allValid(is.string.nanoid({ length: 10 }), vals)).toBe(true);
	});

	// ---- encoding formats -------------------------------------------------

	it('string.base64() generates valid base64 strings that pass the guard', async () => {
		const vals = await is.string.base64().generate(20);
		expect(allValid(is.string.base64(), vals)).toBe(true);
	});

	it('string.hex() generates valid hex strings that pass the guard', async () => {
		const vals = await is.string.hex().generate(20);
		expect(allValid(is.string.hex(), vals)).toBe(true);
	});

	it('string.hex({ case: "upper" }) generates uppercase hex', async () => {
		const vals = (await is.string.hex({ case: 'upper' }).generate(20)) as string[];
		expect(vals.every(v => /^[0-9A-F]+$/.test(v))).toBe(true);
		expect(allValid(is.string.hex({ case: 'upper' }), vals)).toBe(true);
	});

	// ---- hash formats -----------------------------------------------------

	it('string.hash() generates sha256 hex hashes (64 chars) that pass the guard', async () => {
		const vals = (await is.string.hash().generate(20)) as string[];
		expect(vals.every(v => v.length === 64)).toBe(true);
		expect(allValid(is.string.hash(), vals)).toBe(true);
	});

	it('string.hash({ alg: "sha1" }) generates 40-char sha1 hashes', async () => {
		const vals = (await is.string.hash({ alg: 'sha1' }).generate(20)) as string[];
		expect(vals.every(v => v.length === 40)).toBe(true);
		expect(allValid(is.string.hash({ alg: 'sha1' }), vals)).toBe(true);
	});

	// ---- other string formats ---------------------------------------------

	it('string.emoji generates strings containing at least one emoji', async () => {
		const vals = (await is.string.emoji.generate(20)) as string[];
		expect(allValid(is.string.emoji, vals)).toBe(true);
	});

	it('string.boolStr generates boolean string values that pass the guard', async () => {
		const vals = (await is.string.boolStr.generate(30)) as string[];
		expect(allValid(is.string.boolStr, vals)).toBe(true);
	});

	it('string.jwt() generates structurally valid JWTs that pass the guard', async () => {
		const vals = (await is.string.jwt().generate(20)) as string[];
		expect(allValid(is.string.jwt(), vals)).toBe(true);
	});

	it('string.json() generates valid JSON strings that pass the guard', async () => {
		const vals = (await is.string.json().generate(20)) as string[];
		expect(allValid(is.string.json(), vals)).toBe(true);
	});

	// ---- boolean constraints ----------------------------------------------

	it('boolean.true always generates true', async () => {
		const vals = await is.boolean.true.generate(20);
		expect(vals.every((v: boolean) => v === true)).toBe(true);
	});

	it('boolean.false always generates false', async () => {
		const vals = await is.boolean.false.generate(20);
		expect(vals.every((v: boolean) => v === false)).toBe(true);
	});

	it('boolean.asString generates "true" or "false" strings', async () => {
		const vals = await (is.boolean.asString as any).generate(30);
		expect(vals.every((v: string) => v === 'true' || v === 'false')).toBe(true);
	});

	// ---- bigint constraints -----------------------------------------------

	it('bigint.positive generates positive bigints', async () => {
		const vals = await is.bigint.positive.generate(20);
		expect(vals.every((v: bigint) => v > 0n)).toBe(true);
		expect(allValid(is.bigint.positive, vals)).toBe(true);
	});

	it('bigint.negative generates negative bigints', async () => {
		const vals = await is.bigint.negative.generate(20);
		expect(vals.every((v: bigint) => v < 0n)).toBe(true);
		expect(allValid(is.bigint.negative, vals)).toBe(true);
	});

	it('bigint.gte(10n) generates bigints >= 10n', async () => {
		const vals = await is.bigint.gte(10n).generate(20);
		expect(vals.every((v: bigint) => v >= 10n)).toBe(true);
		expect(allValid(is.bigint.gte(10n), vals)).toBe(true);
	});

	it('bigint.lte(5n) generates bigints <= 5n', async () => {
		const vals = await is.bigint.lte(5n).generate(20);
		expect(vals.every((v: bigint) => v <= 5n)).toBe(true);
		expect(allValid(is.bigint.lte(5n), vals)).toBe(true);
	});

	it('bigint.between(1n, 100n) stays in range', async () => {
		const vals = await is.bigint.between(1n, 100n).generate(20);
		expect(vals.every((v: bigint) => v >= 1n && v <= 100n)).toBe(true);
		expect(allValid(is.bigint.between(1n, 100n), vals)).toBe(true);
	});

	it('bigint.even generates even bigints', async () => {
		const vals = await is.bigint.even.generate(20);
		expect(vals.every((v: bigint) => v % 2n === 0n)).toBe(true);
		expect(allValid(is.bigint.even, vals)).toBe(true);
	});

	it('bigint.odd generates odd bigints', async () => {
		const vals = await is.bigint.odd.generate(20);
		expect(vals.every((v: bigint) => v % 2n !== 0n)).toBe(true);
		expect(allValid(is.bigint.odd, vals)).toBe(true);
	});

	it('bigint.multipleOf(3n) generates multiples of 3n', async () => {
		const vals = await is.bigint.multipleOf(3n).generate(20);
		expect(vals.every((v: bigint) => v % 3n === 0n)).toBe(true);
		expect(allValid(is.bigint.multipleOf(3n), vals)).toBe(true);
	});

	it('bigint.int32 generates bigints in 32-bit signed range', async () => {
		const vals = await is.bigint.int32.generate(20);
		expect(vals.every((v: bigint) => v >= -2147483648n && v <= 2147483647n)).toBe(true);
		expect(allValid(is.bigint.int32, vals)).toBe(true);
	});

	// ---- ISO date formats -------------------------------------------------

	it('string.iso generates valid ISO 8601 strings that pass the guard', async () => {
		const vals = (await is.string.iso.generate(20)) as string[];
		expect(allValid(is.string.iso, vals)).toBe(true);
	});

	it('string.iso.date generates YYYY-MM-DD date strings', async () => {
		const vals = (await is.string.iso.date.generate(20)) as string[];
		const dateRe = /^\d{4}-\d{2}-\d{2}$/;
		expect(vals.every(v => dateRe.test(v))).toBe(true);
		expect(allValid(is.string.iso.date, vals)).toBe(true);
	});

	it('string.iso.datetime() generates full ISO datetime strings with timezone', async () => {
		const vals = (await is.string.iso.datetime().generate(20)) as string[];
		expect(allValid(is.string.iso.datetime(), vals)).toBe(true);
	});

	it('string.iso.datetime({ offset: false }) generates local datetimes (no timezone)', async () => {
		const guard = is.string.iso.datetime({ offset: false });
		const vals = (await guard.generate(20)) as string[];
		expect(vals.every(v => !/Z$|[+-]\d{2}:\d{2}$/.test(v))).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});

	it('string.iso.datetime({ precision: 0 }) generates datetimes with seconds only', async () => {
		const guard = is.string.iso.datetime({ precision: 0 });
		const vals = (await guard.generate(20)) as string[];
		// HH:mm:ss — no sub-second part
		expect(vals.every(v => !/\.\d+/.test(v))).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});

	it('string.iso.datetime({ precision: -1 }) generates minute-only datetimes', async () => {
		const guard = is.string.iso.datetime({ precision: -1 });
		const vals = (await guard.generate(20)) as string[];
		// HH:mm — no seconds
		const minuteOnlyRe = /T\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
		expect(vals.every(v => minuteOnlyRe.test(v))).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});

	it('string.iso.datetime({ precision: 6 }) generates datetimes with exactly 6 sub-second digits', async () => {
		const guard = is.string.iso.datetime({ precision: 6 });
		const vals = (await guard.generate(20)) as string[];
		expect(vals.every(v => /\.\d{6}/.test(v))).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Built-in types: Date, URL, Map, Set
// ---------------------------------------------------------------------------

describe('built-in type generation', () => {
	// ---- Date ---------------------------------------------------------------

	it('is.date generates valid Date objects', async () => {
		const vals = (await is.date.generate(10)) as Date[];
		expect(vals.every(v => v instanceof Date && !isNaN(v.getTime()))).toBe(true);
	});

	it('is.date.future generates dates in the future', async () => {
		const before = Date.now();
		const vals = (await is.date.future.generate(20)) as Date[];
		expect(vals.every(v => v.getTime() > before)).toBe(true);
		expect(allValid(is.date.future, vals)).toBe(true);
	});

	it('is.date.past generates dates in the past', async () => {
		const now = Date.now();
		const vals = (await is.date.past.generate(20)) as Date[];
		expect(vals.every(v => v.getTime() < now)).toBe(true);
		expect(allValid(is.date.past, vals)).toBe(true);
	});

	it('is.date.after(d) generates dates strictly after d', async () => {
		const d = new Date('2000-01-01');
		const vals = (await is.date.after(d).generate(20)) as Date[];
		expect(vals.every(v => v.getTime() > d.getTime())).toBe(true);
		expect(allValid(is.date.after(d), vals)).toBe(true);
	});

	it('is.date.before(d) generates dates strictly before d', async () => {
		const d = new Date('2100-01-01');
		const vals = (await is.date.before(d).generate(20)) as Date[];
		expect(vals.every(v => v.getTime() < d.getTime())).toBe(true);
		expect(allValid(is.date.before(d), vals)).toBe(true);
	});

	it('is.date.year(2020) generates dates in 2020', async () => {
		const vals = (await is.date.year(2020).generate(20)) as Date[];
		expect(vals.every(v => v.getFullYear() === 2020)).toBe(true);
		expect(allValid(is.date.year(2020), vals)).toBe(true);
	});

	it('is.date.weekend generates weekend dates', async () => {
		const vals = (await is.date.weekend.generate(20)) as Date[];
		expect(vals.every(v => v.getDay() === 0 || v.getDay() === 6)).toBe(true);
		expect(allValid(is.date.weekend, vals)).toBe(true);
	});

	it('is.date.weekday generates weekday dates', async () => {
		const vals = (await is.date.weekday.generate(20)) as Date[];
		expect(vals.every(v => v.getDay() >= 1 && v.getDay() <= 5)).toBe(true);
		expect(allValid(is.date.weekday, vals)).toBe(true);
	});

	it('is.date.day("monday") generates Mondays', async () => {
		const vals = (await is.date.day('monday').generate(10)) as Date[];
		expect(vals.every(v => v.getDay() === 1)).toBe(true);
		expect(allValid(is.date.day('monday'), vals)).toBe(true);
	});

	// ---- URL ----------------------------------------------------------------

	it('is.url() generates valid URL strings', async () => {
		const vals = (await is.url().generate(20)) as string[];
		expect(
			vals.every(v => {
				try {
					new URL(v);
					return true;
				} catch {
					return false;
				}
			})
		).toBe(true);
		expect(allValid(is.url(), vals)).toBe(true);
	});

	it('is.url().http generates http:// URLs', async () => {
		const vals = (await is.url().http.generate(20)) as string[];
		expect(vals.every(v => v.startsWith('http://'))).toBe(true);
		expect(allValid(is.url().http, vals)).toBe(true);
	});

	it('is.url().https generates https:// URLs', async () => {
		const vals = (await is.url().https.generate(20)) as string[];
		expect(vals.every(v => v.startsWith('https://'))).toBe(true);
		expect(allValid(is.url().https, vals)).toBe(true);
	});

	it('is.url().local generates localhost URLs', async () => {
		const vals = (await is.url().local.generate(20)) as string[];
		expect(vals.every(v => v.includes('localhost'))).toBe(true);
		expect(allValid(is.url().local, vals)).toBe(true);
	});

	// ---- Map ----------------------------------------------------------------

	it('is.map() generates Map instances', async () => {
		const vals = (await is.map().generate(10)) as Map<unknown, unknown>[];
		expect(vals.every(v => v instanceof Map)).toBe(true);
	});

	it('is.map(is.string, is.number) generates typed Maps', async () => {
		const guard = is.map(is.string, is.number);
		const vals = (await guard.generate(10)) as Map<string, number>[];
		expect(vals.every(v => v instanceof Map)).toBe(true);
		expect(vals.every(v => [...v.keys()].every(k => typeof k === 'string'))).toBe(true);
		expect(vals.every(v => [...v.values()].every(val => typeof val === 'number'))).toBe(true);
	});

	it('is.map().minSize(2) generates Maps with at least 2 entries', async () => {
		const vals = (await is.map().minSize(2).generate(10)) as Map<unknown, unknown>[];
		expect(vals.every(v => v.size >= 2)).toBe(true);
		expect(allValid(is.map().minSize(2), vals)).toBe(true);
	});

	it('is.map().maxSize(3) generates Maps with at most 3 entries', async () => {
		const vals = (await is.map().maxSize(3).generate(20)) as Map<unknown, unknown>[];
		expect(vals.every(v => v.size <= 3)).toBe(true);
		expect(allValid(is.map().maxSize(3), vals)).toBe(true);
	});

	// ---- Set ----------------------------------------------------------------

	it('is.set() generates Set instances', async () => {
		const vals = (await is.set().generate(10)) as Set<unknown>[];
		expect(vals.every(v => v instanceof Set)).toBe(true);
	});

	it('is.set(is.number) generates typed Sets', async () => {
		const guard = is.set(is.number);
		const vals = (await guard.generate(10)) as Set<number>[];
		expect(vals.every(v => v instanceof Set)).toBe(true);
		expect(vals.every(v => [...v].every(item => typeof item === 'number'))).toBe(true);
	});

	it('is.set().minSize(2) generates Sets with at least 2 elements', async () => {
		const vals = (await is.set().minSize(2).generate(10)) as Set<unknown>[];
		expect(vals.every(v => v.size >= 2)).toBe(true);
		expect(allValid(is.set().minSize(2), vals)).toBe(true);
	});

	it('is.set().maxSize(3) generates Sets with at most 3 elements', async () => {
		const vals = (await is.set().maxSize(3).generate(20)) as Set<unknown>[];
		expect(vals.every(v => v.size <= 3)).toBe(true);
		expect(allValid(is.set().maxSize(3), vals)).toBe(true);
	});

	// ---- Array helpers ------------------------------------------------------

	it('array.nonEmpty generates non-empty arrays', async () => {
		const vals = (await is.array(is.number).nonEmpty.generate(20)) as number[][];
		expect(vals.every(v => v.length > 0)).toBe(true);
		expect(allValid(is.array(is.number).nonEmpty, vals)).toBe(true);
	});

	it('array.min(3) generates arrays with at least 3 elements', async () => {
		const vals = (await is.array(is.number).min(3).generate(20)) as number[][];
		expect(vals.every(v => v.length >= 3)).toBe(true);
	});

	it('array.max(5) generates arrays with at most 5 elements', async () => {
		const vals = (await is.array(is.number).max(5).generate(20)) as number[][];
		expect(vals.every(v => v.length <= 5)).toBe(true);
	});

	it('array.size(4) generates arrays with exactly 4 elements', async () => {
		const vals = (await is.array(is.number).size(4).generate(20)) as number[][];
		expect(vals.every(v => v.length === 4)).toBe(true);
	});

	it('array.unique generates arrays with no duplicate elements', async () => {
		const vals = (await is.array(is.string).unique.generate(20)) as string[][];
		expect(vals.every(v => new Set(v).size === v.length)).toBe(true);
	});

	it('array.includes(x) generates arrays that always contain x', async () => {
		const vals = (await is.array(is.string).includes('hello').generate(20)) as string[][];
		expect(vals.every(v => v.includes('hello'))).toBe(true);
	});

	// ---- Object helpers -----------------------------------------------------

	it('object.minSize(2) generates objects with at least 2 keys', async () => {
		const vals = (await is.object({}).minSize(2).generate(20)) as object[];
		expect(vals.every(v => Object.keys(v).length >= 2)).toBe(true);
	});

	it('object.maxSize(3) generates objects with at most 3 keys', async () => {
		const vals = (await is.object({}).maxSize(3).generate(20)) as object[];
		expect(vals.every(v => Object.keys(v).length <= 3)).toBe(true);
	});

	// ---- Tuple generation ---------------------------------------------------

	it('tuple([is.string, is.number]) generates correct-shape tuples', async () => {
		const guard = is.tuple([is.string, is.number]);
		const vals = (await guard.generate(20)) as [string, number][];
		expect(vals.every(v => Array.isArray(v) && v.length === 2)).toBe(true);
		expect(vals.every(v => typeof v[0] === 'string' && typeof v[1] === 'number')).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});

	it('tuple([is.string], is.boolean) generates variadic tuples', async () => {
		const guard = is.tuple([is.string], is.boolean);
		const vals = (await guard.generate(20)) as [string, ...boolean[]][];
		expect(vals.every(v => Array.isArray(v) && v.length >= 1)).toBe(true);
		expect(vals.every(v => typeof v[0] === 'string')).toBe(true);
		expect(allValid(guard, vals)).toBe(true);
	});

	// ---- Record generation --------------------------------------------------

	it('is.record(is.string, is.number) generates plain objects with number values', async () => {
		const guard = is.record(is.string, is.number);
		const vals = (await guard.generate(10)) as Record<string, number>[];
		expect(vals.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))).toBe(true);
		expect(
			vals.every(v => Object.values(v).every(val => typeof val === 'number'))
		).toBe(true);
	});

	it('is.record(is.literal("a","b"), is.string) generates exhaustive records', async () => {
		const guard = is.record(is.literal('a', 'b'), is.string);
		const vals = (await guard.generate(10)) as Record<string, string>[];
		expect(vals.every(v => typeof v === 'object')).toBe(true);
	});
});
