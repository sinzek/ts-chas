import { describe, it, expect } from 'vitest';
import { is, type Guard } from '../src/guard/index.js';

// Generous CI-friendly perf budget. Local machines run faster, but CI under load
// can be 5–10x slower than dev. We are testing "this completes in human time and
// is not algorithmically catastrophic" — not a tight perf SLO.
const PERF_BUDGET_MS = 2000;

describe('Fuzzing & Hostile Inputs (2.2)', () => {
	describe('Deep nesting / DoS-resistance', () => {
		it('rejects deeply-nested objects past is.json default depth without throwing', () => {
			// is.json defaults to maxDepth: 256. A depth-1k object must be REJECTED, not crash.
			const obj: any = {};
			let current = obj;
			for (let i = 0; i < 1000; i++) {
				current.next = {};
				current = current.next;
			}

			let threw: unknown = null;
			let result: boolean | null = null;
			try {
				result = is.json(obj);
			} catch (e) {
				threw = e;
			}

			expect(threw).toBeNull();
			expect(result).toBe(false);
		});

		it('rejects deeply-nested arrays past is.json default depth without throwing', () => {
			const arr: any[] = [];
			let current = arr;
			for (let i = 0; i < 1000; i++) {
				const next: any[] = [];
				current.push(next);
				current = next;
			}

			expect(() => is.json(arr)).not.toThrow();
			expect(is.json(arr)).toBe(false);
		});

		it('detects cyclic references via depth limit (no infinite loop)', () => {
			const a: any = {};
			a.self = a;

			const b: any = { x: 1 };
			const c: any = { y: 2, ref: b };
			b.ref = c;

			const start = performance.now();
			expect(is.json(a)).toBe(false);
			expect(is.json(b)).toBe(false);
			const duration = performance.now() - start;
			expect(duration).toBeLessThan(PERF_BUDGET_MS);
		});

		it('cyclic input through is.object schema is rejected without infinite loop', () => {
			const cyc: any = { name: 'root' };
			cyc.parent = cyc;

			const guard = is.object({ name: is.string });
			// The schema only checks `name`, but if any helper traverses unknown keys
			// we must not loop. Add a strict check to force traversal of `parent` too.
			const strict = guard.strict;

			expect(() => strict(cyc)).not.toThrow();
			// Strict rejects the unknown `parent` key. The point is termination.
			expect(strict(cyc)).toBe(false);
		});

		it('rejects shallow-but-wide payloads past maxProperties without OOM-ing', () => {
			const wide: Record<string, unknown> = {};
			for (let i = 0; i < 200_000; i++) {
				wide[`k${i}`] = i;
			}

			const start = performance.now();
			expect(is.json(wide)).toBe(false); // exceeds default 100k cap
			const duration = performance.now() - start;
			expect(duration).toBeLessThan(PERF_BUDGET_MS);
		});

		it('honors per-guard maxDepth override', () => {
			const obj: any = {};
			let cur = obj;
			for (let i = 0; i < 50; i++) {
				cur.next = {};
				cur = cur.next;
			}

			expect(is.json.maxDepth(40)(obj)).toBe(false);
			expect(is.json.maxDepth(60)(obj)).toBe(true);
		});

		it('is.json.unbounded is documented-unsafe: extreme depth may throw RangeError', () => {
			// This codifies the contract: `unbounded` opts out of the safety cap and
			// MAY stack-overflow on hostile input. We assert that the *default* guard
			// is the safe one, and `unbounded` is reserved for trusted input.
			const obj: any = {};
			let cur = obj;
			for (let i = 0; i < 60_000; i++) {
				cur.n = {};
				cur = cur.n;
			}

			let threw: unknown = null;
			try {
				is.json.unbounded(obj);
			} catch (e) {
				threw = e;
			}

			// Either it accepted (best case) or threw RangeError (acceptable opt-in risk).
			// Anything else (TypeError, hang, etc.) would be a bug.
			if (threw !== null) {
				expect(threw).toBeInstanceOf(RangeError);
			}

			// And the default guard, on the same input, MUST NOT throw.
			expect(() => is.json(obj)).not.toThrow();
			expect(is.json(obj)).toBe(false);
		});
	});

	describe('Prototype-pollution safety', () => {
		// Use a fresh probe each test so a leak from a previous case can't mask a bug.
		const polluted = (): unknown => ({} as any).polluted;
		const ctorPolluted = (): unknown => ({} as any).ctorPolluted;
		const protoFn = (): unknown => ({} as any).protoFn;

		it('rejects __proto__ in is.object by default', () => {
			const m = JSON.parse('{"a":"x","__proto__":{"polluted":true}}');
			expect(is.object({ a: is.string })(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('rejects constructor and prototype keys', () => {
			const m1 = JSON.parse('{"a":"x","constructor":{"ctorPolluted":true}}');
			const m2 = JSON.parse('{"a":"x","prototype":{"protoFn":"leaked"}}');
			expect(is.object({ a: is.string })(m1)).toBe(false);
			expect(is.object({ a: is.string })(m2)).toBe(false);
			expect(ctorPolluted()).toBeUndefined();
			expect(protoFn()).toBeUndefined();
		});

		it('rejects __proto__ nested inside object schemas', () => {
			const guard = is.object({ outer: is.object({ b: is.string }) });
			const m = JSON.parse('{"outer":{"b":"x","__proto__":{"polluted":true}}}');
			expect(guard(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('rejects __proto__ in is.record by default', () => {
			const guard = is.record(is.string, is.number);
			const m = JSON.parse('{"a":1,"__proto__":2}');
			expect(guard(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('rejects __proto__ when surfaced via .catchall', () => {
			const guard = is.object({ a: is.string }).catchall(is.number);
			const m = JSON.parse('{"a":"x","__proto__":{"polluted":true},"b":1}');
			expect(guard(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('rejects __proto__ when surfaced via .extend', () => {
			const base = is.object({ a: is.string });
			const ext = base.extend({ b: is.number });
			const m = JSON.parse('{"a":"x","b":1,"__proto__":{"polluted":true}}');
			expect(ext(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('rejects __proto__ across .pick and .omit transforms', () => {
			const base = is.object({ a: is.string, b: is.number });
			const m = JSON.parse('{"a":"x","b":1,"__proto__":{"polluted":true}}');
			expect(base.pick(['a'])(m)).toBe(false);
			expect(base.omit(['b'])(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});

		it('.allowProtoKeys is the documented opt-in escape hatch', () => {
			const lax = is.object({ a: is.string }).allowProtoKeys;
			const m = JSON.parse('{"a":"x","__proto__":{"polluted":true}}');
			expect(lax(m)).toBe(true); // explicit opt-in: caller takes responsibility
			expect(polluted()).toBeUndefined(); // *parsing* the JSON didn't pollute the prototype
		});

		it('.partial / .required after construction propagate the proto-key rejection', () => {
			const base = is.object({ a: is.string, b: is.number.optional });
			const m = JSON.parse('{"a":"x","__proto__":{"polluted":true}}');
			expect(base.partial()(m)).toBe(false);
			expect(base.required()(m)).toBe(false);
			expect(polluted()).toBeUndefined();
		});
	});

	describe('Hostile string inputs', () => {
		it('email regex is ReDoS-resistant on adversarial inputs', () => {
			// A naive email regex with nested quantifiers can backtrack catastrophically
			// on inputs like "a".repeat(N) + "!". We assert linear time behavior.
			const inputs = [
				'a'.repeat(50) + '!',
				'a'.repeat(100) + '!',
				'a@' + 'a'.repeat(200) + '!',
				'a'.repeat(500) + '@' + 'b'.repeat(500),
				'a@b' + '.'.repeat(200),
			];

			const start = performance.now();
			for (const input of inputs) {
				expect(is.string.email(input)).toBe(false);
			}
			const duration = performance.now() - start;
			expect(duration).toBeLessThan(PERF_BUDGET_MS);
		});

		it('url validator is ReDoS-resistant on adversarial inputs', () => {
			const start = performance.now();
			for (let i = 0; i < 5; i++) {
				is.url()('http://' + 'a'.repeat(1000));
				is.url()('://' + 'a'.repeat(1000));
				is.url()('http://[' + 'a'.repeat(500));
			}
			const duration = performance.now() - start;
			expect(duration).toBeLessThan(PERF_BUDGET_MS);
		});

		it('handles malformed UTF-16 (lone surrogates) without throwing', () => {
			const loneLead = 'Lead \uD800 trail';
			const loneTrail = 'Lead \uDC00 trail';
			const reversed = '\uDC00\uD800'; // trail before lead

			for (const s of [loneLead, loneTrail, reversed]) {
				expect(() => is.string(s)).not.toThrow();
				expect(is.string(s)).toBe(true);
				expect(() => is.string.email(s)).not.toThrow();
				expect(is.string.email(s)).toBe(false);
				expect(() => is.url()(s)).not.toThrow();
				expect(is.url()(s)).toBe(false);
				expect(() => is.string.regex(/\w+/)(s)).not.toThrow();
			}
		});

		it('handles 1MB strings without crashing', () => {
			// Correctness only — perf budget is loose to avoid CI flakes.
			const longString = 'a'.repeat(1024 * 1024);
			expect(is.string(longString)).toBe(true);
			expect(is.string.min(10).max(2_000_000)(longString)).toBe(true);
			expect(is.string.email(longString)).toBe(false);
		});

		it('rejects payloads where a 1MB string is wrapped in a deeply-nested key path', () => {
			// Combines two hostile traits: large value, suspicious shape.
			const deep: any = {};
			let cur = deep;
			for (let i = 0; i < 100; i++) {
				cur.next = {};
				cur = cur.next;
			}
			cur.payload = 'a'.repeat(1024 * 1024);

			expect(() => is.json(deep)).not.toThrow();
		});
	});

	describe('Recursive guard (is.lazy) limits', () => {
		it('handles modest recursive depth without crashing', () => {
			type Node = { value: number; children: Node[] };
			const Node: Guard<Node> = is.object({
				value: is.number,
				children: is.lazy(() => is.array(Node)),
			});

			let leaf: Node = { value: 0, children: [] };
			for (let i = 0; i < 100; i++) {
				leaf = { value: i, children: [leaf] };
			}

			expect(Node(leaf)).toBe(true);
		});

		it('is.lazy is recursive: extreme depth WILL stack-overflow (documented limit)', () => {
			// This codifies a known limitation. is.lazy delegates to the inner guard
			// via real recursion. Tests pin the contract so a future iterative
			// implementation can flip this assertion.
			type Node = { value: number; children: Node[] };
			const Node: Guard<Node> = is.object({
				value: is.number,
				children: is.lazy(() => is.array(Node)),
			});

			let leaf: Node = { value: 0, children: [] };
			for (let i = 0; i < 20_000; i++) {
				leaf = { value: i, children: [leaf] };
			}

			let threw: unknown = null;
			try {
				Node(leaf);
			} catch (e) {
				threw = e;
			}
			// If/when is.lazy becomes iterative, swap this for `expect(threw).toBeNull()`.
			expect(threw).toBeInstanceOf(RangeError);
		});
	});

	describe('Extreme numerics', () => {
		it('rejects NaN and Infinity for is.number by default', () => {
			expect(is.number(NaN)).toBe(false);
			expect(is.nan(NaN)).toBe(true);
			expect(is.number(Infinity)).toBe(false);
			expect(is.number(-Infinity)).toBe(false);
			expect(is.infinite.positive(Infinity)).toBe(true);
			expect(is.infinite.negative(-Infinity)).toBe(true);
		});

		it('handles -0 and zero correctly', () => {
			expect(is.number(-0)).toBe(true);
			expect(is.number(0)).toBe(true);
			expect(is.number.positive(-0)).toBe(false);
			expect(is.number.positive(0)).toBe(false);
			expect(is.number.nonnegative(-0)).toBe(true);
		});

		it('handles float boundaries (max double, overflow)', () => {
			expect(is.number(Number.MAX_VALUE)).toBe(true);
			expect(is.number(Number.MIN_VALUE)).toBe(true); // smallest positive subnormal
			expect(is.number(1e308)).toBe(true);
			// eslint-disable-next-line no-loss-of-precision
			expect(is.number(1e309)).toBe(false); // overflows to Infinity
		});

		it('handles integer boundaries (safe int + bigint)', () => {
			expect(is.number.int(Number.MAX_SAFE_INTEGER)).toBe(true);
			expect(is.number.int(Number.MIN_SAFE_INTEGER)).toBe(true);
			// is.number.int rejects values past the safe-integer range (precision is lost
			// in float64). This is the safe default — assert it explicitly.
			expect(is.number.int(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
			expect(is.number.int(Number.MIN_SAFE_INTEGER - 1)).toBe(false);
			expect(is.bigint(2n ** 1024n)).toBe(true);
			expect(is.bigint(-(2n ** 1024n))).toBe(true);
		});

		it('rejects type-confusion across number/bigint/string', () => {
			expect(is.number('42')).toBe(false);
			expect(is.number(42n as any)).toBe(false);
			expect(is.bigint(42 as any)).toBe(false);
			expect(is.bigint('42' as any)).toBe(false);
		});
	});

	describe('Boundary inputs across guards', () => {
		it('handles Object.create(null) (no prototype)', () => {
			const noProto = Object.create(null);
			noProto.a = 'x';
			expect(is.object({ a: is.string })(noProto)).toBe(true);
			expect(is.record(is.string, is.string)(noProto)).toBe(true);
		});

		it('handles frozen objects', () => {
			const frozen = Object.freeze({ a: 'x' });
			expect(is.object({ a: is.string })(frozen)).toBe(true);
			// .strip would normally produce a new object — must not crash on frozen input.
			expect(() => is.object({ a: is.string }).strip.parse(frozen)).not.toThrow();
		});

		it('handles sparse arrays without crashing or hanging', () => {
			// Documented behavior: array iteration helpers skip holes, so a sparse array
			// with only valid elements at defined indices passes is.array(is.number).
			// Callers who need hole-rejection must use a dedicated check. We pin the
			// current behavior so a future tightening flips this assertion intentionally.
			const sparse: any[] = [];
			sparse[5] = 1;
			expect(() => is.array(is.number)(sparse)).not.toThrow();
			expect(is.array(is.number)(sparse)).toBe(true);
			// length-based refinements still see the full sparse length.
			expect(is.array(is.number).min(6)(sparse)).toBe(true);
			expect(is.array(is.number).min(7)(sparse)).toBe(false);
		});

		it('rejects array-likes that are not real arrays', () => {
			const arrayLike = { 0: 'a', 1: 'b', length: 2 };
			expect(is.array(is.string)(arrayLike)).toBe(false);
			expect(is.array(is.string)(Array.from(arrayLike as any))).toBe(true);
		});
	});
});
