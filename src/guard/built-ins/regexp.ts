import { makeGuard, type Guard, factory } from '../shared.js';

export type RegExpGuard = Guard<RegExp, RegExpHelpers>;

export interface RegExpGuardFactory {
	(options?: { pattern?: string | RegExp; flags?: string }): RegExpGuard;
}

export interface RegExpHelpers {
	/** Validates that the RegExp has the 'g' (global) flag. */
	global: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has the 'i' (ignoreCase) flag. */
	ignoreCase: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has the 'm' (multiline) flag. */
	multiline: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has the 'u' (unicode) flag. */
	unicode: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has the 'y' (sticky) flag. */
	sticky: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has the 's' (dotAll) flag. */
	dotAll: Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp's source matches the given pattern. */
	source: (pattern: string | RegExp) => Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp matches the given string. */
	test: (v: string) => Guard<RegExp, RegExpHelpers>;
	/** Validates that the RegExp has exactly the specified flags. */
	flags: (flags: string) => Guard<RegExp, RegExpHelpers>;
}

const regexpHelpers: RegExpHelpers = {
	global: ((v: RegExp) => v.global) as any,
	ignoreCase: ((v: RegExp) => v.ignoreCase) as any,
	multiline: ((v: RegExp) => v.multiline) as any,
	unicode: ((v: RegExp) => v.unicode) as any,
	sticky: ((v: RegExp) => v.sticky) as any,
	dotAll: ((v: RegExp) => v.dotAll) as any,
	source: factory((pattern: string | RegExp) => (v: RegExp) => {
		const src = typeof pattern === 'string' ? pattern : pattern.source;
		return v.source === src;
	}),
	test: factory((str: string) => (v: RegExp) => v.test(str)),
	flags: factory((flags: string) => (v: RegExp) => {
		const sorted = (f: string) => [...f].sort().join('');
		return sorted(v.flags) === sorted(flags);
	}),
};

const baseRegExpGuard = makeGuard(
	(v: unknown): v is RegExp => v instanceof RegExp,
	{ name: 'regexp', id: 'RegExp' },
	regexpHelpers
);

export const RegExpGuardFactory: RegExpGuardFactory = (options?: { pattern?: string | RegExp; flags?: string }) => {
	const { pattern, flags } = options ?? {};
	if (pattern === undefined && flags === undefined) return baseRegExpGuard;

	const p = pattern!;
	const predicate = (v: unknown): v is RegExp => {
		if (!(v instanceof RegExp)) return false;
		const src = typeof p === 'string' ? p : p.source;
		if (v.source !== src) return false;

		if (flags !== undefined) {
			const sorted = (f: string) => [...f].sort().join('');
			if (sorted(v.flags) !== sorted(flags)) return false;
		}
		return true;
	};

	const name = pattern
		? `regexp<${typeof pattern === 'string' ? pattern : pattern.source}${flags ? `, ${flags}` : ''}>`
		: 'regexp';
	return makeGuard(predicate, { name, id: 'RegExp' }, regexpHelpers);
};
