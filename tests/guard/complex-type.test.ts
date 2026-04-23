import { describe, it, expect } from 'vitest';
import { is, defineSchemas, defineSchema } from '../../src/guard/index.js';

// =============================================================================
// Complex Nested Coercions
// =============================================================================

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

// =============================================================================
// Complex Nested Guard Validation (without schema)
// =============================================================================

describe('Complex Nested Guard Validation', () => {
	it('should validate and transform deeply nested optional fields via schema', () => {
		// Nested fallbacks require defineSchema (recursive validation), not guard.parse (fail-fast)
		const schema = defineSchema(
			'Config',
			is.object({
				config: is.object({
					name: is.string.trim().min(1),
					retries: is.number.int.gte(0).fallback(3),
					debug: is.boolean.fallback(false),
					tags: is.array(is.string.trim().toLowerCase()).fallback([]),
				}),
			})
		);

		const result = schema.parse({
			config: {
				name: '  server-01  ',
				// retries, debug, tags all missing -> fallbacks
			},
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			config: {
				name: 'server-01',
				retries: 3,
				debug: false,
				tags: [],
			},
		});
	});

	it('should handle nullable and optional in nested arrays', () => {
		const guard = is.object({
			rows: is.array(
				is.object({
					label: is.string,
					value: is.number.nullable,
					note: is.string.optional,
				})
			),
		});

		expect(
			guard
				.parse({
					rows: [
						{ label: 'a', value: 1 },
						{ label: 'b', value: null },
						{ label: 'c', value: 42, note: 'important' },
					],
				})
				.isOk()
		).toBe(true);

		expect(
			guard
				.parse({
					rows: [{ label: 'x', value: undefined }], // value is nullable, not optional
				})
				.isErr()
		).toBe(true);
	});

	it('should handle union element arrays (validation only, unions have no transforms)', () => {
		const numOrStr = is.union(is.number, is.string);

		const guard = is.object({
			items: is.array(numOrStr),
		});

		// Union validates that each element is a number or string
		const result = guard.parse({ items: [42, 'hello', 0, 'world'] });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ items: [42, 'hello', 0, 'world'] });

		// Mixed with invalid types fails
		expect(guard.parse({ items: [42, true] }).isErr()).toBe(true);
	});

	it('should apply object extend with validation on both sides', () => {
		const base = is.object({
			name: is.string.min(1),
		});

		const extended = base.extend({
			email: is.string.email,
		});

		// Both base and extended fields are validated
		expect(extended.parse({ name: 'Alice', email: 'alice@example.com' }).isOk()).toBe(true);
		expect(extended.parse({ name: '', email: 'alice@example.com' }).isErr()).toBe(true);
		expect(extended.parse({ name: 'Alice', email: 'not-email' }).isErr()).toBe(true);
	});

	it('should handle partial validation', () => {
		const full = is.object({
			a: is.number,
			b: is.boolean,
			c: is.string.min(1),
		});

		const partial = full.partial();

		// All fields are optional
		expect(partial.parse({}).isOk()).toBe(true);
		expect(partial.parse({ a: 42 }).isOk()).toBe(true);
		expect(partial.parse({ a: 42, b: true, c: 'hello' }).isOk()).toBe(true);

		// But if provided, fields must still pass validation
		expect(partial.parse({ a: 'not a number' }).isErr()).toBe(true);
		expect(partial.parse({ c: '' }).isErr()).toBe(true);
	});

	it('should handle pick/omit with transforms', () => {
		const guard = is.object({
			id: is.number.coerce,
			name: is.string.trim(),
			email: is.string.trim().toLowerCase(),
			age: is.number,
		});

		const picked = guard.pick(['id', 'name']);
		const result = picked.parse({ id: '5', name: '  Bob  ', email: 'ignored', age: 99 });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ id: 5, name: 'Bob' });

		const omitted = guard.omit(['age', 'email']);
		const result2 = omitted.parse({ id: '99', name: '  Eve  ', age: 30, email: 'x@y.com' });
		expect(result2.isOk()).toBe(true);
		expect(result2.unwrap()).toEqual({ id: 99, name: 'Eve' });
	});

	it('should handle tuple with coerced elements via schema', () => {
		// Tuple transforms require defineSchema (recursive validation applies transforms per element)
		const schema = defineSchema('Tuple', is.tuple([is.number.coerce, is.string.trim(), is.boolean.coerce]));

		const result = schema.parse(['42', '  hello  ', 'yes']);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([42, 'hello', true]);
	});

	it('should handle tuple with rest and transforms via schema', () => {
		const schema = defineSchema('TupleRest', is.tuple([is.string.trim(), is.number.coerce], is.boolean.coerce));

		const result = schema.parse(['  header  ', '100', '1', 'no', 'true']);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual(['header', 100, true, false, true]);
	});

	it('should handle nested transforms with where', () => {
		const guard = is
			.object({
				password: is.string.trim().min(8),
				confirm: is.string.trim(),
			})
			.where(v => {
				const obj = v as { password: string; confirm: string };
				return obj.password === obj.confirm;
			});

		expect(guard.parse({ password: '  secret123  ', confirm: '  secret123  ' }).isOk()).toBe(true);
		expect(guard.parse({ password: '  secret123  ', confirm: '  different  ' }).isErr()).toBe(true);
	});

	it('should handle refine in nested contexts', () => {
		const guard = is.object({
			values: is.array(is.number.coerce.refine(n => Math.round(n))),
		});

		const result = guard.parse({ values: ['1.7', '2.3', '3.9'] });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ values: [2, 2, 4] });
	});

	it('should handle enum inside nested structures', () => {
		const guard = is.object({
			users: is.array(
				is.object({
					role: is.enum(['admin', 'user', 'guest'] as const),
					level: is.number.coerce.gte(1).lte(10),
				})
			),
		});

		expect(
			guard
				.parse({
					users: [
						{ role: 'admin', level: '10' },
						{ role: 'user', level: '5' },
					],
				})
				.isOk()
		).toBe(true);

		expect(
			guard
				.parse({
					users: [{ role: 'superadmin', level: '1' }],
				})
				.isErr()
		).toBe(true);
	});

	it('should handle literal discriminated unions in arrays (validation)', () => {
		const circle = is.object({ type: is.literal('circle'), radius: is.number.positive });
		const rect = is.object({
			type: is.literal('rect'),
			width: is.number.positive,
			height: is.number.positive,
		});

		const shapes = is.array(is.union(circle, rect));

		// Validates that each element matches one of the union branches
		const result = shapes.parse([
			{ type: 'circle', radius: 10 },
			{ type: 'rect', width: 5, height: 3 },
		]);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([
			{ type: 'circle', radius: 10 },
			{ type: 'rect', width: 5, height: 3 },
		]);

		// Invalid discriminant fails
		expect(shapes.parse([{ type: 'triangle', sides: 3 }]).isErr()).toBe(true);
		// Invalid field value fails
		expect(shapes.parse([{ type: 'circle', radius: -1 }]).isErr()).toBe(true);
	});

	it('should chain multiple transforms in correct order', () => {
		const guard = is.string.coerce
			.trim()
			.toLowerCase()
			.transform(s => s.split(','))
			.transform(arr => arr.map(s => s.trim()));

		const result = guard.parse(123);
		// 123 -> "123" (coerce) -> "123" (trim, noop) -> "123" (lower, noop) -> ["123"] (split) -> ["123"] (map trim, noop)
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual(['123']);

		const result2 = guard.parse('  A, B, C  ');
		// "  A, B, C  " -> "  A, B, C  " (coerce, already string) -> "A, B, C" (trim) -> "a, b, c" (lower) -> ["a", " b", " c"] (split) -> ["a", "b", "c"] (map trim)
		expect(result2.isOk()).toBe(true);
		expect(result2.unwrap()).toEqual(['a', 'b', 'c']);
	});

	it('should handle date coercion in nested objects', () => {
		const guard = is.object({
			event: is.string,
			timestamp: is.date.coerce,
		});

		const result = guard.parse({
			event: 'deploy',
			timestamp: '2025-01-15T10:30:00.000Z',
		});
		expect(result.isOk()).toBe(true);
		const val = result.unwrap();
		expect(val.timestamp).toBeInstanceOf(Date);
		expect(val.timestamp.toISOString()).toBe('2025-01-15T10:30:00.000Z');
	});

	it('should handle bigint coercion in nested objects', () => {
		const guard = is.object({
			id: is.bigint.coerce,
			amount: is.bigint.coerce.positive,
		});

		const result = guard.parse({ id: '9007199254740993', amount: 42 });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ id: 9007199254740993n, amount: 42n });
	});
});

