/**
 * Schema module for the Guard API.
 *
 * While individual guards have `.parse()` (single error, fail-fast) and `.assert()` (throws),
 * schemas provide **recursive error collection** — walking nested objects, arrays, and tuples
 * to gather ALL validation failures with full dot-path tracking.
 *
 * @example
 * ```ts
 * import { is, defineSchemas, type InferSchema } from 'ts-chas/guard';
 *
 * const schemas = defineSchemas({
 *   User: is.object({
 *     name: is.string.min(1),
 *     age: is.number.integer.gt(0),
 *     address: is.object({
 *       street: is.string,
 *       city: is.string,
 *       zip: is.string.length(5),
 *     }),
 *     tags: is.array(is.string).nonEmpty,
 *   }),
 *   Email: is.string.trim().email,
 * });
 *
 * type User = InferSchema<typeof schemas.User>;
 * // { name: string; age: number; address: { street: string; city: string; zip: string }; tags: string[] }
 *
 * const result = schemas.User.parse({ name: '', age: -1, address: { street: 'Main St', city: 'NY', zip: 123 }, tags: [] });
 * // Err([
 * //   GuardErr { path: ['User', 'name'], message: 'Value "" failed validation', ... },
 * //   GuardErr { path: ['User', 'age'], message: 'Value -1 failed validation', ... },
 * //   GuardErr { path: ['User', 'address', 'zip'], message: 'Expected string, but got number (123)', ... },
 * //   GuardErr { path: ['User', 'tags'], message: 'Value [] failed validation', ... },
 * // ])
 * ```
 */

import { ok, err, type Result } from '../result/result.js';
import { GlobalErrs } from '../tagged-errs.js';
import type { StandardSchemaV1 } from '../standard-schema.js';
import { safeStringify } from '../utils.js';
import {
	type Guard,
	type GuardMeta,
	type InferGuard,
	type GuardErr,
	evaluateFallback,
	evaluateDefault,
	evaluateError,
	getType,
	buildGuardErrMsg,
} from './base/shared.js';
import { generateTerminal } from './generate.js';
import { _registerToSchema } from './base/universal-helpers.js';

/**
 * Extracts the validated output type from a schema, guard, or guard record.
 *
 * @example
 * ```ts
 * const UserSchema = is.object({ name: is.string, age: is.number });
 * type User = InferSchema<typeof UserSchema>;
 * // { name: string; age: number }
 *
 * const schemas = defineSchemas({ User: is.object({ name: is.string }) });
 * type User = InferSchema<typeof schemas.User>;
 * // { name: string }
 * ```
 */
export type InferSchema<T> = T extends { $infer: infer U }
	? U
	: T extends Record<string, any>
		? { [K in keyof T]: InferSchema<T[K]> }
		: never;

/**
 * A named schema with recursive validation, error collection, and Standard Schema compliance.
 *
 * Unlike individual guard `.parse()` (which fails fast on the first error), schema `.parse()`
 * recursively walks the entire structure and collects all errors with full paths.
 */
export interface Schema<G extends Guard<any, any, any>> {
	/**
	 * Recursively validates a value, collecting all errors with full dot-paths.
	 * Returns `Result<T, GuardErr[]>` (an array of every validation failure).
	 *
	 * @example
	 * ```ts
	 * const result = schemas.User.parse({ name: 123, age: 'old' });
	 * if (result.isErr()) {
	 *   for (const e of result.error) {
	 *     console.log(`${e.path.join('.')}: ${e.message}`);
	 *   }
	 * }
	 * ```
	 */
	parse(value: unknown): Result<InferGuard<G>, GuardErr[]>;

	/**
	 * Validates and returns the typed value, or throws an `AggregateGuardErr`
	 * containing ALL collected `GuardErr`s.
	 *
	 * @throws {AggregateGuardErr} If validation fails (contains `.errors: GuardErr[]`).
	 */
	assert(value: unknown): InferGuard<G>;

	/**
	 * Simple boolean type guard, delegates to the underlying guard.
	 */
	is(value: unknown): value is InferGuard<G>;

	/**
	 * Generates `n` valid values that satisfy this schema (default: 1 → returns a single value).
	 *
	 * Requires `fast-check` to be installed (`npm install fast-check`).
	 * Generated values are guaranteed to pass the schema's predicate.
	 *
	 * @example
	 * ```ts
	 * await schemas.User.generate()          // { name: 'John', age: 30 }
	 * await schemas.User.generate(5)  // [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }, ...]
	 * ```
	 */
	generate: {
		(): Promise<InferGuard<G>>;
		(n: number): Promise<InferGuard<G>[]>;
	};

