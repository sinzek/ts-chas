import { makeGuard, type Guard } from '../shared.js';

export interface PromiseGuard extends Guard<Promise<unknown>> {}

export const PromiseGuard: PromiseGuard = makeGuard(
	(v: unknown): v is Promise<unknown> =>
		v instanceof Promise ||
		(v !== null &&
			typeof v === 'object' &&
			typeof (v as any).then === 'function' &&
			typeof (v as any).catch === 'function'),
	{ name: 'promise', id: 'promise' }
);
