import { makeGuard, type Guard } from '../shared.js';

export interface NullGuard extends Guard<null, typeof nullHelpers> {}

const nullHelpers = {};

export const NullGuard: NullGuard = makeGuard(
	(v: unknown): v is null => v === null,
	{
		name: 'null',
		id: 'null',
	},
	nullHelpers
);
