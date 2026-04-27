import { describe, expect, it } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Refinement preservation (1.1)', () => {
	describe('object reshapes preserve value-level refinements', () => {
		it('preserves .size() across .partial()', () => {
			const obj = is.object({ a: is.string, b: is.number }).size(2);
			const partialObj = obj.partial();

			expect(partialObj({ a: 'a', b: 1 })).toBe(true);
			// Distinguish failure modes — the second case fails ONLY size(2)
			// because partial would otherwise accept the missing key.
			expect(partialObj({ a: 'a' })).toBe(false); // size: 1 ≠ 2
			expect(partialObj({})).toBe(false); // size: 0 ≠ 2

			// And this fails for a different reason: extra key.
			expect(partialObj({ a: 'a', b: 1, c: true } as any)).toBe(false);
		});

		it('preserves .where() across .omit()', () => {
			const obj = is
				.object({ a: is.string, b: is.string, c: is.number })
				.where(v => Object.keys(v).every(k => k !== 'forbidden'));

			const omittedObj = obj.omit(['c']);

			expect(omittedObj({ a: 'x', b: 'y' })).toBe(true);
			// Distinguishes that .where() is the rejection cause: shape is otherwise valid.
			expect(omittedObj({ a: 'x', b: 'y', forbidden: 'z' } as any)).toBe(false);
		});

		it('preserves .where() and .size() across .extend()', () => {
			const base = is
				.object({ a: is.string })
				.size(2)
				.where(v => v.a === 'hello');

			const extended = base.extend({ b: is.number });

			expect(extended({ a: 'hello', b: 42 })).toBe(true);
			expect(extended({ a: 'world', b: 42 })).toBe(false); // fails .where()
			expect(extended({ a: 'hello', b: 42, c: true } as any)).toBe(false); // fails extra-keys
		});

		it('preserves multiple .where() and .strict across .pick()', () => {
			const base = is
				.object({ a: is.number, b: is.number, c: is.number })
				.strict.where(v => v.a > 0)
				.where(v => v.b > 0);

			const picked = base.pick(['a', 'b']);

			expect(picked({ a: 1, b: 2 })).toBe(true);
			expect(picked({ a: 0, b: 2 })).toBe(false); // first .where()
			expect(picked({ a: 1, b: 0 })).toBe(false); // second .where()
			expect(picked({ a: 1, b: 2, c: 3 })).toBe(false); // strict
		});

		it('preserves refinements across .required()', () => {
			const base = is
				.object({ a: is.string.optional, b: is.string.optional })
				.size(2)
				.where(v => v.a !== v.b);

			const required = base.required();

			expect(required({ a: 'x', b: 'y' })).toBe(true);
			expect(required({ a: 'x' })).toBe(false); // required + size
			expect(required({ a: 'x', b: 'x' })).toBe(false); // .where()
		});

		it('chained reshapes preserve a .where() refinement at every step', () => {
			const base = is
				.object({ a: is.string, b: is.number, c: is.boolean })
				.where(v => v.a !== 'forbidden');

			// Two reshapes in sequence — the .where() must still apply to the final guard.
			const reshaped = base.pick(['a', 'b']).omit(['b']);

			expect(reshaped({ a: 'ok' })).toBe(true);
			expect(reshaped({ a: 'forbidden' })).toBe(false); // .where() still active
		});
	});

	describe('extra-key policy propagates through reshapes', () => {
		it('.strict propagates through .partial()', () => {
			const guard = is.object({ a: is.string, b: is.number }).strict.partial();
			expect(guard({ a: 'x' })).toBe(true);
			expect(guard({ a: 'x', extra: 1 } as any)).toBe(false);
		});

		it('.catchall propagates through .extend()', () => {
			const guard = is.object({ a: is.string }).catchall(is.number).extend({ b: is.boolean });
			expect(guard({ a: 'x', b: true })).toBe(true);
			expect(guard({ a: 'x', b: true, extra: 5 })).toBe(true); // matches catchall
			expect(guard({ a: 'x', b: true, extra: 'no' } as any)).toBe(false);
		});

		it('.allowProtoKeys propagates through reshapes', () => {
			const guard = is.object({ a: is.string }).allowProtoKeys.partial();
			const m = JSON.parse('{"a":"x","__proto__":{"polluted":true}}');
			expect(guard(m)).toBe(true);
			expect(({} as any).polluted).toBeUndefined();
		});
	});

	describe('non-object refinement preservation', () => {
		it('string length constraints survive .nullable / .optional', () => {
			const g = is.string.min(5).max(10).nullable;
			expect(g('hello')).toBe(true);
			expect(g(null)).toBe(true);
			expect(g('abc')).toBe(false); // < min
			expect(g('a'.repeat(11))).toBe(false); // > max

			const g2 = is.string.email.optional;
			expect(g2('a@b.com')).toBe(true);
			expect(g2(undefined)).toBe(true);
			expect(g2('not-an-email')).toBe(false);
		});

		it('number constraints survive .nullable / .optional / .nullish', () => {
			const g = is.number.int.between(0, 100).nullable;
			expect(g(50)).toBe(true);
			expect(g(null)).toBe(true);
			expect(g(101)).toBe(false);
			expect(g(50.5)).toBe(false); // not int

			const g2 = is.number.positive.optional;
			expect(g2(1)).toBe(true);
			expect(g2(undefined)).toBe(true);
			expect(g2(0)).toBe(false);
			expect(g2(-1)).toBe(false);

			const g3 = is.number.nullish;
			expect(g3(1)).toBe(true);
			expect(g3(null)).toBe(true);
			expect(g3(undefined)).toBe(true);
			expect(g3('1' as any)).toBe(false);
		});

		it('array constraints survive .nullable / .optional', () => {
			const g = is.array(is.number).min(2).max(5).nullable;
			expect(g([1, 2, 3])).toBe(true);
			expect(g(null)).toBe(true);
			expect(g([1])).toBe(false); // < min
			expect(g([1, 2, 3, 4, 5, 6])).toBe(false); // > max
			expect(g(['x'] as any)).toBe(false); // wrong inner type
		});
	});

	describe('reshape composition (round-trips & order independence)', () => {
		it('.partial().required() restores original required-ness for known keys', () => {
			const base = is.object({ a: is.string, b: is.number });
			const round = base.partial().required();
			expect(round({ a: 'x', b: 1 })).toBe(true);
			expect(round({ a: 'x' })).toBe(false); // b required again
			expect(round({})).toBe(false);
		});

		it('.pick(keys).pick(subset) is equivalent to .pick(subset)', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const chained = base.pick(['a', 'b']).pick(['a']);
			const direct = base.pick(['a']);
			const probes: unknown[] = [
				{ a: 'x' },
				{ a: 'x', b: 1 },
				{ b: 1 },
				{},
				{ a: 1 },
			];
			for (const v of probes) {
				expect(chained(v)).toBe(direct(v));
			}
		});

		it('.omit(keys).omit(more) is equivalent to .omit([keys ∪ more])', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const chained = base.omit(['c']).omit(['b']);
			const direct = base.omit(['b', 'c']);
			const probes: unknown[] = [
				{ a: 'x' },
				{ a: 'x', b: 1 },
				{},
				{ b: 1 },
			];
			for (const v of probes) {
				expect(chained(v)).toBe(direct(v));
			}
		});
	});

	describe('refinement isolation', () => {
		it('a refinement chained AFTER a reshape applies only to the reshaped guard', () => {
			const base = is.object({ a: is.string, b: is.number });
			const onlyA = base.pick(['a']).where(v => v.a.startsWith('A'));
			expect(onlyA({ a: 'Apple' })).toBe(true);
			expect(onlyA({ a: 'banana' })).toBe(false);
			// The base guard is independent — it does not inherit the reshape's where().
			expect(base({ a: 'banana', b: 1 })).toBe(true);
		});

		it('two refinements short-circuit in chain order', () => {
			let firstCalls = 0;
			let secondCalls = 0;
			const guard = is
				.object({ a: is.number })
				.where(v => {
					firstCalls++;
					return v.a >= 0;
				})
				.where(v => {
					secondCalls++;
					return v.a < 100;
				});

			expect(guard({ a: -1 })).toBe(false);
			expect(firstCalls).toBe(1);
			// Second predicate must not run when the first already rejected.
			expect(secondCalls).toBe(0);
		});
	});
});
