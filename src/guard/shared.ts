import { ok, err, type Result } from '../result/result.js';
import { GlobalErrs, type InferErr } from '../tagged-errs.js';
import { deepEqual, safeStringify, type DeepReadonly } from '../utils.js';
import type { StandardSchemaV1 } from '../standard-schema.js';
import type { Schema } from './schema.js';
import { COERCERS } from './coercion.js';
import { arbitraryTerminal, generateTerminal } from './generate.js';
import { AsyncGuard } from './async.js';

// ---------------------------------------------------------------------------
// JSON Schema types
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for a fast-check `Arbitrary<T>`.
 *
 * Defined locally so `.arbitrary()` is strongly typed without requiring
 * fast-check to be installed as a hard dependency.
 */
export type Arbitrary<T> = {
	filter(predicate: (value: T) => boolean): Arbitrary<T>;
	map<U>(mapper: (value: T) => U): Arbitrary<U>;
	chain<U>(chainer: (value: T) => Arbitrary<U>): Arbitrary<U>;
	generate(mrng: any, biasFactor: number | undefined): any;
	canShrinkWithoutContext: any;
	shrink(value: T): any;
	[k: string]: unknown;
};

/**
 * A JSON Schema Draft-07 compatible node.
 *
 * Used as the return type of `.toJsonSchema()` and as the type for
 * accumulated constraint metadata stored in `guard.meta.jsonSchema`.
 */
export type JsonSchemaNode = {
	type?: string | string[];
	format?: string;
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number | boolean;
	exclusiveMaximum?: number | boolean;
	minLength?: number;
	maxLength?: number;
	minItems?: number;
	maxItems?: number;
	pattern?: string;
	enum?: unknown[];
	const?: unknown;
	properties?: Record<string, JsonSchemaNode>;
	required?: string[];
	items?: JsonSchemaNode;
	additionalProperties?: boolean | JsonSchemaNode;
	oneOf?: JsonSchemaNode[];
	anyOf?: JsonSchemaNode[];
	allOf?: JsonSchemaNode[];
	not?: JsonSchemaNode;
	$ref?: string;
	$defs?: Record<string, JsonSchemaNode>;
	description?: string;
	title?: string;
	default?: unknown;
	multipleOf?: number;
	minProperties?: number;
	maxProperties?: number;
	uniqueItems?: boolean;
	/** @internal Tracks nullability for `.nullable` / `.nullish` — removed before final output. */
	_nullable?: boolean;
	/** @internal Tracks optionality for `.optional` / `.nullish` — used by parent object to omit from required. */
	_optional?: boolean;
	[key: string]: any; // any extra metadata, usually prefixed with _
};

/**
 * Symbol that helpers can use to declare their JSON Schema contribution.
 *
 * Attach a function that takes the same arguments as the helper and returns
 * a `Partial<JsonSchemaNode>` to merge into `meta.jsonSchema`.
 *
 * @example
 * ```ts
 * import { factory, JSON_SCHEMA } from 'ts-chas/guard';
 *
 * const min = factory((n: number) => (v: string) => v.length >= n);
 * (min as any)[JSON_SCHEMA] = (n: number) => ({ minLength: n });
 * ```
 */
export const JSON_SCHEMA = Symbol('jsonSchema');

/**
 * A tagged error produced when guard validation fails.
 *
 * Extends `Error` (with a real stack trace) and carries structured metadata
 * about the failure: what was expected, what was received, and where in the
 * schema the error occurred.
 *
 * Created automatically by `.parse()` and `.assert()`. You will typically
 * consume these via `Result<T, GuardErr>` or catch them from `.assert()`.
 *
 * @example
 * ```ts
 * const result = is.string.parse(123);
 * if (result.isErr()) {
 *   const err = result.error;
 *   err._tag;     // 'GuardErr'
 *   err.message;  // 'Expected string, but got number (123)'
 *   err.expected; // 'string'
 *   err.actual;   // 'number'
 *   err.name;     // 'string'
 *   err.path;     // []
 * }
 * ```
 */
export type GuardErr = InferErr<typeof GlobalErrs.GuardErr>;

/**
 * Keys that can be used to pollute an object's prototype chain when assigned
 * to plain objects via computed property access (e.g. `obj[userInput] = value`).
 *
 * Object and record guards reject input containing these as own keys by default.
 * Chain `.allowProtoKeys` on an object/record guard to opt in to accepting them.
 */
export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Returns `true` if `obj` has any own key in {@link FORBIDDEN_KEYS}.
 *
 * Only own string keys are considered (matches `Object.keys`), so this is safe
 * to call on values that set `Object.prototype.__proto__` via the literal syntax.
 */
export function hasForbiddenKey(obj: object): boolean {
	for (const k of Object.keys(obj)) {
		if (FORBIDDEN_KEYS.has(k)) return true;
	}
	return false;
}

/**
 * Metadata attached to every guard via `.meta`.
 *
 * Contains the guard's identity, the full chain name, error configuration,
 * and structural information used by `defineSchemas` for recursive validation.
 *
 * Custom metadata can be attached via the index signature and accessed
 * with bracket notation (e.g. `guard.meta['myField']`).
 *
 * @example
 * ```ts
 * const guard = is.string.trim().email.err('Invalid email');
 * guard.meta.name;  // 'trimmed string.email'
 * guard.meta.id;    // 'string'
 * guard.meta.error; // 'Invalid email'
 * ```
 */
export type GuardMeta = {
	/**
	 * The schema name this guard belongs to, if it was created via `defineSchemas`.
	 * Populated during schema parsing; `undefined` for standalone guards.
	 */
	schema?: string | undefined;
	/**
	 * The full chain name of the guard, built up as helpers are chained.
	 *
	 * For example, `is.string.trim().email` produces `'trimmed string.email'`.
	 * Used in error messages and for debugging.
	 */
	name: string;
	/**
	 * A custom error message set via `.err()`.
	 * When present, this overrides the default auto-generated message in `.parse()` and `.assert()`.
	 */
	error?: string | ((ctx: { meta: GuardMeta; value: unknown }) => string) | undefined;
	/**
	 * A stable identifier for the guard's base type (e.g. `'string'`, `'number'`, `'object'`).
	 *
	 * Unlike `name`, this does not change when helpers are chained. It is used to
	 * distinguish type mismatches from refinement failures in error messages, and
	 * to drive recursive validation in `defineSchemas`.
	 */
	id: string;
	/**
	 * The path to this guard within a schema, populated during `defineSchemas` parsing.
	 * For standalone guards, this is an empty array.
	 *
	 * @example `['User', 'address', 'zip']`
	 */
	path: string[];
	/**
	 * For object guards: the record of field names to their guards.
	 * Used by `defineSchemas` to recurse into nested objects for deep error collection.
	 */
	shape?: Record<string, Guard<any, Record<string, any>>> | undefined;
	/**
	 * For literal guards: the set of allowed values.
	 * Included in error output so consumers can display "expected one of: ...".
	 */
	values?: Set<any> | undefined;
	/**
	 * The default value (or a function returning one) to use when parsing fails.
	 *
	 * NOTE: A fallback does not change the behavior of the guard when used as a boolean type predicate
	 * in `if` statements.
	 */
	fallback?: any | ((ctx: { meta: GuardMeta; value: unknown }) => any) | undefined;
	/**
	 * A transformation function applied to the validated value before passing it
	 * to subsequent helpers in the chain. Composed sequentially by `createProxy`
	 * when multiple transformers are chained.
	 *
	 * @param v - The (possibly already-transformed) value from the previous step.
	 * @param original - The original raw input, preserved for helpers like `.extend()`.
	 */
	transform?: ((v: any, original: any) => any) | undefined;
	/**
	 * Accumulated JSON Schema constraint metadata.
	 *
	 * Populated automatically when helpers with `[JSON_SCHEMA]` declarations are chained.
	 * The `.toJsonSchema()` terminal merges this with the base type schema to produce the
	 * final JSON Schema output.
	 */
	jsonSchema?: Partial<JsonSchemaNode>;
	/** Index signature for custom metadata fields. Access with bracket notation. */
	[key: string]: any;
};

