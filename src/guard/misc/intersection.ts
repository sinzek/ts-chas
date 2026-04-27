import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { type UnionToIntersection } from '../../utils.js';

export interface IntersectionGuard<T extends Guard<any, any, any>[]> extends Guard<
	UnionToIntersection<InferGuard<T[number]>>,
	typeof intersectionHelpers,
	IntersectionGuard<T>
> {}

export interface IntersectionGuardFactory {
	<T extends Guard<any, any, any>[]>(...guards: T): IntersectionGuard<T>;
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
			guards,
		},
		intersectionHelpers
	);
};
