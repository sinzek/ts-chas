import type { StandardSchemaV1 } from '../../standard-schema.js';
import { makeGuard } from '../base/proxy.js';
import type { Guard } from '../base/shared.js';

/**
 * A guard that wraps any Standard Schema V1 compliant schema.
 *
 * This allows using schemas from other libraries (like Zod, Valibot, ArkType)
 * as leaf nodes within a `chas` object schema. `chas` handles the object
 * structure and path reporting, while the foreign schema handles the leaf
 * validation.
 *
 * @example
 * ```ts
 * const User = is.object({
 *   name: is.standard(z.string().email()),
 *   age:  is.standard(z.number().int().positive()),
 * });
 * ```
 */
export interface StandardGuard<T> extends Guard<T, {}, StandardGuard<T>> {}

export interface StandardGuardFactory {
	/**
	 * Wraps a Standard Schema V1 compliant schema as a `chas` guard.
	 *
	 * Note: If the underlying schema is asynchronous, this guard will throw
	 * an error when called synchronously (e.g. via `is(v)` or `parse()`).
	 * Use `parseAsync()` for async-compliant schemas.
	 */
	<TSchema extends StandardSchemaV1>(
		schema: TSchema
	): StandardGuard<
		TSchema['~standard']['types'] extends StandardSchemaV1.Types<any, infer O>
			? O
			: TSchema extends StandardSchemaV1<any, infer O>
				? O
				: never
	>;
}

export const StandardGuardFactory: StandardGuardFactory = (schema: StandardSchemaV1) => {
	const validate = schema['~standard'].validate;

	return makeGuard(
		(v: unknown): v is any => {
			const result = validate(v);
			if (result instanceof Promise) {
				throw new Error(
					`[ts-chas] Standard schema "${schema['~standard'].vendor}" returned a Promise during synchronous validation. ` +
						`Standard schemas that use async refinements must be validated with .parseAsync().`
				);
			}
			return !result.issues;
		},
		{
			name: `standard(${schema['~standard'].vendor})`,
			id: 'standard',

			_foreignSchema: schema,
		}
	);
};
