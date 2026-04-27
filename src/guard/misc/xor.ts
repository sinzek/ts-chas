import { type Guard, type InferGuard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { GlobalErrs } from '../../tagged-errs.js';

export interface XorGuard<T extends Guard<any, any, any>[]> extends Guard<
	InferGuard<T[number]>,
	typeof xorHelpers,
	XorGuard<T>
> {}

export interface XorGuardFactory {
	/**
	 * Creates a guard that passes when **exactly one** of the provided guards matches.
	 * Unlike `union` (which passes if *any* guard matches), `xor` rejects values
	 * that satisfy multiple guards simultaneously.
	 */
	<T extends [Guard<any, any, any>, ...Guard<any, any, any>[]]>(...guards: T): XorGuard<T>;
}

const xorHelpers = {};

export const XorGuardFactory: XorGuardFactory = (...guards) => {
	if (guards.length === 0) {
		GlobalErrs.ChasErr.throw({
			message: '[ts-chas] is.xor() requires at least one guard.',
			origin: 'is.xor()',
		});
	}

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
			guards,
		},
		xorHelpers
	);
};