	/**
	 * The underlying guard function for this schema.
	 */
	guard: G;

	/**
	 * Schema metadata.
	 */
	meta: { name: string };

	/**
	 * Standard Schema V1 compliance.
	 * Compatible with tRPC, react-hook-form, Drizzle, and other Standard Schema consumers.
	 */
	'~standard': StandardSchemaV1.Props<unknown, InferGuard<G>>;

	/**
	 * Helper property to infer the output type of the schema.
	 */
	$infer: InferGuard<G>;
}

// ---------------------------------------------------------------------------
// AggregateGuardErr — thrown by schema.assert() with all errors
// ---------------------------------------------------------------------------

/**
 * An Error subclass that aggregates multiple `GuardErr`s from schema validation.
 * Thrown by `schema.assert()` when validation fails.
 *
 * @example
 * ```ts
 * try {
 *   schemas.User.assert(invalidData);
 * } catch (e) {
 *   if (e instanceof AggregateGuardErr) {
 *     console.log(e.errors); // GuardErr[]
 *     console.log(e.format()); // { 'name': ['...'], 'address.zip': ['...'] }
 *   }
 * }
 * ```
 */
export class AggregateGuardErr extends Error {
	readonly errors: GuardErr[];
	readonly schemaName: string;

	constructor(schemaName: string, errors: GuardErr[]) {
		const count = errors.length;
		const summary = errors
			.slice(0, 3)
			.map(e => `  - ${e.path.join('.')}: ${e.message}`)
			.join('\n');
		const overflow = count > 3 ? `\n  ... and ${count - 3} more` : '';
		super(`${schemaName}: ${count} validation error${count === 1 ? '' : 's'}\n${summary}${overflow}`);
		this.name = 'AggregateGuardErr';
		this.errors = errors;
		this.schemaName = schemaName;
	}

	/**
	 * Formats errors as a flat record of `path → messages[]`.
	 *
	 * @example
	 * ```ts
	 * e.format()
	 * // {
	 * //   'name': ['Expected string, but got number (123)'],
	 * //   'address.zip': ['Value "1234" failed validation'],
	 * // }
	 * ```
	 */
	format(): Record<string, string[]> {
		return formatErrors(this.errors);
	}

	/**
	 * Flattens errors into a simple array of `{ path, message }` objects.
	 */
	flatten(): { path: string; message: string }[] {
		return flattenErrors(this.errors);
	}
}

// ---------------------------------------------------------------------------
// Error formatting utilities
// ---------------------------------------------------------------------------

/**
 * Formats an array of `GuardErr`s into a record of `path → messages[]`.
 * The path is a dot-separated string with the schema name prefix stripped.
 *
 * @example
 * ```ts
 * const result = schemas.User.parse(invalid);
 * if (result.isErr()) {
 *   const formatted = formatErrors(result.error);
 *   // { 'name': ['Expected string, but got number'], 'address.zip': ['Value "1234" failed validation'] }
 * }
 * ```
 */
export function formatErrors(errors: GuardErr[]): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const e of errors) {
		// Always drop the first path segment (schema name), use _root for root-level errors
		const pathSegments = e.path.slice(1);
		const key = pathSegments.join('.') || '_root';
		if (!result[key]) result[key] = [];
		result[key]!.push(e.message);
	}
	return result;
}

/**
 * Flattens an array of `GuardErr`s into simple `{ path, message }` objects.
 *
 * @example
 * ```ts
 * const result = schemas.User.parse(invalid);
 * if (result.isErr()) {
 *   flattenErrors(result.error).forEach(e => console.log(`${e.path}: ${e.message}`));
 * }
 * ```
 */
export function flattenErrors(errors: GuardErr[]): { path: string; message: string }[] {
	return errors.map(e => {
		const pathSegments = e.path.slice(1);
		return { path: pathSegments.join('.') || '_root', message: e.message };
	});
}

// ---------------------------------------------------------------------------
// Deep recursive validation — the core of schema parsing
// ---------------------------------------------------------------------------

/**
 * Recursively validates a value against a guard, descending into object shapes,
 * arrays, and tuples to collect ALL errors with full path tracking.
 */
