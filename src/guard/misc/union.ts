import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface UnionGuard<T> extends Guard<T, {}, UnionGuard<T>> {}

export interface UnionGuardFactory {
	<T extends Guard<any, any, any>[]>(...guards: T): UnionGuard<InferGuard<T[number]>>;
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
			guards,
		},
		unionHelpers
	);
};
