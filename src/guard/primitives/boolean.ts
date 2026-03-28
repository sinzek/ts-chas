import { makeGuard, type Guard, property, transformer } from '../shared.js';

export interface BooleanHelpers {
	/** Validates that the boolean is strictly true. */
	true: Guard<boolean, BooleanHelpers>;
	/** Validates that the boolean is strictly false. */
	false: Guard<boolean, BooleanHelpers>;
	/** Converts the boolean to a boolstr (string "true" or "false"). */
	asString: Guard<string, {}>;
}

export interface BooleanGuard extends Guard<boolean, BooleanHelpers> {}

const booleanHelpers: BooleanHelpers = {
	true: ((v: boolean) => v === true) as any,
	false: ((v: boolean) => v === false) as any,
	asString: property(
		transformer((target: Guard<boolean>) => ({
			fn: (v: unknown): v is boolean => target(v),
			meta: { name: `${target.meta.name}.asString`, id: 'string' },
			transform: (v: boolean) => String(v),
			replaceHelpers: true,
		}))
	) as any,
};

export const BooleanGuard: BooleanGuard = makeGuard(
	(v: unknown): v is boolean => typeof v === 'boolean',
	{
		name: 'boolean',
		id: 'boolean',
	},
	booleanHelpers
);