/**
 * Extracts the validated type `T` from a guard.
 *
 * Works with any guard or guard-like function that has a `value is T` return type.
 *
 * @example
 * ```ts
 * type S = InferGuard<typeof is.string>;         // string
 * type N = InferGuard<typeof is.number.positive>; // number
 *
 * const UserGuard = is.object({ name: is.string, age: is.number });
 * type User = InferGuard<typeof UserGuard>; // { name: string; age: number }
 * ```
 */
export type InferGuard<T> = T extends (value: unknown) => value is infer U ? U : never;

/**
 * A unique symbol used to brand types.
 */
export declare const $brand: unique symbol;
/**
 * A branded type. Used to create new types that are distinct from their base type.
 *
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * const example: Email = 'not-an-email'; // Error: Type 'string' is not assignable to type 'Email'.
 * ```
 */
export type Brand<Tag extends string | number | symbol, Base> = Base & { readonly [$brand]: { [K in Tag]: true } };

type AddBrand<T, Tag extends string | number | symbol> =
	T extends Brand<infer T1, infer B1> ? Brand<T1 | Tag, B1> : Brand<Tag, T>;

export type Unbrand<T, Tag extends string | number | symbol | undefined = undefined> =
	T extends Brand<infer T1, infer B1> ? (Tag extends undefined ? B1 : Brand<Exclude<T1, Tag>, B1>) : T;
export type IsBranded<T> = T extends Brand<any, any> ? true : false;
export type HasBrand<T, Tag extends string | number | symbol> =
	T extends Brand<infer T1, any> ? (Tag extends T1 ? true : false) : false;
export type GetBrand<T> = T extends Brand<infer T1, any> ? T1 : never;

// ---------------------------------------------------------------------------
// Guard type
// ---------------------------------------------------------------------------

/**
 * A chainable, immutable type guard function with universal methods and optional type-specific helpers.
 *
 * Every guard is callable as a TypeScript type predicate (`(value: unknown) => value is T`),
 * so it narrows types in `if` blocks. It also carries `.meta` for introspection and a set of
 * universal methods (`.parse()`, `.assert()`, `.where()`, `.transform()`, etc.) that return
 * new guards without mutating the original.
 *
 * The second type parameter `H` represents the type-specific helper methods available on this guard
 * (e.g. `StringHelpers` for string guards, `NumberHelpers` for number guards). These are intersected
 * into the guard type so they appear alongside the universal methods.
 *
 * @typeParam T - The type this guard narrows to.
 * @typeParam H - The type-specific helper methods available on this guard (default: `{}`).
 *
 * @example
 * ```ts
 * // As a type predicate
 * declare const value: unknown;
 * if (is.string(value)) {
 *   value; // narrowed to string
 * }
 *
 * // Chaining helpers
 * const guard = is.string.trim().email.min(5);
 * const result = guard.parse('  a@b.com  '); // Result<string, GuardErr>
 *
 * // Custom guard with helpers
 * const MoneyGuard: Guard<number, MoneyHelpers> = makeGuard(
 *   (v): v is number => typeof v === 'number' && isFinite(v),
 *   { name: 'money', id: 'money' },
 *   moneyHelpers,
 * );
 * ```
 */
