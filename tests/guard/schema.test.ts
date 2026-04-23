/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import {
	defineSchemas,
	defineSchema,
	formatErrors,
	flattenErrors,
	AggregateGuardErr,
	type InferSchema,
} from '../../src/guard/schema.js';

// ---------------------------------------------------------------------------
// InferSchema type tests (compile-time only)
// ---------------------------------------------------------------------------

describe('InferSchema', () => {
	it('infers from a guard', () => {
		const guard = is.string;
		type T = InferSchema<typeof guard>;
		const _check: T = 'hello';
		expect(true).toBe(true); // compile-time check
	});

	it('infers from an object guard', () => {
		const guard = is.object({ name: is.string, age: is.number });
		type T = InferSchema<typeof guard>;
		const _check: T = { name: 'Chase', age: 25 };
		expect(true).toBe(true);
	});

	it('infers from a schema returned by defineSchemas', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string, age: is.number }),
		});
		type User = InferSchema<typeof schemas.User>;
		const _check: User = { name: 'Chase', age: 25 };
		expect(true).toBe(true);
	});

	it('infers from a plain guard record', () => {
		type T = InferSchema<{ name: typeof is.string; age: typeof is.number }>;
		const _check: T = { name: 'Chase', age: 25 };
		expect(true).toBe(true);
	});

	it('infers nested objects', () => {
		const schemas = defineSchemas({
			User: is.object({
				name: is.string,
				address: is.object({ city: is.string, zip: is.string }),
			}),
		});
		type User = InferSchema<typeof schemas.User>;
		const _check: User = { name: 'Chase', address: { city: 'NYC', zip: '10001' } };
		expect(true).toBe(true);
	});

	it('infers from a nested plain record', () => {
		type T = InferSchema<{ name: typeof is.string; address: { city: typeof is.string; zip: typeof is.string } }>;
		const _check: T = { name: 'Chase', address: { city: 'NYC', zip: '10001' } };
		expect(true).toBe(true);
	});

	it('infers from defineSchemas with nested plain records', () => {
		const schemas = defineSchemas({
			User: {
				name: is.string,
				address: { street: is.string, city: is.string },
			},
		});
		type User = InferSchema<typeof schemas.User>;
		const _check: User = { name: 'Chase', address: { street: 'Main St', city: 'NYC' } };
		expect(true).toBe(true);
	});

	it('infers deeply nested plain records', () => {
		const schemas = defineSchemas({
			Config: {
				db: {
					host: is.string,
					port: is.number,
					auth: { user: is.string, pass: is.string },
				},
			},
		});
		type Config = InferSchema<typeof schemas.Config>;
		const _check: Config = { db: { host: 'localhost', port: 5432, auth: { user: 'admin', pass: 'secret' } } };
		expect(true).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// defineSchemas — basic usage
// ---------------------------------------------------------------------------

describe('defineSchemas', () => {
	it('creates named schemas from guards', () => {
		const schemas = defineSchemas({
			Email: is.string,
			Age: is.number,
		});

		expect(schemas.Email).toBeDefined();
		expect(schemas.Age).toBeDefined();
		expect(schemas.Email.meta.name).toBe('Email');
		expect(schemas.Age.meta.name).toBe('Age');
	});

	it('creates schemas from object guards', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string, age: is.number }),
		});

		expect(schemas.User.meta.name).toBe('User');
	});

	it('creates schemas from plain guard records (auto-wrapped)', () => {
		const schemas = defineSchemas({
			User: { name: is.string, age: is.number },
		});

		const result = schemas.User.parse({ name: 'Chase', age: 25 });
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ name: 'Chase', age: 25 });
		}
	});

	it('creates schemas with nested plain records', () => {
		const schemas = defineSchemas({
			User: {
				name: is.string,
				address: { street: is.string, city: is.string },
			},
		});

		const good = schemas.User.parse({ name: 'Chase', address: { street: '123 Main', city: 'NYC' } });
		expect(good.isOk()).toBe(true);
		if (good.isOk()) {
			expect(good.value).toEqual({ name: 'Chase', address: { street: '123 Main', city: 'NYC' } });
		}

		// Nested field fails
		const bad = schemas.User.parse({ name: 'Chase', address: { street: 123, city: 'NYC' } });
		expect(bad.isErr()).toBe(true);
	});

	it('creates schemas with deeply nested plain records', () => {
		const schemas = defineSchemas({
			Config: {
				db: {
					host: is.string,
					port: is.number,
					auth: { user: is.string, pass: is.string },
				},
			},
		});

		const good = schemas.Config.parse({
			db: { host: 'localhost', port: 5432, auth: { user: 'admin', pass: 'secret' } },
		});
		expect(good.isOk()).toBe(true);

		const bad = schemas.Config.parse({
			db: { host: 'localhost', port: 'bad', auth: { user: 'admin', pass: 123 } },
		});
		expect(bad.isErr()).toBe(true);
		if (bad.isErr()) {
			// Should have errors for both port and pass
			expect(bad.error.length).toBeGreaterThanOrEqual(2);
		}
	});

	it('collects errors with correct paths for nested plain records', () => {
		const schemas = defineSchemas({
			User: {
				name: is.string,
				address: { street: is.string, city: is.string },
			},
		});

		const result = schemas.User.parse({ name: 42, address: { street: 123, city: 456 } });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const formatted = formatErrors(result.error);
			expect(formatted['name']).toBeDefined();
			expect(formatted['address.street']).toBeDefined();
			expect(formatted['address.city']).toBeDefined();
		}
	});
});

