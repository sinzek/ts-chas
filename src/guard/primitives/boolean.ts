import { makeGuard, type Guard } from '../shared.js';

export interface BooleanHelpers {
	/** Validates that the boolean is strictly true. */
	true: Guard<boolean, BooleanHelpers>;
	/** Validates that the boolean is strictly false. */
	false: Guard<boolean, BooleanHelpers>;
}

export interface BooleanGuard extends Guard<boolean, BooleanHelpers> {}

const booleanHelpers: BooleanHelpers = {
	true: ((v: boolean) => v === true) as any,
	false: ((v: boolean) => v === false) as any,
};

export const BooleanGuard: BooleanGuard = makeGuard(
	(v: unknown): v is boolean => typeof v === 'boolean',
	{
		name: 'boolean',
		id: 'boolean',
	},
	booleanHelpers
);
