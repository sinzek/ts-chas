import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.json', () => {
	it('validates primitives', () => {
		expect(is.json('hello')).toBe(true);
		expect(is.json(123)).toBe(true);
		expect(is.json(true)).toBe(true);
		expect(is.json(false)).toBe(true);
		expect(is.json(null)).toBe(true);
	});

	it('validates arrays', () => {
		expect(is.json([])).toBe(true);
		expect(is.json([1, 'a', null])).toBe(true);
		expect(is.json([[1, 2], [3, 4]])).toBe(true);
	});

	it('validates objects', () => {
		expect(is.json({})).toBe(true);
		expect(is.json({ a: 1, b: 'foo' })).toBe(true);
		expect(is.json({ a: { b: { c: 1 } } })).toBe(true);
	});

	it('validates complex nested structure', () => {
		const complex = {
			name: 'Bob',
			age: 30,
			hobbies: ['coding', 'reading'],
			address: {
				street: '123 Main St',
				city: 'Anytown',
				zip: 12345,
			},
			active: true,
			meta: null,
		};
		expect(is.json(complex)).toBe(true);
	});

	it('rejects non-JSON primitives', () => {
		expect(is.json(undefined)).toBe(false);
		expect(is.json(Symbol('foo'))).toBe(false);
		expect(is.json(10n)).toBe(false); // BigInt is not JSON
	});

	it('rejects functions', () => {
		expect(is.json(() => {})).toBe(false);
		expect(is.json({ a: () => {} })).toBe(false);
	});

	it('rejects non-JSON collections (Map, Set, Date, RegExp)', () => {
		// Only plain objects (prototype === Object.prototype or null) count as JSON.
		expect(is.json(new Map())).toBe(false);
		expect(is.json(new Set())).toBe(false);
		expect(is.json(new Map([['a', 1]]))).toBe(false);
		expect(is.json(new Date())).toBe(false);
		expect(is.json(/regex/)).toBe(false);
		class User {
			name = 'Alice';
		}
		expect(is.json(new User())).toBe(false);
	});

	it('rejects non-finite numbers (NaN, Infinity)', () => {
		expect(is.json(NaN)).toBe(false);
		expect(is.json(Infinity)).toBe(false);
		expect(is.json(-Infinity)).toBe(false);
		expect(is.json({ x: NaN })).toBe(false);
	});

	it('narrows correctly', () => {
		const value: unknown = { a: 1 };
		if (is.json(value)) {
			// value is now JsonValue. JsonValue can be an object.
			expect(typeof value).toBe('object');
			// We can't access fields directly because it could be string/number/etc.
			// but we can check it's an object first.
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				expect(value.a).toBe(1);
			}
		}
	});

	it('works with parse', () => {
		const result = is.json.parse({ a: 1 });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ a: 1 });

		const fail = is.json.parse(undefined);
		expect(fail.isErr()).toBe(true);
	});

	describe('helpers', () => {
		it('.object narrows to JsonObject', () => {
			expect(is.json.object({ a: 1 })).toBe(true);
			expect(is.json.object([])).toBe(false);
			expect(is.json.object(1)).toBe(false);
		});

		it('.array narrows to JsonArray', () => {
			expect(is.json.array([1, 2])).toBe(true);
			expect(is.json.array({})).toBe(false);
			expect(is.json.array('foo')).toBe(false);
		});

		it('.primitive narrows to Json primitives', () => {
			expect(is.json.primitive('foo')).toBe(true);
			expect(is.json.primitive(123)).toBe(true);
			expect(is.json.primitive(null)).toBe(true);
			expect(is.json.primitive({})).toBe(false);
			expect(is.json.primitive([])).toBe(false);
		});

		it('.stringify transforms to string', () => {
			const res = is.json.stringify.parse({ a: 1 });
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe('{"a":1}');
		});

		it('chains helpers', () => {
			const guard = is.json.object.stringify;
			const res = guard.parse({ x: 10 });
			expect(res.unwrap()).toBe('{"x":10}');

			const fail = guard.parse([1, 2]);
			expect(fail.isErr()).toBe(true);
		});
	});
});
