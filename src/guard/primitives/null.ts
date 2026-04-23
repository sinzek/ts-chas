import { makeGuard, type Guard } from '../shared.js';

export interface NullGuard extends Guard<null> {}
export interface NullableGuard<T> extends Guard<T | null> {}

export interface NullableGuardFactory {
	<T>(guard: Guard<T>): NullableGuard<T>;
}

export const NullGuard: NullGuard = makeGuard((v: unknown): v is null => v === null, {
	name: 'null',
	id: 'null',
});

export const NullableGuardFactory: NullableGuardFactory = <T>(guard: Guard<T>) => {
	return makeGuard((v: unknown): v is T | null => v === null || guard(v), {
		id: 'nullable',
		name: `nullable<${guard.meta.name}>`,
		inner: guard,
	});
};