// =============================================================================
// Complex Schema Validation (defineSchemas / defineSchema)
// =============================================================================

describe('Complex Schema Validation', () => {
	it('should collect all errors across deeply nested structures', () => {
		const schemas = defineSchemas({
			Config: is.object({
				server: is.object({
					host: is.string.min(1),
					port: is.number.int.between(1, 65535),
				}),
				db: is.object({
					url: is.string.min(1),
					pool: is.number.int.positive,
				}),
			}),
		});

		const result = schemas.Config.parse({
			server: { host: '', port: 99999 },
			db: { url: 123, pool: -1 },
		});

		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr();
		// Should have errors for: host (empty), port (out of range), url (wrong type), pool (negative)
		expect(errors.length).toBeGreaterThanOrEqual(4);
	});

	it('should collect errors with correct paths in arrays', () => {
		const schema = defineSchema(
			'Items',
			is.object({
				items: is.array(
					is.object({
						name: is.string.min(1),
						count: is.number.positive,
					})
				),
			})
		);

		const result = schema.parse({
			items: [
				{ name: 'valid', count: 5 },
				{ name: '', count: 10 }, // name fails
				{ name: 'also valid', count: -1 }, // count fails
			],
		});

		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr();
		expect(errors.length).toBe(2);

		const paths = errors.map(e => e.path.slice(1).join('.'));
		expect(paths).toContain('items.[1].name');
		expect(paths).toContain('items.[2].count');
	});

	it('should apply transforms in schema validation', () => {
		const schema = defineSchema(
			'User',
			is.object({
				name: is.string.trim().min(1),
				email: is.string.trim().toLowerCase(),
				age: is.number.coerce.int.positive,
			})
		);

		const result = schema.parse({
			name: '  Alice  ',
			email: '  ALICE@EXAMPLE.COM  ',
			age: '30',
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			name: 'Alice',
			email: 'alice@example.com',
			age: 30,
		});
	});

	it('should handle schema with fallbacks filling in missing fields', () => {
		const schema = defineSchema(
			'Settings',
			is.object({
				theme: is.string.fallback('dark'),
				fontSize: is.number.int.fallback(14),
				notifications: is.object({
					email: is.boolean.fallback(true),
					sms: is.boolean.fallback(false),
				}),
			})
		);

		const result = schema.parse({
			notifications: {},
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			theme: 'dark',
			fontSize: 14,
			notifications: {
				email: true,
				sms: false,
			},
		});
	});

	it('should validate tuples inside schemas with full error paths', () => {
		const schema = defineSchema(
			'Row',
			is.object({
				entries: is.array(is.tuple([is.string.min(1), is.number.positive])),
			})
		);

		const result = schema.parse({
			entries: [
				['valid', 10],
				['', -5], // both elements fail
			],
		});

		expect(result.isErr()).toBe(true);
		expect(result.unwrapErr().length).toBeGreaterThanOrEqual(2);
	});

	it('should handle schema assert throwing AggregateGuardErr', () => {
		const schema = defineSchema(
			'Point',
			is.object({
				x: is.number,
				y: is.number,
			})
		);

		expect(() => schema.assert({ x: 'not a number', y: 'also not' })).toThrow();

		try {
			schema.assert({ x: 'bad', y: 'bad' });
		} catch (e: any) {
			expect(e.errors.length).toBe(2);
			expect(e.format()).toBeDefined();
			expect(e.flatten()).toBeDefined();
		}
	});

	it('should handle nested schemas with coercion and collect all errors', () => {
		const schema = defineSchema(
			'Order',
			is.object({
				id: is.number.coerce.int.positive,
				customer: is.object({
					name: is.string.min(1),
					email: is.string.email,
				}),
				items: is.array(
					is.object({
						sku: is.string.min(3),
						qty: is.number.coerce.int.positive,
						price: is.number.coerce.positive,
					})
				).nonEmpty,
			})
		);

		// Everything wrong
		const result = schema.parse({
			id: 'not-a-number',
			customer: { name: '', email: 'not-an-email' },
			items: [],
		});

		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr();
		// id fails coercion, name empty, email invalid, items empty
		expect(errors.length).toBeGreaterThanOrEqual(3);
	});

	it('should handle schema with record type validation', () => {
		const schema = defineSchema(
			'Config',
			is.object({
				env: is.record(is.string, is.string.min(1)),
				ports: is.record(is.string, is.number.int.between(1, 65535)),
			})
		);

		expect(
			schema
				.parse({
					env: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
					ports: { http: 80, https: 443 },
				})
				.isOk()
		).toBe(true);

		expect(
			schema
				.parse({
					env: { NODE_ENV: '' }, // empty string fails min(1)
					ports: { http: 99999 }, // out of range
				})
				.isErr()
		).toBe(true);
	});
});

