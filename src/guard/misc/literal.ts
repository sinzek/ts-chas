import { makeGuard, type Guard } from '../shared.js';

export type LiteralGuard<T extends readonly (string | number | boolean | bigint | null | undefined)[]> = Guard<
	T[number],
	typeof literalHelpers
>;

export interface LiteralGuardFactory {
	<T extends readonly (string | number | boolean | bigint | null | undefined)[]>(...values: T): LiteralGuard<T>;
}

const literalHelpers = {};

export const LiteralGuardFactory: LiteralGuardFactory = (...values) => {
	const fn = (value: unknown): value is any => {
		for (const v of values) {
			if (Object.is(v, value)) return true;
		}
		return false;
	};

	const formatValue = (v: any) => {
		if (typeof v === 'string') return `'${v}'`;
		if (typeof v === 'bigint') return `${v}n`;
		return String(v);
	};

	return makeGuard(
		fn,
		{
			name: `literal<${values.map(formatValue).join(', ')}>`,
			id: 'literal',
			values: new Set(values),
		},
		literalHelpers
	);
};
