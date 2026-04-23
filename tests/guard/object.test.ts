import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import { defineErrs } from '../../src/tagged-errs.js';
import { some } from '../../src/option.js';
import { ok } from '../../src/result/result.js';

describe('is.object (v2)', () => {
	it('basic object validation', () => {
		expect(is.object()({ a: 1 })).toBe(true);
		expect(is.object()({})).toBe(true);
		expect(is.object()(null)).toBe(false);
		expect(is.object()([])).toBe(false);
	});

	it('object with schema', () => {
		const guard = is.object({
			a: is.string,
			b: is.number,
		});
		expect(guard({ a: 'foo', b: 123 })).toBe(true);
		expect(guard({ a: 'foo' })).toBe(false); // missing b
		expect(guard({ a: 'foo', b: '123' })).toBe(false); // b is not a number
	});

	describe('is.record', () => {
		describe('open-ended (is.string key)', () => {
			it('validates record keys and values', () => {
				const guard = is.record(is.string, is.number);
				expect(guard({ a: 1, b: 2 })).toBe(true);
				expect(guard({ a: 1, b: '2' })).toBe(false);
			});

			it('accepts empty objects', () => {
				const guard = is.record(is.string, is.number);
				expect(guard({})).toBe(true);
			});

			it('chains refinements on record', () => {
				const guard = is.record(is.string, is.number).size(2).has('a');
				expect(guard({ a: 1, b: 2 })).toBe(true);
				expect(guard({ a: 1 })).toBe(false); // size 1
				expect(guard({ b: 2, c: 3 })).toBe(false); // missing 'a'
			});

			it('rejects non-objects', () => {
				const guard = is.record(is.string, is.number);
				expect(guard(null)).toBe(false);
				expect(guard(undefined)).toBe(false);
				expect(guard([])).toBe(false);
				expect(guard('string')).toBe(false);
				expect(guard(42)).toBe(false);
			});
		});

		describe('exhaustive with is.enum keys', () => {
			it('requires all enum keys to be present', () => {
				const Keys = is.enum(['id', 'name', 'email'] as const);
				const guard = is.record(Keys, is.string);
				expect(guard({ id: '1', name: 'Alice', email: 'a@b.com' })).toBe(true);
				expect(guard({ id: '1', name: 'Alice' })).toBe(false); // missing email
				expect(guard({ id: '1' })).toBe(false); // missing name, email
				expect(guard({})).toBe(false); // missing all
			});

			it('rejects extra keys not in the enum', () => {
				const Keys = is.enum(['id', 'name'] as const);
				const guard = is.record(Keys, is.string);
				expect(guard({ id: '1', name: 'Alice', extra: 'x' })).toBe(false);
			});

			it('validates values against the value guard', () => {
				const Keys = is.enum(['a', 'b'] as const);
				const guard = is.record(Keys, is.number);
				expect(guard({ a: 1, b: 2 })).toBe(true);
				expect(guard({ a: 1, b: 'two' })).toBe(false);
			});

			it('works with TypeScript enum objects', () => {
				enum Color {
					Red = 'red',
					Blue = 'blue',
				}
				const guard = is.record(is.enum(Color), is.number);
				expect(guard({ red: 1, blue: 2 })).toBe(true);
				expect(guard({ red: 1 })).toBe(false); // missing blue
				expect(guard({ red: 1, blue: 2, green: 3 })).toBe(false); // extra key
			});
		});

		describe('exhaustive with is.literal keys', () => {
			it('requires all literal keys to be present', () => {
				const guard = is.record(is.literal('a', 'b', 'c'), is.number);
				expect(guard({ a: 1, b: 2, c: 3 })).toBe(true);
				expect(guard({ a: 1, b: 2 })).toBe(false); // missing c
				expect(guard({ a: 1 })).toBe(false); // missing b, c
			});

			it('rejects extra keys not in the literal set', () => {
				const guard = is.record(is.literal('x', 'y'), is.string);
				expect(guard({ x: 'a', y: 'b' })).toBe(true);
				expect(guard({ x: 'a', y: 'b', z: 'c' })).toBe(false);
			});

			it('validates values against the value guard', () => {
				const guard = is.record(is.literal('a', 'b'), is.boolean);
				expect(guard({ a: true, b: false })).toBe(true);
				expect(guard({ a: true, b: 'false' })).toBe(false);
			});

			it('works with a single literal key', () => {
				const guard = is.record(is.literal('only'), is.string);
				expect(guard({ only: 'value' })).toBe(true);
				expect(guard({})).toBe(false);
				expect(guard({ only: 'value', extra: 'x' })).toBe(false);
			});
		});

		describe('exhaustive with .partial()', () => {
			it('makes all enum keys optional', () => {
				const Keys = is.enum(['id', 'name', 'email'] as const);
				const guard = is.record(Keys, is.string).partial();
				expect(guard({ id: '1' })).toBe(true);
				expect(guard({})).toBe(true);
				expect(guard({ id: '1', name: 'Alice', email: 'a@b.com' })).toBe(true);
			});

			it('makes all literal keys optional', () => {
				const guard = is.record(is.literal('a', 'b'), is.number).partial();
				expect(guard({ a: 1 })).toBe(true);
				expect(guard({ b: 2 })).toBe(true);
				expect(guard({})).toBe(true);
				expect(guard({ a: 1, b: 2 })).toBe(true);
			});

			it('rejects non-objects when partial', () => {
				const guard = is.record(is.literal('a', 'b'), is.number).partial();
				expect(guard(null)).toBe(false);
				expect(guard([])).toBe(false);
				expect(guard('string')).toBe(false);
			});
		});

		describe('behavior distinction: open-ended vs exhaustive vs partial', () => {
			const input = { a: 'hello', b: 'world' };
			const missingKey = { a: 'hello' };
			const extraKey = { a: 'hello', b: 'world', c: 'extra' };
			const empty = {};

			it('record(is.string, is.string) — open-ended: accepts any keys', () => {
				const guard = is.record(is.string, is.string);
				expect(guard(input)).toBe(true);
				expect(guard(missingKey)).toBe(true); // no required keys
				expect(guard(extraKey)).toBe(true); // extra keys fine
				expect(guard(empty)).toBe(true); // empty fine
			});

			it('record(is.literal(...), is.string) — exhaustive: requires all keys, no extras', () => {
				const guard = is.record(is.literal('a', 'b'), is.string);
				expect(guard(input)).toBe(true);
				expect(guard(missingKey)).toBe(false); // missing 'b'
				expect(guard(extraKey)).toBe(false); // extra 'c'
				expect(guard(empty)).toBe(false); // missing all
			});

			it('record(is.enum(...), is.string) — exhaustive: same as literal', () => {
				const guard = is.record(is.enum(['a', 'b'] as const), is.string);
				expect(guard(input)).toBe(true);
				expect(guard(missingKey)).toBe(false); // missing 'b'
				expect(guard(extraKey)).toBe(false); // extra 'c'
				expect(guard(empty)).toBe(false); // missing all
			});

			it('record(is.literal(...), is.string).partial() — keys become optional', () => {
				const guard = is.record(is.literal('a', 'b'), is.string).partial();
				expect(guard(input)).toBe(true);
				expect(guard(missingKey)).toBe(true); // missing 'b' is OK
				expect(guard(empty)).toBe(true); // all missing is OK
			});
		});

		describe('type narrowing', () => {
			it('narrows to Record<K, V> with enum keys', () => {
				const Keys = is.enum(['x', 'y'] as const);
				const guard = is.record(Keys, is.number);
				const value: unknown = { x: 1, y: 2 };
				if (guard(value)) {
					const narrowed: Record<'x' | 'y', number> = value;
					expect(narrowed.x).toBe(1);
					expect(narrowed.y).toBe(2);
				}
			});

			it('narrows to Record<K, V> with literal keys', () => {
				const guard = is.record(is.literal('a', 'b'), is.string);
				const value: unknown = { a: 'hello', b: 'world' };
				if (guard(value)) {
					const narrowed: Record<'a' | 'b', string> = value;
					expect(narrowed.a).toBe('hello');
					expect(narrowed.b).toBe('world');
				}
			});
		});

		describe('universal helpers', () => {
			it('.parse() returns a Result', () => {
				const guard = is.record(is.literal('a', 'b'), is.number);
				expect(guard.parse({ a: 1, b: 2 }).isOk()).toBe(true);
				expect(guard.parse({ a: 1 }).isErr()).toBe(true);
			});

			it('.nullable allows null', () => {
				const guard = is.record(is.literal('a'), is.string).nullable;
				expect(guard(null)).toBe(true);
				expect(guard({ a: 'x' })).toBe(true);
			});
		});
	});

	describe('keyof', () => {
		it('returns an enum guard of the schema keys', () => {
			const User = is.object({ name: is.string, age: is.number, email: is.string });
			const key = User.keyof;
			expect(key('name')).toBe(true);
			expect(key('age')).toBe(true);
			expect(key('email')).toBe(true);
			expect(key('address')).toBe(false);
			expect(key(42)).toBe(false);
			expect(key(null)).toBe(false);
		});

		it('narrows to the union of key literals', () => {
			const User = is.object({ name: is.string, age: is.number });
			const key = User.keyof;
			const value: unknown = 'name';
			if (key(value)) {
				const narrowed: 'name' | 'age' = value;
				expect(narrowed).toBe('name');
			}
		});

		it('works with is.record for exhaustive checking', () => {
			const User = is.object({ name: is.string, age: is.number });
			const guard = is.record(User.keyof, is.string);
			expect(guard({ name: 'Alice', age: '30' })).toBe(true);
			expect(guard({ name: 'Alice' })).toBe(false); // missing 'age'
			expect(guard({ name: 'Alice', age: '30', extra: 'x' })).toBe(false); // extra key
		});

		it('has enum helpers (exclude, extract)', () => {
			const User = is.object({ name: is.string, age: is.number, email: is.string });
			const notEmail = User.keyof.exclude('email');
			expect(notEmail('name')).toBe(true);
			expect(notEmail('age')).toBe(true);
			expect(notEmail('email')).toBe(false);
		});

		it('returns empty enum for schema-less object', () => {
			const guard = is.object().keyof;
			expect(guard('anything')).toBe(false);
		});

		it('.parse() returns a Result', () => {
			const User = is.object({ x: is.number, y: is.number });
			const key = User.keyof;
			expect(key.parse('x').isOk()).toBe(true);
			expect(key.parse('z').isErr()).toBe(true);
		});
	});

	describe('Transformations', () => {
		const base = is.object({
			a: is.string,
			b: is.number.optional,
		});

		it('partial (no args = all optional)', () => {
			const guard = base.partial();
			expect(guard({})).toBe(true);
			expect(guard({ a: 'foo' })).toBe(true);
			expect(guard({ a: 123 })).toBe(false); // still checks types if present
		});

		it('partial (with keys = only those keys optional)', () => {
			// base = { a: is.string, b: is.number.optional }
			// .partial('b') makes only 'b' optional, 'a' stays required
			const guard = base.partial('b');
			expect(guard({ a: 'foo' })).toBe(true); // b is optional
			expect(guard({ a: 'foo', b: 123 })).toBe(true);
			expect(guard({})).toBe(false); // a is still required
			expect(guard({ b: 123 })).toBe(false); // a is still required
		});

		it('pick', () => {
			const guard = base.pick(['a']);
			expect(guard({ a: 'foo' })).toBe(true);
			expect(guard({ a: 'foo', b: 123 })).toBe(true); // pick doesn't (strictly) forbid extra keys unless .strict() is used
		});

		it('omit', () => {
			const guard = base.omit(['a']);
			expect(guard({ b: 123 })).toBe(true);
			expect(guard({})).toBe(true); // b is optional
		});

		it('extend', () => {
			const guard = base.extend({ c: is.boolean });
			expect(guard({ a: 'foo', b: 1, c: true })).toBe(true);
			expect(guard({ a: 'foo', b: 1 })).toBe(false); // missing c
		});

		it('strict', () => {
			const guard = is.object({ a: is.number }).strict;
			expect(guard({ a: 1 })).toBe(true);
			expect(guard({ a: 1, b: 2 })).toBe(false);
		});
	});

	describe('Refinements & Valuations', () => {
		it('size / minSize / maxSize', () => {
			expect(is.object().size(2)({ a: 1, b: 2 })).toBe(true);
			expect(is.object().size(2)({ a: 1 })).toBe(false);
			expect(is.object().minSize(2)({ a: 1, b: 2, c: 3 })).toBe(true);
			expect(is.object().maxSize(2)({ a: 1 })).toBe(true);
		});

		it('has / hasAll / hasOnly', () => {
			expect(is.object().has('a')({ a: 1 })).toBe(true);
			expect(is.object().hasAll(['a', 'b'])({ a: 1, b: 2 })).toBe(true);
			expect(is.object().hasOnly(['a'])({ a: 1 })).toBe(true);
			expect(is.object().hasOnly(['a'])({ a: 1, b: 2 })).toBe(false);
		});

		it('catchall', () => {
			const guard = is.object({ a: is.number }).catchall(is.string);
			expect(guard({ a: 1, b: '2' })).toBe(true);
			expect(guard({ a: 1, b: 2 })).toBe(false);
			expect(guard({ a: 1, b: '2', c: '3' })).toBe(true);
			expect(guard({ a: 1, b: '2', c: 3 })).toBe(false);
		});
	});

	describe('Chaining with Transformations', () => {
		it('should chain pick and size', () => {
			// pick(['a']) transforms the object to ONLY have 'a'
			const guard = is.object({ a: is.string, b: is.number }).pick(['a']).size(1);
			expect(guard({ a: 'foo', b: 123 })).toBe(true);
		});

		it('should chain omit and has', () => {
			// omit(['b']) removes 'b' from schema, .has('b') asserts the key is present on the value
			const guard = is.object({ a: is.string, b: is.number }).omit(['b']).has('b');
			expect(guard({ a: 'foo', b: 123 })).toBe(true); // 'b' exists on the value
			expect(guard({ a: 'foo' })).toBe(false); // 'b' missing
		});

		it('should chain has with a guard for type narrowing', () => {
			const guard = is.object({ a: is.string }).has('b', is.number);
			expect(guard({ a: 'foo', b: 42 })).toBe(true);
			expect(guard({ a: 'foo', b: 'not number' })).toBe(false);
			expect(guard({ a: 'foo' })).toBe(false); // missing 'b'
		});
	});

	describe('Universal Methods', () => {
		it('nullable / optional', () => {
			expect(is.object().nullable(null)).toBe(true);
			expect(is.object().optional(undefined)).toBe(true);
		});

		it('or', () => {
			expect(is.object().or(is.string)({})).toBe(true);
			expect(is.object().or(is.string)('foo')).toBe(true);
		});
	});

	describe('field guards with transforms on missing keys', () => {
		it('returns GuardErr (not TypeError) when a factory-helper guard has a transform and the key is missing', () => {
			const guard = is.object({ name: is.string.trim().min(1) });
			expect(() => guard.parse({})).not.toThrow();
			expect(guard.parse({}).isErr()).toBe(true);
		});

		it('returns GuardErr (not TypeError) when a value-helper guard has a transform and the key is missing', () => {
			const guard = is.object({ email: is.string.trim().email });
			expect(() => guard.parse({})).not.toThrow();
			expect(guard.parse({}).isErr()).toBe(true);
		});

		it('still validates and transforms correctly when the key is present', () => {
			const guard = is.object({ name: is.string.trim().min(1) });
			expect(guard.parse({ name: '  hello  ' }).isOk()).toBe(true);
			expect(guard.parse({ name: '  hello  ' }).unwrap()).toEqual({ name: 'hello' });
			expect(guard.parse({ name: '   ' }).isErr()).toBe(true); // trims to empty, fails min(1)
		});
	});

	describe('readonly', () => {
		it('basic readonly validation', () => {
			const guard = is
				.object({ a: is.number, b: is.string })
				.readonly.refine(() => ({ a: 1, b: 'hello' })).strict;
			expect(guard({ a: 1, b: 'hello' })).toBe(true);
			expect(guard({ a: 1, b: 'hello', c: 'world' })).toBe(false); // strict, so extra keys are not allowed
			expect(guard.parse({ a: 1, b: 'hello', c: 'world' }).isErr()).toBe(true);

			// type check
			const value: unknown = { a: 1, b: 2 };
			if (guard(value)) {
				const narrowed: Readonly<{ a: number; b?: unknown }> = value;
				expect(narrowed).toEqual({ a: 1, b: 2 });
			}
		});
	});

	describe('all guards', () => {
		it('should work with all other top-level guards', () => {
			const AppErr = defineErrs({
				example: (value: string) => ({ value }),
			});

			const guard = is.object({
				a: is.string,
				b: is.number,
				c: is.boolean,
				d: is.date,
				e: is.enum(['a', 'b', 'c']),
				f: is.literal('a', 'b', 'c'),
				g: is.record(is.string, is.number),
				h: is.array(is.number),
				i: is.tuple([is.string, is.number]),
				j: is.union(is.string, is.number),
				k: is.intersection(is.object({ a: is.string }), is.object({ b: is.number })),
				l: is.xor(is.string, is.number),
				m: is.promise,
				o: is.result(is.string, is.number),
				p: is.option(is.string),
				q: is.tagged(AppErr.example),
			});

			expect(
				guard({
					a: 'hello',
					b: 1,
					c: true,
					d: new Date(),
					e: 'a',
					f: 'a',
					g: { a: 1 },
					h: [1],
					i: ['a', 1],
					j: 'a',
					k: { a: 'hello', b: 1 },
					l: 'hello',
					m: Promise.resolve('a'),
					n: async () => 'a',
					o: ok('a'),
					p: some('a'),
					q: AppErr.example('hello'),
				})
			).toBe(true);
		});
	});

	describe('prototype-pollution safety', () => {
		// JSON.parse puts __proto__ on the parsed object as an own data property,
		// which is the common attacker vector (not the `{__proto__: ...}` literal
		// syntax, which mutates the prototype instead of creating an own key).
		const withProtoOwn = (payload: object) =>
			JSON.parse(`{"a":"x","__proto__":${JSON.stringify(payload)}}`) as Record<string, unknown>;

		it('is.object() bare guard rejects own __proto__', () => {
			expect(is.object()(withProtoOwn({ polluted: true }))).toBe(false);
			expect(is.object()({ constructor: 'x' })).toBe(false);
			expect(is.object()({ prototype: 'x' })).toBe(false);
			expect(is.object()({ a: 1 })).toBe(true);
		});

		it('is.object(schema) rejects own __proto__/constructor/prototype', () => {
			const guard = is.object({ a: is.string });
			expect(guard(withProtoOwn({ polluted: true }))).toBe(false);
			expect(guard({ a: 'x', constructor: 'y' })).toBe(false);
			expect(guard({ a: 'x', prototype: 'y' })).toBe(false);
			expect(guard({ a: 'x' })).toBe(true);
		});

		it('is.record rejects forbidden keys in both open-ended and exhaustive modes', () => {
			const open = is.record(is.string, is.number);
			expect(open(withProtoOwn({ polluted: true }))).toBe(false);
			expect(open({ constructor: 1 })).toBe(false);
			expect(open({ a: 1, b: 2 })).toBe(true);

			const exhaustive = is.record(is.enum(['a', 'b'] as const), is.number);
			expect(exhaustive({ a: 1, b: 2 })).toBe(true);
			// Would already fail the exhaustive check, but confirm forbidden-key path too.
			expect(exhaustive(withProtoOwn({ polluted: true }))).toBe(false);
		});

		it('.allowProtoKeys accepts __proto__ as an own key', () => {
			const guard = is.object({ a: is.string }).allowProtoKeys;
			const input = withProtoOwn({ polluted: true });
			expect(guard(input)).toBe(true);
			// Crucially, the proxy/walker should not have mutated Object.prototype.
			expect(({} as any).polluted).toBeUndefined();

			const rec = is.record(is.string, is.number).allowProtoKeys;
			expect(rec(JSON.parse(`{"a":1,"__proto__":{"polluted":true}}`))).toBe(true);
		});

		it('.allowProtoKeys preserves strict/catchall flags from parent meta', () => {
			const guard = is.object({ a: is.string }).strict.allowProtoKeys;
			// strict still rejects unknown non-forbidden keys
			expect(guard({ a: 'x', extra: 1 })).toBe(false);
			expect(guard({ a: 'x' })).toBe(true);
		});

		it('propagates allowProtoKeys through partial/pick/omit/extend/required', () => {
			const base = is.object({ a: is.string, b: is.number }).allowProtoKeys;
			const proto = withProtoOwn({ polluted: true });

			expect(base.partial()({ ...proto, a: 'x' })).toBe(true);
			expect(base.pick(['a'])({ ...proto, a: 'x' })).toBe(true);
			expect(base.omit(['b'])({ ...proto, a: 'x' })).toBe(true);
			expect(base.extend({ c: is.boolean })({ ...proto, a: 'x', b: 1, c: true })).toBe(true);

			// Without allowProtoKeys, the same chain rejects:
			const strict = is.object({ a: is.string, b: is.number });
			expect(strict.partial()({ ...proto, a: 'x' })).toBe(false);
			expect(strict.pick(['a'])({ ...proto, a: 'x' })).toBe(false);
			expect(strict.omit(['b'])({ ...proto, a: 'x' })).toBe(false);
			expect(strict.extend({ c: is.boolean })({ ...proto, a: 'x', b: 1, c: true })).toBe(false);
		});

		it('pick transform does not trigger __proto__ setter on fresh object', () => {
			// Even with .allowProtoKeys, picking "__proto__" must not mutate the result's prototype.
			const guard = is.object({} as any).allowProtoKeys.pick(['__proto__']);
			const input = JSON.parse(`{"__proto__":{"polluted":true}}`);
			// Parse to exercise the transform path.
			const parsed = guard.parse(input);
			expect(parsed.isOk()).toBe(true);
			if (parsed.isOk()) {
				expect(Object.getPrototypeOf(parsed.value)).toBe(Object.prototype);
			}
		});

		it('can be spread into another object guard', () => {
			const base = is.object({ a: is.string });
			const guard = is.object({ ...base.meta.shape, b: is.number });
			expect(guard.strict({ a: 'hello', b: 1 })).toBe(true);
			expect(guard.strict({ a: 'hello', b: 1, c: 2 })).toBe(false);
		});
	});
});