describe('defineSchema', () => {
	it('creates a single named schema', () => {
		const UserSchema = defineSchema('User', is.object({ name: is.string }));
		expect(UserSchema.meta.name).toBe('User');

		const result = UserSchema.parse({ name: 'Chase' });
		expect(result.isOk()).toBe(true);
	});
});

describe('schema.parse', () => {
	const schemas = defineSchemas({
		User: is.object({
			name: is.string,
			age: is.number,
			email: is.string,
		}),
	});

	it('returns Ok for valid data', () => {
		const result = schemas.User.parse({ name: 'Chase', age: 25, email: 'test@example.com' });
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual({ name: 'Chase', age: 25, email: 'test@example.com' });
		}
	});

	it('returns Err with ALL errors for invalid data', () => {
		const result = schemas.User.parse({ name: 123, age: 'old', email: null });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.length).toBe(3);
		}
	});

	it('collects errors for each invalid field', () => {
		const result = schemas.User.parse({ name: 123, age: 'old', email: null });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('User.name');
			expect(paths).toContain('User.age');
			expect(paths).toContain('User.email');
		}
	});

	it('returns single error when value is not an object', () => {
		const result = schemas.User.parse('not an object');
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.length).toBe(1);
			expect(result.error[0]!.actual).toBe('string');
		}
	});

	it('returns single error for null', () => {
		const result = schemas.User.parse(null);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.length).toBe(1);
			expect(result.error[0]!.actual).toBe('null');
		}
	});

	it('includes schema name in error paths', () => {
		const result = schemas.User.parse({ name: 123, age: 25, email: 'ok' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]!.path[0]).toBe('User');
			expect(result.error[0]!.schema).toBe('User');
		}
	});
});

// ---------------------------------------------------------------------------
// Nested object recursion
// ---------------------------------------------------------------------------

