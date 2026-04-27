import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface UnknownGuard extends Guard<unknown, {}, UnknownGuard> {}
export interface AnyGuard extends Guard<any, {}, AnyGuard> {}
export interface NeverGuard extends Guard<never, {}, NeverGuard> {}

export const UnknownGuard: UnknownGuard = makeGuard((_v: unknown): _v is unknown => true, {
	name: 'unknown',
	id: 'unknown',
});

export const AnyGuard: AnyGuard = makeGuard((_v: unknown): _v is any => true, {
	name: 'any',
	id: 'any',
});

export const NeverGuard: NeverGuard = makeGuard((_v: unknown): _v is never => false, {
	name: 'never',
	id: 'never',
}) as any;
