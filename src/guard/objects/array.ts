import { makeGuard, arrayHelpers, type ArrayHelpers, type Guard, type InferGuard } from '../shared.js';

export type { ArrayHelpers };

export interface ArrayGuardFactory {
	<G extends Guard<any, Record<string, any>>[]>(
		...guards: G
	): Guard<
		G extends [] ? unknown[] : InferGuard<G[number]>[],
		ArrayHelpers<G extends [] ? unknown : InferGuard<G[number]>>
	>;
}

export const ArrayGuardFactory: ArrayGuardFactory = <G extends Guard<any, Record<string, any>>[]>(...guards: G) =>
	makeGuard(
		(v: unknown): v is G extends [] ? unknown[] : InferGuard<G[number]>[] =>
			Array.isArray(v) && (guards.length === 0 || v.every(item => guards.some(guard => guard(item)))), // each item must match at least one guard (matching all guards wouldn't make any sense. is.number & is.string would never match anything)
		{
			name: `array<${guards.map(guard => guard.meta.name).join(', ')}>`,
			id: 'array',
			elementGuards: guards.length > 0 ? guards : undefined,
		},
		arrayHelpers
	);
