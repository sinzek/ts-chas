import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';

describe('is.url (v2)', () => {
	it('validates any WHATWG URL', () => {
		expect(is.url()('https://example.com')).toBe(true);
		expect(is.url()('http://localhost')).toBe(true);
		expect(is.url()('mailto:noreply@zod.dev')).toBe(true);
		expect(is.url()('ftp://files.example.com/data')).toBe(true);
		expect(is.url()('not-a-url')).toBe(false);
		expect(is.url()(123)).toBe(false);
	});

	it('filters by hostname regex', () => {
		const guard = is.url({ hostname: /^example\.com$/ });
		expect(guard('https://example.com')).toBe(true);
		expect(guard('https://zombo.com')).toBe(false);
	});

	it('filters by protocol regex', () => {
		const guard = is.url({ protocol: /^https$/ });
		expect(guard('https://example.com')).toBe(true);
		expect(guard('http://example.com')).toBe(false);
	});

	it('filters by both hostname and protocol', () => {
		const guard = is.url({
			protocol: /^https?$/,
			hostname: /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
		});
		expect(guard('https://example.com')).toBe(true);
		expect(guard('http://example.com')).toBe(true);
		expect(guard('ftp://example.com')).toBe(false);
		expect(guard('http://localhost')).toBe(false);
	});

	describe('Property Helpers', () => {
		it('.http - restricts to http/https with valid domain', () => {
			expect(is.url().http('https://example.com')).toBe(true);
			expect(is.url().http('http://example.com/path')).toBe(true);
			expect(is.url().http('ftp://files.example.com')).toBe(false);
			expect(is.url().http('http://localhost')).toBe(false);
		});

		it('.https - restricts to https only', () => {
			expect(is.url().https('https://example.com')).toBe(true);
			expect(is.url().https('http://example.com')).toBe(false);
		});

		it('.secure - alias for https', () => {
			expect(is.url().secure('https://example.com')).toBe(true);
			expect(is.url().secure('http://example.com')).toBe(false);
		});

		it('.local - matches localhost/127.0.0.1/::1', () => {
			expect(is.url().local('http://localhost')).toBe(true);
			expect(is.url().local('http://localhost:3000')).toBe(true);
			expect(is.url().local('http://127.0.0.1')).toBe(true);
			expect(is.url().local('http://[::1]')).toBe(true);
			expect(is.url().local('https://example.com')).toBe(false);
		});

		it('.hasSearch - validates query string presence', () => {
			expect(is.url().hasSearch('https://example.com?q=hello')).toBe(true);
			expect(is.url().hasSearch('https://example.com')).toBe(false);
		});

		it('.hasHash - validates hash fragment presence', () => {
			expect(is.url().hasHash('https://example.com#section')).toBe(true);
			expect(is.url().hasHash('https://example.com')).toBe(false);
		});
	});

	describe('Factory Helpers', () => {
		it('.pathname - filters by pathname regex', () => {
			expect(is.url().pathname(/^\/api\//)('https://example.com/api/users')).toBe(true);
			expect(is.url().pathname(/^\/api\//)('https://example.com/home')).toBe(false);
		});

		it('.port - filters by port number', () => {
			expect(is.url().port(3000)('http://localhost:3000')).toBe(true);
			expect(is.url().port(3000)('http://localhost:8080')).toBe(false);
		});

		it('.port() - asserts any port is present', () => {
			expect(is.url().port()('http://localhost:3000')).toBe(true);
			expect(is.url().port()('https://example.com')).toBe(false);
		});
	});

	describe('Chaining', () => {
		it('should chain with universal helpers', () => {
			expect(is.url().nullable(null)).toBe(true);
			expect(is.url().nullable('https://example.com')).toBe(true);
		});

		it('should chain hostname and protocol factories', () => {
			const guard = is.url().protocol(/^https$/).hostname(/^example\.com$/);
			expect(guard('https://example.com')).toBe(true);
			expect(guard('http://example.com')).toBe(false);
			expect(guard('https://zombo.com')).toBe(false);
		});

		it('should chain properties with factories', () => {
			const guard = is.url().secure.pathname(/^\/api\//);
			expect(guard('https://example.com/api/users')).toBe(true);
			expect(guard('http://example.com/api/users')).toBe(false);
			expect(guard('https://example.com/home')).toBe(false);
		});
	});
});
