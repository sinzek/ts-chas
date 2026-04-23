import { makeGuard, factory, type Guard } from '../shared.js';

export interface FormDataHelpers {
	nonEmpty: Guard<FormData, FormDataHelpers>;
	empty: Guard<FormData, FormDataHelpers>;
	has: (...keys: string[]) => Guard<FormData, FormDataHelpers>;
}

const formDataHelpers: FormDataHelpers = {
	nonEmpty: ((v: unknown) => typeof FormData !== 'undefined' && v instanceof FormData && !v.keys().next().done) as any,
	empty: ((v: unknown) => typeof FormData !== 'undefined' && v instanceof FormData && !!v.keys().next().done) as any,
	has: factory((...keys: string[]) => (v: unknown) => {
		if (typeof FormData === 'undefined' || !(v instanceof FormData)) return false;
		return keys.every(key => v.has(key));
	}),
};

import { JSON_SCHEMA } from '../shared.js';

(formDataHelpers.nonEmpty as any)[JSON_SCHEMA] = () => ({ minProperties: 1 });
(formDataHelpers.empty as any)[JSON_SCHEMA] = () => ({ minProperties: 0, maxProperties: 0 });
(formDataHelpers.has as any)[JSON_SCHEMA] = (...keys: string[]) => ({ _formDataHasKeys: keys });

export interface FormDataGuard extends Guard<FormData, FormDataHelpers> {}

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
