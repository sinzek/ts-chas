import { makeGuard, type Guard, type InferGuard } from '../shared.js';

type Interpolable = string | number | bigint | boolean | null | undefined;
type TemplatePart = string | Guard<Interpolable, any>;

type InferTemplateLiteral<T extends readonly TemplatePart[]> = T extends readonly []
	? ``
	: T extends readonly [infer Head, ...infer Tail extends readonly TemplatePart[]]
		? Head extends string
			? `${Head}${InferTemplateLiteral<Tail>}`
			: Head extends Guard<any, any>
				? `${InferGuard<Head> & Interpolable}${InferTemplateLiteral<Tail>}`
				: never
		: string;

export interface TemplateLiteralGuardFactory {
	<const T extends readonly TemplatePart[]>(...parts: T): Guard<InferTemplateLiteral<T>>;
}

const templateLiteralHelpers = {};

export const TemplateLiteralGuardFactory: TemplateLiteralGuardFactory = (...parts: TemplatePart[]) => {
	const regexParts: string[] = ['^'];
	const guardIndices: { index: number; guard: Guard<any, any> }[] = [];
	let groupIndex = 0;

	for (const part of parts) {
		if (typeof part === 'string') {
			regexParts.push(escapeRegex(part));
		} else {
			// use a capture group with a pattern based on the guard's inferred type
			const pattern = guardToPattern(part);
			regexParts.push(`(${pattern})`);
			guardIndices.push({ index: groupIndex, guard: part });
			groupIndex++;
		}
	}

	regexParts.push('$');
	const regex = new RegExp(regexParts.join(''));

	const fn = (value: unknown): value is any => {
		if (typeof value !== 'string') return false;

		const match = regex.exec(value);
		if (!match) return false;

		// validate each captured group against its guard
		for (const { index, guard } of guardIndices) {
			const captured = match[index + 1];
			if (captured === undefined) return false;

			const coerced = coerceCapture(captured, guard);
			if (!guard(coerced)) return false;
		}

		return true;
	};

	const name = parts.map(p => (typeof p === 'string' ? p : `\${${p.meta.name}}`)).join('');

	return makeGuard(fn, { name: `templateLiteral<\`${name}\`>`, id: 'templateLiteral' }, templateLiteralHelpers);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Maps a guard to a regex pattern for its capture group.
 * Uses greedy-but-correct patterns based on the guard's id.
 */
function guardToPattern(guard: Guard<any, any>): string {
	const id = guard.meta.id;

	switch (id) {
		case 'number':
			return '-?(?:\\d+\\.?\\d*|\\d*\\.\\d+)(?:[eE][+-]?\\d+)?';
		case 'bigint':
			return '-?\\d+';
		case 'boolean':
			return 'true|false';
		case 'null':
			return 'null';
		case 'undefined':
			return 'undefined';
		case 'literal': {
			const values = guard.meta.values;
			if (values instanceof Set) {
				return [...values].map(v => escapeRegex(String(v))).join('|');
			}
			return '.+?';
		}
		case 'enum': {
			const values = guard.meta.values;
			if (values instanceof Set) {
				return [...values].map(v => escapeRegex(String(v))).join('|');
			}
			return '.+?';
		}
		case 'string':
		default:
			return '.*?';
	}
}

/**
 * Coerces a captured string back to the primitive type expected by the guard,
 * so that the guard can validate it correctly.
 */
function coerceCapture(captured: string, guard: Guard<any, any>): unknown {
	const id = guard.meta.id;

	switch (id) {
		case 'number':
			return Number(captured);
		case 'bigint':
			try {
				return BigInt(captured);
			} catch {
				return captured;
			}
		case 'boolean':
			return captured === 'true';
		case 'null':
			return null;
		case 'undefined':
			return undefined;
		default:
			return captured;
	}
}
