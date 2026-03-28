import { makeGuard, type Guard } from '../shared.js';
import { type UnionToIntersection } from '../../utils.js';

type InferIntersection<T extends Guard<any, Record<string, any>>[]> = UnionToIntersection<
	T[number] extends Guard<infer U, Record<string, any>> ? U : never
>;

export interface IntersectionGuardFactory {
	<T extends Guard<any, Record<string, any>>[]>(
		...guards: T
	): Guard<InferIntersection<T>, typeof intersectionHelpers>;
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
