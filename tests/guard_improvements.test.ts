import { describe, it, expect } from 'vitest';
import { is, defineSchemas } from '../src/guard.js';

describe('Guard API Improvements', () => {
	const schemas = defineSchemas({
		User: {
			name: is.string.setErrMsg('name is not a string'),
			age: is.number.gt(18).setErrMsg('age is not greater than 18'),
			genus: is.string,
		},
	});

	it('provides property paths in parse errors', () => {
		const result = schemas.User.parse({ name: 123, age: 10, genus: 123 });
		expect(result.isErr()).toBe(true);
		const errors = result.unwrapErr().map(e => e.msg);
		expect(errors).toContain('name is not a string');
		expect(errors).toContain('age is not greater than 18');
		expect(errors).toContain('User.genus failed validation: expected string, but got number (123)');
	});

	it('provides property paths in assert errors', () => {
		expect(() => schemas.User.assert({ name: 'John', age: 10 })).toThrow('age is not greater than 18');
	});

	it('optimizes performance (basic check)', () => {
		const start = Date.now();
		for (let i = 0; i < 10000; i++) {
			schemas.User.parse({ name: 'John', age: 25 });
		}
		const end = Date.now();
		console.log(`Parsed 10,000 times in ${end - start}ms`);
		expect(end - start).toBeLessThan(100); // very loose check lol
	});

	it('supports namespace extensibility via is.extend', () => {
		const myIs = is.extend('app', {
			positiveEven: (v: unknown): v is number => is.number.positive(v) && is.number.even(v),
		});

		expect(myIs.app.positiveEven(4)).toBe(true);
		expect(myIs.app.positiveEven(3)).toBe(false);
		expect(myIs.app.positiveEven(-2)).toBe(false);
		expect(myIs.string('hello')).toBe(true);
	});

	it('supports strict mode for objects', () => {
		const strictTest = is.object({
			name: is.string,
			age: is.number,
		}).strict;

		expect(strictTest({ name: 'John', age: 25 })).toBe(true);
		expect(strictTest({ name: 'John', age: 25, extra: true })).toBe(false);
	});

	it('supports deep equality for objects', () => {
		const eqTest = is.object.eq({
			meta: {
				tags: ['a', 'b'],
			},
		});

		expect(eqTest({ meta: { tags: ['a', 'b'] } })).toBe(true);
		expect(eqTest({ meta: { tags: ['a', 'c'] } })).toBe(false);
		expect(eqTest({ meta: { tags: ['a'] } })).toBe(false);
	});

	it('supports enhanced date helpers', () => {
		const date = new Date('2024-03-20T10:30:00Z'); // Wednesday
		expect(is.date.day('wednesday')(date)).toBe(true);
		expect(is.date.day('monday')(date)).toBe(false);
		expect(is.date.year(2024)(date)).toBe(true);
		expect(is.date.month(2)(date)).toBe(true); // 0-indexed
		expect(is.date.dayOfMonth(20)(date)).toBe(true);
		expect(is.date.hour(date.getHours())(date)).toBe(true);
	});

	it('supports array equality', () => {
		expect(is.array.eq([1, 2, 3])([1, 2, 3])).toBe(true);
		expect(is.array.eq([1, 2, 3])([1, 2, 4])).toBe(false);
		expect(is.array.eq([1, 2, 3])([1, 2])).toBe(false);
	});

	it('supports array size checks', () => {
		expect(is.array.size(3)([1, 2, 3])).toBe(true);
		expect(is.array.size(3)([1, 2, 4])).toBe(true);
		expect(is.array.size(3)([1, 2])).toBe(false);
	});

	it('supports object helpers', () => {
		const obj = { a: 1, b: 2 };
		expect(is.object.has('a')(obj)).toBe(true);
		expect(is.object.notHas('c')(obj)).toBe(true);
		expect(is.object.hasAll(['a', 'b'])(obj)).toBe(true);
		expect(is.object.hasAny(['a', 'c'])(obj)).toBe(true);
		expect(is.object.hasNone(['c', 'd'])(obj)).toBe(true);
		expect(is.object.hasOnly(['a', 'b'])(obj)).toBe(true);
		expect(is.object.where(v => v.a > 0)(obj)).toBe(true);
	});

	it('supports record helpers', () => {
		const record = { a: 1, b: 2 };
		expect(is.record(is.string, is.number)(record)).toBe(true);
		expect(is.record(is.string, is.number)({ a: 1, b: '2' })).toBe(false);
		expect(is.record(is.string, is.number)({ a: 1, b: 2, c: 3 })).toBe(true);
		expect(is.record(is.string, is.number)({ a: 1, b: 2, c: 3 })).toBe(true);
	});

	it('supports partial objects', () => {
		const partialTest = is.partial({
			name: is.string,
			age: is.number,
		});

		expect(partialTest({ name: 'John', age: 25 })).toBe(true);
		expect(partialTest({ name: 'John' })).toBe(true);
		expect(partialTest({ age: 25 })).toBe(true);
		expect(partialTest({})).toBe(true);
		expect(partialTest({ name: 'John', age: 25, extra: true })).toBe(true);
	});
});
