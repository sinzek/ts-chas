/**
 * Schema module for the Guard API v2.
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

import { ok, err, type Result } from '../result.js';
import { GlobalErrs } from '../tagged-errs.js';
import type { StandardSchemaV1 } from '../standard-schema.js';
import { safeStringify } from '../utils.js';
import type { Guard, GuardMeta, GuardType, GuardErr } from './shared.js';

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
export type InferSchema<T> =
	T extends Schema<infer U>
		? U
		: T extends Guard<infer U, any>
			? U
			: T extends Record<string, Guard<any, any>>
				? { [K in keyof T]: GuardType<T[K]> }
				: never;

/**
 * A named schema with recursive validation, error collection, and Standard Schema compliance.
 *
 * Unlike individual guard `.parse()` (which fails fast on the first error), schema `.parse()`
 * recursively walks the entire structure and collects all errors with full paths.
 */
export interface Schema<T> {
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
	parse(value: unknown): Result<T, GuardErr[]>;

	/**
	 * Validates and returns the typed value, or throws an `AggregateGuardError`
	 * containing ALL collected `GuardErr`s.
	 *
	 * @throws {AggregateGuardError} If validation fails (contains `.errors: GuardErr[]`).
	 */
	assert(value: unknown): T;

	/**
	 * Simple boolean type guard, delegates to the underlying guard.
	 */
	is(value: unknown): value is T;

	/**
	 * The underlying guard function for this schema.
	 */
	guard: Guard<T, Record<string, any>>;

	/**
	 * Schema metadata.
	 */
	meta: { name: string };

	/**
	 * Standard Schema V1 compliance.
	 * Compatible with tRPC, react-hook-form, Drizzle, and other Standard Schema consumers.
	 */
	'~standard': StandardSchemaV1.Props<unknown, T>;
}

