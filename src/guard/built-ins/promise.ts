import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface PromiseGuard extends Guard<Promise<unknown>, {}, PromiseGuard> {}

export const PromiseGuard: PromiseGuard = makeGuard(
	(v: unknown): v is Promise<unknown> =>
		v instanceof Promise ||
		(v !== null &&
			typeof v === 'object' &&
			typeof (v as any).then === 'function' &&
			typeof (v as any).catch === 'function'),
	{ name: 'promise', id: 'promise' }
);
