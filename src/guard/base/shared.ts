import { GlobalErrs, type InferErr } from '../../tagged-errs.js';
import { safeStringify } from '../../utils.js';
import type { StandardSchemaV1 } from '../../standard-schema.js';
import type { UniversalHelpers } from './universal-helpers.js';

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
	 * The fallback value (or a function returning one) to use when parsing fails.
	 * The callback receives the failing value and the error that would have been thrown.
	 *
	 * NOTE: A fallback does not change the behavior of the guard when used as a boolean type predicate
	 * in `if` statements.
	 */
	fallback?: any | ((ctx: { meta: GuardMeta; value: unknown; error: GuardErr }) => any) | undefined;
	/**
	 * A default value (or a function returning one) to use when input is `undefined`.
	 * Unlike `fallback`, this fires *before* validation — only when the input is missing,
	 * not when it fails the predicate.
	 *
	 * NOTE: A default does not change the behavior of the guard when used as a boolean type predicate
	 * in `if` statements.
	 */
	default?: any | ((ctx: { meta: GuardMeta }) => any) | undefined;
	/**
	 * A human-readable description for the guard. Populated by `.describe(...)`.
	 * Flows into JSON Schema output as `description` and can be read from `meta.description`
	 * for tooling. Stored as a resolved string (function form is evaluated eagerly).
	 */
	description?: string | undefined;
	/**
	 * @internal The guard one chain step below this one. Used to walk the chain
	 * at error time so refinement failures can point at the specific step that rejected.
	 * Populated automatically by `createProxy`; do not set manually.
	 */
	_parent?: Guard<any, any> | undefined;
	/**
	 * @internal Accumulated refinement predicates (from factory and value helpers)
	 * that shape-altering transformers (`partial`, `pick`, `omit`, `extend`, `required`)
	 * must re-apply after rebuilding the structural predicate. Each entry carries the
	 * predicate function and a human-readable name for error messages.
	 *
	 * Populated automatically by `createProxy`; do not set manually.
	 */
	_refinements?: Array<{ predicate: (v: any) => boolean; name: string }> | undefined;
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

/**
 * Adds a brand to a type.
 * @typeParam T - The type to add the brand to.
 * @typeParam Tag - The brand to add to the type.
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * type UnbrandedEmail = Unbrand<Email>; // string
 * type EmailWithBrand = AddBrand<Email, 'Email'>; // Brand<'Email', Brand<'Email', string>>
 * ```
 */
export type AddBrand<T, Tag extends string | number | symbol> =
	T extends Brand<infer T1, infer B1> ? Brand<T1 | Tag, B1> : Brand<Tag, T>;

/**
 * Removes a brand from a type.
 *
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * type UnbrandedEmail = Unbrand<Email>; // string
 * ```
 */
export type Unbrand<T, Tag = undefined> =
	T extends Brand<infer T1, infer B1>
		? Tag extends undefined
			? B1
			: [Exclude<T1, Tag>] extends [never]
				? B1
				: Brand<Exclude<T1, Tag>, B1>
		: T;

/**
 * Checks if a type is branded.
 *
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * type UnbrandedEmail = Unbrand<Email>; // string
 * type IsBrandedEmail = IsBranded<Email>; // true
 * type IsBrandedUnbrandedEmail = IsBranded<UnbrandedEmail>; // false
 * ```
 */
export type IsBranded<T> = [T] extends [Brand<any, any>] ? true : false;

/**
 * Checks if a type has a specific brand or brands.
 *
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * type UnbrandedEmail = Unbrand<Email>; // string
 * type HasEmailBrand = HasBrand<Email, 'Email'>; // true
 * type HasUnbrandedEmailBrand = HasBrand<UnbrandedEmail, 'Email'>; // false
 *
 * type User = AddBrand<Email, 'Password'>;
 * type HasMultipleBrands = HasBrand<User, 'Email' | 'Password'>; // true
 * ```
 */
export type HasBrand<T, Tag extends string | number | symbol> = [T] extends [Brand<infer T1, any>]
	? Tag extends T1
		? true
		: false
	: false;

/**
 * Gets the brand of a type.
 *
 * @example
 * ```ts
 * type Email = Brand<'Email', string>;
 * type UnbrandedEmail = Unbrand<Email>; // string
 * type EmailBrand = GetBrand<Email>; // 'Email'
 * type UnbrandedEmailBrand = GetBrand<UnbrandedEmail>; // never
 * ```
 */
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
 * @typeParam Prev - The type name of the base guard in the chain (eg: `StringGuard`, default: undefined)
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
export type Guard<T, H extends Record<string, any> = {}, Prev = undefined> = StandardSchemaV1<unknown, T> & {
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
} & UniversalHelpers<T, H, Prev> &
	H;

