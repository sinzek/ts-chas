import { err, tryCatch, fromPromise, type Result, type ResultAsync } from './result.js';
import type { Prettify } from './utils.js';

/**
 * `TaggedErr` is a `Error` instance with a `_tag` discriminant field. It is an extension of `Error`
 * that can be used with `Result<T, E>` to create a discriminated union of errors. It is also
 * compatible with error tracking services and `console.log`, and can be used with `Error.cause`
 * to wrap other errors.
 */
export type TaggedErr = Error & {
	readonly _tag: string;
	toJSON: () => Record<string, unknown>;
	toString: () => string;
};

/** Maps tag names to factory functions that produce the error data (without the `_tag` field). */
type ErrorDefinitions = Record<string, (...args: any[]) => object>;

/** Helper type to infer the exact union of errors produced by an ErrorDefinitions object */
type InferErrorsFromDef<T extends ErrorDefinitions, B extends Record<string, unknown> = {}> = {
	[K in keyof T & string]: Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr;
}[keyof T & string];

/**
 * Type that represents the factory functions for a set of tagged error definitions.
 */
export type ErrorFactories<T extends ErrorDefinitions, B extends Record<string, unknown> = {}> = {
	readonly [K in keyof T & string]: {
		(...args: Parameters<T[K]>): Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr;
		err: <Val = never>(...args: Parameters<T[K]>) => Result<Val, InferErrorsFromDef<T, B>>;
		is: (err: unknown) => err is Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr;

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
				) => Result<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr>
			: <Val>(
					fn: () => Val,
					onThrow: (error: unknown) => Parameters<T[K]>
				) => Result<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr>;

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
				) => ResultAsync<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr>
			: <Val>(
					fn: () => Promise<Val>,
					onThrow: (error: unknown) => Parameters<T[K]>
				) => ResultAsync<Val, Prettify<{ readonly _tag: K } & ReturnType<T[K]> & B> & TaggedErr>;
	};
};

/**
 * Extracts the discriminated union type from an `ErrorFactories` object.
 *
 * @example
 * ```ts
 * const AppError = chas.defineErrs({ NotFound: () => ({}) });
 * type AppError = chas.InferErrs<typeof AppError>; // { readonly _tag: "NotFound" }
 * ```
 */
export type InferErrs<T extends ErrorFactories<any, any>> = {
	[K in keyof T & string]: T[K] extends (...args: any[]) => infer R ? R : never;
}[keyof T & string];

/**
 * Extracts a specific error variant from a TaggedErr union.
 * @example
 * type NotFound = chas.ExtractErr<AppErr, 'NotFound'>;
 */
export type ExtractErr<Union extends { _tag: string }, Tag extends Union['_tag']> = Extract<Union, { _tag: Tag }>;

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
 * const AppError = chas.defineErrs({
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
export const defineErrs = <T extends ErrorDefinitions, B extends Record<string, unknown> = {}>(
	definitions: T,
	baseProps?: B
): ErrorFactories<T, B> => {
	const factories = {} as Record<string, any>;

	for (const tag of Object.keys(definitions)) {
		const factory = (...args: unknown[]) => {
			const data = definitions[tag]!(...args) as Record<string, unknown>;

			const message =
				typeof data['message'] === 'string'
					? data['message']
					: typeof baseProps?.['message'] === 'string'
						? baseProps['message']
						: `[${tag}]`;

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

			return errInstance as unknown as TaggedErr;
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
 * const message = chas.matchErr(error, {
 *     NotFound:   (e) => `${e.resource} not found`,
 *     Validation: (e) => `Invalid ${e.field}: ${e.message}`,
 * });
 * ```
 */
export const matchErr = <E extends TaggedErr, H extends { [K in E['_tag']]: (error: Extract<E, { _tag: K }>) => any }>(
	error: E,
	handlers: H & { [K in Exclude<keyof H, E['_tag']>]: never }
): ReturnType<H[keyof H]> => {
	const handler = handlers[error._tag as keyof H] as any;
	return handler(error);
};

/**
 * Async version of `matchErr`. Ensures all branches resolve to a single Promise.
 *
 * @param error The tagged error to match on.
 * @param handlers An object mapping each `_tag` variant to a handler function.
 * @returns The result of the matched handler.
 *
 * @example
 * ```ts
 * const message = await chas.matchErrAsync(error, {
 *     NotFound:   async (e) => Promise.resolve(`${e.resource} not found`),
 *     Validation: async (e) => Promise.resolve(`Invalid ${e.field}: ${e.message}`),
 * });
 * ```
 */
export const matchErrAsync = async <
	E extends TaggedErr,
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
 * const message = chas.matchErrPartial(error, {
 *     Validation:   (e) => `Invalid ${e.field}`,
 *     Unauthorized: ()  => `Please log in`,
 *     _: (e) => `Unexpected error: ${e._tag}`,
 * });
 * ```
 */
export const matchErrPartial = <
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
 * Async version of `matchErrPartial`.
 *
 * @param error The tagged error to match on.
 * @param handlers An object with optional tag handlers and a required `_` wildcard.
 * @returns The result of the matched handler.
 *
 * @example
 * ```ts
 * const message = await chas.matchErrPartialAsync(error, {
 *     Validation:   async (e) => Promise.resolve(`Invalid ${e.field}`),
 *     Unauthorized: async () => Promise.resolve(`Please log in`),
 *     _: async (e) => Promise.resolve(`Unexpected error: ${e._tag}`),
 * });
 * ```
 */
export const matchErrPartialAsync = async <
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
 * if (chas.isErrWithTag(error, "NotFound")) {
 *     error.resource; // narrowed to NotFound variant
 * }
 * ```
 */
export const isErrWithTag = <E extends TaggedErr, Tag extends E['_tag']>(
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
export const isAnyErrWithTag = <E extends TaggedErr, Tag extends E['_tag']>(
	error: E,
	tags: readonly Tag[]
): error is Extract<E, { _tag: Tag }> => {
	return tags.includes(error._tag as Tag);
};

/**
 * Also a namespace for Tagged Error utilities, merges with the `TaggedErr` type definition.
 */
export const TaggedErrs = {
	define: defineErrs,
	match: matchErr,
	matchAsync: matchErrAsync,
	matchPartial: matchErrPartial,
	matchPartialAsync: matchErrPartialAsync,
	is: isErrWithTag,
	isAny: isAnyErrWithTag,
};