// =============================================================================
// Complex Guard + Transform Interactions
// =============================================================================

describe('Complex Guard + Transform Interactions', () => {
	it('should handle nested parsedJson with array schema', () => {
		const guard = is.string.parsedJson({
			schema: is.array(
				is.object({
					id: is.number.coerce,
					active: is.boolean.coerce,
				})
			),
			type: 'array',
		});

		const result = guard.parse('[{"id":"1","active":"yes"},{"id":"2","active":"no"}]');
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([
			{ id: 1, active: true },
			{ id: 2, active: false },
		]);
	});

	it('should handle .or() for validation across branches', () => {
		const guard = is.object({
			value: is.string.or(is.number),
		});

		// String branch
		expect(guard.parse({ value: 'hello' }).isOk()).toBe(true);
		// Number branch
		expect(guard.parse({ value: 42 }).isOk()).toBe(true);
		// Neither branch
		expect(guard.parse({ value: true }).isErr()).toBe(true);
	});

	it('should handle .and() chaining with multiple guards', () => {
		const hasId = is.object({ id: is.number.coerce });
		const hasName = is.object({ name: is.string.trim() });
		const hasRole = is.object({ role: is.string.toLowerCase() });

		const combined = hasId.and(hasName).and(hasRole);

		const result = combined.parse({ id: '42', name: '  Alice  ', role: 'ADMIN' });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ id: 42, name: 'Alice', role: 'admin' });
	});

	it('should handle fallback at different nesting levels via schema', () => {
		// Nested fallbacks require defineSchema for recursive validation
		const schema = defineSchema(
			'Nested',
			is.object({
				a: is
					.object({
						b: is.number.coerce.fallback(0),
						c: is.string.trim().fallback('default'),
					})
					.fallback({ b: -1, c: 'none' }),
			})
		);

		// Inner fallbacks (missing fields get defaults)
		const r1 = schema.parse({ a: {} });
		expect(r1.isOk()).toBe(true);
		expect(r1.unwrap()).toEqual({ a: { b: 0, c: 'default' } });

		// Outer fallback (a is not an object)
		const r2 = schema.parse({ a: 'not-an-object' });
		expect(r2.isOk()).toBe(true);
		expect(r2.unwrap()).toEqual({ a: { b: -1, c: 'none' } });
	});

	it('should handle transform chains that change types through nesting', () => {
		const guard = is.object({
			csv: is.string.trim().transform(s => s.split(',')),
			count: is.string.trim().transform(s => s.length),
		});

		const result = guard.parse({ csv: '  a,b,c  ', count: '  hello  ' });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ csv: ['a', 'b', 'c'], count: 5 });
	});

	it('should handle object strict mode with transforms', () => {
		const guard = is.object({
			name: is.string.trim(),
			age: is.number.coerce,
		}).strict;

		// Extra key should fail
		expect(guard.parse({ name: '  Alice  ', age: '30', extra: true }).isErr()).toBe(true);

		// Exact keys should pass with transforms
		const result = guard.parse({ name: '  Bob  ', age: '25' });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ name: 'Bob', age: 25 });
	});

	it('should handle object catchall for extra keys with transforms', () => {
		const guard = is
			.object({
				name: is.string.trim(),
			})
			.catchall(is.string);

		// Known keys get validated + transformed, extra keys validated by catchall
		const result = guard.parse({ name: '  Alice  ', extra: 'kept' });
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({ name: 'Alice', extra: 'kept' });

		// Extra key fails catchall
		expect(guard.parse({ name: 'Bob', extra: 123 }).isErr()).toBe(true);
	});

	it('should handle deeply nested coercion with fallback recovery via schema', () => {
		// Nested fallback recovery requires defineSchema for recursive validation
		const schema = defineSchema(
			'Matrix',
			is.object({
				matrix: is.array(is.array(is.number.coerce.fallback(0))),
			})
		);

		const result = schema.parse({
			matrix: [
				['1', '2', '3'],
				['4', 'not-a-number', '6'],
				['7', '8', '9'],
			],
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			matrix: [
				[1, 2, 3],
				[4, 0, 6], // 'not-a-number' fell back to 0
				[7, 8, 9],
			],
		});
	});

	it('should handle coercion with brand', () => {
		const UserId = is.number.coerce.positive.brand('UserId');

		const result = UserId.parse('42');
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toBe(42);

		expect(UserId.parse('0').isErr()).toBe(true);
		expect(UserId.parse('-5').isErr()).toBe(true);
	});

	it('should handle array .array shorthand with coerce', () => {
		const guard = is.number.coerce.array;

		const result = guard.parse(['1', '2', '3']);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([1, 2, 3]);
	});

	it('should handle custom error messages via schema', () => {
		// Use defineSchema to collect all errors with custom messages
		const schema = defineSchema(
			'Form',
			is.object({
				age: is.number.gte(0).error('Age must be non-negative'),
				name: is.string.min(1).error('Name is required'),
			})
		);

		const result = schema.parse({ age: -5, name: '' });
		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr();
		const messages = errors.map(e => e.message);
		expect(messages).toContain('Age must be non-negative');
		expect(messages).toContain('Name is required');
	});
});

