import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { GlobalErrs } from '../../tagged-errs.js';

export interface UnionGuard<T> extends Guard<T, {}, UnionGuard<T>> {}

export interface UnionGuardFactory {
	<T extends [Guard<any, any, any>, ...Guard<any, any, any>[]]>(...guards: T): UnionGuard<InferGuard<T[number]>>;
}

const unionHelpers = {};

export const UnionGuardFactory: UnionGuardFactory = (...guards) => {
	if (guards.length === 0) {
		GlobalErrs.ChasErr.throw({
			message: '[ts-chas] is.union() requires at least one guard.',
			origin: 'is.union()',
		});
	}

	const fn = (value: unknown): value is any => {
		for (const guard of guards) {
			if (guard(value)) return true;
		}
		return false;
	};

	const hasAnyTransform = guards.some(g => g.meta.transform);
	const transform = hasAnyTransform
		? (v: any, original: any) => {
				for (const g of guards) {
					if (g(v)) return g.meta.transform ? g.meta.transform(v, original) : v;
				}
				return v;
			}
		: undefined;

	return makeGuard(
		fn,
		{
			name: `union<${guards.map(g => g.meta?.name ?? '?').join(' | ')}>`,
			id: 'union',
			guards,
			...(transform && { transform }),
		},
		unionHelpers
	);
};
