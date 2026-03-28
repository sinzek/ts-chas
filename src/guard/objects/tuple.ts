import { makeGuard, type Guard, type GuardType } from '../shared.js';

export interface TupleGuardFactory {
	<G extends readonly Guard<any, Record<string, any>>[]>(
		...guards: G
	): Guard<{ [K in keyof G]: GuardType<G[K]> }, typeof tupleHelpers>;
}

const tupleHelpers = {};

export const TupleGuardFactory: TupleGuardFactory = (...guards) => {
	const fn = (value: unknown): value is any => {
		if (!Array.isArray(value)) return false;
		if (value.length !== guards.length) return false;
		return guards.every((guard, i) => guard(value[i]));
	};

	return makeGuard(
		fn,
		{ name: `tuple<${guards.map(g => g.meta.name).join(', ')}>`, id: 'tuple', tupleGuards: [...guards] },
		tupleHelpers
	);
};
