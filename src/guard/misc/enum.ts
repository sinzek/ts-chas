import { safeStringify } from '../../utils.js';
import { makeGuard, type Guard, transformer } from '../shared.js';

export interface EnumHelpers<T> {
	/** Excludes specific values from the enum. */
	exclude: <U extends T>(...values: readonly U[]) => Guard<Exclude<T, U>, EnumHelpers<Exclude<T, U>>>;
	/** Extracts only specific values from the enum. */
	extract: <U extends T>(...values: readonly U[]) => Guard<Extract<T, U>, EnumHelpers<Extract<T, U>>>;
}

export type EnumGuard<T> = Guard<T, EnumHelpers<T>>;

export interface EnumGuardFactory {
	<T extends string | number | symbol>(values: readonly T[]): EnumGuard<T>;
	<T extends Record<string, string | number | symbol>>(values: T): EnumGuard<T[keyof T]>;
}

const enumHelpers: EnumHelpers<any> = {
	exclude: transformer((target, ...values: readonly any[]) => {
		const valuesSet = new Set(values);
		return {
			fn: (v: unknown): v is any => target(v) && !valuesSet.has(v as any),
			meta: { name: `${target.meta.name}.exclude(${values.map(safeStringify).join(', ')})` },
		};
	}) as any,
	extract: transformer((target, ...values: readonly any[]) => {
		const valuesSet = new Set(values);
		return {
			fn: (v: unknown): v is any => target(v) && valuesSet.has(v as any),
			meta: { name: `${target.meta.name}.extract(${values.map(safeStringify).join(', ')})` },
		};
	}) as any,
};

export const EnumGuardFactory: EnumGuardFactory = (values: readonly any[] | Record<string, any>) => {
	let valuesArray: any[];
	let name: string;

	if (Array.isArray(values)) {
		valuesArray = values;
		name = values.map(safeStringify).join(' | ');
	} else {
		// filter out reverse mapping keys (which are strings of numbers)
		const keys = Object.keys(values).filter(k => isNaN(Number(k)));
		valuesArray = keys.map(k => (values as Record<string, any>)[k]);
		name = keys.join(' | ');
	}

	return makeGuard(
		(v: unknown): v is any => valuesArray.includes(v as any),
		{ name: `enum<${name}>`, id: 'enum', values: new Set(valuesArray) },
		enumHelpers
	) as any;
};
