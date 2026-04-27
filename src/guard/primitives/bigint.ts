import { type Guard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { factory } from '../base/helper-markers.js';

export interface BigIntHelpers {
	/** Validates that the bigint is greater than the minimum. */
	gt: (min: bigint) => BigIntGuard;
	/** Validates that the bigint is greater than or equal to the minimum. */
	gte: (min: bigint) => BigIntGuard;
	/** Validates that the bigint is less than the maximum. */
	lt: (max: bigint) => BigIntGuard;
	/** Validates that the bigint is less than or equal to the maximum. */
	lte: (max: bigint) => BigIntGuard;
	/** Validates that the bigint is positive (> 0). */
	positive: BigIntGuard;
	/** Validates that the bigint is non-negative (>= 0). */
	nonnegative: BigIntGuard;
	/** Validates that the bigint is negative (< 0). */
	negative: BigIntGuard;
	/** Validates that the bigint is non-positive (<= 0). */
	nonpositive: BigIntGuard;
	/** Validates that the bigint is between the minimum and maximum (inclusive). */
	between: (min: bigint, max: bigint) => BigIntGuard;
	/** Validates that the bigint is even. */
	even: BigIntGuard;
	/** Validates that the bigint is odd. */
	odd: BigIntGuard;
	/** Validates that the bigint is a multiple of the given bigint. */
	multipleOf: (n: bigint) => BigIntGuard;
	/** Validates that the bigint has a specific number of digits. */
	digits: (n: number) => BigIntGuard;
	/** Validates that the bigint is a 32-bit signed integer. */
	int32: BigIntGuard;
	/** Validates that the bigint is a 64-bit signed integer. */
	int64: BigIntGuard;
}

export interface BigIntGuard extends Guard<bigint, BigIntHelpers, BigIntGuard> {}

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

// JSON Schema contributions — bigint has no native JSON Schema type, so we use
// custom _bigint* markers (string-serialized to remain JSON-safe) for the generator.
(bigintHelpers.gt as any)[JSON_SCHEMA] = (min: bigint) => ({ _bigintExclusiveMin: String(min) });
(bigintHelpers.gte as any)[JSON_SCHEMA] = (min: bigint) => ({ _bigintMin: String(min) });
(bigintHelpers.lt as any)[JSON_SCHEMA] = (max: bigint) => ({ _bigintExclusiveMax: String(max) });
(bigintHelpers.lte as any)[JSON_SCHEMA] = (max: bigint) => ({ _bigintMax: String(max) });
(bigintHelpers.positive as any)[JSON_SCHEMA] = () => ({ _bigintExclusiveMin: '0' });
(bigintHelpers.nonnegative as any)[JSON_SCHEMA] = () => ({ _bigintMin: '0' });
(bigintHelpers.negative as any)[JSON_SCHEMA] = () => ({ _bigintExclusiveMax: '0' });
(bigintHelpers.nonpositive as any)[JSON_SCHEMA] = () => ({ _bigintMax: '0' });
(bigintHelpers.between as any)[JSON_SCHEMA] = (min: bigint, max: bigint) => ({
	_bigintMin: String(min),
	_bigintMax: String(max),
});
(bigintHelpers.even as any)[JSON_SCHEMA] = () => ({ _bigintEven: true });
(bigintHelpers.odd as any)[JSON_SCHEMA] = () => ({ _bigintOdd: true });
(bigintHelpers.multipleOf as any)[JSON_SCHEMA] = (n: bigint) => ({ _bigintMultipleOf: String(n) });
(bigintHelpers.digits as any)[JSON_SCHEMA] = (n: number) => ({ _bigintDigits: n });
(bigintHelpers.int32 as any)[JSON_SCHEMA] = () => ({ _bigintMin: '-2147483648', _bigintMax: '2147483647' });
(bigintHelpers.int64 as any)[JSON_SCHEMA] = () => ({
	_bigintMin: '-9223372036854775808',
	_bigintMax: '9223372036854775807',
});
