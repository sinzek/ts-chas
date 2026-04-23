import { makeGuard, type Guard } from '../shared.js';

export interface UndefinedGuard extends Guard<undefined, typeof undefinedHelpers> {}
export interface VoidGuard extends Guard<void, typeof undefinedHelpers> {}
export interface OptionalGuard<T> extends Guard<T | undefined, typeof undefinedHelpers> {}
export interface OptionalGuardFactory {
	<T>(guard: Guard<T>): OptionalGuard<T>;
}

const undefinedHelpers = {};

export const UndefinedGuard: UndefinedGuard = makeGuard(
	(v: unknown): v is undefined => v === undefined,
	{
		name: 'undefined',
		id: 'undefined',
	},
	undefinedHelpers
);

export const VoidGuard: VoidGuard = makeGuard(
	(v: unknown): v is void => v === undefined,
	{ name: 'void', id: 'void' },
	undefinedHelpers
);

export const OptionalGuardFactory: OptionalGuardFactory = <T>(guard: Guard<T>) => {
	return makeGuard((v: unknown): v is T | undefined => v === undefined || guard(v), {
		id: 'optional',
		name: `optional<${guard.meta.name}>`,
		inner: guard,
	});
};
