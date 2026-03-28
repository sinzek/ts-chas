import { makeGuard, type Guard, transformer } from '../shared.js';

export interface EnumHelpers<T> {
	/** Excludes specific values from the enum. */
	exclude: <U extends T>(...values: readonly U[]) => Guard<Exclude<T, U>, EnumHelpers<Exclude<T, U>>>;
	/** Extracts only specific values from the enum. */
	extract: <U extends T>(...values: readonly U[]) => Guard<Extract<T, U>, EnumHelpers<Extract<T, U>>>;
}

export interface EnumGuardFactory {
	<T extends string | number | symbol>(values: readonly T[]): Guard<T, EnumHelpers<T>>;
	<T extends Record<string, string | number | symbol>>(values: T): Guard<T[keyof T], EnumHelpers<T[keyof T]>>;
}

const enumHelpers: EnumHelpers<any> = {
	exclude: transformer((target, ...values: readonly any[]) => {
		const valuesSet = new Set(values);
		return {
			fn: (v: unknown): v is any => target(v) && !valuesSet.has(v as any),
			meta: { name: `${target.meta.name}.exclude(${values.join(', ')})` },
		};
	}) as any,
	extract: transformer((target, ...values: readonly any[]) => {
		const valuesSet = new Set(values);
		return {
			fn: (v: unknown): v is any => target(v) && valuesSet.has(v as any),
			meta: { name: `${target.meta.name}.extract(${values.join(', ')})` },
		};
	}) as any,
};

export const EnumGuardFactory: EnumGuardFactory = (values: readonly any[] | Record<string, any>) => {
	let valuesArray: any[];
	let name: string;

	if (Array.isArray(values)) {
		valuesArray = values;
		name = values.join(' | ');
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