// ---------------------------------------------------------------------------
// AggregateGuardError — thrown by schema.assert() with all errors
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
 *   if (e instanceof AggregateGuardError) {
 *     console.log(e.errors); // GuardErr[]
 *     console.log(e.format()); // { 'name': ['...'], 'address.zip': ['...'] }
 *   }
 * }
 * ```
 */
export class AggregateGuardError extends Error {
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
		this.name = 'AggregateGuardError';
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

function getType(v: unknown): string {
	if (v === null) return 'null';
	if (Array.isArray(v)) return 'array';
	if (v instanceof Date) return 'date';
	if (v instanceof RegExp) return 'regexp';
	if (v instanceof URL) return 'url';
	return typeof v;
}

function buildErrMsg(meta: GuardMeta, v: unknown): string {
	const actual = getType(v);
	const isRefinement =
		actual === meta.id ||
		(meta.id === 'array' && Array.isArray(v)) ||
		(meta.id === 'object' && actual === 'object');

	if (isRefinement) {
		return `Value ${safeStringify(v)} failed validation`;
	}
	return `Expected ${meta.id}, but got ${actual} (${safeStringify(v)})`;
}

/**
 * Recursively validates a value against a guard, descending into object shapes,
 * arrays, and tuples to collect ALL errors with full path tracking.
 */
function validateDeep(
	value: unknown,
	guard: Guard<any, any>,
	schemaName: string,
	path: string[],
	errors: GuardErr[]
): void {
	const meta = guard.meta;
	const shape = meta.shape as Record<string, Guard<any, any>> | undefined;

	// ---- Object with shape: recurse into each field ----
	if (shape && meta.id === 'object') {
		if (value == null || typeof value !== 'object' || Array.isArray(value)) {
			errors.push(
				GlobalErrs.GuardErr({
					name: meta.name,
					message: meta.error ?? `Expected an object, but got ${getType(value)} (${safeStringify(value)})`,
					schema: schemaName,
					path: [schemaName, ...path],
					expected: 'object',
					actual: getType(value),
				})
			);
			return;
		}

		const obj = value as Record<string, unknown>;

		for (const [key, fieldGuard] of Object.entries(shape)) {
			const fieldValue = obj[key];
			const fieldPath = [...path, key];

			if (!fieldGuard(fieldValue)) {
				// if the field guard itself has a shape (nested object), recurse deeper
				if (fieldGuard.meta.shape && typeof fieldValue === 'object' && fieldValue !== null) {
					validateDeep(fieldValue, fieldGuard, schemaName, fieldPath, errors);
				} else if (fieldGuard.meta.id === 'array' && Array.isArray(fieldValue)) {
					// array field — check if we can recurse into elements
					validateDeep(fieldValue, fieldGuard, schemaName, fieldPath, errors);
				} else if (fieldGuard.meta.id === 'tuple' && Array.isArray(fieldValue)) {
					validateDeep(fieldValue, fieldGuard, schemaName, fieldPath, errors);
				} else {
					errors.push(
						GlobalErrs.GuardErr({
							name: fieldGuard.meta.name,
							message: fieldGuard.meta.error ?? buildErrMsg(fieldGuard.meta, fieldValue),
							schema: schemaName,
							path: [schemaName, ...fieldPath],
							expected: fieldGuard.meta.id,
							actual: getType(fieldValue),
							values: fieldGuard.meta.values,
						})
					);
				}
			}
		}

		// also check for any non-field-level refinements on the object guard itself
		// (e.g., .strict, .minSize) that pass the field-by-field check but fail overall
		// we do this by checking if all fields passed but the guard itself fails
		const allFieldsPassed = Object.entries(shape).every(([key, fg]) => fg((value as any)[key]));
		if (allFieldsPassed && !guard(value)) {
			errors.push(
				GlobalErrs.GuardErr({
					name: meta.name,
					message: meta.error ?? buildErrMsg(meta, value),
					schema: schemaName,
					path: [schemaName, ...path],
					expected: meta.id,
					actual: getType(value),
				})
			);
		}
		return;
	}

	if (meta.id === 'array' && Array.isArray(value)) {
		// the guard tracks its element guards via the closure, but we can detect
		// element-level failures by testing each element if the overall guard fails.
		// if no meta.elementGuards, we fall back to a single error.
		const elementGuards: Guard<any, any>[] | undefined = meta['elementGuards'];

		if (elementGuards && elementGuards.length > 0) {
			const elementCheck = (v: unknown) => elementGuards.some(g => g(v));

			let hasElementErrors = false;
			for (let i = 0; i < value.length; i++) {
				if (!elementCheck(value[i])) {
					hasElementErrors = true;
					const elemPath = [...path, `[${i}]`];
					// try to give the best error from the first element guard
					const firstGuard = elementGuards[0]!;
					errors.push(
						GlobalErrs.GuardErr({
							name: firstGuard.meta.name,
							message: firstGuard.meta.error ?? buildErrMsg(firstGuard.meta, value[i]),
							schema: schemaName,
							path: [schemaName, ...elemPath],
							expected: elementGuards.map(g => g.meta.id).join(' | '),
							actual: getType(value[i]),
						})
					);
				}
			}

			if (!hasElementErrors && !guard(value)) {
				errors.push(
					GlobalErrs.GuardErr({
						name: meta.name,
						message: meta.error ?? buildErrMsg(meta, value),
						schema: schemaName,
						path: [schemaName, ...path],
						expected: meta.id,
						actual: getType(value),
					})
				);
			}
		} else {
			errors.push(
				GlobalErrs.GuardErr({
					name: meta.name,
					message: meta.error ?? buildErrMsg(meta, value),
					schema: schemaName,
					path: [schemaName, ...path],
					expected: meta.id,
					actual: getType(value),
				})
			);
		}
		return;
	}

	if (meta.id === 'tuple' && Array.isArray(value)) {
		const tupleGuards: Guard<any, any>[] | undefined = meta['tupleGuards'];

		if (tupleGuards) {
			if (value.length !== tupleGuards.length) {
				errors.push(
					GlobalErrs.GuardErr({
						name: meta.name,
						message: `Expected tuple of length ${tupleGuards.length}, but got length ${value.length}`,
						schema: schemaName,
						path: [schemaName, ...path],
						expected: meta.id,
						actual: getType(value),
					})
				);
				return;
			}

			for (let i = 0; i < tupleGuards.length; i++) {
				const elemGuard = tupleGuards[i]!;
				if (!elemGuard(value[i])) {
					const elemPath = [...path, `[${i}]`];
					if (elemGuard.meta.shape && typeof value[i] === 'object' && value[i] !== null) {
						validateDeep(value[i], elemGuard, schemaName, elemPath, errors);
					} else {
						errors.push(
							GlobalErrs.GuardErr({
								name: elemGuard.meta.name,
								message: elemGuard.meta.error ?? buildErrMsg(elemGuard.meta, value[i]),
								schema: schemaName,
								path: [schemaName, ...elemPath],
								expected: elemGuard.meta.id,
								actual: getType(value[i]),
							})
						);
					}
				}
			}
		} else {
			errors.push(
				GlobalErrs.GuardErr({
					name: meta.name,
					message: meta.error ?? buildErrMsg(meta, value),
					schema: schemaName,
					path: [schemaName, ...path],
					expected: meta.id,
					actual: getType(value),
				})
			);
		}
		return;
	}

	if (!guard(value)) {
		errors.push(
			GlobalErrs.GuardErr({
				name: meta.name,
				message: meta.error ?? buildErrMsg(meta, value),
				schema: schemaName,
				path: [schemaName, ...path],
				expected: meta.id,
				actual: getType(value),
			})
		);
	}
}

/**
 * Input to `defineSchemas`: either a Guard directly, or a plain record of guards
 * (which will be wrapped in an implicit object schema).
 */
type SchemaInput = Guard<any, any> | Record<string, Guard<any, any>>;

/**
 * Resolves a `SchemaInput` to its inferred TypeScript type.
 */
type InferInput<T extends SchemaInput> =
	T extends Guard<infer U, any>
		? U
		: T extends Record<string, Guard<any, any>>
			? { [K in keyof T]: GuardType<T[K]> }
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
 */
export function defineSchemas<S extends Record<string, SchemaInput>>(
	schemas: S
): {
	readonly [K in keyof S]: Schema<InferInput<S[K]>>;
} {
	const compiled = Object.entries(schemas).map(([name, input]) => {
		const guard = resolveGuard(input);
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
	const guard = resolveGuard(input);
	return buildSchema(name, guard) as Schema<InferInput<T>>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * If the input is already a Guard, return it.
 * If it's a plain record of guards, wrap it in an implicit object guard.
 */
function resolveGuard(input: SchemaInput): Guard<any, any> {
	if (typeof input === 'function' && 'meta' in input) {
		return input as Guard<any, any>;
	}
	// Plain record of guards — build an object guard inline
	// We import dynamically to avoid circular deps, but since this is just
	// creating a simple validation fn, we can do it inline:
	const shape = input as Record<string, Guard<any, any>>;
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
				schema: undefined,
				error: undefined,
			} as GuardMeta,
		}
	);

	return fn as unknown as Guard<any, any>;
}

/**
 * Builds a Schema object from a name and a guard.
 */
function buildSchema<T>(name: string, guard: Guard<T, any>): Schema<T> {
	const schema: Schema<T> = {
		parse(value: unknown): Result<T, GuardErr[]> {
			const errors: GuardErr[] = [];
			validateDeep(value, guard, name, [], errors);

			if (errors.length === 0) {
				const transformed = guard.meta.transform?.(value, value) ?? value;
				return ok(transformed as T);
			}
			return err(errors);
		},

		assert(value: unknown): T {
			const result = schema.parse(value);
			if (result.isOk()) return result.value;
			throw new AggregateGuardError(name, result.error);
		},

		is(value: unknown): value is T {
			return guard(value);
		},

		guard,

		meta: { name },

		'~standard': {
			version: 1 as const,
			vendor: 'chas',
			validate(value: unknown): StandardSchemaV1.Result<T> {
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
	};

	return schema;
}
