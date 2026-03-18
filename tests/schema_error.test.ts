import { describe, it, expect } from 'vitest';
import { is, defineSchemas, Guard } from '../src/guard.js';

describe('Schema Planning and Error Messages', () => {
	const userSchema = defineSchemas({
		User: {
			name: is.string.nonEmpty.setErrMsg('Name is required'),
			age: is.number.gt(18).setErrMsg('Must be at least 18'),
			email: is.string.email,
		},
	});

	describe('Default Error Messages', () => {
		it('should include the guard name in the default error message', () => {
			const result = userSchema.User.parse({ name: 'Chase', age: 25, email: 'not-an-email' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// The email guard is is.string.email, which now should have name 'string.email'
				expect(result.error[0].msg).toContain('expected string.email, but got string');
				expect(result.error[0].msg).toContain('User.email failed validation');
			}
		});

		it('should handle complex guards like anyOf in default error messages', () => {
			const schema = defineSchemas({
				Result: {
					status: is.anyOf(is.literal('success'), is.literal('error')),
				},
			});
			const result = schema.Result.parse({ status: 'pending' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error[0].msg).toContain('expected anyOf<literal ("success"), literal ("error")>');
			}
		});
	});

	describe('Custom Error Messages (.setErrMsg)', () => {
		it('should bubble up custom error messages in parse()', () => {
			const result = userSchema.User.parse({ name: '', age: 25, email: 'chase@example.com' });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.map(e => e.msg)).toContain('Name is required');
			}
		});

		it('should bubble up custom error messages in assert()', () => {
			expect(() => userSchema.User.assert({ name: 'Chase', age: 15, email: 'chase@example.com' })).toThrow(
				'Must be at least 18'
			);
		});

		it('should allow overriding the entire schema error message in parse()', () => {
			const result = userSchema.User.parse({ name: '', age: 15 });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// When a schema-wide error is provided, it is used as fallback for each property failure
				// but .setErrMsg on the guard still takes priority (with the path).
				expect(result.error.map(e => e.msg)).toContain('Name is required');
				expect(result.error.map(e => e.msg)).toContain('Must be at least 18');
			}
		});
	});

	describe('Guard.validate', () => {
		it('should use custom error message if provided via .setErrMsg', () => {
			const guard = is.string.nonEmpty.setErrMsg('Cannot be empty');
			const result = Guard.validate('', guard);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.msg).toBe('Cannot be empty');
			}
		});

		it('should fallback to provided error if no custom message is set', () => {
			const guard = is.string.nonEmpty;
			const result = Guard.validate('', guard, 'Default Error');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Default Error');
			}
		});
	});
});
