import type { Brand } from '../base/shared.js';
import { type Guard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { factory } from '../base/helper-markers.js';

/**
 * Counts the number of decimal places in a finite number, correctly handling
 * exponential notation. `Number.prototype.toString()` emits scientific notation
 * for very small or very large magnitudes (e.g. `1e-10`, `1.5e-7`), so naive
 * splitting on `.` silently reports 0 decimals for values that clearly have more.
 */
function countDecimalPlaces(v: number): number {
	if (!Number.isFinite(v)) return Infinity;
	const str = Math.abs(v).toString();
	const eIdx = str.indexOf('e');
	if (eIdx < 0) {
		const dotIdx = str.indexOf('.');
		return dotIdx < 0 ? 0 : str.length - dotIdx - 1;
	}
	const mantissa = str.slice(0, eIdx);
	const exp = parseInt(str.slice(eIdx + 1), 10);
	const dotIdx = mantissa.indexOf('.');
	const mantissaDecimals = dotIdx < 0 ? 0 : mantissa.length - dotIdx - 1;
	return Math.max(0, mantissaDecimals - exp);
}

export interface NumberHelpers {
	/** Validates that the number is greater than the minimum. */
	gt: (min: number) => NumberGuard;
	/** Validates that the number is greater than or equal to the minimum. */
	gte: (min: number) => NumberGuard;
	/** Validates that the number is less than the maximum. */
	lt: (max: number) => NumberGuard;
	/** Validates that the number is less than or equal to the maximum. */
	lte: (max: number) => NumberGuard;
	/** Validates that the number is positive (> 0). */
	positive: NumberGuard;
	/** Validates that the number is non-negative (>= 0). */
	nonnegative: NumberGuard;
	/** Validates that the number is negative (< 0). */
	negative: NumberGuard;
	/** Validates that the number is non-positive (<= 0). */
	nonpositive: NumberGuard;
	/** Validates that the number is an integer. (safe integer range) */
	int: NumberGuard;
	/** Validates that the number is a 32-bit integer. (restricted to 32-bit integer range) */
	int32: NumberGuard;
	/** Validates that the number has a specific number of digits. */
	digits: (n: number) => NumberGuard;
	/** Validates that the number is a multiple of the given number. */
	multipleOf: (n: number) => NumberGuard;
	/** Validates that the number is between the minimum and maximum (inclusive). */
	between: (min: number, max: number) => NumberGuard;
	/** Validates that the number is even. */
	even: NumberGuard;
	/** Validates that the number is odd. */
	odd: NumberGuard;
	/** Validates that the number is a valid port number (0-65535). */
	port: NumberGuard;
	/** Validates that the number has at most n decimal places. */
	precision: (n: number) => NumberGuard;
	/** Validates that the number is between 0 and 1 (inclusive). */
	unit: NumberGuard;
}

export interface NumberGuard extends Guard<number, NumberHelpers, NumberGuard> {}

const numberHelpers: NumberHelpers = {
	gte: factory((min: number) => (v: number) => v >= min),
	gt: factory((min: number) => (v: number) => v > min),
	lte: factory((max: number) => (v: number) => v <= max),
	lt: factory((max: number) => (v: number) => v < max),
	positive: ((v: number) => v > 0) as any,
	nonnegative: ((v: number) => v >= 0) as any,
	negative: ((v: number) => v < 0) as any,
	nonpositive: ((v: number) => v <= 0) as any,
	int: ((v: number) => Number.isSafeInteger(v)) as any,
	int32: ((v: number) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647) as any,
	digits: factory((n: number) => (v: number) => String(v).replace('.', '').length === n),
	multipleOf: factory((n: number) => (v: number) => v % n === 0),
	between: factory((min: number, max: number) => (v: number) => v >= min && v <= max),
	even: ((v: number) => v % 2 === 0) as any,
	odd: ((v: number) => v % 2 !== 0) as any,
	port: ((v: number) => Number.isInteger(v) && v >= 0 && v <= 65535) as any,
	precision: factory((n: number) => (v: number) => Number.isFinite(v) && countDecimalPlaces(v) <= n),
	unit: ((v: number) => v >= 0 && v <= 1) as any,
};

// JSON Schema contributions — picked up by the proxy when these helpers are applied.
(numberHelpers.gt as any)[JSON_SCHEMA] = (n: number) => ({ exclusiveMinimum: n });
(numberHelpers.gte as any)[JSON_SCHEMA] = (n: number) => ({ minimum: n });
(numberHelpers.lt as any)[JSON_SCHEMA] = (n: number) => ({ exclusiveMaximum: n });
(numberHelpers.lte as any)[JSON_SCHEMA] = (n: number) => ({ maximum: n });
(numberHelpers.between as any)[JSON_SCHEMA] = (min: number, max: number) => ({ minimum: min, maximum: max });
(numberHelpers.int as any)[JSON_SCHEMA] = () => ({ type: 'integer' });
(numberHelpers.int32 as any)[JSON_SCHEMA] = () => ({ type: 'integer', minimum: -2147483648, maximum: 2147483647 });
(numberHelpers.positive as any)[JSON_SCHEMA] = () => ({ exclusiveMinimum: 0 });
(numberHelpers.nonnegative as any)[JSON_SCHEMA] = () => ({ minimum: 0 });
(numberHelpers.negative as any)[JSON_SCHEMA] = () => ({ exclusiveMaximum: 0 });
(numberHelpers.nonpositive as any)[JSON_SCHEMA] = () => ({ maximum: 0 });
(numberHelpers.multipleOf as any)[JSON_SCHEMA] = (n: number) => ({ multipleOf: n });
(numberHelpers.port as any)[JSON_SCHEMA] = () => ({ type: 'integer', minimum: 0, maximum: 65535 });
(numberHelpers.unit as any)[JSON_SCHEMA] = () => ({ minimum: 0, maximum: 1 });
(numberHelpers.even as any)[JSON_SCHEMA] = () => ({ multipleOf: 2 });
(numberHelpers.odd as any)[JSON_SCHEMA] = () => ({ _oddNumber: true });
(numberHelpers.digits as any)[JSON_SCHEMA] = (n: number) => ({ _digits: n });
(numberHelpers.precision as any)[JSON_SCHEMA] = (n: number) => ({ _precision: n });

export const NumberGuard: NumberGuard = makeGuard(
	(v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v),
	{
		name: 'number',
		id: 'number',
	},
	numberHelpers
);

type NaN = Brand<'NaN', number>; // type alias for number that is NaN

export interface NaNGuard extends Guard<NaN> {}

export const NaNGuard: NaNGuard = makeGuard((v: unknown): v is NaN => typeof v === 'number' && Number.isNaN(v), {
	name: 'NaN',
	id: 'NaN',
});

type PositiveInfinity = Brand<'PositiveInfinity', number>;
type NegativeInfinity = Brand<'NegativeInfinity', number>;

export interface InfiniteHelpers {
	positive: InfiniteGuard<'positive'>;
	negative: InfiniteGuard<'negative'>;
}

export interface InfiniteGuard<Direction extends 'positive' | 'negative' | 'either' = 'either'> extends Guard<
	Direction extends 'positive' ? PositiveInfinity : Direction extends 'negative' ? NegativeInfinity : number,
	InfiniteHelpers
> {}

export const InfiniteGuard: InfiniteGuard = makeGuard(
	(v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v) && !Number.isFinite(v),
	{
		name: 'infinite',
		id: 'infinite',
	},
	{
		positive: ((v: number) => v === Infinity) as any,
		negative: ((v: number) => v === -Infinity) as any,
	}
);
