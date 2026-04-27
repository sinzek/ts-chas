import { describe, it, expect } from 'vitest';
import { defineSchemas, is } from '../../src/guard/index.js';
import type { StandardSchemaV1 } from '../../src/standard-schema.js';

describe('is.standard()', () => {
	const mockSchema = (passes: boolean, issues: any[] = []): StandardSchemaV1<string, string> => ({
		'~standard': {
			version: 1,
			vendor: 'test-vendor',
			validate: (value: unknown) => {
				if (passes) return { value: value as string };
				return { issues };
			},
		},
	});

	it('returns true when standard schema succeeds', () => {
		const schema = mockSchema(true);
		const guard = is.standard(schema);
		expect(guard('hello')).toBe(true);
	});

	it('returns false when standard schema fails', () => {
		const schema = mockSchema(false, [{ message: 'bad', path: [] }]);
		const guard = is.standard(schema);
		expect(guard('hello')).toBe(false);
	});

	it('surfaces issues in parse() errors', () => {
		const issues = [{ message: 'Invalid length', path: ['foo'] }];
		const schema = mockSchema(false, issues);
		const guard = is.standard(schema);

		const result = guard.parse('hello');
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.issues).toEqual(issues);
			expect(result.error.name).toBe('standard(test-vendor)');
		}
	});

	it('works inside is.object (standalone)', () => {
		const emailSchema = mockSchema(false, [{ message: 'Not an email', path: [] }]);
		const User = is.object({
			email: is.standard(emailSchema),
		});

		const result = User.parse({ email: 'bad-email' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			// Standalone ObjectGuard doesn't currently bubble up issues from children
			// but it should at least fail.
			expect(result.error.name).toContain('object');
		}
	});

	it('works inside defineSchema', () => {
		const emailSchema = mockSchema(false, [{ message: 'Not an email', path: [] }]);
		const { User } = defineSchemas({
			User: {
				email: is.standard(emailSchema),
			},
		});

		const result = User.parse({ email: 'bad-email' });
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const errors = result.error;
			const emailErr = errors.find(e => e.path.includes('email'));
			expect(emailErr).toBeDefined();
			expect(emailErr?.issues?.[0].message).toBe('Not an email');
		}
	});

	it('throws on async validation in sync mode', () => {
		const asyncSchema: StandardSchemaV1 = {
			'~standard': {
				version: 1,
				vendor: 'async-vendor',
				validate: () => Promise.resolve({ value: 'ok' }),
			},
		};

		const guard = is.standard(asyncSchema);
		expect(() => guard('hello')).toThrow(/returned a Promise during synchronous validation/);
	});
});
