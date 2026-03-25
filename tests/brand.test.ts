import { describe, it, expect } from 'vitest';
import { is, validate, defineSchemas, type Brand, unsafeBrand, type GuardType } from '../src/guard.js';

describe('Brand', () => {
	describe('branded guards', () => {
		it('should create a branded string guard', () => {
			const Email = is.string.email.brand<'Email'>();
			expect(Email('test@example.com')).toBe(true);
			expect(Email('not-an-email')).toBe(false);
			expect(Email(123)).toBe(false);
		});

		it('should create a branded number guard', () => {
			const Port = is.number.positive.integer.brand<'Port'>();
			expect(Port(8080)).toBe(true);
			expect(Port(-1)).toBe(false);
			expect(Port(3.14)).toBe(false);
		});

		it('should create a branded boolean guard', () => {
			const Flag = is.boolean.brand<'Flag'>();
			expect(Flag(true)).toBe(true);
			expect(Flag(false)).toBe(true);
			expect(Flag('true')).toBe(false);
		});

		it('should create a branded date guard', () => {
			const Timestamp = is.date.brand<'Timestamp'>();
			expect(Timestamp(new Date())).toBe(true);
			expect(Timestamp('2024-01-01')).toBe(false);
		});

		it('should create a branded array guard', () => {
			const Tags = is.array(is.string).nonEmpty.brand<'Tags'>();
			expect(Tags(['a', 'b'])).toBe(true);
			expect(Tags([])).toBe(false);
			expect(Tags('not-array')).toBe(false);
		});

		it('should create a branded object guard', () => {
			const Config = is
				.object({ host: is.string, port: is.number })
				.brand<'Config'>();
			expect(Config({ host: 'localhost', port: 3000 })).toBe(true);
			expect(Config({ host: 'localhost' })).toBe(false);
			expect(Config('not-object')).toBe(false);
		});

		it('should work with validate() to produce branded Results', () => {
			const Email = is.string.email.brand<'Email'>();
			const result = validate('test@example.com', Email);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				// At runtime, the value is just a string
				expect(result.value).toBe('test@example.com');
				expect(typeof result.value).toBe('string');
			}
		});

		it('should work with validate() to produce errors for invalid values', () => {
			const Email = is.string.email.brand<'Email'>();
			const result = validate('not-an-email', Email);
			expect(result.isErr()).toBe(true);
		});

		it('should work with defineSchemas', () => {
			const schemas = defineSchemas({
				User: {
					email: is.string.email.brand<'Email'>(),
					id: is.string.uuid('v4').brand<'UserId'>(),
					age: is.number.positive.brand<'Age'>(),
				},
			});

			const valid = schemas.User.parse({
				email: 'test@example.com',
				id: '550e8400-e29b-41d4-a716-446655440000',
				age: 25,
			});
			expect(valid.isOk()).toBe(true);

			const invalid = schemas.User.parse({
				email: 'not-email',
				id: 'not-uuid',
				age: -5,
			});
			expect(invalid.isErr()).toBe(true);
		});

		it('should support chaining setErrMsg after brand', () => {
			const Email = is.string.email.brand<'Email'>().setErrMsg('Must be a valid email');
			const result = validate('bad', Email);
			expect(result.isErr()).toBe(true);
		});

		it('should support chaining setMeta after brand', () => {
			const Email = is.string.email.brand<'Email'>().setMeta({ name: 'CustomEmail' });
			expect(Email('test@example.com')).toBe(true);
			expect(Email('bad')).toBe(false);
		});

		it('should have correct meta name with .brand suffix', () => {
			const Email = is.string.email.brand<'Email'>();
			expect(Email.meta?.name).toContain('brand');
		});
	});

	describe('unsafeBrand', () => {
		it('should create a branded value from a plain value', () => {
			const email = unsafeBrand<'Email', string>('test@example.com');
			expect(email).toBe('test@example.com');
		});

		it('should preserve the original value', () => {
			const port = unsafeBrand<'Port', number>(8080);
			expect(port).toBe(8080);
			expect(typeof port).toBe('number');
		});
	});

	describe('GuardType extraction', () => {
		it('should extract branded types from guards', () => {
			const Email = is.string.email.brand<'Email'>();
			// This is a compile-time check — GuardType should extract Brand<"Email", string>
			type EmailType = GuardType<typeof Email>;
			// Runtime: just verify the guard works
			const result = validate('test@example.com', Email);
			expect(result.isOk()).toBe(true);
		});
	});
});
