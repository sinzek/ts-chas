import { describe, it, expect } from 'vitest';
import { is, defineSchema } from '../../src/guard/index.js';

describe('fallback helper', () => {
	describe('standalone guard', () => {
		it('returns static fallback value on failure', () => {
			const guard = is.string.fallback('fallback');
			const result = guard.parse(123);
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('fallback');
		});

		it('returns original value on success', () => {
			const guard = is.string.fallback('fallback');
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('hello');
		});

		it('works with functional fallback', () => {
			const guard = is.string.fallback(({ value }) => `failed: ${value}`);
			expect(guard.parse(123).unwrap()).toBe('failed: 123');
			expect(guard.parse(true).unwrap()).toBe('failed: true');
		});

		it('provides meta to functional fallback', () => {
			const guard = is.string.fallback(({ meta }) => `id was ${meta.id}`);
			expect(guard.parse(123).unwrap()).toBe('id was string');
		});

		it('provides the error to the functional fallback', () => {
			const guard = is.number.gt(10).fallback(({ error }) => {
				expect(error._tag).toBe('GuardErr');
				expect(error.actual).toBe('number');
				expect(error.expected).toBe('number');
				return -1;
			});
			expect(guard.parse(5).unwrap()).toBe(-1);
		});

		it('passes the error through on type-mismatch failures', () => {
			const guard = is.string.fallback(({ error }) => `${error.expected}:${error.actual}`);
			expect(guard.parse(42).unwrap()).toBe('string:number');
		});

		it('works with transform', () => {
			const guard = is.string.trim().fallback('default');
			expect(guard.parse('  hello  ').unwrap()).toBe('hello');
			expect(guard.parse(123).unwrap()).toBe('default');
		});

		it('works with assert', () => {
			const guard = is.number.gt(10).fallback(0);
			expect(guard.assert(15)).toBe(15);
			expect(guard.assert(5)).toBe(0);
			expect(guard.assert('not a number')).toBe(0);
		});
	});

	describe('schema validation', () => {
		it('applies fallback to specific field in object', () => {
			const User = defineSchema('User', {
				name: is.string.fallback('Anonymous'),
				age: is.number,
			});

			// Valid
			expect(User.parse({ name: 'Bob', age: 30 }).unwrap()).toEqual({ name: 'Bob', age: 30 });

			// Missing name -> use fallback
			expect(User.parse({ age: 30 }).unwrap()).toEqual({ name: 'Anonymous', age: 30 });

			// Invalid name -> use fallback
			expect(User.parse({ name: 123, age: 30 }).unwrap()).toEqual({ name: 'Anonymous', age: 30 });

			// Invalid age -> whole schema fails (no fallback on age)
			expect(User.parse({ name: 'Bob', age: 'old' }).isErr()).toBe(true);
		});

		it('works with functional fallback in schema', () => {
			const Schema = defineSchema('Test', {
				code: is.string.fallback(({ value }) => `error_${value}`),
			});

			expect(Schema.parse({ code: 500 }).unwrap()).toEqual({ code: 'error_500' });
		});

		it('works with nested objects', () => {
			const Schema = defineSchema('Config', {
				api: {
					host: is.string.fallback('localhost'),
					port: is.number.fallback(8080),
				},
			});

			expect(Schema.parse({ api: {} }).unwrap()).toEqual({
				api: { host: 'localhost', port: 8080 },
			});

			expect(Schema.parse({ api: { port: 3000 } }).unwrap()).toEqual({
				api: { host: 'localhost', port: 3000 },
			});
		});

		it('works with arrays', () => {
			const List = defineSchema('List', {
				items: is.array(is.string.fallback('invalid')).fallback([]),
			});

			// Valid
			expect(List.parse({ items: ['a', 'b'] }).unwrap()).toEqual({ items: ['a', 'b'] });

			// Invalid items in array
			expect(List.parse({ items: ['a', 123, 'c'] }).unwrap()).toEqual({
				items: ['a', 'invalid', 'c'],
			});

			// Missing array -> use array fallback
			expect(List.parse({}).unwrap()).toEqual({ items: [] });
		});

		it('works with tuples', () => {
			const TupleSchema = defineSchema('Tuple', {
				data: is.tuple([is.string.fallback('fallback'), is.number]),
			});

			expect(TupleSchema.parse({ data: [123, 456] }).unwrap()).toEqual({
				data: ['fallback', 456],
			});

			expect(TupleSchema.parse({ data: ['ok', 'bad'] }).isErr()).toBe(true);
		});
	});

	describe('transform error catching', () => {
		it('catches transform errors in .parse() when fallback is set', () => {
			const guard = is.string
				.transform(() => {
					throw new Error('boom');
				})
				.fallback('safe');
			const result = guard.parse('hello');
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toBe('safe');
		});

		it('still throws transform errors in .parse() when no fallback', () => {
			const guard = is.string.transform(() => {
				throw new Error('boom');
			});
			expect(() => guard.parse('hello')).toThrow('boom');
		});

		it('catches transform errors in .assert() when fallback is set', () => {
			const guard = is.string
				.transform(() => {
					throw new Error('boom');
				})
				.fallback('safe');
			expect(guard.assert('hello')).toBe('safe');
		});

		it('still throws transform errors in .assert() when no fallback', () => {
			const guard = is.string.transform(() => {
				throw new Error('boom');
			});
			expect(() => guard.assert('hello')).toThrow('boom');
		});

		it('catches transform errors via ~standard validate when fallback is set', () => {
			const guard = is.string
				.transform(() => {
					throw new Error('boom');
				})
				.fallback('safe');
			const result = (guard as any)['~standard'].validate('hello');
			expect(result).toEqual({ value: 'safe' });
		});

		it('catches transform errors in schema validation when fallback is set', () => {
			const Schema = defineSchema('Test', {
				value: is.string
					.transform(() => {
						throw new Error('boom');
					})
					.fallback('safe'),
			});
			const result = Schema.parse({ value: 'hello' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ value: 'safe' });
		});

		it('fallback does not change boolean predicate behavior', () => {
			const guard = is.string.fallback('default');
			expect(guard(123)).toBe(false); // still false, fallback only affects parse/assert
		});
	});
});