/** @internal Evaluates a fallback (static value or function). */
export function evaluateFallback(fallback: any, meta: GuardMeta, value: unknown, error: GuardErr): any {
	if (typeof fallback === 'function') {
		return fallback({ meta, value, error });
	}
	return fallback;
}
/** @internal Evaluates a default (static value or function). Called when input is `undefined`. */
export function evaluateDefault(def: any, meta: GuardMeta): any {
	if (typeof def === 'function') {
		return def({ meta });
	}
	return def;
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

// ---------------------------------------------------------------------------
// toSchema registration — avoids a runtime circular dep with schema.ts
// (schema.ts imports runtime values from shared.ts, so shared.ts can't
// import back; schema.ts registers its implementation here at init time)
// ---------------------------------------------------------------------------

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
	if (v instanceof File) return 'file';
	if (v instanceof FormData) return 'formdata';
	if (v instanceof Blob) return 'blob';
	if (typeof Buffer !== 'undefined' && v instanceof Buffer) return 'buffer';
	if (typeof Uint8Array !== 'undefined' && v instanceof Uint8Array) return 'uint8array';
	if (typeof ArrayBuffer !== 'undefined' && v instanceof ArrayBuffer) return 'arraybuffer';
	if (typeof DataView !== 'undefined' && v instanceof DataView) return 'dataview';
	return 'object';
}

/**
 * @internal Walks the `_parent` chain from root to leaf, calling each step's
 * predicate against `value`. Returns the first step that rejects while its
 * parent accepts — i.e., the exact refinement that broke the chain.
 *
 * Returns `undefined` if the root predicate already rejects (type mismatch, not a
 * refinement) or if no rejecting step is found (which would indicate a spurious call).
 */
export function findFailingStep(guard: Guard<any, any>, value: unknown): Guard<any, any> | undefined {
	const chain: Guard<any, any>[] = [];
	let cur: Guard<any, any> | undefined = guard;
	while (cur) {
		chain.unshift(cur);
		cur = cur.meta._parent as Guard<any, any> | undefined;
	}
	if (chain.length === 0 || !chain[0]!(value)) return undefined;
	for (let i = 1; i < chain.length; i++) {
		if (!chain[i]!(value)) return chain[i];
	}
	return undefined;
}

/**
 * @internal Returns just the step's own name (e.g. `.min(3)` or `.email`) by
 * stripping the parent's accumulated name prefix. Falls back to the full name
 * if the parent name isn't a clean prefix.
 */
function stepLocalName(step: Guard<any, any>): string {
	const parent = step.meta._parent as Guard<any, any> | undefined;
	if (parent && step.meta.name.startsWith(parent.meta.name)) {
		const suffix = step.meta.name.slice(parent.meta.name.length);
		return suffix || step.meta.name;
	}
	return step.meta.name;
}

/**
 * Builds a descriptive error message for guard validation failures.
 *
 * Differentiates between:
 * - **Type mismatch**: the value isn't even the right base type
 *   → "Expected string, got number (123)"
 * - **Refinement failure**: the value is the right type but failed a chain step
 *   → "Value \"ab\" failed validation at .min(3)" (when a specific step is located)
 *   → "Value \"ab\" failed validation" (fallback when the failing step can't be located)
 *
 * The guard chain name is always available on the error's `.name` field
 * for programmatic inspection — no need to duplicate it in the message.
 */
export function buildGuardErrMsg(meta: GuardMeta, v: unknown, guard?: Guard<any, any>): string {
	const actual = getType(v);
	const isRefinementFailure =
		actual === meta.id ||
		(meta.id === 'array' && Array.isArray(v)) ||
		(meta.id === 'object' && actual === 'object');

	if (isRefinementFailure) {
		if (guard) {
			const step = findFailingStep(guard, v);
			if (step) {
				return `Value ${safeStringify(v)} failed validation at ${stepLocalName(step)}`;
			}
		}
		return `Value ${safeStringify(v)} failed validation`;
	}
	return `Expected ${meta.id}, but got ${actual} (${safeStringify(v)})`;
}

/**
 * @internal Builds the raw GuardErr props for a failing value. Shared by the
 * universal parse/assert/~standard sites so fallback callbacks can receive the
 * same error object the caller would have seen.
 *
 * Accepts the full guard (not just meta) so the error message can walk the
 * `_parent` chain to pinpoint which refinement failed.
 */
export function buildGuardErr(
	guard: Guard<any, any>,
	value: unknown,
	customMsg?: string | ((meta: GuardMeta) => string) | undefined
): GuardErr {
	const meta = guard.meta;
	const message = evaluateError(meta.error, meta, value, customMsg);
	return GlobalErrs.GuardErr({
		name: meta.name,
		message: message ?? buildGuardErrMsg(meta, value, guard),
		path: meta.path,
		expected: meta.id,
		actual: getType(value),
		values: meta.values,
		issues: (meta as any)._foreignSchema
			? (() => {
					const res = (meta as any)._foreignSchema['~standard'].validate(value);
					return res instanceof Promise ? undefined : res.issues;
				})()
			: undefined,
	});
}
