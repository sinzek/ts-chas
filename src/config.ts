import { ok, err, type Result } from './result.js';
import { type Guard, type GuardErr } from './guard.js';
import { GlobalErrs } from './tagged-errs.js';

// --- Internal GuardErr factory ---

function createGuardErr(props: {
	message: string;
	path: string[];
	expected: string;
	actual: string;
	schema?: string;
}): GuardErr {
	return GlobalErrs.GuardErr(props) as unknown as GuardErr;
}

// --- Coercion Guards ---

/**
 * A coercion guard that parses a string into a target type.
 * Used for environment variables which are always strings.
 */
type CoercionGuard<T> = Guard<T> & {
	readonly meta?: {
		name: string;
		errorMsg?: string;
		coerce?: (value: string) => unknown;
		[key: string]: any;
	};
};

/**
 * Coercion utilities for parsing string env vars into typed values.
 *
 * @example
 * ```ts
 * import { defineConfig, coerce } from 'chas/config';
 *
 * const Config = defineConfig({
 *   PORT: coerce.number,
 *   DEBUG: coerce.boolean,
 * });
 * ```
 */
export const coerce = {
	/**
	 * Coerces a string to a number. Validates the result is a finite number.
	 * Accepts numeric strings like `"3000"` and already-numeric values.
	 */
	number: Object.assign(
		((v: unknown): v is number => {
			if (typeof v === 'number') return Number.isFinite(v);
			if (typeof v === 'string') {
				const n = Number(v);
				return v.trim() !== '' && Number.isFinite(n);
			}
			return false;
		}) as Guard<number>,
		{
			meta: { name: 'coerce.number', coerce: (v: string) => Number(v) },
		}
	) as CoercionGuard<number>,

	/**
	 * Coerces a string to a boolean.
	 * Accepts: `"true"` / `"false"`, `"1"` / `"0"`, `"yes"` / `"no"` (case-insensitive).
	 */
	boolean: Object.assign(
		((v: unknown): v is boolean => {
			if (typeof v === 'boolean') return true;
			if (typeof v === 'string') {
				const lower = v.toLowerCase().trim();
				return ['true', 'false', '1', '0', 'yes', 'no'].includes(lower);
			}
			return false;
		}) as Guard<boolean>,
		{
			meta: {
				name: 'coerce.boolean',
				coerce: (v: string) => {
					const lower = v.toLowerCase().trim();
					return ['true', '1', 'yes'].includes(lower);
				},
			},
		}
	) as CoercionGuard<boolean>,

	/**
	 * Coerces a string to a BigInt.
	 */
	bigint: Object.assign(
		((v: unknown): v is bigint => {
			if (typeof v === 'bigint') return true;
			if (typeof v !== 'string') return false;
			try {
				BigInt(v);
				return true;
			} catch {
				return false;
			}
		}) as Guard<bigint>,
		{
			meta: { name: 'coerce.bigint', coerce: (v: string) => BigInt(v) },
		}
	) as CoercionGuard<bigint>,

	/**
	 * Coerces a string to a Date.
	 */
	date: Object.assign(
		((v: unknown): v is Date => {
			if (v instanceof Date) return true;
			if (typeof v !== 'string') return false;
			try {
				const d = new Date(v);
				return !Number.isNaN(d.getTime());
			} catch {
				return false;
			}
		}) as Guard<Date>,
		{
			meta: { name: 'coerce.date', coerce: (v: string) => new Date(v) },
		}
	) as CoercionGuard<Date>,
};

// --- Config Definition ---

/**
 * A config field definition: either a bare Guard, or an object with a guard and a default value.
 */
type ConfigField<T> = Guard<T> | { guard: Guard<T>; default: T };

/**
 * Schema for config definitions — a record of field names to config fields.
 */
type ConfigSchema = Record<string, ConfigField<any>>;

/**
 * Infer the validated output type from a config schema.
 */
type InferConfig<S extends ConfigSchema> = {
	[K in keyof S]: S[K] extends { guard: Guard<infer T>; default: infer _D }
		? T
		: S[K] extends Guard<infer T>
			? T
			: never;
};

/** Extract the guard from a field definition. */
function getGuard(field: ConfigField<any>): Guard<any> {
	return 'guard' in field && typeof field === 'object' && field !== null
		? (field as { guard: Guard<any> }).guard
		: (field as Guard<any>);
}

/** Extract the default value from a field definition (or `undefined` for bare guards). */
function getDefault(field: ConfigField<any>): any {
	return 'guard' in field && typeof field === 'object' && field !== null
		? (field as { default: any }).default
		: undefined;
}

/**
 * Defines a configuration schema that validates a string record (like `process.env`).
 * Supports coercion (string to number / boolean), default values, and branded types.
 *
 * Returns an object with a `.parse()` method that validates all fields and collects
 * **all** errors rather than failing on the first one.
 *
 * @example
 * ```ts
 * import { defineConfig, coerce } from 'chas/config';
 * import { is } from 'chas/guard';
 *
 * const Config = defineConfig({
 *   DATABASE_URL: is.string.url.brand<"DatabaseUrl">(),
 *   PORT: coerce.number,
 *   NODE_ENV: is.literal("development", "staging", "production"),
 *   DEBUG: { guard: coerce.boolean, default: false },
 * });
 *
 * const config = Config.parse(process.env);
 * // Result<{ DATABASE_URL: Brand<"DatabaseUrl", string>; PORT: number; ... }, GuardErr[]>
 * ```
 */
export function defineConfig<S extends ConfigSchema>(
	schema: S
): {
	/** Parse and validate a string record against the config schema. */
	parse: (env: Record<string, string | undefined>) => Result<InferConfig<S>, GuardErr[]>;
} {
	return {
		parse(env: Record<string, string | undefined>): Result<InferConfig<S>, GuardErr[]> {
			const errors: GuardErr[] = [];
			const result: Record<string, any> = {};

			for (const [key, field] of Object.entries(schema)) {
				const guard = getGuard(field);
				const defaultValue = getDefault(field);
				let rawValue: unknown = env[key];

				// Handle missing / empty values
				if (rawValue === undefined || rawValue === '') {
					if (defaultValue !== undefined) {
						result[key] = defaultValue;
						continue;
					}
					errors.push(
						createGuardErr({
							message: `Missing required config: ${key}`,
							path: [key],
							expected: guard.meta?.name ?? 'unknown',
							actual: 'undefined',
						})
					);
					continue;
				}

				// Validate first, then coerce if valid
				if (guard(rawValue)) {
					// Apply coercion after validation passes
					if (guard.meta?.['coerce'] && typeof env[key] === 'string') {
						rawValue = guard.meta['coerce'](env[key]);
					}
					result[key] = rawValue;
				} else {
					errors.push(
						createGuardErr({
							message: `Invalid config "${key}": expected ${guard.meta?.name ?? 'unknown'}, got ${JSON.stringify(env[key])}`,
							path: [key],
							expected: guard.meta?.name ?? 'unknown',
							actual: typeof env[key],
						})
					);
				}
			}

			if (errors.length > 0) {
				return err(errors);
			}
			return ok(result as InferConfig<S>);
		},
	};
}