export type Guard<T, H extends Record<string, any> = {}> = StandardSchemaV1<unknown, T> & {
	(value: unknown): value is T;
	/**
	 * An easy way to infer a guard's output/expected type.
	 * @example
	 * ```ts
	 * const guard = is.string;
	 * const type: typeof guard.$infer = 'hello';
	 * ```
	 */
	$infer: T;
	/**
	 * Contains the guard's identity, the full chain name, error configuration, etc.
	 *
	 * Custom metadata can be attached via the index signature and accessed
	 * with bracket notation (e.g. `guard.meta['myField']`).
	 *
	 * @example
	 * ```ts
	 * const guard = is.string.trim().email.err('Invalid email');
	 * guard.meta.name;  // 'trimmed string.email'
	 * guard.meta.id;    // 'string'
	 * guard.meta.error; // 'Invalid email'
	 * ```
	 */
	meta: GuardMeta;
	/**
	 * Adds a custom error message to the guard that will be used when parsing fails.
	 * @param msg The error message or a function that returns one.
	 * @returns A new guard with the error message.
	 */
	error: (msg: string | ((ctx: { meta: GuardMeta; value: unknown }) => string)) => Guard<T, H>;
	/**
	 * Adds a brand to the guard. Drops type-specific helpers since the brand cannot be propogated through them at runtime.
	 * @param tag The tag to add to the guard.
	 * @returns A new guard with the brand.
	 */
	brand: <Tag extends string>(tag: Tag) => Guard<AddBrand<T, Tag>>;
	/**
	 * Removes a brand from the guard.
	 * @param tag The tag to remove from the guard. If not provided, all brands will be removed.
	 * @returns A new guard with the brand removed.
	 */
	unbrand: <Tag extends string | number | symbol | undefined = undefined>(tag?: Tag) => Guard<Unbrand<T, Tag>>;
	/**
	 * Parses a value against the guard.
	 * @param value The value to parse.
	 * @param errMsg Optional error message or function that returns one.
	 * @returns A result containing the parsed value or an error.
	 */
	parse: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => Result<T, GuardErr>;
	/**
	 * Asserts that the value is valid according to the guard.
	 * @param value The value to assert.
	 * @param errMsg Optional error message or function that returns one.
	 * @throws {GuardErr} If the value is not valid.
	 * @returns The correctly typed value if valid.
	 */
	assert: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta }) => string)) => T;
	/**
	 * Adds a custom predicate to the guard.
	 * @param predicate The predicate to add to the guard.
	 * @returns A new guard with the predicate.
	 */
	where: (predicate: (value: T) => boolean) => Guard<T, H>;
	/**
	 * Adds a value to the guard that must be equal to the value being tested.
	 * @param value The value to compare against.
	 * @returns A new guard that also checks for equality.
	 */
	eq: <U>(value: U) => Guard<T & U, H>;
	/**
	 * Inverts the guard and returns a new guard that passes when the original fails.
	 * Drops type-specific helpers since the result is `unknown`.
	 *
	 * `is.string.email.not(v)` = `!(isString(v) && isEmail(v))`
	 */
	not: Guard<unknown>;
	/**
	 * Combines this guard with another using AND: both must pass.
	 * Preserves this guard's helpers since the intersection refines the same base type.
	 *
	 * `is.object({ name: is.string }).and(is.object({ age: is.number }))` → `Guard<{ name: string } & { age: number }>`
	 */
	and: <U>(other: Guard<U, Record<string, any>>) => Guard<T & U, H>;
	/**
	 * Combines this guard with another using OR: either can pass.
	 * Drops type-specific helpers since the value could be either type.
	 *
	 * `is.string.or(is.number)` → `Guard<string | number>`
	 */
	or: <U>(other: Guard<U, Record<string, any>>) => Guard<T | U>;
	/**
	 * Combines this guard with another using XOR: exactly one can pass.
	 * Drops type-specific helpers since the value could be either type.
	 *
	 * `is.string.xor(is.number)` → `Guard<string | number>`
	 */
	xor: <U>(other: Guard<U, Record<string, any>>) => Guard<T | U>;
	/**
	 * Wraps the guard to also accept `null`.
	 * Drops type-specific helpers since the value may be null.
	 *
	 * `is.string.email.nullable(v)` = `v === null || (isString(v) && isEmail(v))`
	 */
	nullable: Guard<T | null>;
	/**
	 * Wraps the guard to also accept `undefined`.
	 * Drops type-specific helpers since the value may be undefined.
	 *
	 * `is.string.email.optional(v)` = `v === undefined || (isString(v) && isEmail(v))`
	 */
	optional: Guard<T | undefined>;
	/**
	 * Wraps the guard to also accept `null` or `undefined`.
	 * Drops type-specific helpers since the value may be nullish.
	 *
	 * `is.string.email.nullish(v)` = `v == null || (isString(v) && isEmail(v))`
	 */
	nullish: Guard<T | null | undefined>;
	/**
	 * Wraps the guard to validate arrays where every element matches.
	 * Equivalent to `is.array(thisGuard)`.
	 *
	 * `is.string.array` → `Guard<string[], ArrayHelpers<string>>`
	 * `is.number.positive.array` → `Guard<number[], ArrayHelpers<number>>`
	 */
	array: Guard<T[], ArrayHelpers<T>>;
	/**
	 * Adds coercion support to the guard.
	 *
	 * When enabled, the guard attempts to cast "loose" inputs (like numeric strings or truthy values)
	 * into the target type before validation.
	 *
	 * Coercion happens during `.parse()`, `.assert()`, and Standard Schema validation.
	 *
	 * @example
	 * ```ts
	 * is.number.coerce.parse("123");       // Ok(123)
	 * is.boolean.coerce.parse("true");     // Ok(true)
	 * is.date.coerce.parse("2021-01-01");  // Ok(Date)
	 * ```
	 */
	coerce: Guard<T, H>;
	/**
	 * Sets a fallback value (or a function that returns one) to use when validation fails.
	 *
	 * When a guard has a fallback, `.parse()` and `.assert()` will return the fallback
	 * value instead of an error if the input is invalid. This also works recursively
	 * in schemas--nested properties with fallbacks will be auto-populated.
	 *
	 * > [!IMPORTANT]
	 * > This does **not** change the behavior of the guard when used as a boolean type predicate
	 * > (e.g. in `if (guard(v))`). The predicate still returns `false` if the input is invalid,
	 * > as it cannot safely narrow the type of the original variable to include the fallback.
	 *
	 * @param value - The fallback value OR a function `(ctx) => T`.
	 * @returns A new guard with the fallback configured.
	 */
	fallback: (value: T | ((ctx: { meta: GuardMeta; value: unknown }) => T)) => Guard<T, H>;
	/**
	 * Applies a transformation to the validated value. The guard still validates
	 * the original input, but `.parse()` and `.assert()` return the transformed value.
	 *
	 * Subsequent chain steps (`.where()`, `.eq()`, etc.) operate on the **transformed** value.
	 * Drops type-specific helpers since the output type may have changed.
	 *
	 * For same-type transforms that preserve helpers, use type-specific transformers
	 * like `.trim()`, `.toLowerCase()`, etc.
	 *
	 * @example
	 * ```typescript
	 * // Type-changing transform: string → number
	 * const len = is.string.transform(s => s.length);
	 * len.parse('hello'); // Ok(5)
	 *
	 * // Chain with further refinements on the transformed type
	 * const shortString = is.string.transform(s => s.length).where(n => n < 10);
	 * shortString.parse('hello'); // Ok(5)
	 * shortString.parse('a very long string'); // Err(...)
	 *
	 * // Same-type transform (use .refine() instead to keep helpers)
	 * const upper = is.string.transform(s => s.toUpperCase());
	 * upper.parse('hello'); // Ok('HELLO')
	 * ```
	 */
	transform: <U>(fn: (value: T) => U) => Guard<U>;
	/**
	 * Applies a same-type transformation to the validated value, **preserving type-specific helpers**.
	 *
	 * Like `.transform()`, the guard validates the original input, then applies the function.
	 * Unlike `.transform()`, the return type stays `T` and all helpers are preserved,
	 * so you can continue chaining type-specific methods.
	 *
	 * Use `.refine()` for normalizations (trimming, clamping, rounding) where the type doesn't change.
	 * Use `.transform()` when the output type changes (e.g., `string → number`).
	 *
	 * @example
	 * ```typescript
	 * // Same-type: normalize then continue chaining string helpers
	 * const guard = is.string.refine(s => s.trim().toLowerCase()).email;
	 * guard.parse('  HELLO@EXAMPLE.COM  '); // Ok('hello@example.com')
	 *
	 * // Clamp a number, then continue with number helpers
	 * const clamped = is.number.refine(n => Math.min(100, Math.max(0, n))).int;
	 * clamped.parse(150); // Ok(100)
	 * ```
	 */
	refine: (fn: (value: T) => T) => Guard<T, H>;
	/**
	 * Returns a Promise that resolves to a fast-check `Arbitrary<T>` for this guard.
	 *
	 * Requires `fast-check` to be installed (`npm install fast-check`).
	 * The arbitrary reflects all constraints accumulated through the helper chain.
	 *
	 * @example
	 * ```ts
	 * import * as fc from 'fast-check';
	 * const arb = await is.object({ name: is.string.min(1), age: is.number.int.gte(0) }).arbitrary();
	 * fc.assert(fc.property(arb, user => myFn(user) !== null));
	 * ```
	 */
	arbitrary: () => Promise<Arbitrary<T>>;
	/**
	 * Generates `n` valid values that satisfy this guard (default: 1 → returns a single value).
	 *
	 * Requires `fast-check` to be installed (`npm install fast-check`).
	 * Generated values are guaranteed to pass the guard's predicate.
	 *
	 * @example
	 * ```ts
	 * await is.string.email.generate()          // 'x@example.com'
	 * await is.number.int.between(1,100).generate(5)  // [7, 42, 3, 88, 15]
	 *
	 * // Pair with it.each for data-driven tests
	 * const samples = await is.object({ name: is.string.min(1) }).generate(10);
	 * it.each(samples)('processes %o', obj => expect(process(obj)).toBeTruthy());
	 * ```
	 */
	generate: {
		(): Promise<T>;
		(n: number): Promise<T[]>;
	};
	/**
	 * Serializes the guard to a JSON Schema Draft-07 compatible object.
	 *
	 * Captures constraints accumulated through the helper chain (min/max/email/etc.),
	 * recursively resolves object shapes and array element types, and handles
	 * nullable/optional variants. Best-effort: exotic guards (lazy, custom functions)
	 * fall back to `{}`.
	 *
	 * @example
	 * ```ts
	 * is.string.email.min(5).toJsonSchema()
	 * // { type: 'string', format: 'email', minLength: 5 }
	 *
	 * is.object({ name: is.string, age: is.number.int.gte(0).optional }).toJsonSchema()
	 * // { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer', minimum: 0 } }, required: ['name'] }
	 *
	 * is.array(is.string.email).toJsonSchema()
	 * // { type: 'array', items: { type: 'string', format: 'email' } }
	 * ```
	 */
	toJsonSchema: () => JsonSchemaNode;
	/**
	 * Appends an async predicate check, switching to async mode.
	 *
	 * The returned `AsyncGuard<T>` has `.parseAsync()` returning a
	 * `ResultAsync<T, GuardErr>` with the full monadic API.
	 *
	 * @example
	 * ```ts
	 * const UniqueEmail = is.string.email.whereAsync(async v => {
	 *   return !(await db.users.exists({ email: v }));
	 * });
	 * UniqueEmail.parseAsync(input).match({ ok: v => v, err: e => e.message });
	 * ```
	 */
	whereAsync: (fn: (value: T) => Promise<boolean>) => AsyncGuard<T>;
	/**
	 * Appends an async same-type transformation, switching to async mode.
	 *
	 * The resolved value replaces the current value and is passed to subsequent steps.
	 */
	refineAsync: (fn: (value: T) => Promise<T>) => AsyncGuard<T>;
	/**
	 * Appends an async type-changing transformation, switching to async mode.
	 *
	 * @example
	 * ```ts
	 * const Parsed = is.string.transformAsync(async raw => JSON.parse(raw) as User);
	 * // AsyncGuard<User>
	 * ```
	 */
	transformAsync: <U>(fn: (value: T) => Promise<U>) => AsyncGuard<U>;
	/**
	 * Converts this guard into a `Schema` with recursive error collection.
	 *
	 * Unlike `.parse()` (fail-fast, single error), `schema.parse()` walks the entire
	 * structure and collects **all** validation failures with full dot-path tracking.
	 *
	 * @param name - A label for this schema, used in error paths and messages.
	 *
	 * @example
	 * ```ts
	 * const UserSchema = is.object({
	 *   name: is.string.min(1),
	 *   age: is.number.gt(0),
	 * }).toSchema('User');
	 *
	 * UserSchema.parse({ name: '', age: -1 });
	 * // Err([
	 * //   GuardErr { path: ['User', 'name'], ... },
	 * //   GuardErr { path: ['User', 'age'], ... },
	 * // ])
	 * ```
	 */
	toSchema: (name: string) => Schema<T>;
} & H;

