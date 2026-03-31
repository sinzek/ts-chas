import { makeGuard, factory, type Guard } from '../shared.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface ErrorHelpers {
	/**
	 * Checks if the error's message contains the given pattern.
	 * @param pattern The pattern to match against the error message.
	 * @returns A guard that checks if the error's message contains the given pattern.
	 */
	message: (pattern: string | RegExp) => Guard<Error, ErrorHelpers>;
	/**
	 * Checks if the error name matches the given name.
	 * @param name The name to match against the error name.
	 * @returns A guard that checks if the error name matches the given name.
	 */
	name: (name: string) => Guard<Error, ErrorHelpers>;
	/**
	 * Checks if the error has a cause.
	 * @returns A guard that checks if the error has a cause.
	 */
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
