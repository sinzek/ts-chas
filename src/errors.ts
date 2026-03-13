/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { err, tryCatch, fromPromise, type Result, type ResultAsync } from './result.js';
import type { Prettify } from './utils.js';

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

/** A tagged error object with a `_tag` discriminant field. Extends `Error` for native stack traces. */
export type TaggedError = Error & {
	readonly _tag: string;
	toJSON: () => Record<string, unknown>;
	toString: () => string;
};

/** Maps tag names to factory functions that produce the error data (without the `_tag` field). */
type ErrorDefinitions = Record<string, (...args: any[]) => object>;

/** Helper type to infer the exact union of errors produced by an ErrorDefinitions object */
type InferErrorsFromDef<T extends ErrorDefinitions, B extends Record<string, unknown> = {}> = {
	[K in keyof T & string]: Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError;
}[keyof T & string];

/** Transforms error definitions into factory functions that produce tagged error objects. */
export type ErrorFactories<T extends ErrorDefinitions, B extends Record<string, unknown> = {}> = {
	readonly [K in keyof T & string]: {
		(...args: Parameters<T[K]>): Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError;
		err: <Val = never>(...args: Parameters<T[K]>) => Result<Val, InferErrorsFromDef<T, B>>;
		is: (err: unknown) => err is Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError;

		/**
		 * Synchronously executes a function and returns the result as an `Ok`.
		 * If the function throws an error, it is caught and returned as an `Err`.
		 * @param fn The function to execute.
		 * @param onThrow A function that takes the thrown error and returns the error arguments.
		 * @returns The result of the function execution.
		 *
		 * @example
		 * ```ts
		 * const result = AppError.NotFound.try(() => {
		 *     mayThrow();
		 *     return { name: 'test', id: 'test' };
		 * }, () => ['user', '123']);
		 * ```
		 */
		try: Parameters<T[K]> extends []
			? <Val>(
					fn: () => Val,
					onThrow?: (error: unknown) => []
				) => Result<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError>
			: <Val>(
					fn: () => Val,
					onThrow: (error: unknown) => Parameters<T[K]>
				) => Result<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError>;

		/**
		 * Asynchronously executes a function and returns the result as an `Ok`.
		 * If the function throws an error, it is caught and returned as an `Err`.
		 * @param fn The function to execute.
		 * @param onThrow A function that takes the thrown error and returns the error arguments.
		 * @returns The result of the function execution.
		 *
		 * @example
		 * ```ts
		 * const result = AppError.NotFound.tryAsync(async () => {
		 *     await mayThrowAsync();
		 *     return { name: 'test', id: 'test' };
		 * }, () => ['user', '123']);
		 * ```
		 */
		tryAsync: Parameters<T[K]> extends []
			? <Val>(
					fn: () => Promise<Val>,
					onThrow?: (error: unknown) => []
				) => ResultAsync<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError>
			: <Val>(
					fn: () => Promise<Val>,
					onThrow: (error: unknown) => Parameters<T[K]>
				) => ResultAsync<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedError>;
	};
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
export type InferErrors<T extends ErrorFactories<any, any>> = {
	[K in keyof T & string]: T[K] extends (...args: any[]) => infer R ? R : never;
}[keyof T & string];

/**
 * Extracts a specific error variant from a TaggedError union.
 * @example
 * type NotFound = chas.ExtractError<AppErr, 'NotFound'>;
 */
export type ExtractError<Union extends { _tag: string }, Tag extends Union['_tag']> = Extract<Union, { _tag: Tag }>;

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
 * an object that extends `Error` with `{ _tag, ...data }`. Optionally accepts
 * a base object of properties to apply to all errors in the union.
 *
 * The returned errors are real `Error` instances with native stack traces,
 * making them compatible with error tracking services and `console.log`.
 * They also support error wrapping via `Error.cause`: if a factory's data
 * includes a `cause` property, it will be set as the native `Error.cause`.
 *
 *
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
 *     Generic:      (message: string) => ({ message }),
 * });
 *
 * AppError.NotFound("user", "123");
 * // → Error instance with { _tag: "NotFound", name: "NotFound", message: "[NotFound]", resource: "user", id: "123", stack: "..." }
 *
 * AppError.Generic("Something went wrong");
 * // → Error instance with { _tag: "Generic", name: "Generic", message: "Something went wrong", stack: "..." }
 *
 * // Error wrapping with cause chain:
 * AppError.Http(500, AppError.Database("SELECT *"));
 * // → Error with .cause pointing to the Database error
 * ```
 */
export const errors = <T extends ErrorDefinitions, B extends Record<string, unknown> = {}>(
	definitions: T,
	baseProps?: B
): ErrorFactories<T, B> => {
	const factories = {} as Record<string, any>;

	for (const tag of Object.keys(definitions)) {
		const factory = (...args: unknown[]) => {
			const data = definitions[tag]!(...args) as Record<string, unknown>;

			// custom message template support (specific data overrides baseProps)
			const message =
				typeof data['message'] === 'string'
					? data['message']
					: typeof baseProps?.['message'] === 'string'
						? baseProps['message']
						: `[${tag}]`;

			// native Error.cause support
			const cause =
				data['cause'] instanceof Error
					? data['cause']
					: baseProps?.['cause'] instanceof Error
						? baseProps['cause']
						: undefined;

			const errInstance = new Error(message, cause ? { cause } : undefined);

			if (typeof Error.captureStackTrace === 'function') {
				Error.captureStackTrace(errInstance, factory);
			}

			const fullData = { ...baseProps, _tag: tag, name: tag, ...data };

			// we put baseProps first, so specific 'data' can override base properties if needed.
			Object.assign(errInstance, fullData);

			Object.defineProperty(errInstance, 'toJSON', {
				value: () => {
					return {
						...errInstance,
						stack: errInstance.stack,
						cause: errInstance.cause,
					};
				},
			});

			Object.defineProperty(errInstance, 'toString', {
				value: () => {
					return `${errInstance.name}: ${errInstance.message}`;
				},
			});

			return errInstance as unknown as TaggedError;
		};

		factory.err = (...args: unknown[]) => {
			return err(factory(...args));
		};

		factory.is = (err: any): err is any => {
			return err && typeof err === 'object' && '_tag' in err && err._tag === tag;
		};

		factory.try = (fn: () => any, onThrow?: (e: unknown) => any[]) => {
			return tryCatch(fn, e => factory(...(onThrow ? onThrow(e) : [])));
		};

		factory.tryAsync = (fn: () => Promise<any>, onThrow?: (e: unknown) => any[]) => {
			return fromPromise(fn(), e => factory(...(onThrow ? onThrow(e) : [])));
		};

		factories[tag] = factory;
	}

	return factories as unknown as ErrorFactories<T, B>;
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
	handlers: H & { [K in Exclude<keyof H, E['_tag']>]: never }
): ReturnType<H[keyof H]> => {
	const handler = handlers[error._tag as keyof H] as any;
	return handler(error);
};

/**
 * Async version of `matchError`. Ensures all branches resolve to a single Promise.
 */
export const matchErrorAsync = async <
	E extends TaggedError,
	H extends { [K in E['_tag']]: (error: Extract<E, { _tag: K }>) => any },
>(
	error: E,
	handlers: H & { [K in Exclude<keyof H, E['_tag']>]: never }
): Promise<Awaited<ReturnType<H[keyof H]>>> => {
	const handler = handlers[error._tag as keyof H] as any;
	return await handler(error);
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
	E,
	H extends {
		[K in Extract<E, { _tag: string }>['_tag']]?: (error: Extract<E, { _tag: K }>) => any;
	} & {
		_: (error: Exclude<E, { _tag: keyof Omit<H, '_'> }>) => any;
	},
>(
	error: E,
	handlers: H
): ReturnType<Extract<H[keyof H], (...args: any) => any>> => {
	const tag = error && typeof error === 'object' && '_tag' in error ? (error as any)._tag : undefined;
	const handler = tag ? (handlers as any)[tag] : undefined;

	if (handler) return handler(error);
	return handlers._(error as any);
};

/**
 * Async version of `matchErrorPartial`.
 */
export const matchErrorPartialAsync = async <
	E,
	H extends {
		[K in Extract<E, { _tag: string }>['_tag']]?: (error: Extract<E, { _tag: K }>) => any;
	} & {
		_: (error: Exclude<E, { _tag: keyof Omit<H, '_'> }>) => any;
	},
>(
	error: E,
	handlers: H
): Promise<Awaited<ReturnType<Extract<H[keyof H], (...args: any) => any>>>> => {
	const tag = error && typeof error === 'object' && '_tag' in error ? (error as any)._tag : undefined;
	const handler = tag ? (handlers as any)[tag] : undefined;

	if (handler) return await handler(error);
	return await handlers._(error as any);
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
 * if (chas.isErrorWithTag(error, "NotFound")) {
 *     error.resource; // narrowed to NotFound variant
 * }
 * ```
 */
export const isErrorWithTag = <E extends TaggedError, Tag extends E['_tag']>(
	error: E,
	tag: Tag
): error is Extract<E, { _tag: Tag }> => {
	return error._tag === tag;
};

/**
 * Type guard that narrows a tagged error to a subset of specific `_tag` variants.
 * * @example
 * ```ts
 * if (chas.isAnyErrorWithTag(error, ["NotFound", "Unauthorized"])) {
 * // error is narrowed to NotFound | Unauthorized
 * }
 * ```
 */
export const isAnyErrorWithTag = <E extends TaggedError, Tag extends E['_tag']>(
	error: E,
	tags: readonly Tag[]
): error is Extract<E, { _tag: Tag }> => {
	return tags.includes(error._tag as Tag);
};
