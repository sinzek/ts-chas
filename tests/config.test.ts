import { describe, it, expect } from 'vitest';
import { defineConfig, coerce } from '../src/config.js';
import { is } from '../src/guard.js';

describe('Config Validation', () => {
	describe('defineConfig', () => {
		it('should parse valid string env vars', () => {
			const Config = defineConfig({
				HOST: is.string,
				NAME: is.string.nonEmpty,
			});
			const result = Config.parse({ HOST: 'localhost', NAME: 'myapp' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ HOST: 'localhost', NAME: 'myapp' });
		});

		it('should return errors for missing required vars', () => {
			const Config = defineConfig({
				HOST: is.string,
				PORT: is.string,
			});
			const result = Config.parse({});
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.length).toBe(2);
			}
		});

		it('should collect ALL errors, not fail fast', () => {
			const Config = defineConfig({
				A: is.string.nonEmpty,
				B: is.string.nonEmpty,
				C: is.string.nonEmpty,
			});
			const result = Config.parse({});
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.length).toBe(3);
			}
		});

		it('should treat empty strings as missing', () => {
			const Config = defineConfig({
				HOST: is.string.nonEmpty,
			});
			const result = Config.parse({ HOST: '' });
			expect(result.isErr()).toBe(true);
		});
	});

	describe('coercion', () => {
		it('should coerce strings to numbers', () => {
			const Config = defineConfig({
				PORT: coerce.number,
			});
			const result = Config.parse({ PORT: '3000' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ PORT: 3000 });
		});

		it('should reject non-numeric strings', () => {
			const Config = defineConfig({
				PORT: coerce.number,
			});
			const result = Config.parse({ PORT: 'abc' });
			expect(result.isErr()).toBe(true);
		});

		it('should coerce strings to booleans', () => {
			const Config = defineConfig({
				DEBUG: coerce.boolean,
			});

			expect(Config.parse({ DEBUG: 'true' }).unwrap()).toEqual({ DEBUG: true });
			expect(Config.parse({ DEBUG: 'false' }).unwrap()).toEqual({ DEBUG: false });
			expect(Config.parse({ DEBUG: '1' }).unwrap()).toEqual({ DEBUG: true });
			expect(Config.parse({ DEBUG: '0' }).unwrap()).toEqual({ DEBUG: false });
			expect(Config.parse({ DEBUG: 'yes' }).unwrap()).toEqual({ DEBUG: true });
			expect(Config.parse({ DEBUG: 'no' }).unwrap()).toEqual({ DEBUG: false });
		});

		it('should reject invalid boolean strings', () => {
			const Config = defineConfig({
				DEBUG: coerce.boolean,
			});
			const result = Config.parse({ DEBUG: 'maybe' });
			expect(result.isErr()).toBe(true);
		});
	});

	describe('defaults', () => {
		it('should use default values for missing vars', () => {
			const Config = defineConfig({
				HOST: is.string,
				DEBUG: { guard: coerce.boolean, default: false },
			});
			const result = Config.parse({ HOST: 'localhost' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ HOST: 'localhost', DEBUG: false });
		});

		it('should override defaults when value is provided', () => {
			const Config = defineConfig({
				DEBUG: { guard: coerce.boolean, default: false },
			});
			const result = Config.parse({ DEBUG: 'true' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ DEBUG: true });
		});

		it('should use default for empty strings', () => {
			const Config = defineConfig({
				PORT: { guard: coerce.number, default: 3000 },
			});
			const result = Config.parse({ PORT: '' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ PORT: 3000 });
		});
	});

	describe('literals', () => {
		it('should validate literal string values', () => {
			const Config = defineConfig({
				NODE_ENV: is.literal('development', 'staging', 'production'),
			});
			expect(Config.parse({ NODE_ENV: 'development' }).isOk()).toBe(true);
			expect(Config.parse({ NODE_ENV: 'staging' }).isOk()).toBe(true);
			expect(Config.parse({ NODE_ENV: 'invalid' }).isErr()).toBe(true);
		});
	});

	describe('branded types', () => {
		it('should work with branded string guards', () => {
			const Config = defineConfig({
				API_KEY: is.string.nonEmpty.brand<'ApiKey'>(),
			});
			const result = Config.parse({ API_KEY: 'secret-key-123' });
			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({ API_KEY: 'secret-key-123' });
		});
	});

	describe('complex config', () => {
		it('should handle a realistic config', () => {
			const Config = defineConfig({
				DATABASE_URL: is.string.url,
				PORT: coerce.number,
				NODE_ENV: is.literal('development', 'staging', 'production'),
				DEBUG: { guard: coerce.boolean, default: false },
				APP_NAME: is.string.nonEmpty,
			});

			const result = Config.parse({
				DATABASE_URL: 'https://db.example.com',
				PORT: '5432',
				NODE_ENV: 'production',
				APP_NAME: 'myapp',
			});

			expect(result.isOk()).toBe(true);
			expect(result.unwrap()).toEqual({
				DATABASE_URL: 'https://db.example.com',
				PORT: 5432,
				NODE_ENV: 'production',
				DEBUG: false,
				APP_NAME: 'myapp',
			});
		});

		it('should report multiple errors for invalid config', () => {
			const Config = defineConfig({
				DATABASE_URL: is.string.url,
				PORT: coerce.number,
				NODE_ENV: is.literal('development', 'production'),
			});

			const result = Config.parse({
				DATABASE_URL: 'not-a-url',
				PORT: 'abc',
				NODE_ENV: 'invalid',
			});

			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.length).toBe(3);
			}
		});
	});
});
