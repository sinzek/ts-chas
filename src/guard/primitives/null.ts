import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface NullGuard extends Guard<null, {}, NullGuard> {}
export interface NullableGuard<T> extends Guard<T | null, {}, NullableGuard<T>> {}

export interface NullableGuardFactory {
	<T>(guard: Guard<T>): NullableGuard<T>;
}

export const NullGuard: NullGuard = makeGuard((v: unknown): v is null => v === null, {
	name: 'null',
	id: 'null',
}) as any;

export const NullableGuardFactory: NullableGuardFactory = <T>(guard: Guard<T>) => {
	return makeGuard((v: unknown): v is T | null => v === null || guard(v), {
		id: 'nullable',
		name: `nullable<${guard.meta.name}>`,
		inner: guard,
	});
};
