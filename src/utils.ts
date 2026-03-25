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
/**
 * A branded type that adds a compile-time tag to a base type.
 * This is a phantom type w/ no runtime cost.
 *
 * @example
 * ```ts
 * type Email = Brand<"Email", string>;
 * type UserId = Brand<"UserId", string>;
 *
 * // These are incompatible at compile time even though both are strings:
 * declare function sendEmail(to: Email): void;
 * declare const userId: UserId;
 * sendEmail(userId); // Type error
 * ```
 */
export type Brand<Tag extends string, Base> = Base & { readonly __brand: Tag };

/**
 * Creates a branded value from an already-validated value. Use with caution —
 * prefer using branded guards for runtime validation + compile-time safety.
 */
export const unsafeBrand = <Tag extends string, Base>(value: Base): Brand<Tag, Base> => value as Brand<Tag, Base>;

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