/**
 * Recursively validates a value against a guard, descending into object shapes,
 * arrays, and tuples to collect ALL errors with full path tracking.
 *
 * Returns the (possibly defaulted or transformed) value if no errors occurred
 * at this node, or the original value if errors occurred (unless caught).
 */
function validateDeep(value: unknown, guard: Guard<any>, schemaName: string, path: string[], errors: GuardErr[]): any {
	const meta = guard.meta;
	const shape = meta.shape as Record<string, Guard<any>> | undefined;

	// Default short-circuit: if input is `undefined` and a default is set, materialize it
	// without running the predicate. Lets nested object fields with `.default(...)` fill in.
	if (value === undefined && 'default' in meta) {
		return evaluateDefault(meta.default, meta);
	}

	// Helper to handle failure and apply defaults
	const handleFailure = (
		currentValue: unknown,
		expectedType: string,
		customMsg?: string,
		issues?: readonly StandardSchemaV1.Issue[]
	) => {
		const message = evaluateError(meta.error, meta, currentValue, customMsg);
		const error = GlobalErrs.GuardErr({
			name: meta.name,
			message: message ?? buildGuardErrMsg(meta, currentValue, guard),
			schema: schemaName,
			path: [schemaName, ...path],
			expected: expectedType,
			actual: getType(currentValue),
			values: meta.values,
			issues,
		});

		if ('fallback' in meta) {
			return evaluateFallback(meta.fallback, meta, currentValue, error);
		}

		errors.push(error);
		return currentValue;
	};

	// ---- Object with shape: recurse into each field ----
	if (shape && meta.id === 'object') {
		if (value == null || typeof value !== 'object' || Array.isArray(value)) {
			const message = evaluateError(
				meta.error,
				meta,
				value,
				`Expected an object, but got ${getType(value)} (${safeStringify(value)})`
			);
			return handleFailure(value, 'object', message);
		}

		const obj = value as Record<string, unknown>;
		const result: Record<string, any> = { ...obj };
		let hasChanges = false;
		const initialErrorCount = errors.length;

		for (const [key, fieldGuard] of Object.entries(shape)) {
			const fieldValue = obj[key];
			const fieldPath = [...path, key];

			const validated = validateDeep(fieldValue, fieldGuard, schemaName, fieldPath, errors);
			if (validated !== fieldValue) {
				result[key] = validated;
				hasChanges = true;
			}
		}

		// Also check for any non-field-level refinements on the object guard itself
		const allFieldsPassed = errors.length === initialErrorCount;
		if (allFieldsPassed && !guard(result)) {
			return handleFailure(result, meta.id);
		}

		return hasChanges ? result : value;
	}

	// ---- Array: recurse into elements if they have guards ----
	if (meta.id === 'array' && Array.isArray(value)) {
		const elementGuards: Guard<any>[] | undefined = meta['elementGuards'];

		if (elementGuards && elementGuards.length > 0) {
			const result: any[] = [...value];
			let hasChanges = false;
			const initialErrorCount = errors.length;

			for (let i = 0; i < value.length; i++) {
				const elemPath = [...path, `[${i}]`];
				const passingGuard = elementGuards.find(g => g(value[i]));

				if (passingGuard) {
					const validated = validateDeep(value[i], passingGuard, schemaName, elemPath, errors);
					if (validated !== value[i]) {
						result[i] = validated;
						hasChanges = true;
					}
				} else if (elementGuards.length === 1) {
					// Single-guard array — recurse into it for a precise nested error.
					const validated = validateDeep(value[i], elementGuards[0]!, schemaName, elemPath, errors);
					if (validated !== value[i]) {
						result[i] = validated;
						hasChanges = true;
					}
				} else {
					// Heterogeneous array — no member matched. Don't pick `elementGuards[0]`
					// arbitrarily; that produces misleading "expected X" errors. Emit a single
					// flat error naming all expected variants.
					const expected = elementGuards.map(g => g.meta.id || g.meta.name).join(' | ');
					errors.push(
						GlobalErrs.GuardErr({
							name: meta.name,
							message: `Value ${safeStringify(value[i])} did not match any element variant (${expected})`,
							schema: schemaName,
							path: [schemaName, ...elemPath],
							expected,
							actual: getType(value[i]),
						})
					);
				}
			}

			if (errors.length === initialErrorCount && !guard(result)) {
				return handleFailure(result, meta.id);
			}

			return hasChanges ? result : value;
		}

		if (!guard(value)) {
			return handleFailure(value, meta.id);
		}
		return value;
	}

	// ---- Tuple: recurse into positional elements ----
	if (meta.id === 'tuple' && Array.isArray(value)) {
		const tupleGuards: Guard<any>[] | undefined = meta['tupleGuards'];
		const restGuard: Guard<any> | undefined = meta['restGuard'];

		if (tupleGuards) {
			if (restGuard ? value.length < tupleGuards.length : value.length !== tupleGuards.length) {
				const expected = restGuard ? `at least ${tupleGuards.length}` : `${tupleGuards.length}`;
				return handleFailure(
					value,
					meta.id,
					`Expected tuple of length ${expected}, but got length ${value.length}`
				);
			}

			const result = [...value];
			let hasChanges = false;
			const initialErrorCount = errors.length;

			for (let i = 0; i < tupleGuards.length; i++) {
				const elemPath = [...path, `[${i}]`];
				const validated = validateDeep(value[i], tupleGuards[i]!, schemaName, elemPath, errors);
				if (validated !== value[i]) {
					result[i] = validated;
					hasChanges = true;
				}
			}

			if (restGuard) {
				for (let i = tupleGuards.length; i < value.length; i++) {
					const elemPath = [...path, `[${i}]`];
					const validated = validateDeep(value[i], restGuard, schemaName, elemPath, errors);
					if (validated !== value[i]) {
						result[i] = validated;
						hasChanges = true;
					}
				}
			}

			if (errors.length === initialErrorCount && !guard(result)) {
				return handleFailure(result, meta.id);
			}

			return hasChanges ? result : value;
		}

		if (!guard(value)) {
			return handleFailure(value, meta.id);
		}
		return value;
	}

	// ---- Base Case: check the guard directly ----
	if ((meta as any)._foreignSchema) {
		const result = (meta as any)._foreignSchema['~standard'].validate(value);
		if (result instanceof Promise) {
			GlobalErrs.ChasErr.throw({
				message:
					`[ts-chas] Standard schema "${(meta as any)._foreignSchema['~standard'].vendor}" returned a Promise during synchronous validation. ` +
					`Standard schemas that use async refinements must be validated with .parseAsync().`,
				origin: `validateDeep(${safeStringify(value)})`,
			});
		}
		if (result.issues) {
			return handleFailure(value, meta.id, undefined, result.issues);
		}
	} else if (!guard(value)) {
		return handleFailure(value, meta.id);
	}

	// If it passes, apply the root transform if it exists.
	// Wrap in try/catch so fallback catches transform errors.
	if (meta.transform) {
		try {
			return meta.transform(value, value);
		} catch {
			return handleFailure(value, meta.id);
		}
	}
	return value;
}

