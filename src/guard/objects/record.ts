import { makeGuard, type Guard } from '../shared.js';
import { type ObjectHelpers, objectHelpers } from './shared.js';

export interface RecordGuardFactory {
	<K extends string | number | symbol, V>(
		keyGuard: Guard<K>,
		valGuard: Guard<V, Record<string, any>>
	): Guard<Record<K, V>, ObjectHelpers<Record<K, V>>>;
}

export const RecordGuardFactory: RecordGuardFactory = <K extends string | number | symbol, V>(
	keyGuard: Guard<K>,
	valGuard: Guard<V, Record<string, any>>
) =>
	makeGuard(
		(v: unknown): v is Record<K, V> => {
			if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
			const obj = v as Record<string, unknown>;
			for (const key of Object.keys(obj)) {
				if (!keyGuard(key as K) || !valGuard(obj[key])) return false;
			}
			return true;
		},
		{ name: `record<${keyGuard.meta.name}, ${valGuard.meta.name}>`, id: 'record' },
		objectHelpers as any
	);
