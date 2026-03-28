import { makeGuard, type Guard, factory } from '../shared.js';

export interface BigIntHelpers {
	/** Validates that the bigint is greater than the minimum. */
	gt: (min: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is greater than or equal to the minimum. */
	gte: (min: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is less than the maximum. */
	lt: (max: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is less than or equal to the maximum. */
	lte: (max: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is positive (> 0). */
	positive: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is non-negative (>= 0). */
	nonnegative: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is negative (< 0). */
	negative: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is non-positive (<= 0). */
	nonpositive: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is between the minimum and maximum (inclusive). */
	between: (min: bigint, max: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is even. */
	even: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is odd. */
	odd: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is a multiple of the given bigint. */
	multipleOf: (n: bigint) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint has a specific number of digits. */
	digits: (n: number) => Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is a 32-bit signed integer. */
	int32: Guard<bigint, BigIntHelpers>;
	/** Validates that the bigint is a 64-bit signed integer. */
	int64: Guard<bigint, BigIntHelpers>;
}

export interface BigIntGuard extends Guard<bigint, BigIntHelpers> {}

const bigintHelpers: BigIntHelpers = {
	gte: factory((min: bigint) => (v: bigint) => v >= min),
	gt: factory((min: bigint) => (v: bigint) => v > min),
	lte: factory((max: bigint) => (v: bigint) => v <= max),
	lt: factory((max: bigint) => (v: bigint) => v < max),
	positive: ((v: bigint) => v > 0n) as any,
	nonnegative: ((v: bigint) => v >= 0n) as any,
	negative: ((v: bigint) => v < 0n) as any,
	nonpositive: ((v: bigint) => v <= 0n) as any,
	between: factory((min: bigint, max: bigint) => (v: bigint) => v >= min && v <= max),
	even: ((v: bigint) => v % 2n === 0n) as any,
	odd: ((v: bigint) => v % 2n !== 0n) as any,
	multipleOf: factory((n: bigint) => (v: bigint) => v % n === 0n),
	digits: factory((n: number) => (v: bigint) => v.toString().replace('-', '').length === n),
	int32: ((v: bigint) => v >= -2147483648n && v <= 2147483647n) as any,
	int64: ((v: bigint) => v >= -9223372036854775808n && v <= 9223372036854775807n) as any,
};

export const BigIntGuard: BigIntGuard = makeGuard(
	(v: unknown): v is bigint => typeof v === 'bigint',
	{
		name: 'bigint',
		id: 'bigint',
	},
	bigintHelpers
);
