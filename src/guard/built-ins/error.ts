import { makeGuard, factory, type Guard } from '../shared.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface ErrorHelpers {
	message: (pattern: string | RegExp) => Guard<Error, ErrorHelpers>;
	name: (name: string) => Guard<Error, ErrorHelpers>;
	hasCause: Guard<Error, ErrorHelpers>;
}

const errorHelpers: ErrorHelpers = {
	message: factory((pattern: string | RegExp) => (v: unknown) => {
		if (!(v instanceof Error)) return false;
		return typeof pattern === 'string' ? v.message.includes(pattern) : pattern.test(v.message);
	}),
	name: factory((name: string) => (v: unknown) => v instanceof Error && v.name === name),
	hasCause: ((v: unknown) => v instanceof Error && v.cause !== undefined) as any,
};

export interface ErrorGuard extends Guard<Error, ErrorHelpers> {}

export const ErrorGuard: ErrorGuard = makeGuard(
	(v: unknown): v is Error => v instanceof Error,
	{ name: 'error', id: 'error' },
	errorHelpers
);
