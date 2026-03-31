// Guard API v2

import { ArrayGuardFactory } from './objects/array.js';
import { InstanceofGuardFactory } from './objects/instanceof.js';
import { BigIntGuard } from './primitives/bigint.js';
import { BooleanGuard } from './primitives/boolean.js';
import { NullGuard } from './primitives/null.js';
import { NaNGuard, NumberGuard } from './primitives/number.js';
import { StringGuard } from './primitives/string.js';
import { SymbolGuard } from './primitives/symbol.js';
import { UndefinedGuard, VoidGuard } from './primitives/undefined.js';
import { ObjectGuardFactory } from './objects/object.js';
import { RecordGuardFactory } from './objects/record.js';
import { AnyGuard, NeverGuard, UnknownGuard } from './type-only.js';
import { DateGuard } from './built-ins/date.js';
import { RegExpGuardFactory } from './built-ins/regexp.js';
import { UrlGuardFactory } from './built-ins/url.js';
import { TupleGuardFactory } from './objects/tuple.js';
import { LiteralGuardFactory } from './misc/literal.js';
import { UnionGuardFactory } from './misc/union.js';
import { IntersectionGuardFactory } from './misc/intersection.js';
import { EnumGuardFactory } from './misc/enum.js';
import { ResultGuardFactory } from './custom/result.js';
import { OptionGuardFactory } from './custom/option.js';
import { TaggedErrGuardFactory } from './custom/tagged-err.js';
import { XorGuardFactory } from './misc/xor.js';
import { TemplateLiteralGuardFactory } from './misc/template-literal.js';
import { MapGuardFactory } from './built-ins/map.js';
import { SetGuardFactory } from './built-ins/set.js';
import { PromiseGuard } from './built-ins/promise.js';
import { ErrorGuard } from './built-ins/error.js';
import { FileGuard } from './built-ins/file.js';
import { JsonGuard } from './misc/json.js';
import { CustomGuardFactory } from './custom/custom.js';
import { FunctionGuardFactory } from './primitives/function.js';

// schema utilities
export { defineSchemas, defineSchema, formatErrors, flattenErrors, AggregateGuardError } from './schema.js';
export type { Schema, InferSchema, InferInput } from './schema.js';

// core types
export type { Guard, InferGuard, GuardMeta, GuardErr, Brand } from './shared.js';

// Export all helper and guard types to ensure portability of inferred guard types
export type { ObjectHelpers } from './objects/shared.js';
export type { ArrayHelpers } from './shared.js';
export type { StringHelpers, HashHelpers } from './primitives/string.js';
export type { NumberHelpers } from './primitives/number.js';
export type { BooleanHelpers } from './primitives/boolean.js';
export type { BigIntHelpers } from './primitives/bigint.js';
export type { SymbolHelpers } from './primitives/symbol.js';
export type { EnumHelpers } from './misc/enum.js';
export type { DateHelpers } from './built-ins/date.js';
export type { SetHelpers } from './built-ins/set.js';
export type { MapHelpers } from './built-ins/map.js';
export type { FileHelpers } from './built-ins/file.js';
export type { RegExpHelpers } from './built-ins/regexp.js';
export type { UrlHelpers } from './built-ins/url.js';
export type { ErrorHelpers } from './built-ins/error.js';
export type { JsonHelpers } from './misc/json.js';
export type { ResultHelpers } from './custom/result.js';
export type { OptionHelpers } from './custom/option.js';
export type { FunctionHelpers } from './primitives/function.js';
export type { TaggedErrGuardFactory } from './custom/tagged-err.js';
export type { TemplateLiteralGuardFactory } from './misc/template-literal.js';
export type { XorGuardFactory } from './misc/xor.js';
export type { IntersectionGuardFactory } from './misc/intersection.js';
export type { UnionGuardFactory } from './misc/union.js';
export type { LiteralGuardFactory } from './misc/literal.js';
export type { TupleGuardFactory } from './objects/tuple.js';
export type { RecordGuardFactory } from './objects/record.js';
export type { ObjectGuardFactory } from './objects/object.js';
export type { StringGuard } from './primitives/string.js';
export type { NumberGuard, NaNGuard } from './primitives/number.js';
export type { BooleanGuard } from './primitives/boolean.js';
export type { BigIntGuard } from './primitives/bigint.js';
export type { SymbolGuard } from './primitives/symbol.js';
export type { UndefinedGuard, VoidGuard } from './primitives/undefined.js';
export type { FileGuard } from './built-ins/file.js';
export type { ErrorGuard } from './built-ins/error.js';
export type { PromiseGuard } from './built-ins/promise.js';
export type { DateGuard } from './built-ins/date.js';

