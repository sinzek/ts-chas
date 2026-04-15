import { makeGuard, type Guard, property, transformer, JSON_SCHEMA } from '../shared.js';

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
			meta: { name: `${target.meta.name}.asString`, id: 'string', jsonSchema: { enum: ['true', 'false'] } },
			transform: (v: boolean) => String(v),
			replaceHelpers: true,
		}))
	) as any,
};

// JSON Schema contributions for boolean helpers
(booleanHelpers.true as any)[JSON_SCHEMA] = () => ({ const: true });
(booleanHelpers.false as any)[JSON_SCHEMA] = () => ({ const: false });

export const BooleanGuard: BooleanGuard = makeGuard(
	(v: unknown): v is boolean => typeof v === 'boolean',
	{
		name: 'boolean',
		id: 'boolean',
	},
	booleanHelpers
);
