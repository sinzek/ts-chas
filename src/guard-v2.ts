// TODO: guard API v2 (CLAUDE: IGNORE THIS FILE)

// the primary goal of the guard API v2 is to differentiate this API from zod.
// here are some ways to differentiate this API from zod:
// 1. this API will follow the functional programming paradigm more closely than zod.
// 2. it'll include integration with the Result and Option types, tagged errs, and branded types.

/*
 * # structure:
 * A primary `is` object that contains all guard and coercion methods.
 * Every method must return a `Guard<T>` where T is the type of the value after the guard is applied.
 */

import { ok, type Result } from './result.js';
import { GlobalErrs, type InferErr } from './tagged-errs.js';

type GuardErr = InferErr<typeof GlobalErrs.GuardErr>;

type GuardMetaBase = {
	/**
	 * The name of the schema that this guard is a part of. Set automatically when using `defineSchemas`, otherwise undefined by default.
	 */
	schema?: string;
	/**
	 * The name of the guard, used for debugging and error messages.
	 */
	name: string;
	/**
	 * An optional custom error message to use when the guard fails.
	 */
	error?: string;
	/**
	 * The primitive type of the value that the guard expects. (e.g. string, number, boolean, object, array, ...)
	 */
	type: string;
	/**
	 * The path to the value that the guard is checking. (e.g. ["user", "email"] or ["user", "address", "zip"])
	 *
	 * Will be empty for top-level guards.
	 */
	path: string[];

	[key: string]: any;
};

type GuardMeta<T> = GuardMetaBase & {
	/**
	 * Sets optional metadata on the guard.
	 * @param meta The metadata to set. Can be a partial object or a function that takes the current metadata and returns a partial object.
	 */
	(meta: Partial<GuardMeta<T>> | ((currentMeta: GuardMeta<T>) => Partial<GuardMeta<T>>)): Guard<T>;
};

/**
 * A branded type that adds a compile-time tag to a base type.
 * @template Tag The tag to brand the type with.
 * @template Base The base type to brand.
 */
export type Brand<Tag extends string, Base> = Base & { readonly __brand: Tag };

type Guard<T, ChainableMethods extends Record<string, any> = {}> = {
	(value: unknown): value is T;
	meta: GuardMeta<T>;
	/**
	 * Sets a custom error message for the guard.
	 * @param msg The error message to set. Can be a string or a function that takes some optional context and returns a new message.
	 */
	err: (msg: string | ((ctx: { meta: GuardMeta<T> }) => string)) => Guard<T>;

	/**
	 * Brands the guard's output type with a compile-time tag.
	 * @param tag The tag to brand the guard's output type with.
	 */
	brand: <Tag extends string>(tag: Tag) => Guard<Brand<Tag, T>>;

	/**
	 * Parses any value using this guard chain and returns a Result, and allows you to specify the error type.
	 * By default, it will return Err(GuardErr) if the guard fails.
	 */
	parse: (value: unknown, customError?: string | ((ctx: { meta: GuardMeta<T> }) => string)) => Result<T, GuardErr>;
} & ChainableMethods;

function makeGuard<T, ChainableMethods extends Record<string, Guard<T, ChainableMethods>> = {}>(
	fn: (value: unknown) => value is T,
	metadata: Omit<GuardMetaBase, 'schema' | 'path' | 'error'>,
	methods: ChainableMethods
): Guard<T, ChainableMethods> {
	const globalMethods = {
		err: (msg: string | ((ctx: { meta: GuardMeta<T> }) => string)) => {
			const currentMeta = guard.meta;
			const newMeta = typeof msg === 'function' ? msg({ meta: currentMeta }) : msg;
			return Object.assign(guard, { meta: Object.assign(currentMeta, { error: newMeta }) });
		},
		brand: <Tag extends string>(tag: Tag) => {
			return Object.assign(guard, {
				meta: Object.assign(guard.meta, { name: `${guard.meta.name}.brand<${tag}>` }),
			}) as Guard<Brand<Tag, T>>;
		},
		parse: (value: unknown, errMsg?: string | ((ctx: { meta: GuardMeta<T> }) => string)): Result<T, GuardErr> => {
			if (guard(value)) {
				return ok(value);
			} else {
				const message =
					typeof errMsg === 'function' ? errMsg({ meta: guard.meta }) : (errMsg ?? guard.meta.error);
				return GlobalErrs.GuardErr.err({
					message:
						message ??
						`Validation failed: expected ${guard.meta.name}, but got ${typeof value} (${JSON.stringify(value)})`,
					path: guard.meta.path,
					expected: guard.meta.name,
					actual: typeof value,
				});
			}
		},
	};

	const chainableMethods = new Proxy(methods, {
		get: (target, prop) => {
			const method = target[prop as keyof ChainableMethods];
			if (typeof method === 'function') {
				return Object.assign(method, {
					meta: {
						...method.meta,
						path: [...guard.meta.path, ...method.meta.path],
						name: `${guard.meta.name}.${method.meta.name}`,
						schema: guard.meta.schema,
						type: guard.meta.type, // should always be the same as the guard's type
					},
					...globalMethods,
					...methods, // since each chainable method should have the same chainable methods as the guard
				});
			}
			return method;
		},
	});

	const guard: Guard<T, ChainableMethods> = Object.assign((value: unknown) => fn(value), {
		meta: Object.assign(
			(meta: Partial<GuardMeta<T>> | ((currentMeta: GuardMeta<T>) => Partial<GuardMeta<T>>)) => {
				const currentMeta = guard.meta;
				const newMeta = typeof meta === 'function' ? meta(currentMeta) : meta;
				return Object.assign(guard, { meta: Object.assign(currentMeta, newMeta) });
			},
			{
				...metadata,
				path: [], // set by defineSchemas and object guards
			}
		) as unknown as GuardMeta<T>,
		...globalMethods,
		...chainableMethods,
	});

	return guard;
}
