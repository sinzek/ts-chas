import { makeGuard, type Guard } from '../shared.js';

/**
 * Infers the union of types from an array of guards.
 */
export type InferUnion<T extends Guard<any, Record<string, any>>[]> =
	T[number] extends Guard<infer U, Record<string, any>> ? U : never;

export interface UnionGuardFactory {
	<T extends Guard<any, Record<string, any>>[]>(...guards: T): Guard<InferUnion<T>, typeof unionHelpers>;
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
