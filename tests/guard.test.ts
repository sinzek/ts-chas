import { describe, it, expect } from 'vitest';
import {
	is,
	assert,
	ensure,
	validate,
	guardToValidator,
	guardToTask,
	defineSchemas,
	Guard,
	type InferSchema,
} from '../src/guard.ts';
import { Task } from '../src/task.ts';

describe('Guard Module', () => {
	describe('Primitive Guards', () => {
		it('is.string', () => {
			expect(is.string('hello')).toBe(true);
			expect(is.string(123)).toBe(false);
			expect(is.string('')).toBe(true);
		});

		it('is.number', () => {
			expect(is.number(123)).toBe(true);
			expect(is.number('123')).toBe(false);
			expect(is.number(NaN)).toBe(false);
			expect(is.number(Infinity)).toBe(false);
		});

		it('is.boolean', () => {
			expect(is.boolean(true)).toBe(true);
			expect(is.boolean(false)).toBe(true);
			expect(is.boolean(0)).toBe(false);
		});

		it('is.symbol', () => {
			expect(is.symbol(Symbol('test'))).toBe(true);
			expect(is.symbol('test')).toBe(false);
		});

		it('is.bigint', () => {
			expect(is.bigint(123n)).toBe(true);
			expect(is.bigint(123)).toBe(false);
		});

		it('is.undefined', () => {
			expect(is.undefined(undefined)).toBe(true);
			expect(is.undefined(null)).toBe(false);
		});

		it('is.null', () => {
			expect(is.null(null)).toBe(true);
			expect(is.null(undefined)).toBe(false);
		});

		it('is.nil', () => {
			expect(is.nil(null)).toBe(true);
			expect(is.nil(undefined)).toBe(true);
			expect(is.nil(0)).toBe(false);
		});

		it('is.function', () => {
			expect(is.function(() => {})).toBe(true);
			expect(is.function({})).toBe(false);
		});
	});

	describe('String Sub-guards', () => {
		it('is.string.nonEmpty', () => {
			expect(is.string.nonEmpty('a')).toBe(true);
			expect(is.string.nonEmpty('')).toBe(false);
			expect(is.string.nonEmpty('  ')).toBe(false);
		});

		it('is.string.empty', () => {
			expect(is.string.empty('')).toBe(true);
			expect(is.string.empty('  ')).toBe(true);
			expect(is.string.empty('a')).toBe(false);
		});

		it('is.string.email', () => {
			expect(is.string.email('test@example.com')).toBe(true);
			expect(is.string.email('invalid-email')).toBe(false);
		});

		it('is.string.hexColor', () => {
			expect(is.string.hexColor('#fff')).toBe(true);
			expect(is.string.hexColor('#ffffff')).toBe(true);
			expect(is.string.hexColor('fff')).toBe(false);
		});

		it('is.string.url', () => {
			expect(is.string.url('https://google.com')).toBe(true);
			expect(is.string.url('ftp://google.com')).toBe(false);
			expect(is.string.url('invalid-url')).toBe(false);
		});

		it('is.string.alphanumeric', () => {
			expect(is.string.alphanumeric('abc123')).toBe(true);
			expect(is.string.alphanumeric('abc 123')).toBe(false);
			expect(is.string.alphanumeric.withSpaces('abc 123')).toBe(true);
		});
	});

	describe('Number Sub-guards', () => {
		it('is.number comparison', () => {
			expect(is.number.gt(5)(6)).toBe(true);
			expect(is.number.gt(5)(5)).toBe(false);
			expect(is.number.gte(5)(5)).toBe(true);
			expect(is.number.lt(5)(4)).toBe(true);
			expect(is.number.lte(5)(5)).toBe(true);
			expect(is.number.between(1, 10)(5)).toBe(true);
			expect(is.number.between(1, 10)(11)).toBe(false);
		});

		it('is.number properties', () => {
			expect(is.number.positive(1)).toBe(true);
			expect(is.number.positive(0)).toBe(false);
			expect(is.number.negative(-1)).toBe(true);
			expect(is.number.even(2)).toBe(true);
			expect(is.number.odd(3)).toBe(true);
			expect(is.number.integer(1.0)).toBe(true);
			expect(is.number.integer(1.1)).toBe(false);
			expect(is.number.float(1.1)).toBe(true);
		});
	});

	describe('Complex Guards', () => {
		it('is.array', () => {
			expect(is.array()([1, 2])).toBe(true);
			expect(is.array(is.string)(['a', 'b'])).toBe(true);
			expect(is.array(is.string)(['a', 1])).toBe(false);
		});

		it('is.array sub-guards', () => {
			expect(is.array.min(2)([1, 2])).toBe(true);
			expect(is.array.max(2)([1, 2, 3])).toBe(false);
			expect(is.array.size(2)([1, 2])).toBe(true);
			expect(is.array.nonEmpty([1])).toBe(true);
			expect(is.array.empty([])).toBe(true);
			expect(is.array.unique([1, 2, 1])).toBe(false);
			expect(is.array.includes([1, 2])(1)).toBe(true);
			expect(is.array.excludes([1, 2])(3)).toBe(true);
			expect(is.array.includesAll([1, 2, 3])([1, 2])).toBe(true);
			expect(is.array.includesAny([1, 2, 3])([3, 4])).toBe(true);
			expect(is.array.includesNone([1, 2, 3])([4, 5])).toBe(true);
			expect(is.array.includesOnly([1, 2])([1, 1, 2])).toBe(true);
		});

		it('is.object', () => {
			expect(is.object()({ a: 1 })).toBe(true);
			expect(is.object({ a: is.number })({ a: 1 })).toBe(true);
			expect(is.object({ a: is.number })({ a: '1' })).toBe(false);
			expect(is.object({ a: is.number })({})).toBe(false);
		});

		it('is.partial', () => {
			const guard = is.partial({ a: is.number });
			expect(guard({ a: 1 })).toBe(true);
			expect(guard({})).toBe(true);
			expect(guard({ a: '1' })).toBe(false);
		});

		it('is.record', () => {
			const guard = is.record(is.string, is.number);
			expect(guard({ a: 1, b: 2 })).toBe(true);
			expect(guard({ a: '1' })).toBe(false);
		});

		it('is.tuple', () => {
			const guard = is.tuple(is.string, is.number);
			expect(guard(['a', 1])).toBe(true);
			expect(guard(['a', 'b'])).toBe(false);
			expect(guard(['a'])).toBe(false);
		});
	});

	describe('Logic Guards', () => {
		it('is.oneOf', () => {
			const guard = is.oneOf(is.string, is.number);
			expect(guard('a')).toBe(true);
			expect(guard(1)).toBe(true);
			expect(guard(true)).toBe(false);
		});

		it('is.allOf', () => {
			const guard = is.allOf(is.string, is.number, is.boolean);
			expect(guard('a')).toBe(false);
			expect(guard(1)).toBe(false);
			expect(guard(true)).toBe(false);
			expect(guard({ a: 1 })).toBe(false);
			expect(guard({})).toBe(false);
		});

		it('is.not', () => {
			const guard = is.not(is.string);
			expect(guard(1)).toBe(true);
			expect(guard('a')).toBe(false);
		});

		it('is.union', () => {
			type T = { type: 'a'; val: string } | { type: 'b'; val: number };
			const guard = is.union<T, 'type'>('type', {
				a: is.object({ type: is.literal('a'), val: is.string }),
				b: is.object({ type: is.literal('b'), val: is.number }),
			});
			expect(guard({ type: 'a', val: 's' })).toBe(true);
			expect(guard({ type: 'b', val: 1 })).toBe(true);
			expect(guard({ type: 'a', val: 1 })).toBe(false);
		});
	});

	describe('Specialized Guards', () => {
		it('is.date', () => {
			expect(is.date(new Date())).toBe(true);
			expect(is.date(new Date('invalid'))).toBe(false);
			expect(is.date('2024-01-01')).toBe(false);
		});

		it('is.ok', () => {
			expect(is.ok()({ ok: true, value: 1 })).toBe(true);
			expect(is.ok(is.number)({ ok: true, value: 1 })).toBe(true);
			expect(is.ok(is.number)({ ok: true, value: '1' })).toBe(false);
		});

		it('is.err', () => {
			expect(is.err()({ ok: false, error: 1 })).toBe(true);
			expect(is.err(is.number)({ ok: false, error: 1 })).toBe(true);
			expect(is.err(is.number)({ ok: false, error: '1' })).toBe(false);
		});

		it('is.result', () => {
			const guard = is.result(is.number, is.string);
			expect(guard({ ok: true, value: 1 })).toBe(true);
			expect(guard({ ok: false, error: 'e' })).toBe(true);
			expect(guard({ ok: true, value: 's' })).toBe(false);
		});

		it('is.some', () => {
			expect(is.some()({ ok: true, value: 1 })).toBe(true);
			expect(is.some(is.number)({ ok: true, value: 1 })).toBe(true);
			expect(is.some()({ ok: true, value: null })).toBe(false);
		});

		it('is.none', () => {
			expect(is.none()({ ok: false, error: undefined })).toBe(true);
			expect(is.none()({ ok: false, error: 'error' })).toBe(false);
		});

		it('is.option', () => {
			const guard = is.option(is.number);
			expect(guard({ ok: true, value: 1 })).toBe(true);
			expect(guard({ ok: false, error: undefined })).toBe(true);
		});

		it('is.tagged', () => {
			expect(is.tagged('Error')({ _tag: 'Error' })).toBe(true);
			expect(is.tagged('Error')({ _tag: 'Other' })).toBe(false);

			const factory = { is: (v: any): v is { _tag: 'F' } => v?._tag === 'F' };
			expect(is.tagged(factory)({ _tag: 'F' })).toBe(true);
		});

		it('is.schema', () => {
			const mockSchema = { safeParse: (v: any) => ({ success: v === 'ok' }) };
			expect(is.schema(mockSchema)('ok')).toBe(true);
			expect(is.schema(mockSchema)('not ok')).toBe(false);
		});

		it('is.literal', () => {
			expect(is.literal('a')('a')).toBe(true);
			expect(is.literal('a')('b')).toBe(false);
		});
	});

	describe('Utility Functions', () => {
		it('assert', () => {
			expect(() => assert('a', is.string)).not.toThrow();
			expect(() => assert(1, is.string)).toThrow();
			expect(() => assert(1, is.string, 'Custom message')).toThrow('Custom message');
		});

		it('ensure', () => {
			expect(ensure('a', is.string)).toBe('a');
			expect(() => ensure(1, is.string)).toThrow();
		});

		it('validate', () => {
			const okRes = validate('a', is.string, 'error');
			expect(okRes.isOk()).toBe(true);
			expect(okRes.unwrap()).toBe('a');

			const errRes = validate(1, is.string, 'error');
			expect(errRes.isErr()).toBe(true);
			expect(errRes.unwrapErr()).toBe('error');
		});

		it('guardToValidator', () => {
			const validator = guardToValidator(is.string, 'error');
			expect(validator('a').isOk()).toBe(true);
			expect(validator(1).isErr()).toBe(true);
		});

		it('guardToTask', () => {
			const taskCreator = guardToTask(is.string, 'error');
			const task = taskCreator('a');
			expect(task).toBeInstanceOf(Task);
		});
	});

	describe('defineSchemas', () => {
		const schemas = defineSchemas({
			User: {
				name: is.string,
				age: is.number,
			},
		});

		it('parse success', () => {
			const res = schemas.User.parse({ name: 'John', age: 30 });
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toEqual({ name: 'John', age: 30 });
		});

		it('parse failure', () => {
			const res = schemas.User.parse({ name: 'John', age: '30' });
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()[0]).toContain('User.age failed validation');
		});

		it('parse non-object', () => {
			const res = schemas.User.parse(null);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()[0]).toContain('Expected an object');
		});

		it('assert success', () => {
			expect(schemas.User.assert({ name: 'John', age: 30 })).toBe(true);
		});

		it('assert failure', () => {
			expect(() => schemas.User.assert({ name: 'John', age: '30' })).toThrow();
			expect(() => schemas.User.assert(null)).toThrow();
		});

		it('InferSchema works with schema objects', () => {
			type InferredUser = InferSchema<typeof schemas.User>;
			const user: InferredUser = { name: 'John', age: 30 };
			expect(schemas.User.assert(user)).toBe(true);
		});
	});

	describe('Guard Namespace', () => {
		it('should have all expected utilities', () => {
			expect(Guard.is).toBeDefined();
			expect(Guard.assert).toBeDefined();
			expect(Guard.ensure).toBeDefined();
			expect(Guard.validate).toBeDefined();
			expect(Guard.toValidator).toBeDefined();
			expect(Guard.toTask).toBeDefined();
		});
	});
});
