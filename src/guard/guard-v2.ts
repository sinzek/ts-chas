// Guard API v2

import { ArrayGuardFactory } from './objects/array.js';
import { InstanceGuardFactory } from './objects/instance.js';
import { BigIntGuard } from './primitives/bigint.js';
import { BooleanGuard } from './primitives/boolean.js';
import { NullGuard } from './primitives/null.js';
import { NumberGuard } from './primitives/number.js';
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
	 * const guard = is.number.integer.between(1, 100);
	 * guard.parse(42); // Result<number, GuardErr>
	 */
	number: NumberGuard,
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
	instance: InstanceGuardFactory,
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
	 * @example
	 * // Record with specific value type
	 * const guard = is.record(is.string, is.number);
	 * guard({ a: 1, b: 2 }); // true
	 *
	 * @example
	 * // Record with specific key and value types
	 * const guard = is.record(is.string.length(1), is.number);
	 * guard.parse({ a: 1, b: 2 }); // Result<Record<string, number>, GuardErr>
	 */
	record: RecordGuardFactory,
	/**
	 * Creates a Guard that validates that a value is a tuple (fixed-length array with positional types).
	 *
	 * @example
	 * const guard = is.tuple([is.string, is.number]);
	 * guard(['hello', 123]); // true
	 * guard(['hello', 123, true]); // false (fixed length)
	 *
	 * @example
	 * const guard = is.tuple([is.string, is.number]);
	 * guard.parse(['hello', 123]); // Result<[string, number], GuardErr>
	 */
	tuple: TupleGuardFactory,

	// ---- TYPE ONLY ----
	/** Narrows the type of a value to unknown. Does not perform any runtime validation. */
	unknown: UnknownGuard,
	/** Narrows the type of a value to any. Does not perform any runtime validation. */
	any: AnyGuard,
	/** Narrows the type of a value to never. Does not perform any runtime validation. */
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
};

export type IsAPI<Extensions = {}> = typeof baseIs & Extensions;

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
 */
export const is: IsAPI = baseIs;