//
// The proxy uses these symbols to decide how to compose each helper with the
// parent guard. There are five categories:
//
// 1. **Value helper** (no symbol): a bare predicate `(v) => boolean`. The proxy
//    AND-composes it with the parent: `target(v) && helper(v)`.
//    Example: `nonEmpty`, `email`, `positive`.
//
// 2. **Factory** (`FACTORY`): a function that takes arguments and returns a
//    predicate. The proxy calls `helper(...args)` first, then AND-composes the
//    result with the parent.
//    Example: `min(5)`, `gt(10)`, `regex(/foo/)`.
//
// 3. **Transformer** (`TRANSFORMER`): receives the current guard and returns a
//    `TransformerResult` that can replace the predicate, metadata, helpers, and
//    transformation pipeline. The most powerful helper type.
//    Example: `trim()`, `partial()`, `brand('Email')`.
//
// 4. **Terminal** (`TERMINAL`): receives the current guard plus user args and
//    returns a non-guard value, ending the chain.
//    Example: `parse(value)`, `assert(value)`.
//
// 5. **Property** (`PROPERTY`): wraps a transformer so it executes on property
//    access without needing `()`. Must be combined with `transformer`.
//    Example: `.nullable`, `.optional`, `.strict`.

/** @internal Symbol that marks a helper as a factory. */
export const FACTORY = Symbol('factory');
/** @internal Symbol that marks a helper as a transformer. */
export const TRANSFORMER = Symbol('transformer');
/** @internal Symbol that marks a helper as a terminal. */
export const TERMINAL = Symbol('terminal');
/** @internal Symbol that marks a helper as a property-style access. */
export const PROPERTY = Symbol('property');

// ---------------------------------------------------------------------------
// Helper authoring utilities
// ---------------------------------------------------------------------------

/**
 * Creates a **factory helper**: a function that accepts arguments and returns
 * a predicate. The proxy calls the factory with the user's args, then
 * AND-composes the resulting predicate with the parent guard.
 *
 * Use this for parameterized refinements where the user supplies thresholds,
 * patterns, or other configuration.
 *
 * @param fn - A function that takes user arguments and returns a predicate `(value) => boolean`.
 * @returns A factory-marked function that the proxy recognizes and composes correctly.
 *
 * @example
 * ```ts
 * import { factory } from 'ts-chas/guard';
 *
 * const min = factory((n: number) => (v: number) => v >= n);
 * const max = factory((n: number) => (v: number) => v <= n);
 * const between = factory((lo: number, hi: number) => (v: number) => v >= lo && v <= hi);
 *
 * const numberHelpers = { min, max, between };
 * ```
 */
export function factory<Args extends any[], R extends (value: any) => boolean, H extends Record<string, any> = {}>(
	fn: (...args: Args) => R
): ((...args: Args) => Guard<any, H>) & { [FACTORY]: true } {
	return Object.assign(fn, { [FACTORY]: true as const }) as any;
}

/**
 * The object returned by a transformer's callback function.
 *
 * Controls what the new guard looks like after the transformation:
 * its predicate, metadata, helpers, transformation pipeline, and
 * whether helpers are merged or replaced.
 *
 * @typeParam T - The output type of the new guard.
 * @typeParam H - The helper type for the new guard.
 */
export interface TransformerResult<T, H> {
	/**
	 * The new type predicate for this guard.
	 * Replaces the parent guard's predicate entirely.
	 */
	fn: (v: unknown) => v is T;
	/**
	 * Metadata fields to merge into the parent's metadata.
	 * At minimum, you should set `name` to reflect the new chain step.
	 */
	meta: Partial<GuardMeta>;
	/**
	 * New helpers to attach to the guard.
	 *
	 * By default, these are **merged** with the parent's helpers, so existing
	 * chain methods remain available. Set `replaceHelpers: true` to discard
	 * the parent's helpers entirely (useful when the output type changes).
	 */
	helpers?: H;
	/**
	 * A value transformation applied during `.parse()` and `.assert()`.
	 *
	 * Transformations compose sequentially: if the parent already has a transform,
	 * `createProxy` chains them so the parent's transform runs first, then this one.
	 *
	 * @param v - The value (after any prior transforms in the chain).
	 * @param original - The original raw input, preserved across the entire chain.
	 *
	 * @example
	 * ```ts
	 * is.string.trim().toLowerCase().email
	 * // Chain order:
	 * // 1. Validate that the value is a string
	 * // 2. Trim the value
	 * // 3. Convert to lowercase
	 * // 4. Validate that the result is an email
	 * ```
	 */
	transform?: ((v: any, original: any) => any) | undefined;
	/**
	 * If `true`, `helpers` completely replaces the current helper context
	 * instead of merging with it.
	 *
	 * Use `true` when the output type changes and the parent's helpers no longer apply
	 * (e.g. `string.transform(s => s.length)` produces a number, not a string).
	 *
	 * Use `false` or omit when the type stays the same and parent helpers should remain
	 * (e.g. `string.trim()` is still a string).
	 */
	replaceHelpers?: boolean;
}

/**
 * Creates a **transformer helper**: receives the current guard and returns a
 * {@link TransformerResult} that can replace the guard's predicate, metadata,
 * helpers, and transformation pipeline.
 *
 * This is the most powerful helper type. Use it when you need to:
 * - Change the guard's validation logic (new `fn`)
 * - Modify or replace the guard's type (new `fn` with different type predicate)
 * - Add, merge, or replace helpers (via `helpers` and `replaceHelpers`)
 * - Insert a value transformation into the pipeline (via `transform`)
 *
 * The proxy automatically passes the current guard as the first argument to your callback.
 * Any additional arguments come from the user's call site.
 *
 * @param fn - Receives `(target, ...userArgs)` and returns a `TransformerResult`.
 * @returns A transformer-marked function the proxy recognizes and applies correctly.
 *
 * @example
 * ```ts
 * import { transformer } from 'ts-chas/guard';
 *
 * // A transformer that clamps a number to a range
 * const clamp = transformer((target, min: number, max: number) => ({
 *   fn: (v: unknown): v is number => target(v),
 *   meta: { name: `${target.meta.name}.clamp(${min}, ${max})` },
 *   transform: (v: number) => Math.min(max, Math.max(min, v)),
 * }));
 *
 * // A transformer that changes the output type (drops helpers)
 * const toLength = transformer((target) => ({
 *   fn: (v: unknown): v is number => target(v),
 *   meta: { name: `${target.meta.name}.toLength` },
 *   transform: (v: string) => v.length,
 *   helpers: {},
 *   replaceHelpers: true,
 * }));
 * ```
 */
