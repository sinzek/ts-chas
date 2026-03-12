/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tagged error factories and exhaustive error matching for use with `Result<T, E>`.
 *
 * Create discriminated union error types with `errors()`, then match on them
 * exhaustively with `matchError()` or narrow with `isErrorTag()`.
 *
 * @example
 * ```ts
 * const AppError = chas.errors({
 *     NotFound:   (resource: string, id: string) => ({ resource, id }),
 *     Validation: (field: string, message: string) => ({ field, message }),
 * });
 *
 * type AppError = chas.InferErrors<typeof AppError>;
 *
 * const result: chas.Result<User, AppError> = chas.err(AppError.NotFound("user", "123"));
 *
 * chas.matchError(result.unwrapErr(), {
 *     NotFound:   (e) => `${e.resource} ${e.id} not found`,
 *     Validation: (e) => `${e.field}: ${e.message}`,
 * });
 * ```
 */

// ── Types ────────────────────────────────────────────────────────────────
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/** A tagged error object with a `_tag` discriminant field. Extends `Error` for native stack traces. */
export type TaggedError = Error & { readonly _tag: string };

/** Maps tag names to factory functions that produce the error data (without the `_tag` field). */
export type ErrorDefinitions = Record<string, (...args: any[]) => object>;

/** Transforms error definitions into factory functions that produce tagged error objects. */
export type ErrorFactories<T extends ErrorDefinitions> = {
	readonly [K in keyof T & string]: (
		...args: Parameters<T[K]>
	) => Prettify<{ readonly _tag: K } & ReturnType<T[K]>> & Error;
};

/**
 * Extracts the discriminated union type from an `ErrorFactories` object.
 *
 * @example
 * ```ts
 * const AppError = chas.errors({ NotFound: () => ({}) });
 * type AppError = chas.InferErrors<typeof AppError>; // { readonly _tag: "NotFound" }
 * ```
 */
export type InferErrors<T extends ErrorFactories<any>> = {
	[K in keyof T & string]: T[K] extends (...args: any[]) => infer R ? R : never;
}[keyof T & string];

/**
 * The exhaustive handler map for `matchError`. Each key corresponds to a `_tag` variant,
 * and each value is a function that receives the narrowed error and returns a result.
 */
export type MatchErrorHandlers<E extends TaggedError, R> = {
	[K in E['_tag']]: (error: Extract<E, { _tag: K }>) => R;
};

/**
 * The partial handler map for `matchErrorPartial`. Specific `_tag` handlers are optional,
 * but a `_` wildcard handler is required to catch all unhandled variants.
 */
export type MatchErrorPartialHandlers<E extends TaggedError, R> = {
	[K in E['_tag']]?: (error: Extract<E, { _tag: K }>) => R;
} & {
	_: (error: E) => R;
};

// ── Functions ────────────────────────────────────────────────────────────

/**
 * Creates tagged error factory functions from a definition object.
 * Each key becomes a `_tag` discriminant, and the factory function produces
 * an object that extends `Error` with `{ _tag, ...data }`.
 *
 * The returned errors are real `Error` instances with native stack traces,
 * making them compatible with error tracking services and `console.log`.
 * They also support error wrapping via `Error.cause` — if a factory's data
 * includes a `cause` property, it will be set as the native `Error.cause`.
 *
 * @param definitions An object mapping tag names to data factory functions.
 * @returns An object of factory functions that produce tagged error objects.
 *
 * @example
 * ```ts
 * const AppError = chas.errors({
 *     NotFound:     (resource: string, id: string) => ({ resource, id }),
 *     Validation:   (field: string, message: string) => ({ field, message }),
 *     Unauthorized: () => ({}),
 *     Http:         (status: number, cause?: Error) => ({ status, cause }),
 * });
 *
 * AppError.NotFound("user", "123");
 * // → Error instance with { _tag: "NotFound", resource: "user", id: "123", stack: "..." }
 *
 * // Error wrapping with cause chain:
 * AppError.Http(500, AppError.Database("SELECT *"));
 * // → Error with .cause pointing to the Database error
 * ```
 */
export const errors = <T extends ErrorDefinitions>(definitions: T): ErrorFactories<T> => {
	const factories = {} as Record<string, (...args: unknown[]) => TaggedError>;

	for (const tag of Object.keys(definitions)) {
		factories[tag] = (...args: unknown[]) => {
			const data = definitions[tag]!(...args) as Record<string, unknown>;
			const errInstance = new Error(
				`[${tag}]`,
				data['cause'] instanceof Error ? { cause: data['cause'] } : undefined
			);
			Object.assign(errInstance, { _tag: tag, name: tag }, data);
			return errInstance as unknown as TaggedError;
		};
	}

	return factories as unknown as ErrorFactories<T>;
};

/**
 * Exhaustively matches on a tagged error's `_tag` field and executes the corresponding handler.
 * TypeScript will enforce that every variant is handled.
 *
 * @param error The tagged error to match on.
 * @param handlers An object mapping each `_tag` variant to a handler function.
 * @returns The result of the matched handler.
 *
 * @example
 * ```ts
 * const message = chas.matchError(error, {
 *     NotFound:   (e) => `${e.resource} not found`,
 *     Validation: (e) => `Invalid ${e.field}: ${e.message}`,
 * });
 * ```
 */
export const matchError = <
	E extends TaggedError,
	H extends { [K in E['_tag']]: (error: Extract<E, { _tag: K }>) => any },
>(
	error: E,
	handlers: H
): ReturnType<H[keyof H]> => {
	const handler = handlers[error._tag as keyof H] as any;
	return handler(error);
};

/**
 * Partially matches on a tagged error's `_tag` field. Specific tag handlers are optional,
 * but a `_` wildcard handler is required to catch all unhandled variants.
 *
 * Ideal when you only care about a few error types and want a generic fallback for the rest.
 *
 * @param error The tagged error to match on.
 * @param handlers An object with optional tag handlers and a required `_` wildcard.
 * @returns The result of the matched handler.
 *
 * @example
 * ```ts
 * const message = chas.matchErrorPartial(error, {
 *     Validation:   (e) => `Invalid ${e.field}`,
 *     Unauthorized: ()  => `Please log in`,
 *     _: (e) => `Unexpected error: ${e._tag}`,
 * });
 * ```
 */
export const matchErrorPartial = <
	E extends TaggedError,
	H extends { [K in E['_tag']]?: (error: Extract<E, { _tag: K }>) => any } & { _: (error: E) => any },
>(
	error: E,
	handlers: H
): ReturnType<Extract<H[keyof H], (...args: any) => any>> => {
	const handler = handlers[error._tag as keyof H] as any;
	if (handler) return handler(error);
	return handlers._(error);
};

/**
 * Type guard that narrows a tagged error to a specific `_tag` variant.
 *
 * @param error The tagged error to check.
 * @param tag The `_tag` value to narrow to.
 * @returns `true` if the error's `_tag` matches, narrowing the type.
 *
 * @example
 * ```ts
 * if (chas.isErrorTag(error, "NotFound")) {
 *     error.resource; // narrowed to NotFound variant
 * }
 * ```
 */
export const isErrorTag = <E extends TaggedError, Tag extends E['_tag']>(
	error: E,
	tag: Tag
): error is Extract<E, { _tag: Tag }> => {
	return error._tag === tag;
};