// guard authoring utilities for custom guard creation
export { makeGuard, factory, transformer, terminal, property } from './shared.js';

// misc types
export type { Json } from './misc/json.js';

const baseIs = {
	// ---- PRIMITIVES ----
	/**
	 * Creates a Guard that validates that a value is a string.
	 *
	 * @example
	 * is.string('hello'); // true
	 * is.string(123); // false
	 *
	 * @example
	 * // Chaining string helpers
	 * const guard = is.string.trim().email.min(10).max(50);
	 * guard.parse('  contact@example.com  '); // Result<string, GuardErr>
	 */
	string: StringGuard,
	/**
	 * Creates a Guard that validates that a value is a number.
	 *
	 * @example
	 * is.number(123); // true
	 * is.number('123'); // false
	 *
	 * @example
	 * // Chaining number helpers
	 * const guard = is.number.int.between(1, 100);
	 * guard.parse(42); // Result<number, GuardErr>
	 */
	number: NumberGuard,
	/**
	 * Validates that a value is NaN. Note that `NaN !== NaN`, so you cannot use `is.number.eq(NaN)`.
	 *
	 * Narrows to a branded type `NaN` that is meant to signal "Not a Number" in a type-safe way.
	 *
	 * @example
	 * is.nan(NaN); // true
	 * is.nan(123); // false
	 */
	nan: NaNGuard,
	/**
	 * Creates a Guard that validates that a value is a boolean.
	 *
	 * @example
	 * is.boolean(true); // true
	 * is.boolean.true(true); // true
	 * is.boolean.true(false); // false
	 */
	boolean: BooleanGuard,
	/**
	 * Creates a Guard that validates that a value is a bigint.
	 *
	 * @example
	 * is.bigint(123n); // true
	 */
	bigint: BigIntGuard,
	/**
	 * Creates a Guard that validates that a value is a symbol.
	 *
	 * @example
	 * is.symbol(Symbol('foo')); // true
	 */
	symbol: SymbolGuard,
	/**
	 * Creates a Guard that validates that a value is a function and validates its inputs and outputs when it runs via .impl(...args)().
	 *
	 * @example
	 * const guard = is.function({ input: [is.number], output: is.string });
	 * guard(() => {}); // true
	 * guard(123); // false
	 *
	 * @example
	 * // Chaining function helpers
	 * const guard = is.function({ input: [is.number], output: is.string });
	 * const add = guard.impl((a: number, b: number) => a + b);
	 * add(2, 3); // 5
	 * add(2, '3' as any); // throws
	 */
	function: FunctionGuardFactory,
	/**
	 * Creates a Guard that validates that a value is undefined.
	 */
	undefined: UndefinedGuard,
	/**
	 * Creates a Guard that validates that a value is null.
	 */
	null: NullGuard,
	/**
	 * Creates a Guard that validates that a value is either null or undefined.
	 */
	void: VoidGuard,

	// ---- OBJECTS ----
	/**
	 * Creates a Guard that validates that a value is an instance of a class.
	 *
	 * @example
	 * class Person {}
	 * is.instance(Person)(new Person()); // true
	 */
	instanceof: InstanceofGuardFactory,
	/**
	 * Creates a Guard that validates that a value is an array.
	 *
	 * @example
	 * is.array()([1, 2, 3]); // true, inferred as unknown[]
	 * is.array(is.number)([1, 2, 3]); // true, inferred as number[]
	 * is.array(is.string, is.number)(['hello', 1]); // true, inferred as (string | number)[]
	 * is.array(is.string, is.number)(['hello', 1, true]); // true, inferred as (string | number | boolean)[]
	 *
	 * @example
	 * // Array of specific types with length constraints
	 * const guard = is.array(is.number).min(1).max(10);
	 * guard.parse([1, 2, 3]); // Result<number[], GuardErr>
	 */
	array: ArrayGuardFactory,
	/**
	 * Creates a Guard that validates that a value is an object with a specific shape.
	 *
	 * @example
	 * const guard = is.object({
	 *   name: is.string.min(1),
	 *   age: is.number.gt(0)
	 * }).strict;
	 *
	 * guard({ name: 'Chase', age: 99 }); // true
	 * guard({ name: 'Chase', age: 99, extra: true }); // false (due to .strict)
	 */
	object: ObjectGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a record (object with string/number keys).
	 *
	 * When the key guard has a finite set of values (`is.enum` or `is.literal`), the record
	 * performs **exhaustive key checking** — all keys must be present and no extra keys are
	 * allowed, matching TypeScript's `Record<'a' | 'b', V>` semantics.
	 *
	 * When the key guard is open-ended (`is.string`, `is.number`), it validates that every
	 * existing key/value pair satisfies the guards, without requiring specific keys.
	 *
	 * @example
	 * // Open-ended record
	 * const guard = is.record(is.string, is.number);
	 * guard({ a: 1, b: 2 }); // true
	 *
	 * @example
	 * // Exhaustive record with enum keys
	 * const Keys = is.enum(['id', 'name'] as const);
	 * const guard = is.record(Keys, is.string);
	 * guard({ id: '1', name: 'Alice' }); // true
	 * guard({ id: '1' }); // false — missing 'name'
	 *
	 * @example
	 * // Exhaustive record with literal keys
	 * const guard = is.record(is.literal('a', 'b'), is.number);
	 * guard({ a: 1, b: 2 }); // true
	 * guard({ a: 1 }); // false — missing 'b'
	 *
	 * @example
	 * // Partial exhaustive — keys become optional
	 * const guard = is.record(is.enum(['a', 'b'] as const), is.string).partial;
	 * guard({ a: 'x' }); // true
	 */
	record: RecordGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a tuple (fixed-length array with positional types).
	 * Optionally accepts a rest guard for variadic trailing elements.
	 *
	 * @example
	 * const guard = is.tuple([is.string, is.number]);
	 * guard(['hello', 123]); // true
	 * guard(['hello', 123, true]); // false (fixed length)
	 *
	 * @example
	 * // With rest element
	 * const guard = is.tuple([is.number, is.string], is.boolean);
	 * guard([1, 'a']); // true — rest is optional
	 * guard([1, 'a', true, false]); // true — [number, string, ...boolean[]]
	 * guard([1, 'a', 'nope']); // false — rest elements must be boolean
	 */
	tuple: TupleGuardFactory,

	// ---- TYPE ONLY ----
	/** Narrows the type of a value to unknown. Does not perform any runtime validation. */
	unknown: UnknownGuard,
	/** Narrows the type of a value to any. Does not perform any runtime validation. */
	any: AnyGuard,
	/** Narrows the type of a value to never, however it will always fail at runtime. */
	never: NeverGuard,

	// ---- BUILT-INS ----
	/**
	 * Creates a Guard that validates that a value is a Date.
	 *
	 * @example
	 * const guard = is.date;
	 * guard(new Date()); // true
	 * guard('hello'); // false
	 *
	 * @example
	 * const guard = is.date.before(new Date('2026-01-01'));
	 * guard.parse(new Date('2025-12-31')); // Result<Date, GuardErr>
	 *
	 * @example
	 * const guard = is.date.startOf('year'); // transforms a passed date to the start of the year
	 * guard.parse(new Date('2025-12-31')); // Result<Date, GuardErr> // 2025-01-01T00:00:00.000Z
	 */
	date: DateGuard,
	/**
	 * Creates a Guard that validates that a value is a RegExp.
	 *
	 * @example
	 * const guard = is.regexp;
	 * guard(/hello/); // true
	 * guard('hello'); // false
	 *
	 * @example
	 * const guard = is.regexp(/hello/);
	 * guard.parse(/hello/); // Result<RegExp, GuardErr>
	 */
	regexp: RegExpGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a URL.
	 *
	 * @example
	 * const guard = is.url;
	 * guard(new URL('https://example.com')); // true
	 * guard('https://example.com'); // false
	 *
	 * @example
	 * const guard = is.url.transform(u => u.href);
	 * guard.parse(new URL('https://example.com')); // Result<string, GuardErr>
	 */
	url: UrlGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a `Map`.
	 * Optionally accepts key and value guards for typed Maps.
	 *
	 * @example
	 * is.map()(new Map()); // true
	 * is.map(is.string, is.number)(new Map([['a', 1]])); // true
	 * is.map(is.number.max(10), is.string)(new Map([[5, 'ok']])); // true
	 *
	 * @example
	 * // With helpers
	 * is.map(is.string, is.number).nonEmpty(new Map([['a', 1]])); // true
	 * is.map().size(2)(new Map([['a', 1], ['b', 2]])); // true
	 */
	map: MapGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a `Set`.
	 * Optionally accepts a value guard for typed Sets.
	 *
	 * @example
	 * is.set()(new Set()); // true
	 * is.set(is.number)(new Set([1, 2, 3])); // true
	 *
	 * @example
	 * // With helpers
	 * is.set(is.string).nonEmpty(new Set(['a'])); // true
	 * is.set().size(3)(new Set([1, 2, 3])); // true
	 * is.set(is.number).subsetOf([1, 2, 3, 4])(new Set([1, 2])); // true
	 */
	set: SetGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a `Promise` (or thenable).
	 *
	 * @example
	 * is.promise(Promise.resolve(42)); // true
	 * is.promise(42); // false
	 */
	promise: PromiseGuard,
	/**
	 * Creates a Guard that validates that a value is an `Error` instance.
	 *
	 * @example
	 * is.error(new Error('oops')); // true
	 * is.error.message('oops')(new Error('oops')); // true
	 * is.error.name('TypeError')(new TypeError('bad')); // true
	 */
	error: ErrorGuard,
	/**
	 * Creates a Guard that validates that a value is a `File` or `Blob` instance.
	 *
	 * @example
	 * is.file(new File([''], 'test.txt')); // true
	 * is.file.type('text/plain')(new File([''], 'test.txt')); // true
	 * is.file.maxSize(1024)(new File([''], 'test.txt')); // true
	 */
	file: FileGuard,

	// ---- MISC ----
	/**
	 * Creates a Guard that validates that a value is strictly equal to one of the provided literals.
	 * Supports mixed types and uses `Object.is` for strict identity comparison (correctly handles NaN and distinguishes 0 from -0).
	 *
	 * @example
	 * const guard = is.literal('a', 'b', 'c');
	 * guard('a'); // true
	 * guard('d'); // false
	 * guard.parse('a'); // Result<'a' | 'b' | 'c', GuardErr>
	 *
	 * const mixedGuard = is.literal(1, 'hello', true, null, undefined, 42n);
	 * mixedGuard(1); // true
	 * mixedGuard('hello'); // true
	 * mixedGuard(true); // true
	 * mixedGuard(null); // true
	 * mixedGuard(undefined); // true
	 * mixedGuard(42n); // true
	 * mixedGuard(2); // false
	 * mixedGuard('world'); // false
	 * mixedGuard(false); // false
	 * mixedGuard(NaN); // false
	 * mixedGuard(0); // false
	 * mixedGuard(-0); // false
	 */
	literal: LiteralGuardFactory,
	/**
	 * Creates a Guard that validates that a value satisfies at least one of the provided guards, basically a variant of .or() but for multiple guards at once.
	 *
	 * @example
	 * const guard = is.union(is.string, is.number, is.boolean);
	 * guard('hello'); // true
	 * guard(123); // true
	 * guard(2n); // false
	 *
	 * @example
	 * is.union(is.object({ a: is.string }), is.object({ b: is.number }))(value); // value is inferred as { a: string } | { b: number }
	 */
	union: UnionGuardFactory,
	/**
	 * Creates a Guard that validates that a value satisfies all of the provided guards, basically a variant of .and() but for multiple guards at once.
	 *
	 * @example
	 * const guard = is.intersection(
	 *   is.object({ a: is.string }),
	 *   is.object({ b: is.number })
	 * );
	 * guard({ a: 'hello', b: 123 }); // true
	 * guard({ a: 'hello' }); // false
	 */
	intersection: IntersectionGuardFactory,
	/**
	 * Creates a Guard that validates that a value satisfies **exactly one** of the provided guards.
	 * Unlike `union` (at least one), `xor` rejects values that match multiple guards.
	 *
	 * @example
	 * const guard = is.xor(
	 *   is.object({ a: is.string }),
	 *   is.object({ b: is.number })
	 * );
	 * guard({ a: 'hello' }); // true — matches first only
	 * guard({ b: 123 }); // true — matches second only
	 * guard({ a: 'hello', b: 123 }); // false — matches both
	 */
	xor: XorGuardFactory,
	/**
	 * Creates a Guard that validates that a string matches a template literal pattern.
	 * Accepts a mix of string segments and guards for interpolated positions.
	 * Any guard whose inferred type extends `string | number | bigint | boolean | null | undefined`
	 * can be used as an interpolation.
	 *
	 * @example
	 * const guard = is.templateLiteral('hello, ', is.string, '!');
	 * guard('hello, world!'); // true
	 * guard('hello, !'); // true (empty string matches is.string)
	 * guard('goodbye, world!'); // false
	 *
	 * @example
	 * const guard = is.templateLiteral('id-', is.number);
	 * guard('id-42'); // true
	 * guard('id-abc'); // false
	 *
	 * @example
	 * const guard = is.templateLiteral(is.literal('get', 'post'), '://', is.string);
	 * guard('get://example.com'); // true
	 * guard('delete://example.com'); // false
	 */
	templateLiteral: TemplateLiteralGuardFactory,
	/**
	 * Creates a Guard that validates that a value is one of the provided values.
	 *
	 * Supports arrays, TypeScript enums, and object literals.
	 *
	 * @example
	 * const guard = is.enum(['a', 'b', 'c']);
	 * guard('a'); // true
	 * guard('d'); // false
	 *
	 * @example
	 * enum Color { Red, Green, Blue }
	 * const guard = is.enum(Color);
	 * guard(Color.Red); // true
	 * guard(Color.Green); // true
	 *
	 * @example
	 * const guard = is.enum({ Red: 1, Green: 2, Blue: 3 });
	 * guard(1); // true
	 * guard(2); // true
	 * guard(3); // true
	 * guard(4); // false
	 */
	enum: EnumGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a JSON value.
	 *
	 * @example
	 * is.json(42); // true
	 * is.json('hello'); // true
	 * is.json(true); // true
	 * is.json(null); // true
	 * is.json([1, 2, 3]); // true
	 * is.json({ a: 1, b: 2 }); // true
	 * is.json(undefined); // false
	 * is.json(Symbol('a')); // false
	 */
	json: JsonGuard,

	// ---- CUSTOM ----
	/**
	 * Factory that creates a Guard for `Result<T, E>` values.
	 *
	 * Call with no arguments for unnarrowed validation, or pass inner guards
	 * to validate the Ok value and Err error types.
	 *
	 * The returned guard has `.ok()` and `.err()` transformer helpers to
	 * narrow into specific variants, each accepting an optional inner guard.
	 *
	 * @example
	 * ```ts
	 * // Unnarrowed
	 * is.result()(ok(42));              // true
	 * is.result()(err('fail'));         // true
	 * is.result()('not a result');      // false
	 *
	 * // Narrowed by inner types
	 * is.result(is.number, is.string)(ok(42));       // true
	 * is.result(is.number, is.string)(ok('hello'));   // false
	 *
	 * // Ok/Err variant narrowing
	 * is.result().ok()(ok(42));                 // true
	 * is.result().ok()(err('fail'));             // false
	 * is.result().ok(is.number)(ok(42));         // true
	 * is.result().err(is.string)(err('fail'));   // true
	 * ```
	 */
	result: ResultGuardFactory,
	/**
	 * Factory that creates a Guard for `Option<T>` values.
	 *
	 * Call with no arguments for unnarrowed validation, or pass an inner guard
	 * to validate the Some value type.
	 *
	 * The returned guard has `.some()` (transformer) and `.none` (property)
	 * helpers to narrow into specific variants.
	 *
	 * @example
	 * ```ts
	 * // Unnarrowed
	 * is.option()(some(42));            // true
	 * is.option()(none());              // true
	 * is.option()('not an option');     // false
	 *
	 * // Narrowed by inner type
	 * is.option(is.number)(some(42));           // true
	 * is.option(is.number)(some('hello'));       // false
	 * is.option(is.number)(none());              // true
	 *
	 * // Some/None variant narrowing
	 * is.option().some()(some(42));              // true
	 * is.option().some()(none());                // false
	 * is.option().some(is.number)(some(42));     // true
	 * is.option().none(none());                  // true
	 * ```
	 */
	option: OptionGuardFactory,
	/**
	 * Factory that creates a Guard for tagged errors (from `defineErrs`).
	 *
	 * Accepts an error factory (full type narrowing), the entire factories object
	 * (union of all variants), or a plain string tag (structural `_tag` matching).
	 *
	 * @example
	 * ```ts
	 * const AppError = defineErrs({
	 *   NotFound: (resource: string, id: string) => ({ resource, id }),
	 *   Generic: (message: string) => ({ message }),
	 * });
	 *
	 * // Single factory — narrows to full type
	 * is.tagged(AppError.NotFound)(err); // value.resource, value.id typed
	 *
	 * // Factories object — union of all variants
	 * is.tagged(AppError)(err); // NotFoundErr | GenericErr
	 *
	 * // String tag — narrows to TaggedErr & { _tag: 'NotFound' }
	 * is.tagged('NotFound')(err);
	 * ```
	 */
	tagged: TaggedErrGuardFactory,
	/**
	 * Creates a guard from a function that returns a boolean.
	 *
	 * Supports both type guard functions and boolean returning functions that you can cast to a type guard.
	 *
	 * Note: If no function is provided, it will create a guard that always returns true.
	 *
	 * @example
	 * ```ts
	 * const isOddNum = is.custom((n): n is number => n % 2 !== 0);
	 * isOddNum(1); // true
	 * isOddNum(2); // false
	 *
	 * const isEvenNum = is.custom<number>(n => n % 2 === 0);
	 * isEvenNum(2); // true
	 * isEvenNum('hello'); // false
	 * ```
	 */
	custom: CustomGuardFactory,
};