export function transformer<
	CurGuardType,
	NewGuardType,
	FactoryArgs extends any[],
	NewHelpers extends Record<string, any> = {},
>(
	fn: (
		target: Guard<CurGuardType, Record<string, any>>,
		...args: FactoryArgs
	) => TransformerResult<NewGuardType, NewHelpers>
): ((...args: FactoryArgs) => Guard<NewGuardType, NewHelpers>) & { [TRANSFORMER]: true } {
	return Object.assign(fn, { [TRANSFORMER]: true as const }) as any;
}

/**
 * Creates a **terminal helper**: receives the current guard plus user arguments
 * and returns a non-guard value, ending the chain.
 *
 * Use this for operations that produce a final result rather than another guard,
 * such as parsing, assertion, or serialization.
 *
 * The proxy passes the current guard as the first argument. Any additional
 * arguments come from the user's call site.
 *
 * @param fn - Receives `(target, ...userArgs)` and returns any value.
 * @returns A terminal-marked function the proxy recognizes.
 *
 * @example
 * ```ts
 * import { terminal } from 'ts-chas/guard';
 *
 * // A terminal that returns the guard's JSON schema representation
 * const toJsonSchema = terminal((target) => ({
 *   type: target.meta.id,
 *   description: target.meta.name,
 * }));
 *
 * const helpers = { toJsonSchema };
 * // Usage: is.string.email.toJsonSchema() => { type: 'string', description: 'string.email' }
 * ```
 */
export function terminal<F extends (...args: any[]) => any>(fn: F): F & { [TERMINAL]: true } {
	return Object.assign(fn, { [TERMINAL]: true as const }) as any;
}

/**
 * Wraps a transformer so it executes on property access instead of requiring `()`.
 *
 * This is syntactic sugar for zero-argument transformers. The proxy detects the
 * `PROPERTY` symbol and invokes the transformer immediately when the property
 * is accessed, rather than returning a function that waits to be called.
 *
 * Must wrap a `transformer()`. Combining with other helper types is not supported.
 *
 * @param fn - A transformer (created via `transformer()`) that takes no user arguments.
 * @returns A property-marked transformer the proxy auto-invokes on access.
 *
 * @example
 * ```ts
 * import { property, transformer } from 'ts-chas/guard';
 *
 * const strict = property(
 *   transformer((target) => ({
 *     fn: (v: unknown): v is any => {
 *       if (!target(v)) return false;
 *       const schema = target.meta.shape;
 *       if (!schema) return true;
 *       return Object.keys(v as object).every(k => k in schema);
 *     },
 *     meta: { name: `${target.meta.name}.strict` },
 *   }))
 * );
 *
 * const helpers = { strict };
 * // Usage: is.object({ name: is.string }).strict  (no parentheses)
 * ```
 */
export function property<F extends (...args: any[]) => any>(fn: F): F & { [PROPERTY]: true } {
	return Object.assign(fn, { [PROPERTY]: true as const }) as any;
}

// ---------------------------------------------------------------------------
// Core: makeGuard + createProxy
// ---------------------------------------------------------------------------

/**
 * Creates a new guard from a type predicate, metadata, and optional chainable helpers.
 *
 * This is the low-level constructor for guards. Use it to build custom guards
 * that go beyond what the built-in `is.*` guards offer, such as domain-specific
 * types with their own helper chains.
 *
 * The returned guard is wrapped in a `Proxy` that provides all universal methods
 * (`.parse()`, `.assert()`, `.where()`, `.transform()`, etc.) and surfaces any
 * helpers you pass in as chainable properties.
 *
 * Every chain step returns a new guard. Nothing is ever mutated.
 *
 * @typeParam T - The type this guard narrows to.
 * @typeParam H - The helpers object type (inferred from `helpers` if provided).
 *
 * @param fn - A TypeScript type predicate function: `(value: unknown) => value is T`.
 * @param meta - Guard metadata. `name` and `id` are required; all other fields are optional.
 *   - `name`: The display name for the guard chain (appears in error messages and `.meta.name`).
 *   - `id`: A stable base-type identifier (e.g. `'money'`). Does not change when helpers are chained.
 * @param helpers - An optional object of chainable helpers. Each value can be:
 *   - A bare predicate `(v) => boolean` (value helper, AND-composed with the guard)
 *   - A `factory(...)` (parameterized predicate)
 *   - A `transformer(...)` (replaces predicate/meta/helpers/transform)
 *   - A `terminal(...)` (ends the chain, returns a non-guard value)
 *   - A `property(transformer(...))` (auto-invoked on access, no `()` needed)
 *
 * @returns A fully proxied `Guard<T, H>` with universal methods and the provided helpers.
 *
 * @example
 * ```ts
 * import { makeGuard, factory } from 'ts-chas/guard';
 *
 * // Simple guard with no helpers
 * const isFiniteNumber = makeGuard(
 *   (v: unknown): v is number => typeof v === 'number' && isFinite(v),
 *   { name: 'finiteNumber', id: 'number' },
 * );
 * isFiniteNumber.parse(42);       // Ok(42)
 * isFiniteNumber.parse(Infinity); // Err(...)
 *
 * // Guard with custom chainable helpers
 * const currencyHelpers = {
 *   positive: ((v: number) => v > 0) as (v: number) => boolean,
 *   precision: factory((decimals: number) => (v: number) =>
 *     Number(v.toFixed(decimals)) === v
 *   ),
 * };
 *
 * const isMoney = makeGuard(
 *   (v: unknown): v is number => typeof v === 'number' && isFinite(v),
 *   { name: 'money', id: 'money' },
 *   currencyHelpers,
 * );
 *
 * isMoney.positive.precision(2).parse(19.99); // Ok(19.99)
 * isMoney.positive.precision(2).parse(19.999); // Err(...)
 * ```
 */
export function makeGuard<T, H extends Record<string, any> = {}>(
	fn: (value: unknown) => value is T,
	meta: Pick<GuardMeta, 'name' | 'id'> & Partial<GuardMeta>,
	helpers?: H
): Guard<T, H> {
	const guard = Object.assign(fn, {
		meta: { schema: undefined, error: undefined, path: [], ...meta } as GuardMeta,
	});
	return createProxy(guard, helpers ?? ({} as H)) as Guard<T, H>;
}

/** @internal Evaluates a fallback (static value or function). */
export function evaluateFallback(fallback: any, meta: GuardMeta, value: unknown): any {
	if (typeof fallback === 'function') {
		return fallback({ meta, value });
	}
	return fallback;
}
/** @internal Evaluates an error message (static string or function). */
export function evaluateError(
	error: string | ((ctx: { meta: GuardMeta; value: unknown }) => string) | undefined,
	meta: GuardMeta,
	value: unknown,
	customMsg?: string | ((meta: GuardMeta) => string) | undefined
): string | undefined {
	if (typeof customMsg === 'function') {
		customMsg = customMsg(meta);
	}
	if (customMsg) return customMsg;
	if (typeof error === 'function') {
		return error({ meta, value });
	}
	return error;
}

