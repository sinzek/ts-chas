import { makeGuard, type Guard } from '../shared.js';

export interface SymbolGuard extends Guard<symbol, typeof symbolHelpers> {}

const symbolHelpers = {};

export const SymbolGuard: SymbolGuard = makeGuard(
	(v: unknown): v is symbol => typeof v === 'symbol',
	{
		name: 'symbol',
		id: 'symbol',
	},
	symbolHelpers
);
