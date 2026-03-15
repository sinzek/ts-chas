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