// defined here to allow both is.array and the universal .array helper to use them
export interface ArrayHelpers<T> {
	/**
	 * Validates that the array is non-empty.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).nonEmpty;
	 * guard.parse([]); // Err('Expected non-empty array')
	 * guard.parse(['a']); // Ok(['a'])
	 * ```
	 */
	nonEmpty: Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array is empty.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).empty;
	 * guard.parse([]); // Ok([])
	 * guard.parse(['a']); // Err('Expected empty array')
	 * ```
	 */
	empty: Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that all elements in the array are unique (deep equality).
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).unique;
	 * guard.parse(['a', 'b', 'c']); // Ok(['a', 'b', 'c'])
	 * guard.parse(['a', 'b', 'a']); // Err('Expected unique elements')
	 * ```
	 */
	unique: Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array length is at least `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).min(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a']); // Err('Expected array of length at least 2')
	 * ```
	 */
	min: (n: number) => Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array length is at most `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).max(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a', 'b', 'c']); // Err('Expected array of length at most 2')
	 * ```
	 */
	max: (n: number) => Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array length is exactly `n`.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).size(2);
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a']); // Err('Expected array of length 2')
	 * ```
	 */
	size: (n: number) => Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array contains a specific value.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).includes('a');
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['b', 'c']); // Err('Expected array to include "a"')
	 * ```
	 */
	includes: (item: T) => Guard<T[], ArrayHelpers<T>>;
	/**
	 * Validates that the array does not contain a specific value.
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).excludes('a');
	 * guard.parse(['b', 'c']); // Ok(['b', 'c'])
	 * guard.parse(['a', 'b']); // Err('Expected array to not include "a"')
	 * ```
	 */
	excludes: (item: T) => Guard<T[], ArrayHelpers<T>>;
	/**
	 * Wraps the array in `Object.freeze()` during validation, returning a readonly array when parsed. Since arrays are already readonly, this is not strictly necessary but is included for consistency with other collection guards.
	 *
	 * @example
	 * ```ts
	 * const guard = is.array(is.string).readonly;
	 * guard.parse(['a', 'b']); // Ok(['a', 'b'])
	 * guard.parse(['a', 'b']); // Err('Expected array of length 2')
	 * ```
	 */
	readonly: Guard<DeepReadonly<T[]>, ArrayHelpers<T>>;
}

export const arrayHelpers: ArrayHelpers<any> = {
	nonEmpty: ((v: unknown) => Array.isArray(v) && v.length > 0) as any,
	empty: ((v: unknown) => Array.isArray(v) && v.length === 0) as any,
	unique: ((v: unknown) => Array.isArray(v) && new Set(v as any[]).size === (v as any[]).length) as any,
	min: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length >= n
	),
	max: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length <= n
	),
	size: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length === n
	),
	includes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && v.includes(item)
	),
	excludes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && !v.includes(item)
	),
	readonly: property(
		transformer(target => ({
			fn: (v: unknown): v is any => target(Object.freeze(v)),
			meta: { name: `${target.meta.name}.readonly` },
		})) as any
	),
};

// JSON Schema contributions for array helpers
(arrayHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minItems: 1 });
(arrayHelpers.empty as any)[JSON_SCHEMA] = () => ({ minItems: 0, maxItems: 0 });
(arrayHelpers.unique as any)[JSON_SCHEMA] = () => ({ uniqueItems: true });
(arrayHelpers.min as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n });
(arrayHelpers.max as any)[JSON_SCHEMA] = (n: number) => ({ maxItems: n });
(arrayHelpers.size as any)[JSON_SCHEMA] = (n: number) => ({ minItems: n, maxItems: n });
(arrayHelpers.includes as any)[JSON_SCHEMA] = (item: unknown) => ({ _arrayIncludes: item });
(arrayHelpers.excludes as any)[JSON_SCHEMA] = (item: unknown) => ({ _arrayExcludes: item });

// ---------------------------------------------------------------------------
// JSON Schema builder
// ---------------------------------------------------------------------------

const ID_TO_JSON_TYPE: Record<string, string> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	bigint: 'integer',
	null: 'null',
	object: 'object',
	array: 'array',
	// Date guard uses 'Date' (capitalised) as its id
	date: 'string',
	Date: 'string',
	url: 'string',
	URL: 'string',
	regexp: 'string',
	RegExp: 'string',
	symbol: 'string',
	function: 'object',
	literal: 'string',
	enum: 'string',
	union: 'object',
	intersection: 'object',
	discriminatedUnion: 'object',
	file: 'object',
	File: 'object',
};

/**
 * Converts a guard's meta into a JSON Schema Draft-07 compatible node.
 * @internal Used by the `.toJsonSchema()` terminal helper.
 */
function buildJsonSchema(guard: Guard<any>): JsonSchemaNode {
	const meta = guard.meta;
	const accumulated = meta.jsonSchema ?? {};

	// --- Literal / Enum (values override type) ---
	if (meta.values && (meta.id === 'literal' || meta.id === 'enum')) {
		const vals = [...(meta.values as Set<unknown>)];
		if (vals.length === 1) return { const: vals[0] };
		return { enum: vals };
	}

	// --- Union: anyOf ---
	if (meta.id === 'union' && Array.isArray(meta['guards'])) {
		return { anyOf: (meta['guards'] as Guard<any>[]).map(buildJsonSchema) };
	}

	// --- Intersection: allOf ---
	if (meta.id === 'intersection' && Array.isArray(meta['guards'])) {
		return { allOf: (meta['guards'] as Guard<any>[]).map(buildJsonSchema) };
	}

	// --- Discriminated union: anyOf with discriminant injected ---
	if (meta.id === 'discriminatedUnion' && meta['variantMap']) {
		const anyOf: JsonSchemaNode[] = [];
		const key = meta['discriminantKey'] as string;
		for (const [disc, variantGuard] of Object.entries(meta['variantMap'] as Record<string, Guard<any>>)) {
			const variantSchema = buildJsonSchema(variantGuard);
			anyOf.push({
				...variantSchema,
				properties: {
					...variantSchema.properties,
					[key]: { const: disc },
				},
				required: [...(variantSchema.required ?? []), key].filter((v, i, a) => a.indexOf(v) === i),
			});
		}
		return { anyOf };
	}

	// --- Object: recurse into shape ---
	if (meta.id === 'object' && meta.shape) {
		const properties: Record<string, JsonSchemaNode> = {};
		const required: string[] = [];
		for (const [key, fieldGuard] of Object.entries(meta.shape as Record<string, Guard<any>>)) {
			const fieldSchema = buildJsonSchema(fieldGuard);
			const isOptional = Boolean(fieldSchema._optional);
			properties[key] = cleanSchema(fieldSchema);
			if (!isOptional) required.push(key);
		}
		const schema: JsonSchemaNode = {
			...accumulated,
			type: 'object',
		};
		if (Object.keys(properties).length > 0) schema.properties = properties;
		if (required.length > 0) schema.required = required;
		return cleanSchema(schema);
	}

	// --- Tuple: fixed-position items + optional rest (JSON Schema Draft-07) ---
	if (meta.id === 'tuple') {
		const tupleGuards = meta['tupleGuards'] as Guard<any>[] | undefined;
		const restGuard = meta['restGuard'] as Guard<any> | undefined;
		const schema: JsonSchemaNode = { ...accumulated, type: 'array' };
		if (tupleGuards?.length) {
			(schema as any).prefixItems = tupleGuards.map(buildJsonSchema);
			schema.items = restGuard ? buildJsonSchema(restGuard) : (false as any);
		}
		return cleanSchema(schema);
	}

	// --- Array: recurse into element guard ---
	if (meta.id === 'array') {
		const elementGuards = meta['elementGuards'] as Guard<any>[] | undefined;
		const schema: JsonSchemaNode = { ...accumulated, type: 'array' };
		if (elementGuards?.length === 1) {
			schema.items = buildJsonSchema(elementGuards[0]!);
		} else if (elementGuards && elementGuards.length > 1) {
			schema.items = { anyOf: elementGuards.map(buildJsonSchema) };
		}
		return cleanSchema(schema);
	}

	// --- Base type + accumulated constraints ---
	const jsonType = ID_TO_JSON_TYPE[meta.id] ?? undefined;
	const schema: JsonSchemaNode = { ...accumulated };
	if (jsonType && !accumulated.type) {
		schema.type = jsonType;
	}

	// Special: dates use string + date-time format (id is 'Date' in the built-in guard)
	if ((meta.id === 'date' || meta.id === 'Date') && !accumulated.format) {
		schema.format = 'date-time';
	}

	// _nullable and _optional are left intact for callers (object builder / cleanSchema).
	return schema;
}