/**
 * The base `is` API type, derived from `baseIs` plus an `extend` method.
 */
export type IsAPI<Extensions = {}> = typeof baseIs & {
	/**
	 * Returns a new `is` instance with additional custom guards (or any other properties).
	 *
	 * @param extensions - Custom guards to add.
	 * @returns A new IsAPI instance with all base guards plus the extensions.
	 *
	 * @example
	 * ```ts
	 * const myIs = is.extend({
	 *   email: is.string.trim().email,
	 *   posInt: is.number.int.positive,
	 * });
	 *
	 * myIs.email('hello@example.com'); // true
	 * myIs.posInt(42); // true
	 * myIs.string('still works'); // true
	 * ```
	 */
	extend: <E extends Record<string, any>>(extensions: E) => IsAPI<E>;
} & Extensions;

/**
 * The entry point for the Guard API.
 *
 * Guards are chainable, immutable functions that validate values and narrow their types.
 * Each property access or method call on a guard returns a brand new guard, leaving the
 * previous one unchanged.
 *
 * Each guard in a chain is evaluated sequentially from left to right, meaning the output of one guard
 * is passed as input to the next guard in the chain.
 *
 * @example
 * ```typescript
 * const guard = is.string.trim().email(foo);
 * // Evaluation order:
 * // 1. Validate that foo is a string
 * // 2. Trim foo
 * // 3. Validate that the trimmed foo is an email
 * ```
 *
 * ### Type Inference
 *
 * Guards are TypeScript Type Guards (e.g., `(v: unknown) => v is T`).
 * When used in a conditional (e.g., `if (is.string(v))`), TypeScript correctly narrows the type.
 *
 * ### Schema Definitions
 *
 * Guards can be used to define schemas that can be used to validate & transform values.
 * Schemas are created using `defineSchemas`, which returns a `Schema`.
 * This `Schema` can then be parsed or asserted against for deep recursive validation & error collection.
 *
 * ### Transformations
 *
 * Transformations are applied sequentially from left to right.
 * For example, `is.string.trim().email()` will trim the string **before**
 * validating it as an email.
 *
 * All refining helpers (like `.where()`, `.eq()`, `.and()`) operate on the
 * transformed value from the previous step in the chain.
 *
 * In object guards, transformations like `.pick()` or `.omit()` reduce the
 * target object, but the original input is preserved internally to allow
 * helpers like `.extend()` to merge properties from the initial state.
 *
 * ### Universal Helpers
 *
 * All guards share a common set of helpers:
 * - `.err(msg: string | ((meta: GuardMeta) => string))`: Customizes the error message for this guard.
 * - `.parse(value, errMsg?: string | ((meta: GuardMeta) => string))`: Validates then returns a `Result<T, GuardErr>`. If `errMsg` is provided, it will be used as the error message for this guard, overriding any previously set error message.
 * - `.nullable()` / `.optional()` / `.nullish()`: Allows null/undefined values.
 * - `.and(other)` / `.or(other)`: Logical composition of guards.
 * - `.where(predicate)`: Adds a custom validation rule.
 * - `.brand(tag)`: Adds a compile-time brand to the resulting type.
 *
 * ### Compatibility
 *
 * Guards implement the `Standard Schema V1` interface (`~standard`), making them
 * compatible with many form libraries and other validation ecosystems.
 *
 * ### Customization
 *
 * Custom guards can be created using `is.custom`.
 *
 * ```typescript
 * const isEvenNum = is.custom<number>(n => typeof n === 'number' && n % 2 === 0);
 * isEvenNum(2); // true
 * isEvenNum(3); // false
 * isEvenNum('hello'); // false
 * ```
 *
 * The `is` API can be extended with custom guards using the `.extend()` method.
 *
 * @example
 * ```typescript
 * import { is } from 'ts-chas/guard';
 *
 * const myIs = is.extend({
 *   email: is.string.trim().email,
 *   posInt: is.number.int.positive,
 * });
 *
 * myIs.email('hello@example.com'); // true
 * myIs.posInt(42); // true
 * myIs.string('still works'); // true
 * ```
 */
export const is: IsAPI = Object.assign(baseIs, {
	extend: <E extends Record<string, any>>(extensions: E): IsAPI<E> =>
		({ ...baseIs, extend: is.extend, ...extensions }) as IsAPI<E>,
});
