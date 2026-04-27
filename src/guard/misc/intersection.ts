import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { type UnionToIntersection } from '../../utils.js';
import { GlobalErrs } from '../../tagged-errs.js';

export interface IntersectionGuard<T extends Guard<any, any, any>[]> extends Guard<
	UnionToIntersection<InferGuard<T[number]>>,
	typeof intersectionHelpers,
	IntersectionGuard<T>
> {}

export interface IntersectionGuardFactory {
	<T extends [Guard<any, any, any>, ...Guard<any, any, any>[]]>(...guards: T): IntersectionGuard<T>;
}

const intersectionHelpers = {};

export const IntersectionGuardFactory: IntersectionGuardFactory = (...guards) => {
	if (guards.length === 0) {
		GlobalErrs.ChasErr.throw({
			message: '[ts-chas] is.intersection() requires at least one guard.',
			origin: `is.intersection(${guards.map(g => g.meta.id).join(', ')})`,
		});
	}

	const fn = (value: unknown): value is any => {
		for (const guard of guards) {
			if (!guard(value)) return false;
		}
		return true;
	};

	const hasAnyTransform = guards.some(g => g.meta.transform);
	const transform = hasAnyTransform
		? (v: any, original: any) => {
				let cur = v;
				for (const g of guards) {
					if (g.meta.transform) cur = g.meta.transform(cur, original);
				}
				return cur;
			}
		: undefined;

	return makeGuard(
		fn,
		{
			name: `intersection<${guards.map(g => g.meta?.name ?? '?').join(' & ')}>`,
			id: 'intersection',
			guards,
			...(transform && { transform }),
		},
		intersectionHelpers
	);
};