/**
 * Applies `_nullable` → type widening and strips all internal `_` flags.
 * Call this on the final output of `buildJsonSchema` before returning to the user.
 */
function cleanSchema(schema: JsonSchemaNode): JsonSchemaNode {
	const out = { ...schema };
	if (out._nullable) {
		out.type = out.type ? [...(Array.isArray(out.type) ? out.type : [out.type]), 'null'] : ['null'];
	}
	delete out._nullable;
	delete out._optional;
	return out;
}

// ---------------------------------------------------------------------------
// toSchema registration — avoids a runtime circular dep with schema.ts
// (schema.ts imports runtime values from shared.ts, so shared.ts can't
// import back; schema.ts registers its implementation here at init time)
// ---------------------------------------------------------------------------

let _toSchemaFn: ((name: string, guard: Guard<any>) => unknown) | undefined;

/** @internal Called once by schema.ts at module init to register buildSchema. */
export function _registerToSchema(fn: (name: string, guard: Guard<any>) => unknown): void {
	_toSchemaFn = fn;
}

// Shared by all guards
const universalHelpers: Record<string, any> = {
	error: transformer((target, msg: string | ((ctx: { meta: GuardMeta; value: unknown }) => string)) => {
		return {
			fn: (v: unknown): v is any => target(v),
			meta: { error: msg },
		};
	}),

	brand: transformer(<Tag extends string, T, H extends Record<string, any>>(target: Guard<T, H>, tag: Tag) => ({
		fn: (v: unknown): v is Brand<Tag, T> => target(v),
		meta: { name: `${target.meta.name}.brand<${tag}>` },
	})),

	parse: terminal(
		(
			target: Guard<any, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): Result<any, GuardErr> => {
			if (target(value)) return ok(target.meta.transform ? target.meta.transform(value, value) : value);

			if ('fallback' in target.meta) {
				return ok(evaluateFallback(target.meta.fallback, target.meta, value));
			}

			const message = evaluateError(target.meta.error, target.meta, value, errMsg);
			return GlobalErrs.GuardErr.err({
				message: message ?? buildGuardErrMsg(target.meta, value),
				path: target.meta.path,
				expected: target.meta.id,
				actual: getType(value),
				values: target.meta.values,
				name: target.meta.name,
			});
		}
	),

	assert: terminal(
		<T>(
			target: Guard<T, Record<string, any>>,
			value: unknown,
			errMsg?: string | ((meta: GuardMeta) => string)
		): T => {
			if (target(value)) return target.meta.transform?.(value, value) ?? value;

			if ('fallback' in target.meta) {
				return evaluateFallback(target.meta.fallback, target.meta, value);
			}

			const message = evaluateError(target.meta.error, target.meta, value, errMsg);
			throw GlobalErrs.GuardErr.err({
				message: message ?? buildGuardErrMsg(target.meta, value),
				path: target.meta.path,
				expected: target.meta.id,
				actual: getType(value),
				values: target.meta.values,
				name: target.meta.name,
			});
		}
	),

	where: transformer((target, predicate: (value: any) => boolean) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return predicate(transformed);
		},
		meta: { name: `${target.meta.name}.where(condition)` },
	})),

	eq: transformer((target, value: any) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return deepEqual(transformed, value);
		},
		meta: { name: `${target.meta.name}.eq(${safeStringify(value)})` },
	})),

	not: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is unknown => !target(v),
			meta: { name: `${target.meta.name}.not` },
			helpers: {}, // drops helpers — "not T" is unknown
			replaceHelpers: true,
		}))
	),

	and: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => {
			if (!target(v)) return false;
			const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
			return other(transformed);
		},
		meta: { name: `${target.meta.name}.and(${other.meta?.name ?? '?'})` },
		transform: other.meta.transform ? (v: unknown) => other.meta.transform!(v, v) : undefined,
	})),

	or: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => target(v) || other(v),
		meta: { name: `${target.meta.name}.or(${other.meta?.name ?? '?'})` },
		helpers: {},
		replaceHelpers: true,
	})),

	xor: transformer((target, other: Guard<any, Record<string, any>>) => ({
		fn: (v: unknown): v is any => {
			// Evaluate each predicate exactly once; short-circuit on unanimous rejection or match.
			const a = target(v);
			const b = other(v);
			return a !== b; // exactly one passes
		},
		meta: { name: `${target.meta.name}.xor(${other.meta?.name ?? '?'})` },
		helpers: {},
		replaceHelpers: true,
	})),

	nullable: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === null || target(v),
			meta: {
				name: `${target.meta.name}.nullable`,
				jsonSchema: { ...target.meta.jsonSchema, _nullable: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	),

	optional: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v === undefined || target(v),
			meta: {
				name: `${target.meta.name}.optional`,
				jsonSchema: { ...target.meta.jsonSchema, _optional: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	),

	nullish: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any => v == null || target(v),
			meta: {
				name: `${target.meta.name}.nullish`,
				jsonSchema: { ...target.meta.jsonSchema, _nullable: true, _optional: true },
			},
			helpers: {},
			replaceHelpers: true,
		}))
	),

	fallback: transformer((target, value: any) => ({
		fn: (v: unknown): v is any => target(v),
		meta: {
			name: `${target.meta.name}.fallback(${typeof value === 'function' ? 'fn' : safeStringify(value)})`,
			fallback: value,
		},
	})),

	array: property(
		transformer((target: Guard<any, Record<string, any>>) => ({
			fn: (v: unknown): v is any[] => Array.isArray(v) && v.every(item => target(item)),
			meta: {
				name: `${target.meta.name}[]`,
				id: 'array',
				elementGuards: [target],
			},
			transform: (v: any[]) => v.map(item => (target.meta.transform ? target.meta.transform(item, item) : item)),
			helpers: arrayHelpers,
			replaceHelpers: true,
		}))
	),

	transform: transformer((target: Guard<any, Record<string, any>>, fn: (value: any) => any) => ({
		fn: (v: unknown): v is any => target(v),
		meta: { name: `${target.meta.name}.transform(fn)` },
		transform: (v: any) => fn(v), // createProxy handles composition with parent transforms
		helpers: {},
		replaceHelpers: true,
	})),

	refine: transformer((target: Guard<any, Record<string, any>>, fn: (value: any) => any) => ({
		fn: (v: unknown): v is any => target(v),
		meta: { name: `${target.meta.name}.refine(fn)` },
		transform: (v: any) => fn(v), // createProxy handles composition with parent transforms
		// no helpers/replaceHelpers → preserves current helpers
	})),

	coerce: property(
		transformer((target: Guard<any, Record<string, any>>) => {
			const id = target.meta.id.toLowerCase();
			const coercer = COERCERS[id];

			return {
				fn: (v: unknown): v is any => {
					if (target(v)) return true;
					const val = coercer ? coercer(v) : v;
					return target(val);
				},
				meta: { name: `${target.meta.name}.coerce` },
				transform: (v: unknown) => {
					const coerced = coercer ? coercer(v) : v;
					return target.meta.transform ? target.meta.transform(coerced, coerced) : coerced;
				},
			};
		})
	),

	toJsonSchema: terminal(
		(target: Guard<any, Record<string, any>>): JsonSchemaNode => cleanSchema(buildJsonSchema(target))
	),

	arbitrary: terminal((target: Guard<any, Record<string, any>>) => arbitraryTerminal(target)),

	generate: terminal((target: Guard<any, Record<string, any>>, n?: number) => generateTerminal(target, n)),

	whereAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<boolean>) =>
		new AsyncGuard(target, []).whereAsync(fn)
	),

	refineAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<any>) =>
		new AsyncGuard(target, []).refineAsync(fn)
	),

	transformAsync: terminal((target: Guard<any>, fn: (v: any) => Promise<any>) =>
		new AsyncGuard(target, []).transformAsync(fn)
	),

	toSchema: terminal((target: Guard<any>, name: string) => {
		if (!_toSchemaFn) {
			throw new Error(
				'[ts-chas] Guard.toSchema() is unavailable — import from "ts-chas/guard" rather than an internal module.'
			);
		}
		return _toSchemaFn(name, target);
	}),
};

