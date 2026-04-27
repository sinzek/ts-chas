import { type Guard, JSON_SCHEMA } from '../base/shared.js';
import { makeGuard } from '../base/proxy.js';
import { factory } from '../base/helper-markers.js';

export interface FormDataHelpers {
	nonEmpty: FormDataGuard;
	empty: FormDataGuard;
	has: (...keys: string[]) => FormDataGuard;
}

const formDataHelpers: FormDataHelpers = {
	nonEmpty: ((v: unknown) =>
		typeof FormData !== 'undefined' && v instanceof FormData && !v.keys().next().done) as any,
	empty: ((v: unknown) => typeof FormData !== 'undefined' && v instanceof FormData && !!v.keys().next().done) as any,
	has: factory((...keys: string[]) => (v: unknown) => {
		if (typeof FormData === 'undefined' || !(v instanceof FormData)) return false;
		return keys.every(key => v.has(key));
	}),
};

(formDataHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minProperties: 1 });
(formDataHelpers.empty as any)[JSON_SCHEMA] = () => ({ minProperties: 0, maxProperties: 0 });
(formDataHelpers.has as any)[JSON_SCHEMA] = (...keys: string[]) => ({ _formDataHasKeys: keys });

export interface FormDataGuard extends Guard<FormData, FormDataHelpers, FormDataGuard> {}

/**
 * Validates that a value is a FormData instance.
 *
 * Provides helpers such as `.has(...keys)` and `.empty` / `.nonEmpty`.
 */
export const FormDataGuard: FormDataGuard = makeGuard(
	(v: unknown): v is FormData => typeof FormData !== 'undefined' && v instanceof FormData,
	{ name: 'formData', id: 'formData' },
	formDataHelpers as any
);
