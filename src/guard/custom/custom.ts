import { type Guard, makeGuard } from '../shared.js';

export interface CustomGuardFactory {
	<T>(fn: ((v: unknown) => boolean) | ((v: unknown) => v is T)): Guard<T>;
	(): Guard<unknown>;
}

export const CustomGuardFactory: CustomGuardFactory = (fn?: (v: unknown) => boolean) =>
	makeGuard(fn ?? (((_: unknown): _ is any => true) as any), { name: 'custom', id: 'custom' });
