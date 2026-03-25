import { describe, it, expect } from 'vitest';
import { is, defineSchemas, toStandardSchema } from '../src/guard.js';
import type { StandardSchemaV1 } from '../src/standard-schema.js';

describe('Standard Schema Compliance', () => {
	describe('guards have ~standard property', () => {
		it('string guard has ~standard', () => {
			const guard = is.string;
			const std = (guard as any)['~standard'];
			expect(std).toBeDefined();
			expect(std.version).toBe(1);
			expect(std.vendor).toBe('chas');
			expect(typeof std.validate).toBe('function');
		});

		it('chained guard has ~standard', () => {
			const guard = is.string.email;
			const std = (guard as any)['~standard'];
			expect(std).toBeDefined();
			expect(std.version).toBe(1);
		});

		it('number guard has ~standard', () => {
			const guard = is.number.positive;
			const std = (guard as any)['~standard'];
			expect(std).toBeDefined();
		});

		it('~standard.validate returns success for valid values', () => {
			const guard = is.string.email;
			const std = (guard as any)['~standard'];
			const result = std.validate('test@example.com');
			expect(result).toEqual({ value: 'test@example.com' });
		});

		it('~standard.validate returns issues for invalid values', () => {
			const guard = is.string.email;
			const std = (guard as any)['~standard'];
			const result = std.validate('not-email');
			expect(result.issues).toBeDefined();
			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues[0].message).toBeDefined();
		});

		it('~standard.validate returns issues for wrong type', () => {
			const guard = is.string;
			const std = (guard as any)['~standard'];
			const result = std.validate(123);
			expect(result.issues).toBeDefined();
			expect(result.issues.length).toBe(1);
		});
	});

	describe('schema parsers have ~standard property', () => {
		it('schema parser has ~standard', () => {
			const schemas = defineSchemas({
				User: {
					name: is.string,
					age: is.number,
				},
			});
			const std = (schemas.User as any)['~standard'];
			expect(std).toBeDefined();
			expect(std.version).toBe(1);
			expect(std.vendor).toBe('chas');
		});

		it('schema ~standard.validate returns success', () => {
			const schemas = defineSchemas({
				User: { name: is.string, age: is.number },
			});
			const std = (schemas.User as any)['~standard'];
			const result = std.validate({ name: 'John', age: 30 });
			expect(result.value).toEqual({ name: 'John', age: 30 });
			expect(result.issues).toBeUndefined();
		});

		it('schema ~standard.validate returns issues for invalid data', () => {
			const schemas = defineSchemas({
				User: { name: is.string, age: is.number },
			});
			const std = (schemas.User as any)['~standard'];
			const result = std.validate({ name: 123, age: 'thirty' });
			expect(result.issues).toBeDefined();
			expect(result.issues.length).toBeGreaterThan(0);
		});
	});

	describe('toStandardSchema', () => {
		it('converts a guard to Standard Schema', () => {
			const schema = toStandardSchema(is.string.email);
			expect(schema['~standard']).toBeDefined();
			expect(schema['~standard'].version).toBe(1);
			expect(schema['~standard'].vendor).toBe('chas');
		});

		it('toStandardSchema validate works correctly', () => {
			const schema = toStandardSchema(is.number.positive);
			expect(schema['~standard'].validate(42)).toEqual({ value: 42 });
			expect(schema['~standard'].validate(-1)).toHaveProperty('issues');
			expect(schema['~standard'].validate('hello')).toHaveProperty('issues');
		});
	});
});
