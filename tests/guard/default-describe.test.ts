import { describe, it, expect } from 'vitest';
import { is, defineSchema } from '../../src/guard/index.js';

describe('default helper', () => {
	it('returns the default when input is undefined', () => {
		const guard = is.string.default('unknown');
		expect(guard.parse(undefined).unwrap()).toBe('unknown');
		expect(guard.assert(undefined)).toBe('unknown');
	});

	it('does not fire on values that simply fail validation', () => {
		const guard = is.string.default('unknown');
		expect(guard.parse(123).isErr()).toBe(true);
	});

	it('accepts a thunk', () => {
		let calls = 0;
		const guard = is.number.default(() => {
			calls++;
			return 42;
		});
		expect(guard.parse(undefined).unwrap()).toBe(42);
		expect(guard.parse(undefined).unwrap()).toBe(42);
		expect(calls).toBe(2);
	});

	it('passes meta into the thunk', () => {
		const guard = is.string.default(({ meta }) => `id:${meta.id}`);
		expect(guard.parse(undefined).unwrap()).toBe('id:string');
	});

	it('materializes defaults for missing object fields via defineSchema', () => {
		const User = defineSchema('User', {
			name: is.string,
			role: is.string.default('user'),
		});
		expect(User.parse({ name: 'Alice' }).unwrap()).toEqual({ name: 'Alice', role: 'user' });
		expect(User.parse({ name: 'Alice', role: 'admin' }).unwrap()).toEqual({ name: 'Alice', role: 'admin' });
	});

	it('prefers default over fallback when input is undefined', () => {
		const guard = is.string.default('from-default').fallback('from-fallback');
		expect(guard.parse(undefined).unwrap()).toBe('from-default');
		expect(guard.parse(42).unwrap()).toBe('from-fallback');
	});

	it('returns the default as-is without re-validating it', () => {
		// A mis-typed default is user error; don't re-validate.
		const guard = is.number.default('oops' as unknown as number);
		expect(guard.parse(undefined).unwrap()).toBe('oops');
	});

	it('flows into JSON Schema output', () => {
		const schema = is.string.default('x').toJsonSchema();
		expect(schema.default).toBe('x');
	});
});

describe('describe helper', () => {
	it('attaches a description to meta', () => {
		const guard = is.string.describe('User name');
		expect(guard.meta.description).toBe('User name');
	});

	it('supports a function that receives the current meta', () => {
		const guard = is.number.int.describe(m => `non-negative ${m.id}`);
		expect(guard.meta.description).toBe('non-negative number');
	});

	it('flows into JSON Schema output', () => {
		const schema = is.string.email.describe('Email address').toJsonSchema();
		expect(schema.description).toBe('Email address');
	});

	it('does not affect validation behavior', () => {
		const guard = is.string.describe('anything');
		expect(guard.parse('ok').unwrap()).toBe('ok');
		expect(guard.parse(42).isErr()).toBe(true);
	});

	it('is composable with other helpers', () => {
		const guard = is.object({ name: is.string.describe('the name') }).describe('A user');
		expect(guard.meta.description).toBe('A user');
		const json = guard.toJsonSchema();
		expect(json.description).toBe('A user');
		expect(json.properties?.name?.description).toBe('the name');
	});
});

describe('annotate helper', () => {
	it('merges custom keys into meta', () => {
		const guard = is.string.annotate({ tag: 'pii', owner: 'auth-team' });
		expect(guard.meta['tag']).toBe('pii');
		expect(guard.meta['owner']).toBe('auth-team');
	});

	it('does not affect validation', () => {
		const guard = is.number.int.annotate({ source: 'legacy' });
		expect(guard.parse(5).unwrap()).toBe(5);
		expect(guard.parse(5.5).isErr()).toBe(true);
	});

	it('rejects reserved meta keys', () => {
		expect(() => is.string.annotate({ id: 'hacked' })).toThrow(/reserved/);
		expect(() => is.string.annotate({ description: 'direct' })).toThrow(/reserved/);
		expect(() => is.string.annotate({ fallback: 'x' })).toThrow(/reserved/);
		expect(() => is.string.annotate({ default: 'x' })).toThrow(/reserved/);
		expect(() => is.string.annotate({ shape: {} })).toThrow(/reserved/);
		expect(() => is.string.annotate({ jsonSchema: {} })).toThrow(/reserved/);
	});

	it('chains with other helpers', () => {
		const guard = is.string.email.annotate({ tag: 'user-email' }).describe('User email');
		expect(guard.meta['tag']).toBe('user-email');
		expect(guard.meta.description).toBe('User email');
	});

	it('last annotate wins on the same custom key', () => {
		const guard = is.string.annotate({ tag: 'a' }).annotate({ tag: 'b' });
		expect(guard.meta['tag']).toBe('b');
	});
});
