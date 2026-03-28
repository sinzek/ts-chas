/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/guard-v2.js';
import { makeGuard, type Guard } from '../../src/guard/shared.js';

// We use is.string / is.number as base guards for testing universals.
// A simple custom guard for composition tests:
const isPositiveNumber = is.number.positive;

describe('Universal helpers (v2)', () => {
	// =========================================================================
	// .parse()
	// =========================================================================
	describe('.parse()', () => {
		it('returns Ok on valid value', () => {
			const result = is.string.parse('hello');
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('hello');
		});

		it('returns Err on invalid value', () => {
			const result = is.string.parse(123);
			expect(result.isErr()).toBe(true);
		});

		it('error contains correct fields on type mismatch', () => {
			const result = is.string.parse(42);
			expect(result.isErr()).toBe(true);
			const error = result.unwrapErr();
			expect(error.name).toBe('string');
			expect(error.expected).toBe('string');
			expect(error.actual).toBe('number');
			expect(error.message).toContain('Expected string');
			expect(error.message).toContain('number');
		});

		it('error message distinguishes refinement failure from type mismatch', () => {
			// Type mismatch: "Expected string, but got number (42)"
			const typeMismatch = is.string.parse(42);
			expect(typeMismatch.unwrapErr().message).toMatch(/^Expected string, but got number/);

			// Refinement failure: "Value "hello" failed validation"
			const refinement = is.string.where(v => v.length > 10).parse('hello');
			expect(refinement.unwrapErr().message).toMatch(/^Value .* failed validation$/);
		});

		it('uses custom error from .err() when present', () => {
			const guard = is.string.error('must be a string!');
			const result = guard.parse(42);
			expect(result.unwrapErr().message).toBe('must be a string!');
		});

		it('works on chained guards', () => {
			const result = is.number.positive.int.parse(3.5);
			expect(result.isErr()).toBe(true);
			expect(result.unwrapErr().name).toContain('int');
		});

		it('works on complex types', () => {
			const result = is.array(is.string).parse(['a', 'b']);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual(['a', 'b']);

			const bad = is.array(is.string).parse('not an array');
			expect(bad.isErr()).toBe(true);
		});
	});

	// =========================================================================
	// .assert()
	// =========================================================================
	describe('.assert()', () => {
		it('returns the value on success', () => {
			const value = is.string.assert('hello');
			expect(value).toBe('hello');
		});

		it('throws on failure', () => {
			expect(() => is.string.assert(123)).toThrow();
		});

		it('thrown error has correct fields', () => {
			try {
				is.string.assert(42);
				expect.unreachable('should have thrown');
			} catch (e: any) {
				expect(e.name).toBe('string');
				expect(e.expected).toBe('string');
				expect(e.actual).toBe('number');
			}
		});

		it('uses custom error from .err() when present', () => {
			const guard = is.number.error('not a number!');
			expect(() => guard.assert('foo')).toThrow('not a number!');
		});

		it('distinguishes refinement failure from type mismatch', () => {
			// Type mismatch
			try {
				is.string.assert(42);
				expect.unreachable('should have thrown');
			} catch (e: any) {
				expect(e.message).toMatch(/^Expected string, but got number/);
			}

			// Refinement failure
			try {
				is.number.positive.assert(-5);
				expect.unreachable('should have thrown');
			} catch (e: any) {
				expect(e.message).toMatch(/^Value .* failed validation$/);
			}
		});
	});

	// =========================================================================
	// .err()
	// =========================================================================
	describe('.err()', () => {
		it('sets a static error message', () => {
			const guard = is.string.error('custom error');
			expect(guard.parse(42).unwrapErr().message).toBe('custom error');
		});

		it('sets a dynamic error message from function', () => {
			const guard = is.string.error(meta => `${meta.name} is required`);
			expect(guard.parse(42).unwrapErr().message).toBe('string is required');
		});

		it('does not affect validation logic', () => {
			const guard = is.string.error('custom');
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(false);
		});

		it('returns a new guard (immutable)', () => {
			const original = is.string;
			const withErr = original.error('custom');
			// Original should not have the custom error
			expect(original.meta.error).toBeUndefined();
			expect(withErr.meta.error).toBe('custom');
		});

		it('preserves type-specific helpers after .err()', () => {
			// After .err(), string helpers should still be accessible
			const guard = is.string.error('bad').email;
			expect(guard('test@example.com')).toBe(true);
			expect(guard('nope')).toBe(false);
		});
	});

	// =========================================================================
	// .brand()
	// =========================================================================
	describe('.brand()', () => {
		it('does not change runtime behavior', () => {
			const branded = is.string.brand('Email');
			expect(branded('hello')).toBe(true);
			expect(branded(42)).toBe(false);
		});

		it('updates meta name', () => {
			const branded = is.string.brand('Email');
			expect(branded.meta.name).toContain('brand<Email>');
		});

		it('preserves type-specific helpers', () => {
			const guard = is.string.brand('Username').where(v => v.length > 3);
			expect(guard('abcd')).toBe(true);
			expect(guard('ab')).toBe(false);
		});

		it('parse returns branded value on success', () => {
			const guard = is.string.brand('Email');
			const result = guard.parse('test@example.com');
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('test@example.com');
		});
	});

	// =========================================================================
	// .where()
	// =========================================================================
	describe('.where()', () => {
		it('adds a custom predicate', () => {
			const guard = is.string.where(v => v.startsWith('hello'));
			expect(guard('hello world')).toBe(true);
			expect(guard('goodbye')).toBe(false);
		});

		it('rejects values that fail the base guard', () => {
			const guard = is.string.where(v => v.length > 0);
			expect(guard(42)).toBe(false);
		});

		it('chains with other helpers', () => {
			const guard = is.number.positive.where(v => v % 2 === 0);
			expect(guard(4)).toBe(true);
			expect(guard(3)).toBe(false); // odd
			expect(guard(-2)).toBe(false); // negative
		});

		it('updates meta name', () => {
			const guard = is.string.where(v => v.length > 5);
			expect(guard.meta.name).toContain('where(condition)');
		});

		it('multiple .where() calls compose with AND', () => {
			const guard = is.number
				.where(v => v > 0)
				.where(v => v < 100)
				.where(v => v % 2 === 0);
			expect(guard(50)).toBe(true);
			expect(guard(101)).toBe(false);
			expect(guard(-1)).toBe(false);
			expect(guard(51)).toBe(false); // odd
		});
	});

	// =========================================================================
	// .eq()
	// =========================================================================
	describe('.eq()', () => {
		it('checks deep equality for primitives', () => {
			const guard = is.string.eq('hello');
			expect(guard('hello')).toBe(true);
			expect(guard('world')).toBe(false);
		});

		it('rejects values that fail the base guard', () => {
			const guard = is.string.eq('hello');
			expect(guard(42)).toBe(false);
		});

		it('checks deep equality for objects', () => {
			const guard = is.object({ name: is.string }).eq({ name: 'Alice' });
			expect(guard({ name: 'Alice' })).toBe(true);
			expect(guard({ name: 'Bob' })).toBe(false);
		});

		it('checks deep equality for arrays', () => {
			const guard = is.array(is.number).eq([1, 2, 3]);
			expect(guard([1, 2, 3])).toBe(true);
			expect(guard([1, 2, 4])).toBe(false);
		});

		it('updates meta name', () => {
			const guard = is.number.eq(42);
			expect(guard.meta.name).toContain('eq(42)');
		});
	});

	// =========================================================================
	// .not (property)
	// =========================================================================
	describe('.not', () => {
		it('inverts the guard', () => {
			const notString = is.string.not;
			expect(notString('hello')).toBe(false);
			expect(notString(42)).toBe(true);
			expect(notString(null)).toBe(true);
		});

		it('inverts a chained guard', () => {
			const notPositive = is.number.positive.not;
			expect(notPositive(5)).toBe(false);
			expect(notPositive(-5)).toBe(true);
			// Note: non-numbers also pass .not since the whole chain is inverted
			expect(notPositive('hello')).toBe(true);
		});

		it('updates meta name', () => {
			expect(is.string.not.meta.name).toContain('.not');
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.not;
			// .not drops helpers — should not have string-specific properties
			// Accessing a non-existent helper returns undefined (proxy fallthrough)
			expect((guard as any).email).toBeUndefined();
		});

		it('still has universal helpers', () => {
			const guard = is.string.not;
			// Universal methods should still work
			const result = guard.parse(42);
			expect(result.isOk()).toBe(true);

			const fail = guard.parse('hello');
			expect(fail.isErr()).toBe(true);
		});
	});

	// =========================================================================
	// .and()
	// =========================================================================
	describe('.and()', () => {
		it('combines two guards — both must pass', () => {
			const hasName = is.object({ name: is.string });
			const hasAge = is.object({ age: is.number });
			const hasBoth = hasName.and(hasAge);

			expect(hasBoth({ name: 'Alice', age: 30 })).toBe(true);
			expect(hasBoth({ name: 'Alice' })).toBe(false);
			expect(hasBoth({ age: 30 })).toBe(false);
		});

		it('preserves left guard helpers', () => {
			const guard = is.number.and(is.number.positive);
			// Should still have number helpers since .and preserves helpers
			expect(guard.int(3)).toBe(true);
			expect(guard.int(3.5)).toBe(false);
		});

		it('short-circuits: if first fails, second is not checked', () => {
			let secondCalled = false;
			const second = makeGuard(
				(v: unknown): v is number => {
					secondCalled = true;
					return typeof v === 'number';
				},
				{ name: 'spy', id: 'spy' }
			);
			const guard = is.string.and(second);
			guard(42); // first guard (is.string) should fail
			expect(secondCalled).toBe(false);
		});

		it('updates meta name', () => {
			const guard = is.string.and(is.number);
			expect(guard.meta.name).toContain('.and(');
			expect(guard.meta.name).toContain('number');
		});
	});

	// =========================================================================
	// .or()
	// =========================================================================
	describe('.or()', () => {
		it('combines two guards — either can pass', () => {
			const stringOrNumber = is.string.or(is.number);
			expect(stringOrNumber('hello')).toBe(true);
			expect(stringOrNumber(42)).toBe(true);
			expect(stringOrNumber(null)).toBe(false);
			expect(stringOrNumber(true)).toBe(false);
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.or(is.number);
			// Should not have string-specific helpers
			expect((guard as any).email).toBeUndefined();
		});

		it('still has universal helpers', () => {
			const guard = is.string.or(is.number);
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
		});

		it('updates meta name', () => {
			const guard = is.string.or(is.number);
			expect(guard.meta.name).toContain('.or(');
			expect(guard.meta.name).toContain('number');
		});

		it('chains multiple .or() calls', () => {
			const guard = is.string.or(is.number).or(is.boolean);
			expect(guard('hello')).toBe(true);
			expect(guard(42)).toBe(true);
			expect(guard(true)).toBe(true);
			expect(guard(null)).toBe(false);
		});
	});

	// =========================================================================
	// .nullable (property)
	// =========================================================================
	describe('.nullable', () => {
		it('accepts null in addition to the base type', () => {
			const guard = is.string.nullable;
			expect(guard('hello')).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(undefined)).toBe(false);
			expect(guard(42)).toBe(false);
		});

		it('works with chained guards', () => {
			const guard = is.number.positive.nullable;
			expect(guard(5)).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(-5)).toBe(false);
			expect(guard(undefined)).toBe(false);
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.nullable;
			expect((guard as any).email).toBeUndefined();
		});

		it('updates meta name', () => {
			expect(is.string.nullable.meta.name).toContain('.nullable');
		});

		it('parse works with nullable', () => {
			const guard = is.string.nullable;
			expect(guard.parse(null).isOk()).toBe(true);
			expect(guard.parse(null).unwrap()).toBe(null);
			expect(guard.parse('hello').isOk()).toBe(true);
			expect(guard.parse(42).isErr()).toBe(true);
		});
	});

	// =========================================================================
	// .optional (property)
	// =========================================================================
	describe('.optional', () => {
		it('accepts undefined in addition to the base type', () => {
			const guard = is.string.optional;
			expect(guard('hello')).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard(null)).toBe(false);
			expect(guard(42)).toBe(false);
		});

		it('works with chained guards', () => {
			const guard = is.number.int.optional;
			expect(guard(5)).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard(3.5)).toBe(false);
			expect(guard(null)).toBe(false);
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.optional;
			expect((guard as any).email).toBeUndefined();
		});

		it('updates meta name', () => {
			expect(is.string.optional.meta.name).toContain('.optional');
		});

		it('parse works with optional', () => {
			const guard = is.number.optional;
			expect(guard.parse(undefined).isOk()).toBe(true);
			expect(guard.parse(undefined).unwrap()).toBe(undefined);
			expect(guard.parse(42).isOk()).toBe(true);
			expect(guard.parse('hello').isErr()).toBe(true);
		});
	});

	// =========================================================================
	// .nullish (property)
	// =========================================================================
	describe('.nullish', () => {
		it('accepts null and undefined in addition to the base type', () => {
			const guard = is.string.nullish;
			expect(guard('hello')).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard(42)).toBe(false);
		});

		it('works with chained guards', () => {
			const guard = is.number.positive.nullish;
			expect(guard(5)).toBe(true);
			expect(guard(null)).toBe(true);
			expect(guard(undefined)).toBe(true);
			expect(guard(-5)).toBe(false);
			expect(guard('hello')).toBe(false);
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.nullish;
			expect((guard as any).email).toBeUndefined();
		});

		it('updates meta name', () => {
			expect(is.string.nullish.meta.name).toContain('.nullish');
		});

		it('parse works with nullish', () => {
			const guard = is.boolean.nullish;
			expect(guard.parse(null).isOk()).toBe(true);
			expect(guard.parse(undefined).isOk()).toBe(true);
			expect(guard.parse(true).isOk()).toBe(true);
			expect(guard.parse('hello').isErr()).toBe(true);
		});
	});

	// =========================================================================
	// Immutability
	// =========================================================================
	describe('Immutability', () => {
		it('chaining does not mutate the original guard', () => {
			const base = is.string;
			const withWhere = base.where(v => v.length > 5);
			const withErr = base.error('custom');
			const branded = base.brand('Tag');

			// Original should be unchanged
			expect(base.meta.name).toBe('string');
			expect(base.meta.error).toBeUndefined();
			expect(base('hi')).toBe(true);

			// Derived guards should have their own meta
			expect(withWhere.meta.name).toContain('where');
			expect(withErr.meta.error).toBe('custom');
			expect(branded.meta.name).toContain('brand');
		});

		it('.nullable / .optional / .nullish do not mutate', () => {
			const base = is.number;
			const nullable = base.nullable;
			const optional = base.optional;
			const nullish = base.nullish;

			expect(base(null)).toBe(false);
			expect(base(undefined)).toBe(false);
			expect(nullable(null)).toBe(true);
			expect(optional(undefined)).toBe(true);
			expect(nullish(null)).toBe(true);
			expect(nullish(undefined)).toBe(true);
		});

		it('.not does not mutate', () => {
			const base = is.string;
			const notStr = base.not;

			expect(base('hello')).toBe(true);
			expect(notStr('hello')).toBe(false);
		});
	});

	// =========================================================================
	// Composition (combining multiple universals)
	// =========================================================================
	describe('Composition', () => {
		it('.where() after .nullable works on the inner type', () => {
			// Nullable wraps, then where refines — but .nullable drops helpers,
			// so .where() (universal) still works
			const guard = is.string.nullable.where(v => v === null || v.length > 3);
			expect(guard(null)).toBe(true);
			expect(guard('abcd')).toBe(true);
			expect(guard('ab')).toBe(false);
		});

		it('.parse() after .or() works', () => {
			const guard = is.string.or(is.number);
			expect(guard.parse('hello').isOk()).toBe(true);
			expect(guard.parse(42).isOk()).toBe(true);
			expect(guard.parse(null).isErr()).toBe(true);
		});

		it('.err() after .or() works', () => {
			const guard = is.string.or(is.number).error('must be string or number');
			expect(guard.parse(null).unwrapErr().message).toBe('must be string or number');
		});

		it('.not combined with .and() / .or()', () => {
			// "not string AND not number" = neither string nor number
			const neitherStringNorNumber = is.string.not.and(is.number.not);
			expect(neitherStringNorNumber(true)).toBe(true);
			expect(neitherStringNorNumber(null)).toBe(true);
			expect(neitherStringNorNumber('hello')).toBe(false);
			expect(neitherStringNorNumber(42)).toBe(false);
		});

		it('.brand() then .parse() preserves branded value', () => {
			const guard = is.string.email.brand('Email');
			const result = guard.parse('test@example.com');
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('test@example.com');
		});

		it('.eq() then .parse()', () => {
			const guard = is.number.eq(42);
			expect(guard.parse(42).isOk()).toBe(true);
			expect(guard.parse(43).isErr()).toBe(true);
			expect(guard.parse('hello').isErr()).toBe(true);
		});
	});

	// =========================================================================
	// Meta tracking
	// =========================================================================
	describe('Meta tracking', () => {
		it('base guard has correct meta', () => {
			expect(is.string.meta.name).toBe('string');
			expect(is.string.meta.id).toBe('string');
		});

		it('chain builds up the name', () => {
			const guard = is.string.email;
			expect(guard.meta.name).toBe('string.email');
		});

		it('.where appends to name', () => {
			const guard = is.number.where(v => v > 0);
			expect(guard.meta.name).toBe('number.where(condition)');
		});

		it('.eq appends to name', () => {
			const guard = is.string.eq('hello');
			expect(guard.meta.name).toBe('string.eq("hello")');
		});

		it('.not appends to name', () => {
			expect(is.string.not.meta.name).toBe('string.not');
		});

		it('.and appends to name', () => {
			const guard = is.string.and(is.number);
			expect(guard.meta.name).toBe('string.and(number)');
		});

		it('.or appends to name', () => {
			const guard = is.string.or(is.number);
			expect(guard.meta.name).toBe('string.or(number)');
		});

		it('.nullable appends to name', () => {
			expect(is.string.nullable.meta.name).toBe('string.nullable');
		});

		it('.optional appends to name', () => {
			expect(is.string.optional.meta.name).toBe('string.optional');
		});

		it('.nullish appends to name', () => {
			expect(is.string.nullish.meta.name).toBe('string.nullish');
		});

		it('.err appends custom error to meta', () => {
			const guard = is.string.error('custom');
			expect(guard.meta.error).toBe('custom');
		});

		it('.brand appends to name', () => {
			const guard = is.string.brand('Email');
			expect(guard.meta.name).toBe('string.brand<Email>');
		});

		it('long chain builds full name', () => {
			const guard = is.number.positive.int.where(v => v < 100);
			expect(guard.meta.name).toBe('number.positive.int.where(condition)');
		});
	});

	// =========================================================================
	// Error message quality
	// =========================================================================
	describe('Error messages', () => {
		it('type mismatch: includes expected and actual types', () => {
			const result = is.string.parse(42);
			const msg = result.unwrapErr().message;
			expect(msg).toContain('Expected');
			expect(msg).toContain('string');
			expect(msg).toContain('number');
		});

		it('type mismatch: includes the actual value', () => {
			const result = is.number.parse('hello');
			expect(result.unwrapErr().message).toContain('"hello"');
		});

		it('refinement failure: says "failed validation"', () => {
			const result = is.number.positive.parse(-5);
			expect(result.unwrapErr().message).toMatch(/failed validation$/);
		});

		it('refinement failure: includes the actual value', () => {
			const result = is.number.positive.parse(-5);
			expect(result.unwrapErr().message).toContain('-5');
		});

		it('null value type mismatch is reported as "null"', () => {
			const result = is.string.parse(null);
			expect(result.unwrapErr().actual).toBe('null');
			expect(result.unwrapErr().message).toContain('null');
		});

		it('array value type mismatch is reported as "array"', () => {
			const result = is.string.parse([1, 2]);
			expect(result.unwrapErr().actual).toBe('array');
		});

		it('custom .err() overrides default message', () => {
			const guard = is.string.error('nope');
			expect(guard.parse(42).unwrapErr().message).toBe('nope');
			expect(guard.parse('valid string but wrong refinement is not tested here').isOk()).toBe(true);
		});

		it('dynamic .err() function receives meta', () => {
			const guard = is.number.positive.error(meta => `Guard "${meta.name}" rejected the value`);
			const result = guard.parse(-1);
			expect(result.unwrapErr().message).toBe('Guard "number.positive" rejected the value');
		});
	});

	// -----------------------------------------------------------------------
	// .transform()
	// -----------------------------------------------------------------------

	describe('.transform()', () => {
		it('transforms the parsed value', () => {
			const guard = is.string.transform(s => s.length);
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(5);
			}
		});

		it('transforms the asserted value', () => {
			const guard = is.string.transform(s => s.toUpperCase());
			expect(guard.assert('hello')).toBe('HELLO');
		});

		it('still validates the original input', () => {
			const guard = is.string.transform(s => s.length);
			expect(guard.parse(123).isErr()).toBe(true);
		});

		it('subsequent .where() operates on transformed value', () => {
			const shortString = is.string.transform(s => s.length).where(n => n < 5);
			expect(shortString.parse('hi').isOk()).toBe(true);
			expect(shortString.parse('this is too long').isErr()).toBe(true);
		});

		it('subsequent .eq() operates on transformed value', () => {
			const fiveLetters = is.string.transform(s => s.length).eq(5);
			expect(fiveLetters.parse('hello').isOk()).toBe(true);
			expect(fiveLetters.parse('hi').isErr()).toBe(true);
		});

		it('chains with prior transforms', () => {
			const guard = is.string.trim().transform(s => s.length);
			const result = guard.parse('  hi  ');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(2); // trimmed 'hi' has length 2
			}
		});

		it('can chain multiple transforms', () => {
			const guard = is.string.transform(s => s.split(',')).transform(arr => arr.length);
			const result = guard.parse('a,b,c');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(3);
			}
		});

		it('drops type-specific helpers', () => {
			const guard = is.string.transform(s => s.length);
			// @ts-expect-error — string helpers should not exist after transform
			expect(guard.email).toBeUndefined();
		});

		it('updates meta.name', () => {
			const guard = is.string.transform(s => s.length);
			expect(guard.meta.name).toContain('transform');
		});

		it('works with object guards', () => {
			const guard = is.object({ name: is.string, age: is.number }).transform(obj => obj.name);
			const result = guard.parse({ name: 'Chase', age: 25 });
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe('Chase');
			}
		});

		it('works with array guards', () => {
			const guard = is.array(is.number).transform(arr => arr.reduce((a: number, b: number) => a + b, 0));
			const result = guard.parse([1, 2, 3]);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(6);
			}
		});

		it('type-changing transform narrows correctly in .where()', () => {
			const guard = is.string
				.transform(s => ({ len: s.length, upper: s.toUpperCase() }))
				.where(obj => obj.len > 2);

			expect(guard.parse('hi').isErr()).toBe(true);
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual({ len: 5, upper: 'HELLO' });
			}
		});
	});

	// -----------------------------------------------------------------------
	// .refine()
	// -----------------------------------------------------------------------

	describe('.refine()', () => {
		it('transforms the parsed value', () => {
			const guard = is.string.refine(s => s.toUpperCase());
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe('HELLO');
			}
		});

		it('transforms the asserted value', () => {
			const guard = is.number.refine(n => Math.round(n));
			expect(guard.assert(3.7)).toBe(4);
		});

		it('still validates the original input', () => {
			const guard = is.string.refine(s => s.trim());
			expect(guard.parse(123).isErr()).toBe(true);
		});

		it('preserves type-specific helpers', () => {
			// String helpers should still be available after refine
			const guard = is.string.refine(s => s.trim().toLowerCase()).email;
			expect(guard.parse('  HELLO@EXAMPLE.COM  ').isOk()).toBe(true);
			expect(guard.parse('  not-an-email  ').isErr()).toBe(true);
		});

		it('preserves number helpers', () => {
			const guard = is.number.refine(n => Math.abs(n)).gt(5);
			expect(guard.parse(-10).isOk()).toBe(true); // abs(-10) = 10 > 5
			expect(guard.parse(-3).isErr()).toBe(true); // abs(-3) = 3, not > 5
		});

		it('chains with prior transforms', () => {
			const guard = is.string.trim().refine(s => s.toLowerCase());
			const result = guard.parse('  HELLO  ');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe('hello');
			}
		});

		it('chains multiple refines', () => {
			const guard = is.string.refine(s => s.trim()).refine(s => s.toLowerCase());
			const result = guard.parse('  HELLO  ');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe('hello');
			}
		});

		it('subsequent .where() operates on refined value', () => {
			const guard = is.number.refine(n => Math.abs(n)).where(n => n > 5);
			expect(guard.parse(-10).isOk()).toBe(true); // abs(-10) = 10 > 5
			expect(guard.parse(3).isErr()).toBe(true); // abs(3) = 3, not > 5
		});

		it('subsequent .eq() operates on refined value', () => {
			const guard = is.number.refine(n => Math.round(n)).eq(5);
			expect(guard.parse(4.6).isOk()).toBe(true); // round(4.6) = 5
			expect(guard.parse(4.4).isErr()).toBe(true); // round(4.4) = 4
		});

		it('updates meta.name', () => {
			const guard = is.string.refine(s => s.trim());
			expect(guard.meta.name).toContain('refine');
		});

		it('.refine() then .transform() works', () => {
			const guard = is.string.refine(s => s.trim()).transform(s => s.length);
			const result = guard.parse('  hi  ');
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toBe(2);
			}
		});

		it('.transform() then cannot use .refine() (helpers dropped)', () => {
			const guard = is.string.transform(s => s.length);
			// After transform, helpers are dropped, but refine is universal so it still exists
			const refined = guard.refine(n => Math.abs(n));
			expect(refined.parse('hello').isOk()).toBe(true);
			if (refined.parse('hello').isOk()) {
				expect(refined.parse('hello').unwrap()).toBe(5);
			}
		});
	});
});
