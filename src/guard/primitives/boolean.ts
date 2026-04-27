import { type Guard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { property, transformer } from '../base/helper-markers.js';
import { stringHelpers, type StringGuard } from './string.js';

export interface BooleanHelpers {
	/** Validates that the boolean is strictly true. */
	true: BooleanGuard;
	/** Validates that the boolean is strictly false. */
	false: BooleanGuard;
	/** Converts the boolean to a boolstr (string "true" or "false"). */
	asString: StringGuard;
}

export interface BooleanGuard extends Guard<boolean, BooleanHelpers, BooleanGuard> {}

const booleanHelpers: BooleanHelpers = {
	true: ((v: boolean) => v === true) as any,
	false: ((v: boolean) => v === false) as any,
	asString: property(
		transformer((target: Guard<boolean>) => ({
			fn: (v: unknown): v is boolean => target(v),
			meta: { name: `${target.meta.name}.asString`, id: 'string', jsonSchema: { enum: ['true', 'false'] } },
			transform: (v: boolean) => String(v),
			replaceHelpers: true,
			helpers: stringHelpers,
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
