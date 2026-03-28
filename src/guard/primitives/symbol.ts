// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FACTORY, factory, makeGuard, type Guard } from '../shared.js';

export interface SymbolGuard extends Guard<symbol, typeof symbolHelpers> {}

export interface SymbolHelpers {
	/** Validates the symbol's description string. */
	description: (d: string | RegExp) => Guard<symbol, SymbolHelpers>;
	/** Validates that the symbol is in the global registry (Symbol.for). */
	registered: Guard<symbol, SymbolHelpers>;
	/** Validates the global registry key for the symbol. */
	key: (k: string) => Guard<symbol, SymbolHelpers>;
	/** Validates that the symbol is a built-in "well-known" symbol. */
	wellKnown: Guard<symbol, SymbolHelpers>;
}
const symbolHelpers: SymbolHelpers = {
	description: factory(
		(d: string | RegExp) => (v: symbol) =>
			typeof d === 'string' ? v.description === d : !!v.description && d.test(v.description)
	),
	registered: ((v: symbol) => Symbol.keyFor(v) !== undefined) as any,
	key: factory((k: string) => (v: symbol) => Symbol.keyFor(v) === k),
	wellKnown: ((v: symbol) => {
		return Object.getOwnPropertyNames(Symbol)
			.filter(p => typeof (Symbol as any)[p] === 'symbol')
			.some(p => (Symbol as any)[p] === v);
	}) as any,
};

export const SymbolGuard: SymbolGuard = makeGuard(
	(v: unknown): v is symbol => typeof v === 'symbol',
	{
		name: 'symbol',
		id: 'symbol',
	},
	symbolHelpers
);
