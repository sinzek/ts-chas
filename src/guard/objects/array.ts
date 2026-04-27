import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { arrayHelpers, type ArrayHelpers } from '../base/array-helpers.js';
import type { DeepReadonly } from '../../utils.js';

export type InferGuardUnion<GuardTuple extends Guard<any, any, any>[]> = GuardTuple extends []
	? never
	: InferGuard<GuardTuple[number]>;

// array guard where T = union
export interface ArrayGuard<T = unknown, Modifier extends 'readonly' | 'mutable' = 'mutable'> extends Guard<
	Modifier extends 'readonly' ? DeepReadonly<T[]> : T[],
	ArrayHelpers<T, Modifier>,
	ArrayGuard<T, Modifier>
> {}

export interface ArrayGuardFactory {
	<G extends Guard<any, any, any>[]>(...guards: G): G extends [] ? ArrayGuard<unknown> : ArrayGuard<InferGuardUnion<G>>;
}

export const ArrayGuardFactory: ArrayGuardFactory = <G extends Guard<any, any, any>[]>(...guards: G) => {
	const hasInnerTransform = guards.some(g => g.meta.transform);
	return makeGuard(
		(v: unknown): v is G extends [] ? unknown[] : InferGuardUnion<G>[] =>
			Array.isArray(v) && (guards.length === 0 || v.every(item => guards.some(guard => guard(item)))), // each item must match at least one guard (matching all guards wouldn't make any sense. is.number & is.string would never match anything)
		{
			name: `array<${guards.map(guard => guard.meta.name).join(', ')}>`,
			id: 'array',
			elementGuards: guards.length > 0 ? guards : undefined,
			// Only install a transform pass when at least one element guard actually
			// transforms. Otherwise the element scan is dead work on every parse.
			transform: hasInnerTransform
				? (v: any) => {
						if (!Array.isArray(v)) return v;
						return v.map(item => {
							const g = guards.find(g => g(item));
							return g?.meta.transform ? g.meta.transform(item, item) : item;
						});
					}
				: undefined,
		},
		arrayHelpers
	) as any;
};