/**
 * Input to `defineSchemas`: either a Guard directly, or a plain record of guards
 * (which will be wrapped in an implicit object schema).
 */
type SchemaInputValue = Guard<any, any, any> | { [key: string]: SchemaInputValue };
type SchemaInput = Guard<any, any, any> | Record<string, SchemaInputValue>;

/**
 * Resolves a `SchemaInput` (or nested value) to the corresponding guard type.
 *
 * Discriminates guards from plain records via the `$infer` property rather than
 * `T extends Guard<any, any, any>` — which would collapse to `T extends any` (since
 * `Guard<any, any, any>` evaluates to `any` once the third intersection branch is `any`)
 * and let plain records pass through unwrapped.
 */
import { type ObjectGuard } from './objects/object.js';
import { type InferObjectSchema } from './objects/object-helpers.js';

export type InferInput<T> = T extends { $infer: any }
	? T
	: T extends Record<string, any>
		? ObjectGuard<InferObjectSchema<{ [K in keyof T]: InferInput<T[K]> }>>
		: never;

/**
 * Defines named schemas with recursive validation and error collection.
 *
 * Accepts either guards directly or plain records of guards (auto-wrapped as object schemas).
 *
 * @example
 * ```ts
 * // Guards directly
 * const schemas = defineSchemas({
 *   User: is.object({ name: is.string, age: is.number }),
 *   Email: is.string.trim().email,
 * });
 *
 * // Plain records (auto-wrapped as object schemas)
 * const schemas = defineSchemas({
 *   User: { name: is.string, age: is.number },
 * });
 *
 * // Both produce the same result:
 * type User = InferSchema<typeof schemas.User>;
 * // { name: string; age: number }
 * ```
 *
 * @example
 * ```ts
 * // Nested plain records
 * const schemas = defineSchemas({
 *   User: {
 *     name: is.string,
 *     address: {
 *       street: is.string,
 *       city: is.string,
 *     },
 *   },
 * });
 *
 * type User = InferSchema<typeof schemas.User>;
 * // { name: string; address: { street: string; city: string } }
 * ```
 */
