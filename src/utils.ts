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
 * Converts a union type to an intersection type.
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

// A utility type that checks if T exhaustively covers all members of U.
type ExhaustiveArray<T extends readonly any[], U> = [U] extends [T[number]] ? T : [...T, Exclude<U, T[number]>];

// A helper function that takes the Union type and returns a function
// to validate the array input.
export const exhaustiveArray =
	<U>() =>
	<T extends readonly U[]>(...t: [...(T extends ExhaustiveArray<T, U> ? T : ExhaustiveArray<T, U>)]) =>
		t as T;
