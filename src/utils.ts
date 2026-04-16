/**
 * Represents a value that is not void, undefined, or null.
 */
export type NonVoid<T> = Exclude<T, void | undefined | null>;

/**
 * Helper type to make types more readable.
 */
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Represents a value that may be a promise.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Unwraps a promise type.
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Converts a union type to an intersection type.
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Helper to extract the string tag from either a string or an error factory */
export type CatchTarget = string | { is: (err: any) => err is { readonly _tag: string } };
export type CatchTag<Target> = Target extends string
	? Target
	: Target extends { is: (err: any) => err is { readonly _tag: infer Tag } }
		? Tag
		: never;

export type ExtractErrorFromTarget<Target extends CatchTarget, E> = [E] extends [{ readonly _tag: string }]
	? Extract<E, { _tag: CatchTag<Target> }>
	: Target extends { is: (err: any) => err is infer Guarded }
		? Guarded
		: Error & {
				readonly _tag: CatchTag<Target>;
				toJSON: () => Record<string, unknown>;
				toString: () => string;
			};

/**
 * Type that defines handlers for each tag in an error union E.
 * U defaults to `any` to allow use as a constraint without locking return types.
 */
export type TagHandlers<E, U = any> = {
	[K in Extract<E, { _tag: string }>['_tag']]: (error: Extract<E, { _tag: K }>) => U;
};

/**
 * Type that defines exhaustive handlers for a Result error E.
 *
 * - All tagged variants require a matching tag handler.
 * - An `err` handler is ONLY required when the union contains non-tagged members
 *   (e.g. plain `Error` or other untagged types).
 * - If the union is entirely composed of tagged errors, `err` must not be present.
 * - Extraneous keys (beyond `ok`, tag names, and `err`) are rejected.
 */
export type ResultErrHandlers<E, U = any> = TagHandlers<E, U> &
	([Exclude<E, { _tag: string }>] extends [never]
		? { err?: never }
		: { err: (error: Exclude<E, { _tag: string }>) => U });

/**
 * Type that defines partial tag handlers for a Result error E, with a required wildcard _.
 * Extraneous keys (beyond `ok`, tag names, and `_`) are rejected.
 */
export type ResultPartialErrHandlers<E, U = any> = Partial<TagHandlers<E, U>> & { _: (error: E) => U };

/**
 * Extracts the union of all return types from a handlers object.
 * Handles optional properties gracefully (e.g. `err?: never`).
 */
export type HandlerReturnType<H> = H extends Record<string, ((...args: any) => any) | undefined>
	? ReturnType<Exclude<H[keyof H], undefined>>
	: never;

/**
 * The set of keys allowed in a `matchTag` call for error union E.
 * Any key outside this set is considered extraneous and rejected.
 */
export type AllowedMatchTagKeys<E> = 'ok' | Extract<E, { _tag: string }>['_tag'] | 'err';

/**
 * The set of keys allowed in a `matchTagPartial` call for error union E.
 */
export type AllowedMatchTagPartialKeys<E> = 'ok' | Extract<E, { _tag: string }>['_tag'] | '_';

/**
 * Maps every key in H that is NOT in `Allowed` to `never`.
 * When intersected into a parameter type, this forces TypeScript to reject
 * object literals that contain unexpected properties.
 */
export type NoExtraKeys<H, Allowed extends string | number | symbol> = {
	[K in keyof H as K extends Allowed ? never : K]: never;
};

// A utility type that checks if T exhaustively covers all members of U.
type ExhaustiveArray<T extends readonly any[], U> = [U] extends [T[number]] ? T : [...T, Exclude<U, T[number]>];

// A helper function that takes the Union type and returns a function
// to validate the array input.
export const exhaustiveArray =
	<U>() =>
	<T extends readonly U[]>(...t: [...(T extends ExhaustiveArray<T, U> ? T : ExhaustiveArray<T, U>)]) =>
		t as T;
/**
 * Performs a deep equality check between two values.
 */
export function deepEqual(a: any, b: any): boolean {
	if (a === b) return true;

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
		return a === b;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}

	if (Array.isArray(a) || Array.isArray(b)) {
		return false;
	}

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length) return false;

	for (const key of keysA) {
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
		if (!deepEqual(a[key], b[key])) return false;
	}

	return true;
}

export const isSafeObject = (obj: any): boolean => {
	if (obj && typeof obj === 'object') {
		if ('__proto__' in obj) return false;
		return Object.values(obj).every(isSafeObject);
	}
	return true;
};

export function getObjectDepth(obj: any, depth = 0): number {
	if (obj === null || typeof obj !== 'object') return depth;
	return Math.max(...Object.values(obj).map(v => getObjectDepth(v, depth + 1)));
}

export const safeStringify = (v: any): string => {
	try {
		if (v instanceof RegExp) return v.source;
		return JSON.stringify(v, (_, value) => (typeof value === 'bigint' ? `${value}n` : value));
	} catch {
		return String(v);
	}
};
