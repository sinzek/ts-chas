import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';

export interface CustomGuard<T> extends Guard<T, {}, CustomGuard<T>> {}

export interface CustomGuardFactory {
	<T>(fn: ((v: unknown) => boolean) | ((v: unknown) => v is T)): CustomGuard<T>;
	(): CustomGuard<unknown>;
}

export const CustomGuardFactory: CustomGuardFactory = (fn?: (v: unknown) => boolean) =>
	makeGuard(fn ?? (((_: unknown): _ is any => true) as any), { name: 'custom', id: 'custom' });
