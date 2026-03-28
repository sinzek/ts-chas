import { makeGuard, type Guard } from '../shared.js';

export interface InstanceGuardFactory {
	<T>(ctor: abstract new (...args: any[]) => T): Guard<T, typeof instanceHelpers>;
}

const instanceHelpers = {};

export const InstanceGuardFactory: InstanceGuardFactory = <T>(ctor: abstract new (...args: any[]) => T) =>
	makeGuard(
		(v: unknown): v is T => v instanceof ctor,
		{
			name: `instance<${ctor.name}>`,
			id: ctor.name,
		},
		instanceHelpers
	);
