import { type TaggedErr, type InferErr, GlobalErrs } from './tagged-errs.js';
import type { None, Option, Some } from './option.js';
import { err, ok, ResultAsync, type Err, type Ok, type Result } from './result.js';
import { Task } from './task.js';
import { type UnionToIntersection, deepEqual } from './utils.js';
import type { StandardSchemaV1 } from './standard-schema.js';

/**
 * The error type that is used by default when parsing a guard.
 */
export type GuardErr = InferErr<typeof GlobalErrs.GuardErr>;

/**
 * A guard is a function that returns true if the value is of the specified type (or satisfies a set of conditions) and narrows the type of the value.
 *
 * @example
 * ```ts
 * import { is } from 'chas/guard';
 *
 * // Using a guard to narrow the type of a value
 * const value: unknown = 'hello';
 * if (is.string(value)) {
 *   // value is now typed as string
 * }
 *
 * // Using a guard to validate a form field
 * const email = document.getElementById('email') as HTMLInputElement;
 * if (is.string.email.length(4, 100)(email.value)) {
 *   // email.value is an email string between 4 and 100 characters long
 * }
 *
 * // Using a guard to validate a value and return a Result
 * const result = validate(value, is.string);
 * // result is typed as Result<string, GuardErr>
 *
 * // Using guards to define a schema
 * const schemas = defineSchemas({
 *   User: {
 *     name: is.string,
 *     age: is.number,
 *     email: is.string.email,
 *   },
 * });
 * const result = schemas.User.parse(foo);
 * // result is typed as Result<{ name: string; age: number; email: string }, GuardErr[]>
 * ```
 */
export type Guard<T> = ((value: unknown) => value is T) & {
	/**
	 * @internal Optional metadata for the guard (used by `validate` and other parsing utils).
	 */
	readonly meta?: {
		errorMsg?: string;
		name: string;
		[key: string]: any;
	};
};

/**
 * Extracts the type from a guard.
 */
export type GuardType<T> = T extends Guard<infer U> ? U : never;

/**
 * Identical to a regular Guard but its type parameter is a Brand.
 */
type BrandedGuard<Tag extends string, Base> = Guard<Brand<Tag, Base>> & {
	readonly setErrMsg: (errorMsg: string) => BrandedGuard<Tag, Base>;
	readonly setMeta: (meta: Guard<any>['meta']) => BrandedGuard<Tag, Base>;
	readonly brand: <NewTag extends string>() => BrandedGuard<NewTag, Brand<Tag, Base>>;
};

type CommonHelpers<T> = {
	/**
	 * Sets a custom error message for the guard.
	 * @param errorMsg The error message to set.
	 */
	readonly setErrMsg: (errorMsg: string) => T;
	/**
	 * Sets custom metadata for the guard.
	 * @param meta The metadata to set.
	 */
	readonly setMeta: (meta: Guard<any>['meta']) => T;
	/**
	 * Brands the guard's output type with a compile-time tag. Zero runtime cost.
	 * The returned guard has the same runtime behavior but its type is `Brand<Tag, Base>`.
	 *
	 * @example
	 * ```ts
	 * const Email = is.string.email.brand<"Email">();
	 * // Guard<Brand<"Email", string>>
	 *
	 * const result = validate(input, Email);
	 * // Result<Brand<"Email", string>, GuardErr>
	 * ```
	 */
	readonly brand: <Tag extends string>() => T extends Guard<infer Base> ? BrandedGuard<Tag, Base> : never;
};

