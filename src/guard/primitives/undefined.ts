import { makeGuard, type Guard } from '../shared.js';

export interface UndefinedGuard extends Guard<undefined, typeof undefinedHelpers> {}
export interface VoidGuard extends Guard<void, typeof undefinedHelpers> {}

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