describe('nested object recursion', () => {
	const schemas = defineSchemas({
		User: is.object({
			name: is.string,
			address: is.object({
				street: is.string,
				city: is.string,
				zip: is.string,
			}),
		}),
	});

	it('recurses into nested objects and collects field-level errors', () => {
		const result = schemas.User.parse({
			name: 'Chase',
			address: { street: 123, city: null, zip: 'valid' },
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('User.address.street');
			expect(paths).toContain('User.address.city');
			expect(paths).not.toContain('User.address.zip');
		}
	});

	it('reports error at parent level when nested value is not an object', () => {
		const result = schemas.User.parse({
			name: 'Chase',
			address: 'not an object',
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// The address field fails, and since it has a shape but the value is a string,
			// we report at the address level
			expect(result.error.length).toBeGreaterThanOrEqual(1);
			const addressErrors = result.error.filter(e => e.path.includes('address'));
			expect(addressErrors.length).toBeGreaterThanOrEqual(1);
		}
	});

	it('handles deeply nested objects', () => {
		const deep = defineSchemas({
			Config: is.object({
				db: is.object({
					connection: is.object({
						host: is.string,
						port: is.number,
					}),
				}),
			}),
		});

		const result = deep.Config.parse({
			db: { connection: { host: 123, port: 'bad' } },
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('Config.db.connection.host');
			expect(paths).toContain('Config.db.connection.port');
		}
	});
});

// ---------------------------------------------------------------------------
// Array recursion
// ---------------------------------------------------------------------------

describe('array element recursion', () => {
	it('reports element-level errors with indices', () => {
		const schemas = defineSchemas({
			Numbers: is.array(is.number),
		});

		const result = schemas.Numbers.parse([1, 'two', 3, null]);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('Numbers.[1]');
			expect(paths).toContain('Numbers.[3]');
		}
	});

	it('reports array-level refinement errors', () => {
		const schemas = defineSchemas({
			NonEmpty: is.array(is.number).nonEmpty,
		});

		const result = schemas.NonEmpty.parse([]);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.length).toBe(1);
		}
	});

	it('handles arrays in object fields', () => {
		const schemas = defineSchemas({
			User: is.object({
				name: is.string,
				tags: is.array(is.string),
			}),
		});

		const result = schemas.User.parse({ name: 'Chase', tags: [1, 2, 3] });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			// Should have errors for each invalid array element
			expect(paths.some(p => p.includes('tags'))).toBe(true);
		}
	});

	it('passes for valid arrays', () => {
		const schemas = defineSchemas({
			Tags: is.array(is.string),
		});
		const result = schemas.Tags.parse(['a', 'b', 'c']);
		expect(result.isOk()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Tuple recursion
// ---------------------------------------------------------------------------

describe('tuple recursion', () => {
	it('reports positional errors with indices', () => {
		const schemas = defineSchemas({
			Pair: is.tuple([is.string, is.number]),
		});

		const result = schemas.Pair.parse([123, 'not a number']);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('Pair.[0]');
			expect(paths).toContain('Pair.[1]');
		}
	});

	it('reports length mismatch', () => {
		const schemas = defineSchemas({
			Triple: is.tuple([is.string, is.number, is.boolean]),
		});

		const result = schemas.Triple.parse(['a', 1]);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]!.message).toContain('length');
		}
	});

	it('passes for valid tuples', () => {
		const schemas = defineSchemas({
			Pair: is.tuple([is.string, is.number]),
		});
		const result = schemas.Pair.parse(['hello', 42]);
		expect(result.isOk()).toBe(true);
	});

	it('recurses into nested objects within tuples', () => {
		const schemas = defineSchemas({
			Mixed: is.tuple([is.string, is.object({ x: is.number })]),
		});

		const result = schemas.Mixed.parse(['ok', { x: 'bad' }]);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths.some(p => p.includes('[1]') && p.includes('x'))).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// schema.assert
// ---------------------------------------------------------------------------

describe('schema.assert', () => {
	const schemas = defineSchemas({
		User: is.object({ name: is.string, age: is.number }),
	});

	it('returns the value for valid data', () => {
		const result = schemas.User.assert({ name: 'Chase', age: 25 });
		expect(result).toEqual({ name: 'Chase', age: 25 });
	});

	it('throws AggregateGuardErr for invalid data', () => {
		expect(() => schemas.User.assert({ name: 123, age: 'old' })).toThrow(AggregateGuardErr);
	});

	it('AggregateGuardErr contains all errors', () => {
		try {
			schemas.User.assert({ name: 123, age: 'old' });
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(AggregateGuardErr);
			const agg = e as AggregateGuardErr;
			expect(agg.errors.length).toBe(2);
			expect(agg.schemaName).toBe('User');
		}
	});

	it('AggregateGuardErr has descriptive message', () => {
		try {
			schemas.User.assert({ name: 123, age: 'old' });
		} catch (e) {
			const agg = e as AggregateGuardErr;
			expect(agg.message).toContain('User');
			expect(agg.message).toContain('2 validation errors');
		}
	});

	it('AggregateGuardErr.format() returns formatted errors', () => {
		try {
			schemas.User.assert({ name: 123, age: 'old' });
		} catch (e) {
			const formatted = (e as AggregateGuardErr).format();
			expect(formatted['name']).toBeDefined();
			expect(formatted['age']).toBeDefined();
		}
	});

	it('AggregateGuardErr.flatten() returns flat array', () => {
		try {
			schemas.User.assert({ name: 123, age: 'old' });
		} catch (e) {
			const flat = (e as AggregateGuardErr).flatten();
			expect(flat.length).toBe(2);
			expect(flat.every(f => typeof f.path === 'string' && typeof f.message === 'string')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// schema.is
// ---------------------------------------------------------------------------

describe('schema.is', () => {
	const schemas = defineSchemas({
		Email: is.string,
	});

	it('returns true for valid values', () => {
		expect(schemas.Email.is('hello@example.com')).toBe(true);
	});

	it('returns false for invalid values', () => {
		expect(schemas.Email.is(123)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Primitive / non-object schemas
// ---------------------------------------------------------------------------

describe('non-object schemas', () => {
	it('validates primitive guards', () => {
		const schemas = defineSchemas({
			Email: is.string,
			Count: is.number,
			Flag: is.boolean,
		});

		expect(schemas.Email.parse('hello').isOk()).toBe(true);
		expect(schemas.Email.parse(123).isErr()).toBe(true);
		expect(schemas.Count.parse(42).isOk()).toBe(true);
		expect(schemas.Count.parse('nope').isErr()).toBe(true);
		expect(schemas.Flag.parse(true).isOk()).toBe(true);
		expect(schemas.Flag.parse('yes').isErr()).toBe(true);
	});

	it('includes schema name in error path', () => {
		const schemas = defineSchemas({ Age: is.number });
		const result = schemas.Age.parse('not a number');
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]!.path).toContain('Age');
		}
	});

	it('works with refined guards', () => {
		const schemas = defineSchemas({
			PositiveInt: is.number.int.positive,
		});

		expect(schemas.PositiveInt.parse(42).isOk()).toBe(true);
		expect(schemas.PositiveInt.parse(-1).isErr()).toBe(true);
		expect(schemas.PositiveInt.parse(3.14).isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Transformation support
// ---------------------------------------------------------------------------

describe('transformation support', () => {
	it('applies transforms during parse', () => {
		const schemas = defineSchemas({
			TrimmedEmail: is.string.trim(),
		});

		const result = schemas.TrimmedEmail.parse('  hello@example.com  ');
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe('hello@example.com');
		}
	});
});

// ---------------------------------------------------------------------------
// Standard Schema compliance
// ---------------------------------------------------------------------------

describe('Standard Schema V1 compliance', () => {
	it('has ~standard property', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string }),
		});

		const standard = schemas.User['~standard'];
		expect(standard.version).toBe(1);
		expect(standard.vendor).toBe('chas');
		expect(typeof standard.validate).toBe('function');
	});

	it('validate returns success for valid data', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string }),
		});

		const result = schemas.User['~standard'].validate({ name: 'Chase' });
		expect('value' in result).toBe(true);
		if ('value' in result) {
			expect(result.value).toEqual({ name: 'Chase' });
		}
	});

	it('validate returns issues for invalid data', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string }),
		});

		const result = schemas.User['~standard'].validate({ name: 123 });
		expect('issues' in result).toBe(true);
		if ('issues' in result && result.issues) {
			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues[0]!.message).toBeTruthy();
			expect(result.issues[0]!.path).toBeDefined();
		}
	});
});