interface StringHelpers extends CommonHelpers<ChainableStringGuard> {
	/**
	 * Checks if the string is not empty.
	 */
	readonly nonEmpty: ChainableStringGuard;
	/**
	 * Checks if the string is empty.
	 */
	readonly empty: ChainableStringGuard;
	/**
	 * Checks if the string is a valid email address (RFC 5322).
	 */
	readonly email: ChainableStringGuard;
	/**
	 * Checks if the string is a valid hex color.
	 */
	readonly hexColor: ChainableStringGuard;
	/**
	 * Checks if the string is a valid URL.
	 */
	readonly url: ChainableStringGuard;
	/**
	 * Checks if the string contains only alphanumeric characters.
	 */
	readonly alphanumeric: ChainableStringGuard;
	/**
	 * Checks if the string has a specific length or a length within a range.
	 * @param min The minimum length (or exact length if max is not provided).
	 * @param max The maximum length (optional).
	 */
	readonly length: (min: number, max?: number) => ChainableStringGuard;
	/**
	 * Checks if the string has a length greater than the specified value.
	 * @param n The minimum length.
	 */
	readonly lengthGt: (n: number) => ChainableStringGuard;
	/**
	 * Checks if the string has a length greater than or equal to the specified value.
	 * @param n The minimum length.
	 */
	readonly lengthGte: (n: number) => ChainableStringGuard;
	/**
	 * Checks if the string has a length less than the specified value.
	 * @param n The maximum length.
	 */
	readonly lengthLt: (n: number) => ChainableStringGuard;
	/**
	 * Checks if the string has a length less than or equal to the specified value.
	 * @param n The maximum length.
	 */
	readonly lengthLte: (n: number) => ChainableStringGuard;
	/**
	 * Checks if the string matches the specified regular expression.
	 * @param regex The regular expression to match.
	 */
	readonly regex: (regex: RegExp) => ChainableStringGuard;
	/**
	 * Adds a custom predicate to the string guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: string) => boolean) => ChainableStringGuard;
	/**
	 * Checks if the string is a valid UUID.
	 * @param version The UUID version to check for (v1-v8).
	 */
	readonly uuid: (version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8') => ChainableStringGuard;
	/**
	 * Checks if the string starts with the specified prefix.
	 * @param prefix The prefix to check for.
	 */
	readonly startsWith: (prefix: string) => ChainableStringGuard;
	/**
	 * Checks if the string ends with the specified suffix.
	 * @param suffix The suffix to check for.
	 */
	readonly endsWith: (suffix: string) => ChainableStringGuard;
	/**
	 * Checks if the string includes the specified substring.
	 * @param substring The substring to check for.
	 */
	readonly includes: (substring: string) => ChainableStringGuard;
	/**
	 * Checks if the string includes any of the specified substrings.
	 * @param substrings The substrings to check for.
	 */
	readonly includesAny: (substrings: string[]) => ChainableStringGuard;
	/**
	 * Checks if the string includes all of the specified substrings.
	 * @param substrings The substrings to check for.
	 */
	readonly includesAll: (substrings: string[]) => ChainableStringGuard;
	/**
	 * Checks if the string includes none of the specified substrings.
	 * @param substrings The substrings to check for.
	 */
	readonly includesNone: (substrings: string[]) => ChainableStringGuard;
	/**
	 * Checks if the string includes spaces. If no arguments are provided, it will check for at least one space.
	 * @param minSpaces The minimum number of spaces.
	 * @param maxSpaces The maximum number of spaces.
	 */
	readonly spaces: (minSpaces?: number, maxSpaces?: number) => ChainableStringGuard;
	/**
	 * Checks if the string includes symbols. If no arguments are provided, it will check for at least one symbol.
	 * @param minSymbols The minimum number of symbols.
	 * @param maxSymbols The maximum number of symbols.
	 */
	readonly symbols: (minSymbols?: number, maxSymbols?: number) => ChainableStringGuard;
	/**
	 * Checks if the string includes numbers. If no arguments are provided, it will check for at least one number.
	 * @param minNumbers The minimum number of numbers.
	 * @param maxNumbers The maximum number of numbers.
	 */
	readonly numbers: (minNumbers?: number, maxNumbers?: number) => ChainableStringGuard;
	/**
	 * Checks if the string includes letters. If no arguments are provided, it will check for at least one letter.
	 * @param type The type of letters to check for.
	 * @param minLetters The minimum number of letters.
	 * @param maxLetters The maximum number of letters.
	 */
	readonly letters: (
		type?: 'uppercase' | 'lowercase' | 'mixedcase',
		minLetters?: number,
		maxLetters?: number
	) => ChainableStringGuard;
}

interface NumberHelpers extends CommonHelpers<ChainableNumberGuard> {
	/**
	 * Checks if the number is greater than the specified value.
	 * @param n The value to compare against.
	 */
	readonly gt: (n: number) => ChainableNumberGuard;
	/**
	 * Checks if the number is greater than or equal to the specified value.
	 * @param n The value to compare against.
	 */
	readonly gte: (n: number) => ChainableNumberGuard;
	/**
	 * Checks if the number is less than the specified value.
	 * @param n The value to compare against.
	 */
	readonly lt: (n: number) => ChainableNumberGuard;
	/**
	 * Checks if the number is less than or equal to the specified value.
	 * @param n The value to compare against.
	 */
	readonly lte: (n: number) => ChainableNumberGuard;
	/**
	 * Checks if the number is between the specified values.
	 * @param min The minimum value.
	 * @param max The maximum value.
	 */
	readonly between: (min: number, max: number) => ChainableNumberGuard;
	/**
	 * Checks if the number is positive.
	 */
	readonly positive: ChainableNumberGuard;
	/**
	 * Checks if the number is negative.
	 */
	readonly negative: ChainableNumberGuard;
	/**
	 * Checks if the number is even.
	 */
	readonly even: ChainableNumberGuard;
	/**
	 * Checks if the number is odd.
	 */
	readonly odd: ChainableNumberGuard;
	/**
	 * Checks if the number is an integer.
	 */
	readonly integer: ChainableNumberGuard;
	/**
	 * Checks if the number is a float (not an integer and not NaN)
	 */
	readonly float: ChainableNumberGuard;
	/**
	 * Adds a custom predicate to the number guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: number) => boolean) => ChainableNumberGuard;
}

interface ArrayHelpers<T> extends CommonHelpers<ChainableArrayGuard<T>> {
	/**
	 * Checks if the array has a minimum length.
	 * @param n The minimum length.
	 */
	readonly min: (n: number) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array has a maximum length.
	 * @param n The maximum length.
	 */
	readonly max: (n: number) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array has a specific length.
	 * @param n The length.
	 */
	readonly size: (n: number) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array is not empty.
	 */
	readonly nonEmpty: ChainableArrayGuard<T>;
	/**
	 * Checks if the array is empty.
	 */
	readonly empty: ChainableArrayGuard<T>;
	/**
	 * Checks if the array has unique elements.
	 */
	readonly unique: ChainableArrayGuard<T>;
	/**
	 * Checks if the array includes the specified item.
	 * @param item The item to check for.
	 */
	readonly includes: (item: any) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array excludes the specified item.
	 * @param item The item to check for.
	 */
	readonly excludes: (item: any) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array includes all of the specified items.
	 * @param items The items to check for.
	 */
	readonly includesAll: (items: any[]) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array includes any of the specified items.
	 * @param items The items to check for.
	 */
	readonly includesAny: (items: any[]) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array includes none of the specified items.
	 * @param items The items to check for.
	 */
	readonly includesNone: (items: any[]) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array includes only the specified items.
	 * @param items The items to check for.
	 */
	readonly includesOnly: (items: any[]) => ChainableArrayGuard<T>;
	/**
	 * Adds a custom predicate to the array guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: T[]) => boolean) => ChainableArrayGuard<T>;
	/**
	 * Checks if the array is equal to the specified value (deep comparison).
	 * @param value The value to check against.
	 */
	readonly eq: (value: T[]) => ChainableArrayGuard<T>;
}

interface ObjectHelpers<T extends Record<string, any>> extends CommonHelpers<ChainableObjectGuard<T>> {
	/**
	 * Checks if the object has the specified property.
	 * @param key The property to check for.
	 */
	readonly has: (key: keyof T) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object does not have the specified property.
	 * @param key The property to check for.
	 */
	readonly notHas: (key: keyof T) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object has all of the specified properties.
	 * @param keys The properties to check for.
	 */
	readonly hasAll: (keys: (keyof T)[]) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object has any of the specified properties.
	 * @param keys The properties to check for.
	 */
	readonly hasAny: (keys: (keyof T)[]) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object has none of the specified properties.
	 * @param keys The properties to check for.
	 */
	readonly hasNone: (keys: (keyof T)[]) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object has only the specified properties.
	 * @param keys The properties to check for.
	 */
	readonly hasOnly: (keys: (keyof T)[]) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object is equal to the specified value (deep comparison).
	 * @param value The value to check against.
	 */
	readonly eq: (value: T) => ChainableObjectGuard<T>;
	/**
	 * Adds a custom predicate to the object guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: T) => boolean) => ChainableObjectGuard<T>;
	/**
	 * Checks if the object has only the specified properties (no extra properties allowed)
	 */
	readonly strict: ChainableObjectGuard<T>;
}

interface DateHelpers extends CommonHelpers<ChainableDateGuard> {
	/**
	 * Checks if the date is before the specified date.
	 * @param date The date to compare against.
	 */
	readonly before: (date: Date) => ChainableDateGuard;
	/**
	 * Checks if the date is after the specified date.
	 * @param date The date to compare against.
	 */
	readonly after: (date: Date) => ChainableDateGuard;
	/**
	 * Checks if the date is between the specified dates.
	 * @param min The minimum date.
	 * @param max The maximum date.
	 */
	readonly between: (min: Date, max: Date) => ChainableDateGuard;
	/**
	 * Checks if the date is a weekend (Saturday or Sunday).
	 */
	readonly weekend: ChainableDateGuard;
	/**
	 * Checks if the date is a weekday (Monday through Friday).
	 */
	readonly weekday: ChainableDateGuard;
	/**
	 * Checks if the date is a specific day of the week.
	 * @param day The day of the week to check for.
	 */
	readonly day: (
		day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
	) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific year.
	 * @param year The year to check for.
	 */
	readonly year: (year: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific month (0-indexed: January is 0, December is 11).
	 * @param month The month to check for.
	 */
	readonly month: (month: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific day of the month.
	 * @param day The day of the month to check for.
	 */
	readonly dayOfMonth: (day: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific time.
	 * @param time The time to check for.
	 */
	readonly time: (time: { hour: number; minute: number; second: number }) => ChainableDateGuard;
	/**
	 * Checks if the date has a specific timezone offset.
	 * @param timezoneOffset The timezone offset to check for.
	 */
	readonly timezoneOffset: (timezoneOffset: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific hour.
	 * @param hour The hour to check for.
	 */
	readonly hour: (hour: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific minute.
	 * @param minute The minute to check for.
	 */
	readonly minute: (minute: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific second.
	 * @param second The second to check for.
	 */
	readonly second: (second: number) => ChainableDateGuard;
	/**
	 * Checks if the date is a specific millisecond.
	 * @param millisecond The millisecond to check for.
	 */
	readonly millisecond: (millisecond: number) => ChainableDateGuard;
	/**
	 * Adds a custom predicate to the date guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: Date) => boolean) => ChainableDateGuard;
}

interface BooleanHelpers extends CommonHelpers<ChainableBooleanGuard> {
	/**
	 * Checks if the value is strictly true.
	 */
	readonly true: ChainableBooleanGuard;
	/**
	 * Checks if the value is strictly false.
	 */
	readonly false: ChainableBooleanGuard;
	/**
	 * Adds a custom predicate to the boolean guard.
	 * @param predicate The predicate to check against.
	 */
	readonly where: (predicate: (value: boolean) => boolean) => ChainableBooleanGuard;
}

type ChainableStringGuard = Guard<string> & StringHelpers;
type ChainableNumberGuard = Guard<number> & NumberHelpers;
type ChainableArrayGuard<T> = Guard<T[]> & ArrayHelpers<T>;
type ChainableObjectGuard<T extends Record<string, any>> = Guard<T> & ObjectHelpers<T>;
type ChainableDateGuard = Guard<Date> & DateHelpers;
type ChainableBooleanGuard = Guard<boolean> & BooleanHelpers;

type ArrayFactory = {
	<T>(inner?: Guard<T>): ChainableArrayGuard<T>;
} & ArrayHelpers<any>;

type ObjectFactory = {
	<T extends Record<string, any>>(shape?: { [K in keyof T]: Guard<T[K]> }): ChainableObjectGuard<T>;
} & ObjectHelpers<any>;

type PartialFactory = {
	<T extends Record<string, any>>(shape?: { [K in keyof T]?: Guard<T[K]> }): ChainableObjectGuard<Partial<T>>;
} & ObjectHelpers<Partial<any>>;

type RecordFactory = {
	<K extends string | number | symbol, V>(keyGuard: Guard<K>, valGuard: Guard<V>): ChainableObjectGuard<Record<K, V>>;
} & ObjectHelpers<Record<string | number | symbol, any>>;

/**
 * Helper to identify a factory produced by the errors() utility.
 * It identifies any object/function that has an .is guard.
 * @internal
 */
type ErrorFactory<T = any> = { is: Guard<T> };

/**
 * Creates a chainable guard by wrapping a base guard and attaching helpers.
 * @internal
 */
function makeChainable<T, H extends Record<string, any>>(base: T, helpers: H): T & H {
	// strictly include helper names that are factories
	const factoryHelpers: Record<string, true> = {
		length: true,
		lengthGt: true,
		lengthGte: true,
		lengthLt: true,
		lengthLte: true,
		regex: true,
		where: true,
		uuid: true,
		startsWith: true,
		endsWith: true,
		includes: true,
		includesAny: true,
		includesAll: true,
		includesNone: true,
		includesOnly: true,
		spaces: true,
		symbols: true,
		numbers: true,
		letters: true,
		gt: true,
		gte: true,
		lt: true,
		lte: true,
		between: true,
		min: true,
		max: true,
		size: true,
		excludes: true,
		has: true,
		notHas: true,
		hasAll: true,
		hasAny: true,
		hasNone: true,
		hasOnly: true,
		before: true,
		after: true,
		day: true,
		year: true,
		month: true,
		dayOfMonth: true,
		time: true,
		timezoneOffset: true,
		hour: true,
		minute: true,
		second: true,
		millisecond: true,
		eq: true,
	};

	const createProxy = (target: any, currentHelpers: Record<string, any>): any => {
		return new Proxy(target, {
			apply(target, thisArg, argArray) {
				const result = Reflect.apply(target, thisArg, argArray);
				if (typeof result === 'function') {
					return createProxy(result, currentHelpers);
				}
				return result;
			},
			get(target, prop: string) {
				if (prop === 'setErrMsg') {
					return (errorMsg: string) => {
						const nextGuard = ((v: unknown): v is any => target(v)) as any;
						nextGuard.meta = { ...target.meta, errorMsg };
						return createProxy(nextGuard, currentHelpers);
					};
				}

				if (prop === 'setMeta') {
					return (meta: Record<string, any>) => {
						const nextGuard = ((v: unknown): v is any => target(v)) as any;
						nextGuard.meta = { ...target.meta, ...meta };
						return createProxy(nextGuard, currentHelpers);
					};
				}

				if (prop === 'brand') {
					return () => {
						const nextGuard = ((v: unknown): v is any => target(v)) as any;
						nextGuard.meta = { ...target.meta, name: `${target.meta?.name || 'unknown'}.brand` };
						return createProxy(nextGuard, currentHelpers);
					};
				}

				if (prop === 'strict' && target.meta?.shape) {
					const shape = target.meta.shape;
					const newName = `${target.meta.name || 'unknown'}.strict`;
					const nextGuard = name(
						((v: unknown): v is any => {
							if (!target(v)) return false;
							if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
							return Object.keys(v).every(key => key in shape);
						}) as any,
						newName
					);
					return createProxy(nextGuard, currentHelpers);
				}

				if (prop in currentHelpers) {
					const helper = currentHelpers[prop];

					// spaces on alphanumeric should allow spaces in the base check
					if (prop === 'spaces' && (target as any)._isAlphanumeric) {
						return (...args: any[]) => {
							const nextGuard = helper(...args);
							const newName = `${target.meta?.name || 'unknown'}.${prop}${args.length ? `(${args.join(', ')})` : ''}`;
							return createProxy(
								name(
									((v: unknown): v is any =>
										typeof v === 'string' && /^[a-z0-9\s]*$/i.test(v) && nextGuard(v)) as any,
									newName
								),
								currentHelpers
							);
						};
					}

					if (prop in factoryHelpers) {
						return (...args: any[]) => {
							const nextGuard = helper.apply(target, args);
							const newName = `${target.meta?.name || 'unknown'}.${prop}${args.length ? `(${args.join(', ')})` : ''}`;
							return createProxy(
								name(((v: unknown): v is any => target(v) && nextGuard(v)) as any, newName),
								currentHelpers
							);
						};
					}

					const nextHelpers = { ...currentHelpers, ...helper };
					const newName = `${target.meta?.name || 'unknown'}.${prop}`;
					const nextGuard = name(
						((v: unknown): v is any => target(v) && (helper as Guard<any>)(v)) as any,
						newName
					);
					if (prop === 'alphanumeric') nextGuard._isAlphanumeric = true;
					return createProxy(nextGuard, nextHelpers);
				}

				if (prop in target) return (target as any)[prop];
				return undefined;
			},
		});
	};

	return createProxy(base, helpers);
}

const name = <T extends Guard<any>>(guard: T, name: string, etc?: Record<string, any>): T => {
	const nextGuard = ((v: unknown): v is any => guard(v)) as any;
	nextGuard.meta = { ...guard.meta, name, ...etc };
	nextGuard['~standard'] = {
		version: 1,
		vendor: 'chas',
		validate(value: unknown): StandardSchemaV1.Result<any> {
			if (nextGuard(value)) {
				return { value };
			}
			return {
				issues: [
					{
						message:
							nextGuard.meta?.errorMsg ||
							`Validation failed: expected ${nextGuard.meta?.name || 'unknown'}`,
					},
				],
			};
		},
	};
	return nextGuard;
};

const RGX = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	hex: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
	url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
	alphanumeric: { base: /^[a-z0-9]+$/i },
	symbols: { base: /^[^a-zA-Z0-9]+$/ },
	numbers: { base: /^\d+$/ },
	letters: { uppercase: /^[A-Z]+$/, lowercase: /^[a-z]+$/, mixedcase: /^[a-zA-Z]+$/ },
	uuid: {
		v1: /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v2: /^[0-9a-f]{8}-[0-9a-f]{4}-2[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v3: /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v5: /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v6: /^[0-9a-f]{8}-[0-9a-f]{4}-6[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v7: /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		v8: /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		all: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[8ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	},
};

const objectHelpers = {
	has: <T = any>(key: keyof T) => ((v: any) => key in v) as Guard<T>,
	notHas: <T = any>(key: keyof T) => ((v: any) => !(key in v)) as Guard<T>,
	hasAll: <T = any>(keys: (keyof T)[]) => ((v: any) => keys.every(key => key in v)) as Guard<T>,
	hasAny: <T = any>(keys: (keyof T)[]) => ((v: any) => keys.some(key => key in v)) as Guard<T>,
	hasNone: <T = any>(keys: (keyof T)[]) => ((v: any) => keys.every(key => !(key in v))) as Guard<T>,
	hasOnly: <T = any>(keys: (keyof T)[]) =>
		((v: any) =>
			keys.every(key => key in v) && Object.keys(v).every(key => keys.includes(key as keyof T))) as Guard<T>,
	eq: <T = any>(value: T) => ((v: any) => deepEqual(v, value)) as Guard<T>,
	where: <T = any>(predicate: (v: T) => boolean) =>
		((v: any) => typeof v === 'object' && v !== null && predicate(v)) as Guard<T>,
};

/**
 * @internal
 */
interface TaggedFn {
	/**
	 * Checks if a value is a tagged error using an error factory (e.g., AppError.NotFound)
	 * @param factory The error factory to check for.
	 * @param inne  r An optional guard to check the inner value.
	 * @returns A guard that checks if the value is a tagged error.
	 *
	 * @example
	 * ```ts
	 * if (is.taggedErr(AppError.NotFound)(value)) {
	 *   console.log(value.resource); // value is now typed as TaggedErr & { _tag: 'NotFound' } & (whatever other properties the factory provides)
	 * }
	 * ```
	 */
	<T extends ErrorFactory>(factory: T, inner?: Guard<GuardType<T['is']>>): Guard<GuardType<T['is']>>;
	/**
	 * Checks if a value is a tagged error using a string tag.
	 * @param tag The tag to check for.
	 * @param inner An optional guard to check the inner value.
	 * @returns A guard that checks if the value is a tagged error.
	 *
	 * @example
	 * ```ts
	 * if (is.taggedErr('NotFound')(value)) {
	 *   console.log(value.resource); // value is now typed as TaggedErr & { _tag: 'NotFound' } & (whatever other properties the factory with this tag provides)
	 * }
	 * ```
	 */
	<Tag extends string>(tag: Tag, inner?: Guard<any>): Guard<TaggedErr & { readonly _tag: Tag }>;
}

const implementation = {
	/**
	 * Checks if a value is a string.
	 * @param value The value to check.
	 * @returns True if the value is a string, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = 'hello';
	 * if (is.string(value)) {
	 *   // value is now typed as string
	 * }
	 * ```
	 */
	string: makeChainable(name(((v: unknown) => typeof v === 'string') as Guard<string>, 'string'), {
		nonEmpty: ((v: unknown) => typeof v === 'string' && v.trim().length > 0) as Guard<string>,
		empty: ((v: unknown) => typeof v === 'string' && v.trim().length === 0) as Guard<string>,
		email: ((v: unknown) => typeof v === 'string' && RGX.email.test(v)) as Guard<string>,
		hexColor: ((v: unknown) => typeof v === 'string' && RGX.hex.test(v)) as Guard<string>,
		url: ((v: unknown) => typeof v === 'string' && RGX.url.test(v)) as Guard<string>,
		alphanumeric: Object.assign(
			((v: unknown) => typeof v === 'string' && RGX.alphanumeric.base.test(v)) as Guard<string>,
			{ _isAlphanumeric: true }
		) as any as Guard<string>,
		length: (min: number, max?: number) =>
			((v: unknown) =>
				typeof v === 'string' &&
				(max ? v.length >= min && v.length <= max : v.length === min)) as Guard<string>,
		lengthGt: (n: number) => ((v: unknown) => typeof v === 'string' && v.length > n) as Guard<string>,
		lengthGte: (n: number) => ((v: unknown) => typeof v === 'string' && v.length >= n) as Guard<string>,
		lengthLt: (n: number) => ((v: unknown) => typeof v === 'string' && v.length < n) as Guard<string>,
		lengthLte: (n: number) => ((v: unknown) => typeof v === 'string' && v.length <= n) as Guard<string>,
		regex: (regex: RegExp) => ((v: unknown) => typeof v === 'string' && regex.test(v)) as Guard<string>,
		startsWith: (prefix: string) =>
			((v: unknown) => typeof v === 'string' && v.startsWith(prefix)) as Guard<string>,
		endsWith: (suffix: string) => ((v: unknown) => typeof v === 'string' && v.endsWith(suffix)) as Guard<string>,
		includes: (substring: string) =>
			((v: unknown) => typeof v === 'string' && v.includes(substring)) as Guard<string>,
		includesAny: (substrings: string[]) =>
			((v: unknown) => typeof v === 'string' && substrings.some(s => v.includes(s))) as Guard<string>,
		includesAll: (substrings: string[]) =>
			((v: unknown) => typeof v === 'string' && substrings.every(s => v.includes(s))) as Guard<string>,
		includesNone: (substrings: string[]) =>
			((v: unknown) => typeof v === 'string' && substrings.every(s => !v.includes(s))) as Guard<string>,
		spaces: (minSpaces = 1, maxSpaces = Infinity) =>
			((v: unknown) => {
				if (typeof v !== 'string') return false;
				const count = (v.match(/\s/g) ?? []).length;
				return count >= minSpaces && count <= maxSpaces;
			}) as Guard<string>,
		symbols: (minSymbols = 1, maxSymbols = Infinity) =>
			((v: unknown) => {
				if (typeof v !== 'string') return false;
				const count = (v.match(/[^a-zA-Z0-9\s]/g) ?? []).length;
				return count >= minSymbols && count <= maxSymbols;
			}) as Guard<string>,
		numbers: (minNumbers = 1, maxNumbers = Infinity) =>
			((v: unknown) => {
				if (typeof v !== 'string') return false;
				const count = (v.match(/\d/g) ?? []).length;
				return count >= minNumbers && count <= maxNumbers;
			}) as Guard<string>,
		letters: (
			type: 'uppercase' | 'lowercase' | 'mixedcase' = 'mixedcase',
			minLetters: number = 1,
			maxLetters: number = Infinity
		) =>
			((v: unknown) => {
				if (typeof v !== 'string') return false;
				let count = 0;
				switch (type) {
					case 'uppercase':
						count = (v.match(/[A-Z]/g) ?? []).length;
						break;
					case 'lowercase':
						count = (v.match(/[a-z]/g) ?? []).length;
						break;
					case 'mixedcase':
						count = (v.match(/[A-Za-z]/g) ?? []).length;
						break;
				}
				return count >= minLetters && count <= maxLetters;
			}) as Guard<string>,
		uuid: (version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8') =>
			((v: unknown) =>
				typeof v === 'string' && (version ? RGX.uuid[version].test(v) : RGX.uuid.all.test(v))) as Guard<string>,
		where: (predicate: (v: string) => boolean) => ((v: any) => predicate(v)) as Guard<string>,
	}) as ChainableStringGuard,
	/**
	 * Checks if a value is a number.
	 * @param value The value to check.
	 * @returns True if the value is a number, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = 123;
	 * if (is.number(value)) {
	 *   // value is now typed as number
	 * }
	 * ```
	 */
	number: makeChainable(
		name(((v: unknown) => typeof v === 'number' && Number.isFinite(v)) as Guard<number>, 'number'),
		{
			/** Checks if a value is a number and is greater than a given number. */
			gt: (n: number): Guard<number> => ((v: unknown) => typeof v === 'number' && v > n) as Guard<number>,
			/** Checks if a value is a number and is greater than or equal to a given number. */
			gte: (n: number): Guard<number> => ((v: unknown) => typeof v === 'number' && v >= n) as Guard<number>,
			/** Checks if a value is a number and is less than a given number. */
			lt: (n: number): Guard<number> => ((v: unknown) => typeof v === 'number' && v < n) as Guard<number>,
			/** Checks if a value is a number and is less than or equal to a given number. */
			lte: (n: number): Guard<number> => ((v: unknown) => typeof v === 'number' && v <= n) as Guard<number>,
			/** Checks if a value is a number and is between two given numbers. */
			between: (min: number, max: number): Guard<number> =>
				((v: unknown) => typeof v === 'number' && v >= min && v <= max) as Guard<number>,
			/** Checks if a value is a positive number. */
			positive: ((v: unknown) => typeof v === 'number' && v > 0) as Guard<number>,
			/** Checks if a value is a negative number. */
			negative: ((v: unknown) => typeof v === 'number' && v < 0) as Guard<number>,
			/** Checks if a value is an even number. */
			even: ((v: unknown) => typeof v === 'number' && v % 2 === 0) as Guard<number>,
			/** Checks if a value is an odd number. */
			odd: ((v: unknown) => typeof v === 'number' && v % 2 !== 0) as Guard<number>,
			/** Checks if a value is an integer. */
			integer: ((v: unknown) => typeof v === 'number' && Number.isInteger(v)) as Guard<number>,
			/** Checks if a value is a float. */
			float: ((v: unknown) => typeof v === 'number' && !Number.isInteger(v) && !Number.isNaN(v)) as Guard<number>,
			where: (predicate: (v: number) => boolean) => ((v: any) => predicate(v)) as Guard<number>,
		}
	) as ChainableNumberGuard,
	/**
	 * Checks if a value is a boolean.
	 * @param value The value to check.
	 * @returns True if the value is a boolean, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = true;
	 * if (is.boolean(value)) {
	 *   // value is now typed as boolean
	 * }
	 * ```
	 */
	boolean: makeChainable(name(((v: unknown) => typeof v === 'boolean') as Guard<boolean>, 'boolean'), {
		true: ((v: unknown) => v === true) as Guard<boolean>,
		false: ((v: unknown) => v === false) as Guard<boolean>,
		where: (predicate: (v: boolean) => boolean) =>
			((v: unknown) => typeof v === 'boolean' && predicate(v)) as Guard<boolean>,
	}) as ChainableBooleanGuard,
	/**
	 * Checks if a value is a symbol.
	 * @param value The value to check.
	 * @returns True if the value is a symbol, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = Symbol('test');
	 * if (is.symbol(value)) {
	 *   // value is now typed as symbol
	 * }
	 * ```
	 */
	symbol: name((v => typeof v === 'symbol') as Guard<symbol>, 'symbol'),
	/**
	 * Checks if a value is a bigint.
	 * @param value The value to check.
	 * @returns True if the value is a bigint, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = 123n;
	 * if (is.bigint(value)) {
	 *   // value is now typed as bigint
	 * }
	 * ```
	 */
	bigint: name((v => typeof v === 'bigint') as Guard<bigint>, 'bigint'),
	/**
	 * Checks if a value is undefined.
	 * @param value The value to check.
	 * @returns True if the value is undefined, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = undefined;
	 * if (is.undefined(value)) {
	 *   // value is now typed as undefined
	 * }
	 * ```
	 */
	undefined: name((v => v === undefined) as Guard<undefined>, 'undefined'),
	/**
	 * Checks if a value is null.
	 * @param value The value to check.
	 * @returns True if the value is null, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = null;
	 * if (is.null(value)) {
	 *   // value is now typed as null
	 * }
	 * ```
	 */
	null: name((v => v === null) as Guard<null>, 'null'),
	/**
	 * Checks if a value is null or undefined.
	 * @param value The value to check.
	 * @returns True if the value is null or undefined, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = null;
	 * if (is.nil(value)) {
	 *   // value is now typed as null | undefined
	 * }
	 * ```
	 */
	nil: name((v => v == null) as Guard<null | undefined>, 'nil'),
	/**
	 * Checks if a value is null or passes the inner guard.
	 * @param inner The guard to check.
	 * @returns True if the value is null or passes the inner guard, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = null;
	 * if (is.nullable(value)) {
	 *   // value is now typed as null | undefined
	 * }
	 * ```
	 */
	nullable: <T>(inner: Guard<T>) =>
		name((v => v === null || inner(v)) as Guard<T | null>, `nullable<${inner.meta?.name || 'unknown'}>`),
	/**
	 * Checks if a value is undefined or passes the inner guard.
	 * @param inner The guard to check.
	 * @returns True if the value is undefined or passes the inner guard, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = undefined;
	 * if (is.optional(value)) {
	 *   // value is now typed as undefined
	 * }
	 * ```
	 */
	optional: <T>(inner: Guard<T>) =>
		name((v => v === undefined || inner(v)) as Guard<T | undefined>, `optional<${inner.meta?.name || 'unknown'}>`),
	/**
	 * Checks if a value is a function.
	 * @param value The value to check.
	 * @returns True if the value is a function, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a value
	 * const value: unknown = () => {};
	 * if (is.function(value)) {
	 *   // value is now typed as Function
	 * }
	 * ```
	 */
	function: name((v => typeof v === 'function') as Guard<Function>, 'function'),

	/**
	 * Checks if a value is an array.
	 * @param value The value to check.
	 * @returns True if the value is an array, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = [1, 2, 3];
	 * if (is.array()(value)) {
	 *   // value is now typed as any[]
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the inner type of an array
	 * const value: unknown = [1, 2, 3];
	 * if (is.array(is.number)(value)) {
	 *   // value is now typed as number[]
	 * }
	 * ```
	 */
	array: makeChainable(
		(<T>(inner?: Guard<T>) =>
			name(
				(v => Array.isArray(v) && (!inner || v.every(inner))) as Guard<T[]>,
				`array<${inner?.meta?.name || 'any'}>`
			)) as <T>(inner?: Guard<T>) => ChainableArrayGuard<T>,
		{
			/** Checks if value is an array and has a minimum length. */
			min: (n: number) => ((v: any[]) => Array.isArray(v) && v.length >= n) as Guard<any[]>,
			/** Checks if value is an array and has a maximum length. */
			max: (n: number) => ((v: any[]) => Array.isArray(v) && v.length <= n) as Guard<any[]>,
			/** Checks if value is an array and has a specific length. */
			size: (n: number) => ((v: any[]) => Array.isArray(v) && v.length === n) as Guard<any[]>,
			/** Checks if value is an array and is not empty. */
			nonEmpty: ((v: any[]) => Array.isArray(v) && v.length > 0) as Guard<any[]>,
			/** Checks if value is an array and is empty. */
			empty: ((v: any[]) => Array.isArray(v) && v.length === 0) as Guard<any[]>,
			/** Checks if value is an array and contains only unique values. */
			unique: ((v: any[]) => Array.isArray(v) && new Set(v).size === v.length) as Guard<any[]>,
			/** Checks if value is an array and includes a specific item. */
			includes: (item: any) => ((arr: any[]) => Array.isArray(arr) && arr.includes(item)) as Guard<any[]>,
			/** Checks if value is an array and excludes a specific item. */
			excludes: (item: any) => ((arr: any[]) => Array.isArray(arr) && !arr.includes(item)) as Guard<any[]>,
			/** Checks if value is an array and includes all specified items. */
			includesAll: (items: any[]) =>
				((arr: any[]) => Array.isArray(arr) && items.every(item => arr.includes(item))) as Guard<any[]>,
			/** Checks if value is an array and includes any of the specified items. */
			includesAny: (items: any[]) =>
				((arr: any[]) => Array.isArray(arr) && items.some(item => arr.includes(item))) as Guard<any[]>,
			/** Checks if value is an array and includes none of the specified items. */
			includesNone: (items: any[]) =>
				((arr: any[]) => Array.isArray(arr) && items.every(item => !arr.includes(item))) as Guard<any[]>,
			/** Checks if value is an array and includes only the specified items. */
			includesOnly: (items: any[]) =>
				((arr: any[]) => {
					if (!Array.isArray(arr)) return false;
					if (arr.length !== new Set(arr).size) return false;
					const itemSet = new Set(items);
					const arrSet = new Set(arr);
					if (itemSet.size !== arrSet.size) return false;
					for (const i of arrSet) if (!itemSet.has(i)) return false;
					return true;
				}) as Guard<any[]>,
			eq: (value: any[]) => ((arr: any[]) => deepEqual(arr, value)) as Guard<any[]>,
			where: (predicate: (v: any[]) => boolean) => ((v: any) => predicate(v)) as Guard<any[]>,
		}
	) as ArrayFactory,
	/**
	 * Checks if a value is an object.
	 * @param value The value to check.
	 * @returns True if the value is an object, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.object()(value)) {
	 *   // value is now typed as object
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of an object
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.object({ a: is.number, b: is.number })(value)) {
	 *   // value is now typed as { a: number, b: number }
	 * }
	 * ```
	 */
	object: makeChainable(
		<T extends Record<string, any>>(shape?: { [K in keyof T]: Guard<T[K]> }) =>
			name(
				(v => {
					if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
					if (!shape) return true;
					return Object.entries(shape).every(([k, g]) => (g as any)((v as any)[k]));
				}) as Guard<T>,
				`object<${shape ? Object.keys(shape).join(', ') : 'any'}>`,
				{
					shape,
				}
			) as ChainableObjectGuard<T>,
		objectHelpers
	) as ObjectFactory,
	/**
	 * Checks if a value is a partial object.
	 * @param value The value to check.
	 * @returns True if the value is a partial object, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.partial()(value)) {
	 *   // value is now typed as Partial<Record<string, unknown>>
	 * }
	 * ```
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * // Using a guard to narrow the type of a partial object
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.partial({ a: is.number, b: is.number })(value)) {
	 *   // value is now typed as { a: number, b: number }
	 * }
	 * ```
	 */
	partial: makeChainable(
		<T extends Record<string, any>>(shape: { [K in keyof T]: Guard<T[K]> }): Guard<Partial<T>> =>
			name(
				(v => {
					if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
					return Object.entries(shape).every(
						([k, g]) => (v as any)[k] === undefined || (g as any)((v as any)[k])
					);
				}) as Guard<Partial<T>>,
				`partial<${Object.keys(shape).join(', ')}>`
			),
		objectHelpers
	) as PartialFactory,
	/**
	 * Checks if a value is a record.
	 * @param value The value to check.
	 * @returns True if the value is a record, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { a: 1, b: 2 };
	 * if (is.record(is.string, is.number)(value)) {
	 *   // value is now typed as Record<string, number>
	 * }
	 * ```
	 */
	record: makeChainable(
		<K extends string | number | symbol, V>(keyGuard: Guard<K>, valGuard: Guard<V>): Guard<Record<K, V>> =>
			name(
				(v => {
					if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
					return Object.entries(v).every(([k, val]) => keyGuard(k) && valGuard(val));
				}) as Guard<Record<K, V>>,
				`record<${keyGuard.meta?.name || 'unknown'}, ${valGuard.meta?.name || 'unknown'}>`
			),
		objectHelpers
	) as RecordFactory,
	/**
	 * Checks if a value is a tuple.
	 * @param value The value to check.
	 * @returns True if the value is a tuple, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = [1, 2, 3];
	 * if (is.tuple(is.number, is.number, is.number)(value)) {
	 *   // value is now typed as [number, number, number]
	 * }
	 * ```
	 */
	tuple: <T extends any[]>(...guards: { [K in keyof T]: Guard<T[K]> }): Guard<T> =>
		name(
			(v => {
				if (!Array.isArray(v) || v.length !== guards.length) return false;
				return v.every((val, idx) => (guards[idx] as any)(val));
			}) as Guard<T>,
			`tuple<${guards.map(g => g.meta?.name || 'unknown').join(', ')}>`
		),
	/**
	 * Checks if a value satisfies one or more of the specified guards.
	 * @param value The value to check.
	 * @returns True if the value satisfies one of the specified guards, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 1;
	 * if (is.anyOf(is.string, is.number)(value)) {
	 *   // value is now typed as string | number
	 * }
	 * ```
	 */
	anyOf: <T extends Guard<any>[]>(...guards: T): Guard<GuardType<T[number]>> =>
		name(
			(v: unknown): v is GuardType<T[number]> => guards.some(g => g(v)),
			`anyOf<${guards.map(g => g.meta?.name || 'unknown').join(', ')}>`
		) as any,
	/**
	 * Checks if a value satisfies all of the specified guards.
	 * @param value The value to check.
	 * @returns True if the value satisfies all of the specified guards, false otherwise.
	 *
	 * Note: The narrowed type will collapse to `never` if the guards are not compatible.
	 * `is.allOf(is.string, is.number)` will result in `never`.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, world: 'world' };
	 * if (is.allOf(is.object({ ok: is.boolean }), is.literal('hello'))(value)) {
	 *   // value is now typed as { ok: boolean } & 'hello'
	 * }
	 * ```
	 */
	allOf: <T extends Guard<any>[]>(...guards: T): Guard<UnionToIntersection<GuardType<T[number]>>> =>
		name(
			(v: unknown): v is UnionToIntersection<GuardType<T[number]>> => guards.every(g => g(v)),
			`allOf<${guards.map(g => g.meta?.name || 'unknown').join(', ')}>`
		) as any,
	/**
	 * Checks if a value is a date.
	 * @param value The value to check.
	 * @returns True if the value is a date, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = new Date();
	 * if (is.date(value)) {
	 *   // value is now typed as Date
	 * }
	 * ```
	 */
	date: makeChainable(
		name((v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime()), 'date'),
		{
			before: (date: Date) => ((v: unknown) => v instanceof Date && v < date) as Guard<Date>,
			after: (date: Date) => ((v: unknown) => v instanceof Date && v > date) as Guard<Date>,
			between: (min: Date, max: Date) =>
				((v: unknown) => v instanceof Date && v >= min && v <= max) as Guard<Date>,
			weekend: ((v: unknown) => v instanceof Date && (v.getDay() === 0 || v.getDay() === 6)) as Guard<Date>,
			weekday: ((v: unknown) => v instanceof Date && v.getDay() !== 0 && v.getDay() !== 6) as Guard<Date>,
			day: (day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday') => {
				const days = {
					sunday: 0,
					monday: 1,
					tuesday: 2,
					wednesday: 3,
					thursday: 4,
					friday: 5,
					saturday: 6,
				};
				return ((v: unknown) => v instanceof Date && v.getDay() === days[day]) as Guard<Date>;
			},
			year: (year: number) => ((v: unknown) => v instanceof Date && v.getFullYear() === year) as Guard<Date>,
			month: (month: number) => ((v: unknown) => v instanceof Date && v.getMonth() === month) as Guard<Date>,
			dayOfMonth: (day: number) => ((v: unknown) => v instanceof Date && v.getDate() === day) as Guard<Date>,
			time: (time: { hour: number; minute: number; second: number }) =>
				((v: unknown) =>
					v instanceof Date &&
					v.getHours() === time.hour &&
					v.getMinutes() === time.minute &&
					v.getSeconds() === time.second) as Guard<Date>,
			timezoneOffset: (timezoneOffset: number) =>
				((v: unknown) => v instanceof Date && v.getTimezoneOffset() === timezoneOffset) as Guard<Date>,
			hour: (hour: number) => ((v: unknown) => v instanceof Date && v.getHours() === hour) as Guard<Date>,
			minute: (minute: number) => ((v: unknown) => v instanceof Date && v.getMinutes() === minute) as Guard<Date>,
			second: (second: number) => ((v: unknown) => v instanceof Date && v.getSeconds() === second) as Guard<Date>,
			millisecond: (millisecond: number) =>
				((v: unknown) => v instanceof Date && v.getMilliseconds() === millisecond) as Guard<Date>,
			where: (predicate: (v: Date) => boolean) =>
				((v: unknown) => v instanceof Date && predicate(v)) as Guard<Date>,
		}
	) as ChainableDateGuard,
	/**
	 * Checks if a value is an Ok result.
	 * @param value The value to check.
	 * @returns True if the value is an Ok result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.ok(is.number)(value)) {
	 *   // value is now typed as Ok<number> (i.e. { ok: true, value: number, ...methods })
	 * }
	 * ```
	 */
	ok: <T = any>(inner?: Guard<T>): Guard<Ok<T>> =>
		name(
			(v: any): v is Ok<T> => !!v && v.ok === true && (!inner || inner(v.value)),
			`Ok<${inner?.meta?.name || 'unknown'}>`
		),

	/**
	 * Checks if a value is an Err result.
	 * @param value The value to check.
	 * @returns True if the value is an Err result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: false, error: 'error' };
	 * if (is.err(is.string)(value)) {
	 *   // value is now typed as Err<string> (i.e. { ok: false, error: string, ...methods })
	 * }
	 * ```
	 */
	err: <E = any>(inner?: Guard<E>): Guard<Err<E>> =>
		name(
			(v: any): v is Err<E> => !!v && v.ok === false && (!inner || inner(v.error)),
			`Err<${inner?.meta?.name || 'unknown'}>`
		),

	/**
	 * Checks if a value is a Result.
	 * @param value The value to check.
	 * @returns True if the value is a Result, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.result(is.string, is.number)(value)) {
	 *   // value is now typed as Result<number, string> (i.e. { ok: true, value: number, ...methods } | { ok: false, error: string, ...methods })
	 * }
	 * ```
	 */
	result: makeChainable(
		<T, E>(okG?: Guard<T>, errG?: Guard<E>): Guard<Result<T, E>> =>
			name(
				((v: unknown) => is.ok(okG)(v) || is.err(errG)(v)) as Guard<Result<T, E>>,
				`Result<${okG?.meta?.name || 'never'}, ${errG?.meta?.name || 'never'}>`
			),
		{
			ok: <T = any>(inner?: Guard<T>) => is.ok(inner),
			err: <E = any>(inner?: Guard<E>) => is.err(inner),
		}
	),

	/**
	 * Checks if a value is a Some.
	 * @param value The value to check.
	 * @returns True if the value is a Some, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.some(is.number)(value)) {
	 *   // value is now typed as Some<number> (i.e. { ok: true, value: number, ...methods })
	 * }
	 * ```
	 */
	some: <T = any>(inner?: Guard<T>): Guard<Some<T>> =>
		name(
			(v: any): v is Some<T> => is.ok()(v) && v.value != null && (!inner || inner(v.value)),
			`Some<${inner?.meta?.name || 'unknown'}>`
		),

	/**
	 * Checks if a value is a None.
	 * @param value The value to check.
	 * @returns True if the value is a None, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: false, error: undefined };
	 * if (is.none()(value)) {
	 *   // value is now typed as None (i.e. { ok: false, error: undefined, ...methods })
	 * }
	 * ```
	 */
	none: (): Guard<None> => name((v: any): v is None => is.err()(v) && v.error === undefined, 'None'),

	/**
	 * Checks if a value is an Option.
	 * @param value The value to check.
	 * @returns True if the value is an Option, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = { ok: true, value: 1 };
	 * if (is.option(is.number)(value)) {
	 *   // value is now typed as Option<number> (i.e. { ok: true, value: number, ...methods } | { ok: false, error: undefined, ...methods })
	 * }
	 * ```
	 */
	option: makeChainable(
		<T>(inner?: Guard<T>): Guard<Option<T>> =>
			name(
				((v: unknown) => is.some(inner)(v) || is.none()(v)) as Guard<Option<T>>,
				`Option<${inner?.meta?.name || 'unknown'}>`
			),
		{
			some: <T = any>(inner?: Guard<T>) => is.some(inner),
			none: () => is.none(),
		}
	),

	/**
	 * Checks if a value is a tagged error using a tag or error factory.
	 * @param value The value to check.
	 * @returns True if the value is a tagged error, false otherwise.
	 *
	 * @example Using a string tag
	 * ```ts
	 * import { is } from 'chas/guard';
	 * const value: unknown = { _tag: 'UserError', message: 'error' };
	 * if (is.taggedErr('UserError')(value)) {
	 *   // value is now typed as { _tag: 'UserError', message: string, ...methods }
	 * }
	 * ```
	 *
	 * @example Using an error factory
	 * ```ts
	 * import { is } from 'chas/guard';
	 * const value: unknown = { _tag: 'UserError', message: 'error' };
	 * if (is.taggedErr(AppError.NotFound)(value)) {
	 *   // value is now typed as { _tag: 'UserError', message: string, ...methods }
	 * }
	 * ```
	 */
	taggedErr: (tagOrFactory: string | ErrorFactory, inner?: Guard<any>): Guard<any> => {
		return name(
			(v: any): v is any => {
				if (typeof tagOrFactory !== 'string' && 'is' in tagOrFactory) {
					return tagOrFactory.is(v) && (!inner || inner(v));
				}
				const matchesTag = !!v && typeof v === 'object' && v._tag === tagOrFactory;
				return matchesTag && (!inner || inner(v));
			},
			`taggedErr (${typeof tagOrFactory === 'string' ? tagOrFactory : 'factory'})`
		);
	},

	/**
	 * Checks if a value is not a specific type.
	 * @param value The value to check.
	 * @returns True if the value is not a specific type, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 1;
	 * if (is.not(is.string)(value)) {
	 *   // value is not a string
	 * }
	 * ```
	 */
	not: <T, U = any>(guard: Guard<T>): Guard<Exclude<U, T>> =>
		name((v: unknown): v is Exclude<U, T> => !guard(v), `not (${guard.meta?.name || 'unknown'})`),

	/**
	 * Checks if a value matches a schema.
	 * @param schema The schema to check against, must have a safeParse or parse method (e.g. Zod schema or custom schema from chas.defineSchemas).
	 * @returns True if the value matches the schema, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is, defineSchemas } from 'chas/guard';
	 * import { z } from 'zod';
	 *
	 * const schema = z.object({ name: z.string(), age: z.number() });
	 * const value: unknown = { name: 'John', age: 30 };
	 *
	 * if (is.schema(schema)(value)) {
	 *   // value is now typed as { name: string, age: number }
	 * }
	 *
	 * const schemas = defineSchemas({
	 *   User: {
	 *     name: is.string,
	 *     age: is.number,
	 *   },
	 * });
	 *
	 * const value: unknown = { name: 'John', age: 30 };
	 * if (is.schema(schemas.User)(value)) {
	 *   // value is now typed as { name: string, age: number }
	 * }
	 * ```
	 */
	schema: <T>(s: { safeParse?: (v: unknown) => any; parse?: (v: unknown) => any }): Guard<T> =>
		name(
			(v => {
				if (typeof s.safeParse === 'function') {
					return !!s.safeParse(v).success;
				}
				if (typeof s.parse === 'function') {
					try {
						s.parse(v);
						return true;
					} catch {
						return false;
					}
				}
				return false;
			}) as Guard<T>,
			`schema (${s.constructor.name || 'unknown'})`
		),

	/**
	 * Checks if a value is a literal or union of literals.
	 * @param values The value(s) to check.
	 * @returns True if the value is one of the provided values, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 'hello';
	 * if (is.literal('hello')(value)) {
	 *   // value is now typed as 'hello'
	 * }
	 * ```
	 */
	literal: <T extends readonly (string | number | boolean | bigint)[]>(...values: T): Guard<T[number]> =>
		name(
			(v: unknown): v is T[number] => values.includes(v as T[number]),
			`literal (${values.map(v => JSON.stringify(v)).join(' | ')})`
		),

	/**
	 * Checks if a value is a union of types
	 * @param value The value to check.
	 * @returns True if the value is a union of literals, false otherwise.
	 *
	 * @example
	 * ```ts
	 * import { is } from 'chas/guard';
	 *
	 * const value: unknown = 'hello';
	 * if (is.union('hello', 'world')(value)) {
	 *   // value is now typed as 'hello' | 'world'
	 * }
	 * ```
	 */
	union: <T extends readonly Guard<unknown>[]>(...values: T): T[number] =>
		name(
			(v: unknown): v is T[number] => values.some(g => g(v)),
			`union (${values.map(g => g.meta?.name || 'unknown').join(' | ')})`
		),
};

/**
 * The IsApi type represents the full API of the guard module.
 * It is a generic type that can be extended with additional guards.
 *
 * @template Ext - An object containing sub-namespaces of guards to extend the API.
 *
 * @example Extending the API with a new sub-namespace
 * ```ts
 * import { is } from 'chas/guard';
 *
 * const myIs = is.extend('app', {
 *   validUser: (v: unknown): v is User => is.object({ id: is.string })(v),
 * });
 *
 * if (myIs.app.validUser(data)) {
 *   // value is now typed as User
 * }
 * ```
 */
export type IsApi<Ext = {}> = Omit<typeof implementation, 'taggedErr' | 'string' | 'number' | 'array'> & {
	readonly string: ChainableStringGuard;
	readonly number: ChainableNumberGuard;
	readonly array: ArrayFactory;
	readonly taggedErr: TaggedFn;
	/**
	 * Extends the guard API with a new sub-namespace.
	 * @param namespace The name of the sub-namespace (e.g. 'app').
	 * @param guards An object containing the new guards.
	 * @returns A new IsApi instance that includes the extended guards.
	 *
	 * @example
	 * ```ts
	 * const myIs = is.extend('app', {
	 *   validUser: (v: unknown): v is User => is.object({ id: is.string })(v),
	 * });
	 *
	 * if (myIs.app.validUser(data)) { ... }
	 * ```
	 */
	readonly extend: <N extends string, G extends Record<string, any>>(
		namespace: N,
		guards: G
	) => IsApi<Ext & { readonly [K in N]: G }>;
} & Ext & {
		readonly [K in keyof typeof implementation]: (typeof implementation)[K] & {
			/**
			 * Adds a custom guard to the chain that satisfies the predicate (simply passes the type through the chain).
			 * @param predicate The predicate to check against.
			 * @returns A new guard that includes the custom guard.
			 */
			where: (
				predicate: (value: GuardType<(typeof implementation)[K]>) => boolean
			) => Guard<GuardType<(typeof implementation)[K]>>;
		};
	};

/**
 * Creates an IsApi instance.
 * @internal
 */
function createIs<E extends Record<string, any> = {}>(base: any, extensions: E = {} as E): IsApi<E> {
	const guardsWithUniversalChain: any = Object.fromEntries(
		Object.entries(base).map(([key, value]) => {
			if (typeof value === 'function') {
				return [
					key,
					Object.assign(value, {
						where: (predicate: (v: any) => boolean): Guard<any> => {
							const originalGuard = value;
							return ((input: any): input is any =>
								originalGuard(input) && predicate(input)) as Guard<any>;
						},
					}),
				];
			}
			return [key, value];
		})
	);

	const instance = Object.assign(
		/** Instance Check: is(value, Date) */
		<T>(value: unknown, ctor: abstract new (...args: any[]) => T): value is T => value instanceof ctor,
		guardsWithUniversalChain
	);

	instance.extend = <N extends string, G extends Record<string, any>>(namespace: N, guards: G) => {
		return createIs(base, { ...extensions, [namespace]: guards });
	};

	return new Proxy(instance, {
		get(target, prop: string) {
			if (prop in target) return target[prop];
			if (prop in extensions) return (extensions as any)[prop];
			return undefined;
		},
	}) as IsApi<E>;
}

/**
 * Type guard utilities for type narrowing and data validation. Includes a chainable API for common guards.
 *
 *
 * All chained guards are combined with logical AND and short-circuit on failure.
 *
 * @example
 * ```ts
 * import { is } from 'chas/guard';
 *
 * if (is(value, Error)) {
 *   console.log(value.message); // value is now typed as Error
 * }
 *
 * if (is.ok(is.string)(value)) {
 *   console.log(value.value); // value is now typed as Ok<string>
 * }
 *
 * if (is.result(is.number, is.string)(value)) {
 *   console.log(value.value); // value is now typed as Result<number, string>
 * }
 *
 * if (is.tagged('UserError')(value)) {
 *   console.log(value.name); // value is now typed as TaggedErr with _tag: 'UserError'
 * }
 * ```
 */
export const is = createIs(implementation);

/**
 * Asserts that a value matches a guard, or throws.
 *
 * @example
 * ```ts
 * assert(value, is.string, 'Value must be a string');
 * ```
 */
export function assert<T>(value: unknown, guard: Guard<T>, message?: string): asserts value is T {
	if (!guard(value)) {
		throw GlobalErrs.GuardErr({
			message: message ?? guard.meta?.errorMsg ?? `Value failed type assertion`,
			expected: guard.meta?.name ?? 'unknown',
			path: [],
			actual: typeof value,
		});
	}
}

/**
 * "Ensures" a value matches a guard and returns it, typed.
 *
 * @example
 * ```ts
 * const value = ensure(value, is.string, 'Value must be a string');
 * ```
 */
export function ensure<T>(value: unknown, guard: Guard<T>, message?: string): T {
	assert(value, guard, message);
	return value;
}

/**
 * Uses a guard to validate a value, returning a Result. If the guard fails, it will return the error provided, or a `GuardErr`.
 *
 * @example
 * ```ts
 * const result = validate(value, is.string, 'Value must be a string');
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function validate<T, E = null>(
	value: unknown,
	guard: Guard<T>,
	error?: E
): Result<T, E extends null | undefined ? GuardErr : E> {
	return guard(value)
		? ok(value)
		: (err(
				error ||
					GlobalErrs.GuardErr({
						message:
							guard.meta?.errorMsg ||
							`Value failed validation: expected ${guard.meta?.name}, but got ${typeof value} (${JSON.stringify(value)})`,
						expected: guard.meta?.name || 'unknown',
						path: [],
						actual: typeof value,
					})
			) as Result<T, E extends null | undefined ? GuardErr : E>);
}

/**
 * Converts a guard into a Result-returning function. If the guard fails, it will return the error provided, or a `GuardErr`.
 *
 * @example
 * ```ts
 * const validateString = guardToValidator(is.string, 'Value must be a string');
 * const result = validateString(value);
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export function guardToValidator<T, E = null>(
	guard: Guard<T>,
	error?: E
): (value: unknown) => Result<T, E extends null | undefined ? GuardErr : E> {
	return (value: unknown) => validate(value, guard, error);
}

/**
 * Takes a guard and an error, and returns a function that converts
 * a value into a `Task`. If the guard fails, it will return the error
 * provided, or a `GuardErr`.
 *
 * @param guard The guard to use for validation.
 * @param error The error to return if the guard fails.
 *
 * @example
 * ```ts
 * const validateValue = guardToTask(is.string, 'Value must be a string')(value); // Task
 * const result = await validateValue.execute(); // Result
 * if (result.isOk()) {
 *   console.log(result.value); // value is string
 * } else {
 *   console.log(result.error); // error is string
 * }
 * ```
 */
export function guardToTask<T, E = null>(
	guard: Guard<T>,
	error?: E
): (value: unknown) => Task<T, E extends null | undefined ? GuardErr : E> {
	return (value: unknown): Task<T, E extends null | undefined ? GuardErr : E> =>
		new Task(() => ResultAsync.fromResult(validate(value, guard, error)));
}

/**
 * Infer the type of a guard schema.
 *
 * @example
 * ```ts
 * const schema = defineSchemas({
 *   User: {
 *     name: is.string,
 *     age: is.number,
 *   },
 * });
 *
 * type User = InferSchema<typeof schema.User>;
 * // User is now { name: string; age: number }
 * ```
 */
export type InferSchema<T> = T extends { parse: (value: unknown) => Result<infer U, any> }
	? U
	: T extends Record<string, Guard<any>>
		? { [K in keyof T]: T[K] extends Guard<infer V> ? V : never }
		: never;

/**
 * Defines a set of schemas for use with the `is` guard.
 *
 * @param schemas An object containing the schemas to define.
 * @returns An object containing the defined schemas.
 *
 * @example
 * ```ts
 * const schemas = defineSchemas({
 *   User: {
 *     name: is.string,
 *     age: is.number,
 *     address: is.object({
 *       street: is.string,
 *       city: is.string,
 *       region: is.string,
 *     }),
 *   },
 * });
 *
 * type User = InferSchema<typeof schemas.User>;
 * // User is now { name: string; age: number; address: { street: string; city: string; region: string; } }
 * ```
 */
export function defineSchemas<S extends Record<string, Record<string, Guard<any>>>>(
	schemas: S
): {
	readonly [K in keyof S]: {
		/**
		 * Recursively parses a value against the schema.
		 * @param value The value to parse.
		 * @returns A Result containing the parsed value or an array of `GuardErr`.
		 *
		 * @example
		 * ```ts
		 * const schemas = defineSchemas({
		 *   User: {
		 *     name: is.string,
		 *     age: is.number,
		 *     address: is.object({
		 *       street: is.string,
		 *       city: is.string,
		 *       region: is.string,
		 *     }),
		 *   },
		 * });
		 *
		 * const result = schemas.User.parse({ name: 'John', age: 30, address: { street: '123 Main St', city: 'Anytown', region: 'CA' } });
		 * // result is typed as Result<{ name: string; age: number; address: { street: string; city: string; region: string; } }, GuardErr[]>
		 *
		 * // Nested objects are fully typed and errors are reported with full paths
		 * const invalidResult = schemas.User.parse({ name: 'John', age: 30, address: { street: '123 Main St', city: 'Anytown', region: 123 } });
		 * // message: User.address.region failed validation: expected string, but got number (123)
		 * // path: ['User', 'address', 'region']
		 * // expected: 'string'
		 * // actual: 'number'
		 * ```
		 */
		parse: (value: unknown, error?: string) => Result<InferSchema<S[K]>, GuardErr[]>;
		/**
		 * Recursively 'asserts' that a value matches the schema (throws `GuardErr` if not).
		 *
		 * We use `value is x` instead of `asserts value is x`
		 * because `asserts` does not work with inferred types.
		 *
		 * @param value The value to assert.
		 * @throws An error if the value does not match the schema.
		 */
		assert: (value: unknown, error?: string) => value is InferSchema<S[K]>;
	};
} {
	/**
	 * Recursively validates a value against a shape (guard map), collecting errors with full paths.
	 * If a guard has `meta.shape`, it descends into the nested object instead of just failing at this level.
	 */
	function validateShape(
		value: unknown,
		shape: Record<string, Guard<any>>,
		schemaName: string,
		path: string[],
		errors: GuardErr[]
	): void {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			errors.push(
				GlobalErrs.GuardErr({
					message: `${[schemaName, ...path].join('.')}: Expected an object but got ${typeof value}`,
					schema: schemaName,
					path: [schemaName, ...path],
					expected: 'object',
					actual: typeof value,
				})
			);
			return;
		}

		const entries = Object.entries(shape);
		for (let i = 0; i < entries.length; i++) {
			const [key, guard] = entries[i]!;
			const propertyValue = (value as any)[key];
			const currentPath = [...path, key];

			if (!guard(propertyValue)) {
				// If this guard has a shape, recurse into it for deeper error detail
				if (guard.meta?.['shape'] && typeof propertyValue === 'object' && propertyValue !== null) {
					validateShape(propertyValue, guard.meta['shape'], schemaName, currentPath, errors);
				} else {
					const fullPath = [schemaName, ...currentPath].join('.');
					const message = guard.meta?.errorMsg;
					errors.push(
						GlobalErrs.GuardErr({
							message: message
								? message
								: `${fullPath} failed validation: expected ${guard.meta?.name || 'unknown'}, but got ${typeof propertyValue} (${JSON.stringify(propertyValue)})`,
							schema: schemaName,
							path: [schemaName, ...currentPath],
							expected: guard.meta?.name || 'unknown',
							actual: typeof propertyValue,
						})
					);
				}
			}
		}
	}

	const compiledSchemas = Object.entries(schemas).map(([schemaName, schema]) => {
		const schemaObj = {
			parse: (value: unknown) => {
				if (typeof value !== 'object' || value === null || Array.isArray(value)) {
					return err([
						GlobalErrs.GuardErr({
							message: `${schemaName}: Expected an object but got ${typeof value}`,
							schema: schemaName,
							path: [],
							expected: 'object',
							actual: typeof value,
						}),
					]);
				}
				const errors: GuardErr[] = [];
				validateShape(value, schema, schemaName, [], errors);
				return errors.length === 0 ? ok(value as any) : err(errors);
			},
			assert: (value: unknown, errorMsg?: string) => {
				if (typeof value !== 'object' || value === null || Array.isArray(value)) {
					throw GlobalErrs.GuardErr({
						message: errorMsg || `${schemaName}: Expected an object but got ${typeof value}`,
						schema: schemaName,
						path: [],
						expected: 'object',
						actual: typeof value,
					});
				}
				const errors: GuardErr[] = [];
				validateShape(value, schema, schemaName, [], errors);
				if (errors.length > 0) {
					throw errors[0]!;
				}
				return true;
			},
			'~standard': {
				version: 1 as const,
				vendor: 'chas',
				validate(value: unknown): StandardSchemaV1.Result<any> {
					const result = schemaObj.parse(value);
					if (result.isOk()) {
						return { value: result.value };
					}
					return {
						issues: result.error.map((e: any) => ({
							message: e.message || e.message || 'Validation failed',
							path: e.path?.map((p: string) => ({ key: p })),
						})),
					};
				},
			},
		};
		return [schemaName, schemaObj];
	});

	return Object.fromEntries(compiledSchemas) as any;
}

/**
 * Converts a Guard into a Standard Schema V1 compliant object.
 * Useful for passing guards to frameworks that accept Standard Schema validators
 * (e.g. tRPC, react-hook-form, Drizzle).
 *
 * @example
 * ```ts
 * import { is, toStandardSchema } from 'chas/guard';
 *
 * const emailSchema = toStandardSchema(is.string.email);
 * // emailSchema satisfies StandardSchemaV1<unknown, string>
 * ```
 */
export function toStandardSchema<T>(guard: Guard<T>): StandardSchemaV1<unknown, T> {
	return {
		'~standard': {
			version: 1,
			vendor: 'chas',
			validate(value: unknown): StandardSchemaV1.Result<T> {
				if (guard(value)) {
					return { value };
				}
				return {
					issues: [
						{
							message:
								guard.meta?.errorMsg || `Validation failed: expected ${guard.meta?.name || 'unknown'}`,
						},
					],
				};
			},
		},
	};
}

/**
 * Also a namespace for guard utilities, merges with the `Guard` type definition.
 */
export const Guard = {
	toValidator: guardToValidator,
	toTask: guardToTask,
	toStandardSchema,
	validate,
	assert,
	ensure,
	is,
	defineSchemas,
};

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