export function defineSchemas<S extends Record<string, SchemaInput>>(
	schemas: S
): {
	readonly [K in keyof S]: Schema<InferInput<S[K]>>;
} {
	const compiled = Object.entries(schemas).map(([name, input]) => {
		const guard = resolveGuard(name, input);
		const schema = buildSchema(name, guard);
		return [name, schema] as const;
	});

	return Object.fromEntries(compiled) as any;
}

/**
 * Creates a single named schema from a guard. Useful when you don't need multiple schemas.
 *
 * @example
 * ```ts
 * const UserSchema = defineSchema('User', is.object({
 *   name: is.string,
 *   age: is.number.gt(0),
 * }));
 *
 * const result = UserSchema.parse(data);
 * ```
 */
export function defineSchema<T extends SchemaInput>(name: string, input: T): Schema<InferInput<T>> {
	const guard = resolveGuard(name, input);
	return buildSchema(name, guard) as any;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Checks if a value is a Guard (function with `.meta`).
 */
function isGuard(v: unknown): v is Guard<any> {
	return typeof v === 'function' && 'meta' in v;
}

/**
 * If the input is already a Guard, return it.
 * If it's a plain record, recursively resolve nested records into object guards.
 */
function resolveGuard(schemaName: string, input: SchemaInput | SchemaInputValue): Guard<any> {
	if (isGuard(input)) {
		return input;
	}
	// Plain record — recursively resolve each value, then build an object guard
	const record = input as Record<string, SchemaInputValue>;
	const shape: Record<string, Guard<any>> = {};
	for (const [key, value] of Object.entries(record)) {
		shape[key] = resolveGuard(schemaName, value);
	}

	const names = Object.keys(shape)
		.map(k => `${k}: ${shape[k]!.meta.name}`)
		.join(', ');

	// Create a minimal guard-like object with shape metadata
	const fn = Object.assign(
		(v: unknown): v is any => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const obj = v as Record<string, unknown>;
			for (const [key, guard] of Object.entries(shape)) {
				if (!guard(obj[key])) return false;
			}
			return true;
		},
		{
			meta: {
				name: `object<${names}>`,
				id: 'object',
				shape,
				path: [] as string[],
				schema: schemaName,
				error: undefined,
			} as GuardMeta,
		}
	);

	return fn as unknown as Guard<any>;
}

/**
 * Builds a Schema object from a name and a guard.
 */
function buildSchema<G extends Guard<any, any, any>>(name: string, guard: G): Schema<G> {
	const g = guard as unknown as Guard<any>;
	const schema: Schema<G> = {
		parse(value: unknown): Result<InferGuard<G>, GuardErr[]> {
			const errors: GuardErr[] = [];
			const result = validateDeep(value, g, name, [], errors);

			if (errors.length === 0) {
				return ok(result as InferGuard<G>);
			}
			return err(errors);
		},

		assert(value: unknown): InferGuard<G> {
			const result = schema.parse(value);
			if (result.isOk()) return result.value;
			throw new AggregateGuardErr(name, result.error);
		},

		is(value: unknown): value is InferGuard<G> {
			return g(value);
		},

		generate(n?: number) {
			return generateTerminal(g, n);
		},

		guard,

		meta: { name },

		'~standard': {
			version: 1 as const,
			vendor: 'chas',
			validate(value: unknown): StandardSchemaV1.Result<InferGuard<G>> {
				const result = schema.parse(value);
				if (result.isOk()) {
					return { value: result.value };
				}
				return {
					issues: result.error.map(e => ({
						message: e.message,
						path: e.path.map(p => ({ key: p })),
					})),
				};
			},
		},

		$infer: undefined as InferGuard<G>,
	};

	return schema;
}

// Register buildSchema into shared.ts so Guard.toSchema() can call it
// without creating a runtime circular dependency.
_registerToSchema((name, guard) => buildSchema(name, guard));
