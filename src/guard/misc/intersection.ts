import { makeGuard, type Guard, type InferGuard } from '../shared.js';
import { type UnionToIntersection } from '../../utils.js';

export type IntersectionGuard<T extends Guard<any, any>[]> = Guard<
	UnionToIntersection<InferGuard<T[number]>>,
	typeof intersectionHelpers
>;

export interface IntersectionGuardFactory {
	<T extends Guard<any, any>[]>(...guards: T): IntersectionGuard<T>;
}

const intersectionHelpers = {};

export const IntersectionGuardFactory: IntersectionGuardFactory = (...guards) => {
	const fn = (value: unknown): value is any => {
		for (const guard of guards) {
			if (!guard(value)) return false;
		}
		return true;
	};

	return makeGuard(
		fn,
		{
			name: `intersection<${guards.map(g => g.meta?.name ?? '?').join(' & ')}>`,
			id: 'intersection',
		},
		intersectionHelpers
	);
};
