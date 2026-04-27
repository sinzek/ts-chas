import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface UndefinedGuard extends Guard<undefined, {}, UndefinedGuard> {}
export interface VoidGuard extends Guard<void, {}, VoidGuard> {}
export interface OptionalGuard<T> extends Guard<T | undefined, {}, OptionalGuard<T>> {}
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
) as any;

export const VoidGuard: VoidGuard = makeGuard(
	(v: unknown): v is void => v === undefined,
	{ name: 'void', id: 'void' },
	undefinedHelpers
) as any;

export const OptionalGuardFactory: OptionalGuardFactory = <T>(guard: Guard<T>) => {
	return makeGuard((v: unknown): v is T | undefined => v === undefined || guard(v), {
		id: 'optional',
		name: `optional<${guard.meta.name}>`,
		inner: guard,
	});
};
