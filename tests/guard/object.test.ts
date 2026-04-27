import { describe, it, expect, expectTypeOf } from 'vitest';
import { is, type InferGuard, type Guard } from '../../src/guard/index.js';
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

	describe('Type-level inference', () => {
		it('infers required and optional fields correctly', () => {
			const guard = is.object({
				name: is.string,
				age: is.number,
				email: is.string.optional,
				bio: is.string.nullable,
			});
			type T = InferGuard<typeof guard>;
			const value: T = { name: 'a', age: 1, bio: null };
			expectTypeOf(value).toMatchTypeOf<{ name: string; age: number; bio: string | null }>();
			// `email` is optional — assigning either a string or omitting it should compile.
			const withEmail: T = { name: 'a', age: 1, bio: null, email: 'x' };
			expect(withEmail.email).toBe('x');
		});

		it('.partial() makes every field optional in the inferred type', () => {
			const guard = is.object({ a: is.string, b: is.number }).partial();
			type T = InferGuard<typeof guard>;
			// All keys may be omitted.
			const empty: T = {};
			const partial: T = { a: 'x' };
			const full: T = { a: 'x', b: 1 };
			expect([empty, partial, full].every(v => guard(v))).toBe(true);
		});

		it('.partial(specific) makes only the listed keys optional', () => {
			const guard = is.object({ a: is.string, b: is.number, c: is.boolean }).partial('b');
			type T = InferGuard<typeof guard>;
			// `a` and `c` are required; `b` is optional.
			const v: T = { a: 'x', c: true };
			expectTypeOf(v).toMatchTypeOf<{ a: string; c: boolean }>();
			// @ts-expect-error — `a` is required
			const missingA: T = { b: 1, c: true };
			expect(missingA).toBeDefined();
		});

		it('.required() strips both ? and | undefined from each field', () => {
			const guard = is.object({ a: is.string.optional, b: is.number.optional }).required();
			type T = InferGuard<typeof guard>;
			const v: T = { a: 'x', b: 1 };
			// The `| undefined` introduced by `.optional` is removed by `.required()`,
			// mirroring `partial`'s behavior in reverse and matching the runtime,
			// which rejects undefined values.
			expectTypeOf(v.a).toEqualTypeOf<string>();
			expectTypeOf(v.b).toEqualTypeOf<number>();
			// @ts-expect-error — undefined is no longer assignable to a required field
			const bad: T = { a: undefined, b: 1 };
			expect(bad).toBeDefined();
			expect(guard({ a: 'x', b: 1 })).toBe(true);
			expect(guard({ a: undefined as any, b: undefined as any })).toBe(false);
		});

		it('.required(specific) strips ? and | undefined only on listed keys', () => {
			const guard = is
				.object({ a: is.string.optional, b: is.number.optional, c: is.boolean.optional })
				.required('a');
			type T = InferGuard<typeof guard>;
			const v: T = { a: 'x' };
			expectTypeOf(v.a).toEqualTypeOf<string>();
			expectTypeOf(v.b).toEqualTypeOf<number | undefined>();
			expectTypeOf(v.c).toEqualTypeOf<boolean | undefined>();
		});

		it('.pick narrows the inferred type to the chosen keys', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const picked = base.pick(['a', 'c']);
			type T = InferGuard<typeof picked>;
			const v: T = { a: 'x', c: true };
			expectTypeOf(v).toEqualTypeOf<{ a: string; c: boolean }>();
		});

		it('.omit removes the listed keys from the inferred type', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const omitted = base.omit(['b']);
			type T = InferGuard<typeof omitted>;
			const v: T = { a: 'x', c: true };
			expectTypeOf(v).toEqualTypeOf<{ a: string; c: boolean }>();
		});

		it('.extend produces the intersection of both shapes', () => {
			const base = is.object({ a: is.string });
			const ext = base.extend({ b: is.number, c: is.boolean });
			type T = InferGuard<typeof ext>;
			const v: T = { a: 'x', b: 1, c: true };
			expectTypeOf(v).toEqualTypeOf<{ a: string; b: number; c: boolean }>();
		});

		it('.keyof narrows to the union of schema keys', () => {
			const guard = is.object({ name: is.string, age: is.number });
			const k = guard.keyof;
			type K = InferGuard<typeof k>;
			expectTypeOf<K>().toEqualTypeOf<'name' | 'age'>();
		});

		it('.has(key, guard) widens the inferred type with the new key', () => {
			const base = is.object({ a: is.string });
			const widened = base.has('b', is.number);
			type T = InferGuard<typeof widened>;
			const v: T = { a: 'x', b: 1 };
			expectTypeOf(v).toMatchObjectType<{ a: string; b: number }>();
		});

		it('.catchall<V> adds an index signature of V to the inferred type', () => {
			const guard = is.object({ a: is.string }).catchall(is.number);
			type T = InferGuard<typeof guard>;
			// TypeScript strictly checks object literals against index signatures and will reject
			// `{ a: 'x' }` against `Record<string, number>`. However, the intersection type
			// `{ a: string } & Record<string, number>` works perfectly for property access.
			const v = { a: 'x', extra: 5, anotherKey: 99 } as unknown as T;
			expectTypeOf(v.a).toEqualTypeOf<string>();
			expectTypeOf(v['extra']).toEqualTypeOf<number>();
		});

		it('nested object guards infer nested shapes', () => {
			const guard = is.object({
				user: is.object({
					name: is.string,
					address: is.object({
						street: is.string,
						city: is.string,
					}),
				}),
			});
			type T = InferGuard<typeof guard>;
			const v: T = {
				user: {
					name: 'a',
					address: { street: 's', city: 'c' },
				},
			};
			expectTypeOf(v.user.address.street).toEqualTypeOf<string>();
			expectTypeOf(v.user.address.city).toEqualTypeOf<string>();
		});

		it('discriminated unions infer as a union of object variants', () => {
			const guard = is.discriminatedUnion('kind', {
				circle: is.object({ radius: is.number }),
				square: is.object({ side: is.number }),
			});
			type T = InferGuard<typeof guard>;
			// Each variant must be assignable to T.
			const c: T = { kind: 'circle', radius: 5 };
			const s: T = { kind: 'square', side: 3 };
			expectTypeOf(c).toExtend<T>();
			expectTypeOf(s).toExtend<T>();
			// And foreign discriminant values must NOT be assignable.
			// @ts-expect-error — 'triangle' is not in the variant map
			const t: T = { kind: 'triangle', base: 1 };
			expect(t).toBeDefined();
			expect(guard(c)).toBe(true);
			expect(guard(s)).toBe(true);
		});

		it('Guard.parse returns Result<T, GuardErr> with proper narrowing', () => {
			const guard: Guard<{ a: string }> = is.object({ a: is.string });
			const result = guard.parse({ a: 'x' });
			if (result.isOk()) {
				expectTypeOf(result.value).toEqualTypeOf<{ a: string }>();
			}
		});
	});

	describe('Deep nesting & complex shapes', () => {
		it('validates 3-level deep objects with mixed optionality', () => {
			const guard = is.object({
				outer: is.object({
					mid: is.object({
						leaf: is.string.min(1),
						count: is.number.int.optional,
					}),
				}),
			});
			expect(guard({ outer: { mid: { leaf: 'x' } } })).toBe(true);
			expect(guard({ outer: { mid: { leaf: 'x', count: 3 } } })).toBe(true);
			expect(guard({ outer: { mid: { leaf: '' } } })).toBe(false); // min(1)
			expect(guard({ outer: { mid: { leaf: 'x', count: 1.5 } } })).toBe(false); // int
			expect(guard({ outer: {} } as any)).toBe(false); // missing mid
		});

		it('supports recursive guards via is.lazy', () => {
			type Tree = { value: number; children: Tree[] };
			const Tree: Guard<Tree> = is.object({
				value: is.number,
				children: is.lazy(() => is.array(Tree)),
			});

			expect(
				Tree({
					value: 1,
					children: [
						{ value: 2, children: [] },
						{ value: 3, children: [{ value: 4, children: [] }] },
					],
				})
			).toBe(true);

			expect(Tree({ value: 1, children: [{ value: 'bad' as any, children: [] }] })).toBe(false);
		});

		it('supports mutually-recursive guards', () => {
			type Folder = { name: string; entries: (Folder | File)[] };
			type File = { name: string; size: number };

			const FileGuard: Guard<File> = is.object({ name: is.string, size: is.number });
			const FolderGuard: Guard<Folder> = is.object({
				name: is.string,
				entries: is.lazy(() => is.array(is.union(FolderGuard, FileGuard))),
			});

			const root: Folder = {
				name: 'root',
				entries: [
					{ name: 'readme.md', size: 42 },
					{
						name: 'src',
						entries: [{ name: 'index.ts', size: 1024 }],
					},
				],
			};
			expect(FolderGuard(root)).toBe(true);
			expect(FolderGuard({ name: 'x', entries: [{ name: 'y', size: '10' }] } as any)).toBe(false);
		});

		it('handles a realistic nested API response', () => {
			const Response = is.object({
				status: is.literal('ok', 'error'),
				data: is.union(
					is.object({
						items: is
							.array(
								is.object({
									id: is.string.uuid(),
									tags: is.array(is.string).max(10),
								})
							)
							.min(1),
						page: is.number.int.nonnegative,
					}),
					is.object({
						message: is.string.min(1),
					})
				),
			});

			expect(
				Response({
					status: 'ok',
					data: {
						items: [{ id: '11111111-1111-4111-8111-111111111111', tags: ['a', 'b'] }],
						page: 0,
					},
				})
			).toBe(true);

			expect(
				Response({
					status: 'error',
					data: { message: 'something went wrong' },
				})
			).toBe(true);

			expect(
				Response({
					status: 'ok',
					data: {
						items: [],
						page: 0,
					},
				})
			).toBe(false); // items min(1)
		});
	});

	describe('Reshape composition & order independence', () => {
		it('.partial().required() recovers original required-ness', () => {
			const base = is.object({ a: is.string, b: is.number });
			const round = base.partial().required();
			expect(round({ a: 'x', b: 1 })).toBe(true);
			expect(round({ a: 'x' })).toBe(false);
			expect(round({})).toBe(false);
		});

		it('.required().partial() makes every key optional again', () => {
			const base = is.object({ a: is.string.optional, b: is.number });
			const round = base.required().partial();
			expect(round({})).toBe(true);
			expect(round({ a: 'x' })).toBe(true);
			expect(round({ a: 'x', b: 1 })).toBe(true);
			expect(round({ a: 1 } as any)).toBe(false); // wrong type still rejected
		});

		it('.pick(keys).pick(subset) === .pick(subset)', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const chained = base.pick(['a', 'b']).pick(['a']);
			const direct = base.pick(['a']);
			const probes: unknown[] = [{ a: 'x' }, { a: 'x', b: 1 }, { b: 1 }, {}, { a: 1 }];
			for (const v of probes) expect(chained(v)).toBe(direct(v));
		});

		it('.omit(a).omit(b) === .omit([a, b])', () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean });
			const chained = base.omit(['c']).omit(['b']);
			const direct = base.omit(['b', 'c']);
			const probes: unknown[] = [{ a: 'x' }, { a: 'x', b: 1 }, { a: 'x', c: true }, {}];
			for (const v of probes) expect(chained(v)).toBe(direct(v));
		});

		it('.pick then .extend re-adds the dropped key with a fresh type', () => {
			const base = is.object({ a: is.string, b: is.number });
			const reshaped = base.pick(['a']).extend({ b: is.boolean });
			expect(reshaped({ a: 'x', b: true })).toBe(true);
			expect(reshaped({ a: 'x', b: 1 })).toBe(false);
		});

		it('.extend can override an existing field with a stricter guard', () => {
			const base = is.object({ a: is.string });
			const stricter = base.extend({ a: is.string.min(3).max(5) });
			expect(stricter({ a: 'abcd' })).toBe(true);
			expect(stricter({ a: 'ab' })).toBe(false);
			expect(stricter({ a: 'abcdef' })).toBe(false);
		});

		// KNOWN ASYMMETRY: `.strict.partial()` correctly treats every key as optional,
		// but `.partial().strict` re-validates every schema key as required. The
		// `strict` transformer rebuilds its predicate from `meta.shape` instead of
		// delegating to the parent guard, so it ignores any partial state set above.
		// Pinned with `it.fails` so a future fix flips it.
		it.fails('.strict.partial vs .partial.strict produce equivalent runtime behavior', () => {
			const a = is.object({ a: is.string, b: is.number }).strict.partial();
			const b = is.object({ a: is.string, b: is.number }).partial().strict;
			const probes: unknown[] = [{}, { a: 'x' }, { a: 'x', b: 1 }, { a: 'x', extra: 1 }, { a: 1 }];
			for (const v of probes) expect(a(v)).toBe(b(v));
		});

		it('.strict.partial allows missing keys (partial wins over strict order)', () => {
			const guard = is.object({ a: is.string, b: is.number }).strict.partial();
			expect(guard({})).toBe(true);
			expect(guard({ a: 'x' })).toBe(true);
			expect(guard({ a: 'x', b: 1 })).toBe(true);
			expect(guard({ a: 'x', extra: 1 })).toBe(false); // strict still rejects extras
		});
	});

	describe('keyof reflects the current schema after reshapes', () => {
		it('after .extend, keyof includes the new keys', () => {
			const guard = is.object({ a: is.string }).extend({ b: is.number });
			const k = guard.keyof;
			expect(k('a')).toBe(true);
			expect(k('b')).toBe(true);
			expect(k('c')).toBe(false);
		});

		it('after .pick, keyof is restricted to picked keys', () => {
			const guard = is.object({ a: is.string, b: is.number, c: is.boolean }).pick(['a']);
			const k = guard.keyof;
			expect(k('a')).toBe(true);
			expect(k('b')).toBe(false);
			expect(k('c')).toBe(false);
		});

		it('after .omit, keyof drops the omitted keys', () => {
			const guard = is.object({ a: is.string, b: is.number }).omit(['b']);
			const k = guard.keyof;
			expect(k('a')).toBe(true);
			expect(k('b')).toBe(false);
		});
	});

	describe('catchall & strip semantics', () => {
		it('.catchall validates extra keys against the catchall guard', () => {
			const guard = is.object({ name: is.string }).catchall(is.number.int.nonnegative);
			expect(guard({ name: 'Alice', age: 30, score: 100 })).toBe(true);
			expect(guard({ name: 'Alice', age: -1 })).toBe(false); // catchall rejects
			expect(guard({ name: 'Alice', age: 'thirty' })).toBe(false);
		});

		it('.catchall composed with object guards in extra-key positions', () => {
			const guard = is.object({ name: is.string }).catchall(is.object({ tag: is.literal('a', 'b') }));
			expect(guard({ name: 'x', m1: { tag: 'a' }, m2: { tag: 'b' } })).toBe(true);
			expect(guard({ name: 'x', m1: { tag: 'c' } } as any)).toBe(false);
		});

		it('.strip discards extra keys via .parse() transform', () => {
			const guard = is.object({ a: is.string, b: is.number }).strip;
			const result = guard.parse({ a: 'x', b: 1, c: 'extra', d: 99 });
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual({ a: 'x', b: 1 });
				expect(Object.keys(result.value)).toEqual(['a', 'b']);
			}
		});

		it('.strip on frozen input does not throw', () => {
			const guard = is.object({ a: is.string }).strip;
			const frozen = Object.freeze({ a: 'x', extra: 1 });
			expect(() => guard.parse(frozen)).not.toThrow();
			const result = guard.parse(frozen);
			if (result.isOk()) {
				expect(Object.isFrozen(result.value)).toBe(false); // strip returns a fresh object
				expect(result.value).toEqual({ a: 'x' });
			}
		});
	});

	describe('Refinement chain semantics', () => {
		it('.where chained after a reshape applies only to the reshaped guard', () => {
			const base = is.object({ a: is.string, b: is.number });
			const onlyA = base.pick(['a']).where(v => v.a.startsWith('A'));
			expect(onlyA({ a: 'Apple' })).toBe(true);
			expect(onlyA({ a: 'banana' })).toBe(false);
			expect(base({ a: 'banana', b: 1 })).toBe(true);
		});

		it('multiple .where short-circuit in declaration order', () => {
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
			expect(secondCalls).toBe(0);
		});

		it('.size and .partial together: distinguish failure modes', () => {
			const guard = is.object({ a: is.string, b: is.number }).size(2).partial();
			expect(guard({ a: 'x', b: 1 })).toBe(true);
			expect(guard({ a: 'x' })).toBe(false); // size: 1 ≠ 2
			expect(guard({})).toBe(false); // size: 0 ≠ 2
			expect(guard({ a: 'x', b: 1, c: true } as any)).toBe(false); // extra
		});

		it('.minSize and .maxSize compose into a range', () => {
			const guard = is.object().minSize(2).maxSize(4);
			expect(guard({ a: 1, b: 2 })).toBe(true);
			expect(guard({ a: 1, b: 2, c: 3, d: 4 })).toBe(true);
			expect(guard({ a: 1 })).toBe(false);
			expect(guard({ a: 1, b: 2, c: 3, d: 4, e: 5 })).toBe(false);
		});
	});

	describe('Edge cases', () => {
		it('rejects arrays even when their schema would otherwise match', () => {
			// Arrays have numeric keys + length, so an empty schema "could" structurally
			// match []. Confirm the guard explicitly rejects arrays.
			const guard = is.object({});
			expect(guard([])).toBe(false);
			expect(guard([1, 2])).toBe(false);
		});

		it('handles Object.create(null) (no prototype)', () => {
			const noProto: Record<string, unknown> = Object.create(null);
			noProto.a = 'x';
			noProto.b = 1;
			const guard = is.object({ a: is.string, b: is.number });
			expect(guard(noProto)).toBe(true);
		});

		it('handles symbol keys without confusion', () => {
			const sym = Symbol('s');
			const obj = { a: 'x', [sym]: 'hidden' };
			const guard = is.object({ a: is.string });
			// Symbol keys aren't enumerated by Object.keys, so strict still passes.
			expect(guard.strict(obj)).toBe(true);
		});

		it('rejects null and undefined consistently across reshapes', () => {
			const base = is.object({ a: is.string });
			for (const reshape of [
				base,
				base.partial(),
				base.required(),
				base.pick(['a']),
				base.omit([]),
				base.extend({ b: is.number.optional }),
				base.strict,
				base.catchall(is.number),
			]) {
				expect(reshape(null)).toBe(false);
				expect(reshape(undefined)).toBe(false);
			}
		});
	});
});
