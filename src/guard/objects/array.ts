import { factory, makeGuard, type Guard, type GuardType } from '../shared.js';

export interface ArrayGuardFactory {
	<G extends Guard<any, Record<string, any>>[]>(
		...guards: G
	): Guard<
		G extends [] ? unknown[] : GuardType<G[number]>[],
		ArrayHelpers<G extends [] ? unknown : GuardType<G[number]>>
	>;
}

export interface ArrayHelpers<T> {
	nonEmpty: Guard<T[], ArrayHelpers<T>>;
	empty: Guard<T[], ArrayHelpers<T>>;
	unique: Guard<T[], ArrayHelpers<T>>;
	min: (n: number) => Guard<T[], ArrayHelpers<T>>;
	max: (n: number) => Guard<T[], ArrayHelpers<T>>;
	size: (n: number) => Guard<T[], ArrayHelpers<T>>;
	includes: (item: T) => Guard<T[], ArrayHelpers<T>>;
	excludes: (item: T) => Guard<T[], ArrayHelpers<T>>;
}

const arrayHelpers: ArrayHelpers<any> = {
	nonEmpty: ((v: unknown) => Array.isArray(v) && v.length > 0) as any,
	empty: ((v: unknown) => Array.isArray(v) && v.length === 0) as any,
	unique: ((v: unknown) => Array.isArray(v) && new Set(v as any[]).size === (v as any[]).length) as any,
	min: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length >= n
	),
	max: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length <= n
	),
	size: factory<[number], any, ArrayHelpers<Record<string, any>>>(
		(n: number) => (v: unknown) => Array.isArray(v) && v.length === n
	),
	includes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && v.includes(item)
	),
	excludes: factory<[unknown], any, ArrayHelpers<Record<string, any>>>(
		(item: unknown) => (v: unknown) => Array.isArray(v) && !v.includes(item)
	),
};

export const ArrayGuardFactory: ArrayGuardFactory = <G extends Guard<any, Record<string, any>>[]>(...guards: G) =>
	makeGuard(
		(v: unknown): v is G extends [] ? unknown[] : GuardType<G[number]>[] =>
			Array.isArray(v) && (guards.length === 0 || v.every(item => guards.some(guard => guard(item)))), // each item must match at least one guard (matching all guards wouldn't make any sense. is.number & is.string would never match anything)
		{
			name: `array<${guards.map(guard => guard.meta.name).join(', ')}>`,
			id: 'array',
		},
		arrayHelpers
	);
