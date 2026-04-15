import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('.toJsonSchema()', () => {
	// ---- primitives --------------------------------------------------------

	it('string → { type: "string" }', () => {
		expect(is.string.toJsonSchema()).toEqual({ type: 'string' });
	});

	it('number → { type: "number" }', () => {
		expect(is.number.toJsonSchema()).toEqual({ type: 'number' });
	});

	it('boolean → { type: "boolean" }', () => {
		expect(is.boolean.toJsonSchema()).toEqual({ type: 'boolean' });
	});

	it('null → { type: "null" }', () => {
		expect(is.null.toJsonSchema()).toEqual({ type: 'null' });
	});

	it('date → { type: "string", format: "date-time" }', () => {
		expect(is.date.toJsonSchema()).toEqual({ type: 'string', format: 'date-time' });
	});

	// ---- string constraints -----------------------------------------------

	it('string.email → format: "email"', () => {
		expect(is.string.email.toJsonSchema()).toEqual({ type: 'string', format: 'email' });
	});

	it('string.url → format: "uri"', () => {
		expect(is.string.url.toJsonSchema()).toEqual({ type: 'string', format: 'uri' });
	});

	it('string.uuid() → format: "uuid"', () => {
		expect(is.string.uuid().toJsonSchema()).toEqual({ type: 'string', format: 'uuid' });
	});

	it('string.ipv4 → format: "ipv4"', () => {
		expect(is.string.ipv4.toJsonSchema()).toEqual({ type: 'string', format: 'ipv4' });
	});

	it('string.ipv6 → format: "ipv6"', () => {
		expect(is.string.ipv6.toJsonSchema()).toEqual({ type: 'string', format: 'ipv6' });
	});

	it('string.min(5) → minLength: 5', () => {
		expect(is.string.min(5).toJsonSchema()).toEqual({ type: 'string', minLength: 5 });
	});

	it('string.max(100) → maxLength: 100', () => {
		expect(is.string.max(100).toJsonSchema()).toEqual({ type: 'string', maxLength: 100 });
	});

	it('string.length(10) → minLength + maxLength', () => {
		expect(is.string.length(10).toJsonSchema()).toEqual({
			type: 'string',
			minLength: 10,
			maxLength: 10,
		});
	});

	it('string.regex(/^\\d+$/) → pattern', () => {
		expect(is.string.regex(/^\d+$/).toJsonSchema()).toEqual({
			type: 'string',
			pattern: '^\\d+$',
		});
	});

	it('string.email.min(5).max(100) chains constraints', () => {
		expect(is.string.email.min(5).max(100).toJsonSchema()).toEqual({
			type: 'string',
			format: 'email',
			minLength: 5,
			maxLength: 100,
		});
	});

	// ---- number constraints -----------------------------------------------

	it('number.int → type: "integer"', () => {
		expect(is.number.int.toJsonSchema()).toEqual({ type: 'integer' });
	});

	it('number.positive → exclusiveMinimum: 0', () => {
		expect(is.number.positive.toJsonSchema()).toEqual({
			type: 'number',
			exclusiveMinimum: 0,
		});
	});

	it('number.nonnegative → minimum: 0', () => {
		expect(is.number.nonnegative.toJsonSchema()).toEqual({ type: 'number', minimum: 0 });
	});

	it('number.gte(0) → minimum: 0', () => {
		expect(is.number.gte(0).toJsonSchema()).toEqual({ type: 'number', minimum: 0 });
	});

	it('number.lte(100) → maximum: 100', () => {
		expect(is.number.lte(100).toJsonSchema()).toEqual({ type: 'number', maximum: 100 });
	});

	it('number.gt(0) → exclusiveMinimum: 0', () => {
		expect(is.number.gt(0).toJsonSchema()).toEqual({ type: 'number', exclusiveMinimum: 0 });
	});

	it('number.lt(100) → exclusiveMaximum: 100', () => {
		expect(is.number.lt(100).toJsonSchema()).toEqual({ type: 'number', exclusiveMaximum: 100 });
	});

	it('number.between(1, 10) → minimum + maximum', () => {
		expect(is.number.between(1, 10).toJsonSchema()).toEqual({
			type: 'number',
			minimum: 1,
			maximum: 10,
		});
	});

	it('number.multipleOf(5) → multipleOf: 5', () => {
		expect(is.number.multipleOf(5).toJsonSchema()).toEqual({
			type: 'number',
			multipleOf: 5,
		});
	});

	it('number.port → integer 0–65535', () => {
		expect(is.number.port.toJsonSchema()).toEqual({
			type: 'integer',
			minimum: 0,
			maximum: 65535,
		});
	});

	it('number.int.gte(0) combines constraints', () => {
		expect(is.number.int.gte(0).toJsonSchema()).toEqual({
			type: 'integer',
			minimum: 0,
		});
	});

	// ---- boolean constraints -----------------------------------------------

	it('boolean.true → const: true', () => {
		expect(is.boolean.true.toJsonSchema()).toMatchObject({ const: true });
	});

	it('boolean.false → const: false', () => {
		expect(is.boolean.false.toJsonSchema()).toMatchObject({ const: false });
	});

	// ---- bigint constraints ------------------------------------------------

	it('bigint → type: "integer"', () => {
		expect(is.bigint.toJsonSchema()).toEqual({ type: 'integer' });
	});

	it('bigint.positive → _bigintExclusiveMin: "0"', () => {
		expect((is.bigint.positive.toJsonSchema() as any)._bigintExclusiveMin).toBe('0');
	});

	it('bigint.gte(10n) → _bigintMin: "10"', () => {
		expect((is.bigint.gte(10n).toJsonSchema() as any)._bigintMin).toBe('10');
	});

	it('bigint.between(1n, 100n) → _bigintMin + _bigintMax', () => {
		const schema = is.bigint.between(1n, 100n).toJsonSchema() as any;
		expect(schema._bigintMin).toBe('1');
		expect(schema._bigintMax).toBe('100');
	});

	it('bigint.even → _bigintEven: true', () => {
		expect((is.bigint.even.toJsonSchema() as any)._bigintEven).toBe(true);
	});

	it('bigint.multipleOf(5n) → _bigintMultipleOf: "5"', () => {
		expect((is.bigint.multipleOf(5n).toJsonSchema() as any)._bigintMultipleOf).toBe('5');
	});

	// ---- nullable / optional ----------------------------------------------

	it('string.nullable → type: ["string", "null"]', () => {
		expect(is.string.nullable.toJsonSchema()).toEqual({ type: ['string', 'null'] });
	});

	it('number.nullable → type: ["number", "null"]', () => {
		expect(is.number.nullable.toJsonSchema()).toEqual({ type: ['number', 'null'] });
	});

	it('string.email.nullable chains with nullable', () => {
		expect(is.string.email.nullable.toJsonSchema()).toEqual({
			type: ['string', 'null'],
			format: 'email',
		});
	});

	// ---- literal / enum ---------------------------------------------------

	it('literal("a") → const: "a"', () => {
		expect(is.literal('a').toJsonSchema()).toEqual({ const: 'a' });
	});

	it('literal("a", "b", "c") → enum', () => {
		expect(is.literal('a', 'b', 'c').toJsonSchema()).toEqual({ enum: ['a', 'b', 'c'] });
	});

	it('enum(["x", "y"]) → enum values', () => {
		expect(is.enum(['x', 'y']).toJsonSchema()).toEqual({ enum: ['x', 'y'] });
	});

	// ---- objects ----------------------------------------------------------

	it('object({}) → { type: "object" }', () => {
		expect(is.object({}).toJsonSchema()).toEqual({ type: 'object' });
	});

	it('object with fields generates properties + required', () => {
		const schema = is.object({ name: is.string, age: is.number }).toJsonSchema();
		expect(schema).toEqual({
			type: 'object',
			properties: {
				name: { type: 'string' },
				age: { type: 'number' },
			},
			required: ['name', 'age'],
		});
	});

	it('optional fields are omitted from required', () => {
		const schema = is.object({ name: is.string, age: is.number.optional }).toJsonSchema();
		expect(schema.required).toEqual(['name']);
		expect(schema.properties?.age).toBeDefined();
	});

	it('nullable fields use type array', () => {
		const schema = is.object({ id: is.string, note: is.string.nullable }).toJsonSchema();
		expect(schema.properties?.note).toEqual({ type: ['string', 'null'] });
		expect(schema.required).toContain('note'); // nullable ≠ optional — still required
	});

	it('nested objects recurse', () => {
		const schema = is
			.object({
				user: is.object({ name: is.string }),
			})
			.toJsonSchema();
		expect(schema.properties?.user).toEqual({
			type: 'object',
			properties: { name: { type: 'string' } },
			required: ['name'],
		});
	});

	it('no _nullable / _optional internal flags leak into output', () => {
		const schema = is.object({ x: is.string.optional }).toJsonSchema();
		expect('_optional' in (schema.properties?.x ?? {})).toBe(false);
		expect('_nullable' in (schema.properties?.x ?? {})).toBe(false);
	});

	// ---- arrays -----------------------------------------------------------

	it('array() → { type: "array" }', () => {
		expect(is.array().toJsonSchema()).toEqual({ type: 'array' });
	});

	it('array(is.string) → items: { type: "string" }', () => {
		expect(is.array(is.string).toJsonSchema()).toEqual({
			type: 'array',
			items: { type: 'string' },
		});
	});

	it('array(is.string.email) → items with format', () => {
		expect(is.array(is.string.email).toJsonSchema()).toEqual({
			type: 'array',
			items: { type: 'string', format: 'email' },
		});
	});

	it('string.array (universal helper) → type: array with items', () => {
		expect(is.string.array.toJsonSchema()).toEqual({
			type: 'array',
			items: { type: 'string' },
		});
	});

	// ---- array helpers ----------------------------------------------------

	it('array.nonEmpty → minItems: 1', () => {
		expect(is.array(is.string).nonEmpty.toJsonSchema()).toMatchObject({ minItems: 1 });
	});

	it('array.empty → minItems: 0, maxItems: 0', () => {
		expect(is.array(is.string).empty.toJsonSchema()).toMatchObject({ minItems: 0, maxItems: 0 });
	});

	it('array.unique → uniqueItems: true', () => {
		expect(is.array(is.string).unique.toJsonSchema()).toMatchObject({ uniqueItems: true });
	});

	it('array.min(3) → minItems: 3', () => {
		expect(is.array(is.string).min(3).toJsonSchema()).toMatchObject({ minItems: 3 });
	});

	it('array.max(10) → maxItems: 10', () => {
		expect(is.array(is.string).max(10).toJsonSchema()).toMatchObject({ maxItems: 10 });
	});

	it('array.size(5) → minItems: 5, maxItems: 5', () => {
		expect(is.array(is.string).size(5).toJsonSchema()).toMatchObject({ minItems: 5, maxItems: 5 });
	});

	it('array.includes(x) → _arrayIncludes: x', () => {
		expect((is.array(is.string).includes('hello').toJsonSchema() as any)._arrayIncludes).toBe('hello');
	});

	// ---- object helpers ---------------------------------------------------

	it('object.minSize(2) → minProperties: 2', () => {
		expect(is.object({}).minSize(2).toJsonSchema()).toMatchObject({ minProperties: 2 });
	});

	it('object.maxSize(5) → maxProperties: 5', () => {
		expect(is.object({}).maxSize(5).toJsonSchema()).toMatchObject({ maxProperties: 5 });
	});

	it('object.size(3) → minProperties: 3, maxProperties: 3', () => {
		expect(is.object({}).size(3).toJsonSchema()).toMatchObject({ minProperties: 3, maxProperties: 3 });
	});

	it('object.strict → additionalProperties: false', () => {
		expect(is.object({ name: is.string }).strict.toJsonSchema()).toMatchObject({
			additionalProperties: false,
		});
	});

	// ---- tuples -----------------------------------------------------------

	it('tuple([is.string, is.number]) → prefixItems + items: false', () => {
		const schema = is.tuple([is.string, is.number]).toJsonSchema() as any;
		expect(schema.type).toBe('array');
		expect(schema.prefixItems).toHaveLength(2);
		expect(schema.prefixItems[0]).toEqual({ type: 'string' });
		expect(schema.prefixItems[1]).toEqual({ type: 'number' });
		expect(schema.items).toBe(false);
	});

	it('tuple with rest guard → items is the rest schema', () => {
		const schema = is.tuple([is.string], is.number).toJsonSchema();
		expect(schema.prefixItems[0]).toEqual({ type: 'string' });
		expect(schema.items).toEqual({ type: 'number' });
	});

	it('tuple.min(2) → minItems: 2', () => {
		expect(is.tuple([is.string, is.number]).min(2).toJsonSchema()).toMatchObject({ minItems: 2 });
	});

	it('tuple.unique → uniqueItems: true', () => {
		expect(is.tuple([is.string, is.string]).unique.toJsonSchema()).toMatchObject({ uniqueItems: true });
	});

	// ---- union ------------------------------------------------------------

	it('union(is.string, is.number) → anyOf', () => {
		const schema = is.union(is.string, is.number).toJsonSchema();
		expect(schema).toEqual({ anyOf: [{ type: 'string' }, { type: 'number' }] });
	});

	// ---- discriminated union ---------------------------------------------

	it('discriminatedUnion → anyOf with discriminant const', () => {
		const schema = is
			.discriminatedUnion('kind', {
				circle: is.object({ radius: is.number }),
				square: is.object({ side: is.number }),
			})
			.toJsonSchema();
		expect(schema.anyOf).toHaveLength(2);
		const circleVariant = schema.anyOf?.find(v => v.properties?.kind?.const === 'circle');
		expect(circleVariant?.properties?.radius).toEqual({ type: 'number' });
	});
});
