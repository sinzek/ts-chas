import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('Complex Nested Coercions', () => {
	it('should handle deep nested object coercion', () => {
		const schema = is.object({
			id: is.number.coerce,
			user: is.object({
				active: is.boolean.coerce,
				settings: is.object({
					retries: is.number.coerce.gte(0),
					debug: is.boolean.coerce.fallback(false),
				}),
			}),
		});

		const input = {
			id: '123',
			user: {
				active: 'true',
				settings: {
					retries: '5',
					debug: 'off', // falsy boolStr
				},
			},
		};

		const result = schema.parse(input);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			id: 123,
			user: {
				active: true,
				settings: {
					retries: 5,
					debug: false,
				},
			},
		});
	});

	it('should handle arrays of coerced objects', () => {
		const schema = is.array(
			is.object({
				index: is.number.coerce,
				tags: is.array(is.string.trim().toLowerCase()).min(1),
				metadata: is.object({
					priority: is.number.coerce.fallback(1),
				}).optional,
			})
		);

		const input = [
			{ index: '0', tags: ['  First  ', 'SECOND'] },
			{ index: '1', tags: ['Third'], metadata: { priority: '10' } },
		];

		const result = schema.parse(input);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([
			{ index: 0, tags: ['first', 'second'] },
			{ index: 1, tags: ['third'], metadata: { priority: 10 } },
		]);
	});

	it('should handle deep nesting: Object -> Array -> Object -> Primitives', () => {
		const schema = is.object({
			org: is.string,
			departments: is.array(
				is.object({
					name: is.string.trim(),
					employees: is.array(
						is.object({
							name: is.string,
							salary: is.number.coerce,
							isRemote: is.boolean.coerce,
						})
					),
				})
			),
		});

		const input = {
			org: 'TechCorp',
			departments: [
				{
					name: '  Engineering  ',
					employees: [
						{ name: 'Alice', salary: '100000', isRemote: '1' },
						{ name: 'Bob', salary: '95000', isRemote: 'no' },
					],
				},
			],
		};

		const result = schema.parse(input);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			org: 'TechCorp',
			departments: [
				{
					name: 'Engineering',
					employees: [
						{ name: 'Alice', salary: 100000, isRemote: true },
						{ name: 'Bob', salary: 95000, isRemote: false },
					],
				},
			],
		});
	});

	it('should handle JSON parsing inside an object followed by coercion', () => {
		const schema = is.object({
			rawJson: is.string.parsedJson({
				schema: is.object({
					count: is.number.coerce,
					enabled: is.boolean.coerce,
				}),
				type: 'object',
			}),
		});

		const input = {
			rawJson: '{"count": "42", "enabled": "ON"}',
		};

		const result = schema.parse(input);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			rawJson: {
				count: 42,
				enabled: true,
			},
		});
	});

	it('should handle mixed transform and coercion in deep structures', () => {
		const schema = is.object({
			data: is.array(is.string.coerce.trim().transform(s => s.length)).min(1),
		});

		// input is array of things that can be coerced to string, then trimmed, then length extracted
		const input = {
			data: [123, true, '  hello  '],
		};

		const result = schema.parse(input);
		expect(result.isOk()).toBe(true);
		// "123" -> 3
		// "true" -> 4
		// "hello" -> 5
		expect(result.unwrap().data).toEqual([3, 4, 5]);
	});

	it('should ensure composition (and) works with deep coercion', () => {
		const part1 = is.object({
			base: is.object({
				id: is.number.coerce,
			}),
		});

		const part2 = is.object({
			base: is.object({
				type: is.string.toLowerCase(),
			}),
		});

		const combined = part1.and(part2);

		const input = {
			base: {
				id: '999',
				type: 'ADMIN',
			},
		};

		const result = combined.parse(input);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			base: {
				id: 999,
				type: 'admin',
			},
		});
	});

	it('should correctly handle failure at deep levels in complex structures', () => {
		const schema = is.object({
			items: is.array(
				is.object({
					val: is.number.coerce.gte(100),
				})
			),
		});

		const input = {
			items: [
				{ val: '150' },
				{ val: '50' }, // Fail: < 100
			],
		};

		const result = schema.parse(input);
		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().message).toContain('failed validation');
	});
});
