import { makeGuard, type Guard, type InferGuard } from '../shared.js';

export interface UnionGuardFactory {
	<T extends Guard<any, any>[]>(...guards: T): Guard<InferGuard<T[number]>, typeof unionHelpers>;
}

const unionHelpers = {};

export const UnionGuardFactory: UnionGuardFactory = (...guards) => {
	const fn = (value: unknown): value is any => {
		for (const guard of guards) {
			if (guard(value)) return true;
		}
		return false;
	};

	return makeGuard(
		fn,
		{
			name: `union<${guards.map(g => g.meta?.name ?? '?').join(' | ')}>`,
			id: 'union',
		},
		unionHelpers
	);
};
