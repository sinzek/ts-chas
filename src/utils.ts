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
