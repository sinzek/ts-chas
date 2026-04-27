import { safeStringify } from '../../utils.js';
import { type Guard } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { transformer } from '../base/helper-markers.js';

export interface EnumHelpers<T> {
	/** Excludes specific values from the enum. */
	exclude: <U extends T>(...values: readonly U[]) => EnumGuard<Exclude<T, U>>;
	/** Extracts only specific values from the enum. */
	extract: <U extends T>(...values: readonly U[]) => EnumGuard<Extract<T, U>>;
}

export interface EnumGuard<T> extends Guard<T, EnumHelpers<T>, EnumGuard<T>> {}

export interface EnumGuardFactory {
	<const T extends string | number | symbol>(values: readonly T[]): EnumGuard<T>;
	<const T extends Record<string, string | number | symbol>>(values: T): EnumGuard<T[keyof T]>;
}

export const enumHelpers: EnumHelpers<any> = {
	exclude: transformer((target, ...values: readonly any[]) => {
		const excludeSet = new Set(values);
		const parentValues = target.meta.values instanceof Set ? target.meta.values : new Set<any>();
		const nextValues = new Set<any>();
		for (const v of parentValues) {
			if (!excludeSet.has(v)) nextValues.add(v);
		}
		return {
			fn: (v: unknown): v is any => target(v) && !excludeSet.has(v as any),
			meta: {
				name: `${target.meta.name}.exclude(${values.map(safeStringify).join(', ')})`,
				values: nextValues,
				jsonSchema: { ...(target.meta.jsonSchema ?? {}), enum: [...nextValues] },
			},
		};
	}) as any,
	extract: transformer((target, ...values: readonly any[]) => {
		const extractSet = new Set(values);
		const parentValues = target.meta.values instanceof Set ? target.meta.values : new Set<any>();
		const nextValues = new Set<any>();
		for (const v of parentValues) {
			if (extractSet.has(v)) nextValues.add(v);
		}
		return {
			fn: (v: unknown): v is any => target(v) && extractSet.has(v as any),
			meta: {
				name: `${target.meta.name}.extract(${values.map(safeStringify).join(', ')})`,
				values: nextValues,
				jsonSchema: { ...(target.meta.jsonSchema ?? {}), enum: [...nextValues] },
			},
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
		(v: unknown): v is any => {
			for (const candidate of valuesArray) {
				if (Object.is(candidate, v)) return true;
			}
			return false;
		},
		{ name: `enum<${name}>`, id: 'enum', values: new Set(valuesArray) },
		enumHelpers
	) as any;
};