export function getType(v: any): string {
	if (v === null) return 'null';
	const t = typeof v;
	if (t !== 'object') return t;
	if (Array.isArray(v)) return 'array';
	if (v instanceof Date) return 'date';
	if (v instanceof RegExp) return 'regexp';
	if (v instanceof URL) return 'url';
	if (v instanceof Map) return 'map';
	if (v instanceof Set) return 'set';
	if (v instanceof WeakMap) return 'weakmap';
	if (v instanceof WeakSet) return 'weakset';
	if (v instanceof Error) return 'error';
	if (v instanceof Promise) return 'promise';
	return 'object';
}

/**
 * Builds a descriptive error message for guard validation failures.
 *
 * Differentiates between:
 * - **Type mismatch**: the value isn't even the right base type
 *   → "Expected string, got number (123)"
 * - **Refinement failure**: the value is the right type but failed a chain step
 *   → "Value "hello" failed validation"
 *
 * The guard chain name is always available on the error's `.name` field
 * for programmatic inspection — no need to duplicate it in the message.
 */
export function buildGuardErrMsg(meta: GuardMeta, v: unknown): string {
	const actual = getType(v);
	const isRefinementFailure =
		actual === meta.id ||
		(meta.id === 'array' && Array.isArray(v)) ||
		(meta.id === 'object' && actual === 'object');

	if (isRefinementFailure) {
		return `Value ${safeStringify(v)} failed validation`;
	}
	return `Expected ${meta.id}, but got ${actual} (${safeStringify(v)})`;
}

/**
 * Wraps a guard function in a Proxy that intercepts all property access.
 * This is the single chaining mechanism — universal methods, type-specific
 * helpers, and composition all flow through here.
 */
export function createProxy<T, H extends Record<string, any>>(
	target: { (value: unknown): value is T; meta: GuardMeta },
	helpers: H
): Guard<T, H> {
	return new Proxy(target, {
		apply(_target, _thisArg, args) {
			return target(args[0]);
		},

		get(target, prop: string) {
			if (prop === '$infer') {
				throw GlobalErrs.ChasErr({
					message:
						`[ts-chas] The .$infer property is a type-level helper and cannot be accessed at runtime. ` +
						`Use it only with 'typeof' (e.g., type T = typeof guard.$infer).`,
					origin: 'infer',
				});
			}
			if (prop === 'helpers') return helpers;

			if (prop === 'meta') return target.meta;

			if (prop === '~standard') {
				return {
					version: 1,
					vendor: 'chas',
					validate: (v: unknown): StandardSchemaV1.Result<T> => {
						if (target(v)) {
							const val = target.meta.transform ? target.meta.transform(v, v) : v;
							return { value: val as T };
						}

						if ('fallback' in target.meta) {
							return { value: evaluateFallback(target.meta.fallback, target.meta, v) as T };
						}

						const message = evaluateError(target.meta.error, target.meta, v);
						return {
							issues: [
								{
									message: message ?? buildGuardErrMsg(target.meta, v),
									path: target.meta.path,
								},
							],
						};
					},
				};
			}

			// Universal methods (terminal)
			if (prop === 'parse') {
				return (v: unknown) => {
					if (target(v)) return ok((target.meta.transform ? target.meta.transform(v, v) : v) as T);

					if ('fallback' in target.meta) {
						return ok(evaluateFallback(target.meta.fallback, target.meta, v) as T);
					}

					const message = evaluateError(target.meta.error, target.meta, v);

					return err(
						GlobalErrs.GuardErr({
							name: target.meta.name,
							message: message ?? buildGuardErrMsg(target.meta, v),
							path: target.meta.path,
							expected: target.meta.id,
							actual: getType(v),
							values: target.meta.values,
						})
					);
				};
			}
			if (prop === 'assert') {
				return (v: unknown) => {
					if (target(v)) return (target.meta.transform ? target.meta.transform(v, v) : v) as T;

					if ('fallback' in target.meta) {
						return evaluateFallback(target.meta.fallback, target.meta, v) as T;
					}

					const message = evaluateError(target.meta.error, target.meta, v);

					throw GlobalErrs.GuardErr({
						name: target.meta.name,
						message: message ?? buildGuardErrMsg(target.meta, v),
						path: target.meta.path,
						expected: target.meta.id,
						actual: getType(v),
						values: target.meta.values,
					});
				};
			}

			// --- Let symbols and internal props pass through ---
			if (typeof prop === 'symbol') {
				return (target as any)[prop];
			}

			// --- Lookup helper (Universal first, then specific) ---
			const helper = helpers[prop] ?? universalHelpers[prop];
			if (!helper) {
				return (target as any)[prop];
			}

			// 1. Terminal helpers - execution ends the chain or returns a non-guard value
			if (helper[TERMINAL]) {
				return (...args: any[]) => helper(target, ...args);
			}

			// 2. Transformer helpers - these return a new Guard with modified logic/meta/type/helpers
			if (helper[TRANSFORMER]) {
				const execute = (...args: any[]) => {
					const result = helper(target, ...args);
					const next = Object.assign(result.fn, {
						meta: {
							...target.meta,
							...result.meta,
							transform: result.transform
								? (v: any, original: any) => {
										const parentVal = target.meta.transform
											? target.meta.transform(v, original)
											: v;
										const newVal = result.transform!(parentVal, original);
										return newVal;
									}
								: target.meta.transform,
						} as GuardMeta,
					});
					const nextHelpers = result.helpers
						? result.replaceHelpers
							? result.helpers
							: { ...helpers, ...result.helpers }
						: helpers;
					return createProxy(next, nextHelpers);
				};

				// If marked as a property, execute immediately with no extra args
				if (helper[PROPERTY]) {
					return execute();
				}

				return execute;
			}

			// 3. Factory helpers - these take args and return a predicate to be combined with the target
			if (helper[FACTORY]) {
				return (...args: any[]) => {
					const predicate = helper(...args);
					const jsonContrib: Partial<JsonSchemaNode> | undefined = (helper as any)[JSON_SCHEMA]
						? (helper as any)[JSON_SCHEMA](...args)
						: undefined;
					const next = Object.assign(
						(v: unknown): v is T => {
							if (!target(v)) return false;
							const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
							return predicate(transformed);
						},
						{
							meta: {
								...target.meta,
								name: `${target.meta.name}.${String(prop)}(${args.map(a => safeStringify(a)).join(', ')})`,
								...(jsonContrib && {
									jsonSchema: { ...target.meta.jsonSchema, ...jsonContrib },
								}),
							},
						}
					);
					return createProxy(next, helpers);
				};
			}

			// 4. Value helpers — simple predicates, compose immediately
			const jsonContrib: Partial<JsonSchemaNode> | undefined = (helper as any)[JSON_SCHEMA]
				? (helper as any)[JSON_SCHEMA]()
				: undefined;
			const next = Object.assign(
				(v: unknown): v is T => {
					if (!target(v)) return false;
					const transformed = target.meta.transform ? target.meta.transform(v, v) : v;
					return helper(transformed);
				},
				{
					meta: {
						...target.meta,
						name: `${target.meta.name}.${String(prop)}`,
						...(jsonContrib && {
							jsonSchema: { ...target.meta.jsonSchema, ...jsonContrib },
						}),
					},
				}
			);
			return createProxy(next, helpers);
		},
	}) as Guard<T, H>;
}
