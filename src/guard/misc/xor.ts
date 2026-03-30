import { makeGuard, type Guard, type InferGuard } from '../shared.js';

export interface XorGuardFactory {
	/**
	 * Creates a guard that passes when **exactly one** of the provided guards matches.
	 * Unlike `union` (which passes if *any* guard matches), `xor` rejects values
	 * that satisfy multiple guards simultaneously.
	 */
	<T extends Guard<any, any>[]>(...guards: T): Guard<InferGuard<T[number]>, typeof xorHelpers>;
}

const xorHelpers = {};

export const XorGuardFactory: XorGuardFactory = (...guards) => {
	const fn = (value: unknown): value is any => {
		let matchCount = 0;
		for (const guard of guards) {
			if (guard(value)) {
				matchCount++;
				if (matchCount > 1) return false;
			}
		}
		return matchCount === 1;
	};

	return makeGuard(
		fn,
		{
			name: `xor<${guards.map(g => g.meta?.name ?? '?').join(' ^ ')}>`,
			id: 'xor',
		},
		xorHelpers
	);
};