// ---------------------------------------------------------------------------
// Error formatting utilities
// ---------------------------------------------------------------------------

describe('formatErrors', () => {
	it('groups errors by path', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string, age: is.number }),
		});

		const result = schemas.User.parse({ name: 123, age: 'old' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const formatted = formatErrors(result.error);
			expect(formatted['name']).toBeDefined();
			expect(formatted['name']!.length).toBe(1);
			expect(formatted['age']).toBeDefined();
			expect(formatted['age']!.length).toBe(1);
		}
	});

	it('strips schema name from path keys', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string }),
		});

		const result = schemas.User.parse({ name: 123 });
		if (result.isErr()) {
			const formatted = formatErrors(result.error);
			// Key should be 'name', not 'User.name'
			expect(formatted['name']).toBeDefined();
			expect(formatted['User.name']).toBeUndefined();
		}
	});

	it('uses _root for path-less errors', () => {
		const schemas = defineSchemas({ Num: is.number });
		const result = schemas.Num.parse('bad');
		if (result.isErr()) {
			const formatted = formatErrors(result.error);
			expect(formatted['_root']).toBeDefined();
		}
	});
});

describe('flattenErrors', () => {
	it('returns array of { path, message }', () => {
		const schemas = defineSchemas({
			User: is.object({ name: is.string, age: is.number }),
		});

		const result = schemas.User.parse({ name: 123, age: 'old' });
		if (result.isErr()) {
			const flat = flattenErrors(result.error);
			expect(flat.length).toBe(2);
			expect(flat.every(f => typeof f.path === 'string')).toBe(true);
			expect(flat.every(f => typeof f.message === 'string')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Custom error messages
// ---------------------------------------------------------------------------

describe('custom error messages', () => {
	it('uses guard .error() messages in schema errors', () => {
		const schemas = defineSchemas({
			User: is.object({
				name: is.string.error('Name must be a string'),
				age: is.number.error('Age must be a number'),
			}),
		});

		const result = schemas.User.parse({ name: 123, age: 'old' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const messages = result.error.map(e => e.message);
			expect(messages).toContain('Name must be a string');
			expect(messages).toContain('Age must be a number');
		}
	});
});

// ---------------------------------------------------------------------------
// Object-level refinements
// ---------------------------------------------------------------------------

describe('object-level refinements', () => {
	it('detects .strict violations after field-level pass', () => {
		const schemas = defineSchemas({
			Strict: is.object({ name: is.string }).strict,
		});

		// All fields valid, but extra key
		const result = schemas.Strict.parse({ name: 'Chase', extra: true });
		expect(result.isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// schema.guard — exposes underlying guard
// ---------------------------------------------------------------------------

describe('schema.guard', () => {
	it('is the underlying guard function', () => {
		const schemas = defineSchemas({
			Email: is.string,
		});

		expect(typeof schemas.Email.guard).toBe('function');
		expect(schemas.Email.guard('hello')).toBe(true);
		expect(schemas.Email.guard(123)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
	it('handles empty object schema', () => {
		const schemas = defineSchemas({
			Empty: is.object({}),
		});
		expect(schemas.Empty.parse({}).isOk()).toBe(true);
		expect(schemas.Empty.parse({ any: 'thing' }).isOk()).toBe(true);
	});

	it('handles union schemas', () => {
		const schemas = defineSchemas({
			StringOrNumber: is.union(is.string, is.number),
		});
		expect(schemas.StringOrNumber.parse('hello').isOk()).toBe(true);
		expect(schemas.StringOrNumber.parse(42).isOk()).toBe(true);
		expect(schemas.StringOrNumber.parse(true).isErr()).toBe(true);
	});

	it('handles literal schemas', () => {
		const schemas = defineSchemas({
			Status: is.literal('active', 'inactive'),
		});
		expect(schemas.Status.parse('active').isOk()).toBe(true);
		expect(schemas.Status.parse('deleted').isErr()).toBe(true);
	});

	it('handles nullable fields in objects', () => {
		const schemas = defineSchemas({
			User: is.object({
				name: is.string,
				bio: is.string.nullable,
			}),
		});
		expect(schemas.User.parse({ name: 'Chase', bio: null }).isOk()).toBe(true);
		expect(schemas.User.parse({ name: 'Chase', bio: 'hello' }).isOk()).toBe(true);
		expect(schemas.User.parse({ name: 'Chase', bio: 123 }).isErr()).toBe(true);
	});

	it('handles optional fields in objects', () => {
		const schemas = defineSchemas({
			User: is.object({
				name: is.string,
				bio: is.string.optional,
			}),
		});
		expect(schemas.User.parse({ name: 'Chase', bio: undefined }).isOk()).toBe(true);
		expect(schemas.User.parse({ name: 'Chase' }).isOk()).toBe(true);
		expect(schemas.User.parse({ name: 'Chase', bio: 123 }).isErr()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// guard.toSchema()
// ---------------------------------------------------------------------------

describe('guard.toSchema()', () => {
	it('creates a schema with the given name', () => {
		const schema = is.string.toSchema('Email');
		expect(schema.meta.name).toBe('Email');

		const example = is.object();
	});

	it('parse() returns Ok for valid values', () => {
		const schema = is.string.toSchema('Email');
		expect(schema.parse('hello').isOk()).toBe(true);
	});

	it('parse() returns Err for invalid values', () => {
		const schema = is.string.toSchema('Email');
		expect(schema.parse(42).isErr()).toBe(true);
	});

	it('includes the schema name in error paths', () => {
		const schema = is.string.toSchema('MySchema');
		const result = schema.parse(42);
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error[0]!.path[0]).toBe('MySchema');
		}
	});

	it('collects all errors from an object guard', () => {
		const schema = is.object({ name: is.string, age: is.number }).toSchema('User');
		const result = schema.parse({ name: 123, age: 'old' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.length).toBe(2);
			const paths = result.error.map(e => e.path.join('.'));
			expect(paths).toContain('User.name');
			expect(paths).toContain('User.age');
		}
	});

	it('assert() returns the value for valid data', () => {
		const schema = is.object({ name: is.string }).toSchema('User');
		expect(schema.assert({ name: 'Chase' })).toEqual({ name: 'Chase' });
	});

	it('assert() throws AggregateGuardErr for invalid data', () => {
		const schema = is.object({ name: is.string }).toSchema('User');
		expect(() => schema.assert({ name: 123 })).toThrow(AggregateGuardErr);
	});

	it('is() delegates to the underlying guard', () => {
		const schema = is.string.toSchema('Email');
		expect(schema.is('hello')).toBe(true);
		expect(schema.is(42)).toBe(false);
	});

	it('exposes the underlying guard on .guard', () => {
		const schema = is.string.toSchema('Email');
		expect(typeof schema.guard).toBe('function');
		expect(schema.guard('hello')).toBe(true);
		expect(schema.guard(42)).toBe(false);
	});

	it('produces the same result as defineSchema for the same guard', () => {
		const guard = is.object({ name: is.string, age: is.number });
		const viaMethod = guard.toSchema('User');
		const viaFn = defineSchema('User', guard);

		const valid = { name: 'Chase', age: 25 };
		const invalid = { name: 123, age: 'old' };

		expect(viaMethod.parse(valid).isOk()).toBe(viaFn.parse(valid).isOk());
		expect(viaMethod.parse(invalid).isErr()).toBe(viaFn.parse(invalid).isErr());

		const methodErrs = viaMethod.parse(invalid);
		const fnErrs = viaFn.parse(invalid);
		if (methodErrs.isErr() && fnErrs.isErr()) {
			expect(methodErrs.error.length).toBe(fnErrs.error.length);
		}
	});

	it('works inline on a chained guard', () => {
		const schema = is.string.trim().email.toSchema('Email');
		expect(schema.parse('  user@example.com  ').isOk()).toBe(true);
		expect(schema.parse('  not-an-email  ').isErr()).toBe(true);
	});

	it('is Standard Schema V1 compliant', () => {
		const schema = is.object({ name: is.string }).toSchema('User');
		const standard = schema['~standard'];
		expect(standard.version).toBe(1);
		expect(standard.vendor).toBe('chas');
		expect(typeof standard.validate).toBe('function');
	});

	it('infers the correct output type (compile-time)', () => {
		const schema = is.object({ name: is.string, age: is.number }).toSchema('User');
		type User = typeof schema.$infer;
		const _check: User = { name: 'Chase', age: 25 };
		expect(true).toBe(true);
	});

	it('generates values', async () => {
		const schema = is.object({ name: is.string, age: is.number }).toSchema('User');
		const value = await schema.generate();
		expect(schema.is(value)).toBe(true);
	});

	it('generates multiple values', async () => {
		const schema = is.object({ name: is.string, age: is.number }).toSchema('User');
		const values = await schema.generate(5);
		expect(values.length).toBe(5);
		expect(values.every(v => schema.is(v))).toBe(true);
	});
});