// =============================================================================
// Edge Cases & Boundary Conditions
// =============================================================================

describe('Edge Cases & Boundary Conditions', () => {
	it('should handle empty arrays with transforms', () => {
		const guard = is.array(is.string.trim());
		const result = guard.parse([]);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([]);
	});

	it('should handle null and undefined at various nesting levels', () => {
		const guard = is.object({
			a: is.string.nullable,
			b: is.object({
				c: is.number.optional,
				d: is.boolean.nullish,
			}),
		});

		const result = guard.parse({ a: null, b: { c: undefined, d: null } });
		expect(result.isOk()).toBe(true);
	});

	it('should handle boolean coercion edge cases in nested objects', () => {
		const guard = is.object({
			flags: is.array(is.boolean.coerce),
		});

		const result = guard.parse({
			flags: ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off', 'active', 'disabled'],
		});
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			flags: [true, false, true, false, true, false, true, false, true, false],
		});
	});

	it('should handle number coercion edge cases', () => {
		const guard = is.number.coerce;

		expect(guard.parse('0').unwrap()).toBe(0);
		expect(guard.parse('').unwrap()).toBe(0);
		expect(guard.parse(true).unwrap()).toBe(1);
		expect(guard.parse(false).unwrap()).toBe(0);
		expect(guard.parse('3.14').unwrap()).toBe(3.14);
		expect(guard.parse('-42').unwrap()).toBe(-42);
	});

	it('should handle string coercion from various types', () => {
		const guard = is.string.coerce;

		expect(guard.parse(123).unwrap()).toBe('123');
		expect(guard.parse(true).unwrap()).toBe('true');
		expect(guard.parse(false).unwrap()).toBe('false');
		expect(guard.parse(0).unwrap()).toBe('0');
	});

	it('should handle coercion failure gracefully', () => {
		const guard = is.number.coerce;

		// Symbol cannot be coerced to number
		expect(guard.parse(Symbol('test')).isErr()).toBe(true);
		// Object cannot be coerced to number
		expect(guard.parse({}).isErr()).toBe(true);
	});

	it('should handle deeply nested objects (5+ levels) with transforms', () => {
		const guard = is.object({
			l1: is.object({
				l2: is.object({
					l3: is.object({
						l4: is.object({
							l5: is.object({
								value: is.number.coerce,
								label: is.string.trim().toLowerCase(),
							}),
						}),
					}),
				}),
			}),
		});

		const result = guard.parse({
			l1: {
				l2: {
					l3: {
						l4: {
							l5: {
								value: '999',
								label: '  DEEP  ',
							},
						},
					},
				},
			},
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap().l1.l2.l3.l4.l5).toEqual({
			value: 999,
			label: 'deep',
		});
	});

	it('should handle arrays of arrays with element transforms', () => {
		const guard = is.array(is.array(is.string.trim().toLowerCase()));

		const result = guard.parse([['  A  ', '  B  '], ['  C  ']]);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([['a', 'b'], ['c']]);
	});

	it('should handle mixed nullish and coercion in arrays', () => {
		const guard = is.array(is.number.coerce.nullable);

		const result = guard.parse(['1', null, '3', null, '5']);
		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual([1, null, 3, null, 5]);
	});

	it('should handle object with all optional coerced fields', () => {
		const guard = is.object({
			a: is.number.coerce.optional,
			b: is.boolean.coerce.optional,
			c: is.string.coerce.optional,
		});

		expect(guard.parse({}).isOk()).toBe(true);
		expect(guard.parse({ a: '1', b: 'yes', c: 42 }).isOk()).toBe(true);

		const result = guard.parse({ a: '1', b: 'yes', c: 42 });
		expect(result.unwrap()).toEqual({ a: 1, b: true, c: '42' });
	});

	it('should handle multiple parsedJson fields with different schemas', () => {
		const guard = is.object({
			config: is.string.parsedJson({
				schema: is.object({ debug: is.boolean.coerce }),
				type: 'object',
			}),
			data: is.string.parsedJson({
				schema: is.array(is.number.coerce),
				type: 'array',
			}),
		});

		const result = guard.parse({
			config: '{"debug": "yes"}',
			data: '["1", "2", "3"]',
		});

		expect(result.isOk()).toBe(true);
		expect(result.unwrap()).toEqual({
			config: { debug: true },
			data: [1, 2, 3],
		});
	});
});
