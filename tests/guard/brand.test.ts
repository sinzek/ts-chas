import { describe, it } from 'vitest';
import { Brand, Guard, is } from '../../src/guard/index.js';

describe('Brand', () => {
	it('Brand type creates unique types for each brand', () => {
		const stringbrand = is.string.brand('hey');
		const numberbrand = is.number.brand('hey');

		function takesOneString<Tag extends PropertyKey, T extends string>(_: Guard<Brand<Tag, T>>) {}

		takesOneString(stringbrand);
		// @ts-expect-error - numberbrand is not a string
		takesOneString(numberbrand);
	});
});
