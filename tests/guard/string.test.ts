import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { is } from '../../src/guard/index.js';

describe('is.string (v2)', () => {
	it('basic string validation', () => {
		expect(is.string('foo')).toBe(true);
		expect(is.string(123)).toBe(false);
		expect(is.string(null)).toBe(false);
	});

	describe('Refinements', () => {
		it('email', () => {
			expect(is.string.email('test@example.com')).toBe(true);
			expect(is.string.email('invalid')).toBe(false);
		});

		it('url', () => {
			expect(is.string.url('https://google.com')).toBe(true);
			expect(is.string.url('ftp://google.com')).toBe(true);
			expect(is.string.url('invalid')).toBe(false);
		});

		it('uuid', () => {
			// Default: any version, RFC 9562 variant enforced
			expect(is.string.uuid()('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
			expect(is.string.uuid()('invalid')).toBe(false);

			// Version-specific: v4 (char at position 14 = '4')
			expect(is.string.uuid({ version: 'v4' })('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
			expect(is.string.uuid({ version: 'v4' })('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1

			// Variant enforcement: position 19 must be 8, 9, a, or b
			expect(is.string.uuid()('550e8400-e29b-41d4-c716-446655440000')).toBe(false); // 'c' is not valid variant
		});

		it('uuidv4 / uuidv7 convenience', () => {
			expect(is.string.uuidv4('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
			expect(is.string.uuidv4('550e8400-e29b-71d4-a716-446655440000')).toBe(false); // v7
			expect(is.string.uuidv7('017f22e2-79b0-7cc3-98c4-dc0c0c07398f')).toBe(true);
			expect(is.string.uuidv7('550e8400-e29b-41d4-a716-446655440000')).toBe(false); // v4
		});

		it('guid (relaxed, no variant enforcement)', () => {
			// guid accepts any UUID-like format, no variant check
			expect(is.string.guid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
			expect(is.string.guid('550e8400-e29b-41d4-c716-446655440000')).toBe(true); // 'c' variant OK for guid
			expect(is.string.guid('invalid')).toBe(false);
		});

		it('ipv4', () => {
			expect(is.string.ipv4('127.0.0.1')).toBe(true);
			expect(is.string.ipv4('256.0.0.1')).toBe(false);
		});

		it('hex', () => {
			expect(is.string.hex()('deadbeef')).toBe(true);
			expect(is.string.hex()('0xdeadbeef')).toBe(false); // default no prefix
			expect(is.string.hex({ prefix: true })('0xDEADBEEF')).toBe(true);
		});

		it('jwt', () => {
			const hs256 =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
			const rs256 =
				'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

			expect(is.string.jwt()(hs256)).toBe(true);
			expect(is.string.jwt({ validateJson: true })(hs256)).toBe(true);
			expect(is.string.jwt({ alg: 'HS256' })(hs256)).toBe(true);
			expect(is.string.jwt({ alg: 'RS256' })(hs256)).toBe(false);
			expect(is.string.jwt({ alg: ['HS256', 'RS256'] })(hs256)).toBe(true);
			expect(is.string.jwt({ alg: 'RS256' })(rs256)).toBe(true);
			expect(is.string.jwt()('invalid')).toBe(false);
		});

		it('hash & verify', () => {
			// MD5 hex
			const md5Hex = 'acbd18db4cc2f85cedef654fccc4a4d8'; // hash of 'foo'
			expect(is.string.hash({ alg: 'md5' })(md5Hex)).toBe(true);
			expect(is.string.hash({ alg: 'md5' }).verify('foo')(md5Hex)).toBe(true);
			expect(is.string.hash({ alg: 'md5' }).verify('bar')(md5Hex)).toBe(false);

			// SHA-256 (default) hex
			const sha256Hex = '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'; // hash of 'foo'
			expect(is.string.hash()(sha256Hex)).toBe(true);
			expect(is.string.hash().verify('foo')(sha256Hex)).toBe(true);

			// SHA-512 base64
			const actualSha512B64 = crypto.createHash('sha512').update('foo').digest('base64');
			expect(is.string.hash({ alg: 'sha512', enc: 'base64' })(actualSha512B64)).toBe(true);
			expect(is.string.hash({ alg: 'sha512', enc: 'base64' }).verify('foo')(actualSha512B64)).toBe(true);
		});
	});

	describe('Constraints', () => {
		it('min / max / length', () => {
			expect(is.string.min(3)('abc')).toBe(true);
			expect(is.string.min(3)('ab')).toBe(false);
			expect(is.string.max(3)('abc')).toBe(true);
			expect(is.string.max(3)('abcd')).toBe(false);
			expect(is.string.length(3)('abc')).toBe(true);
		});

		it('regex', () => {
			expect(is.string.regex(/^[a-z]+$/)('abc')).toBe(true);
			expect(is.string.regex(/^[a-z]+$/)('123')).toBe(false);
		});
	});

	describe('Chaining', () => {
		it('should chain refinements', () => {
			const guard = is.string.min(3).max(10).email;
			expect(guard('a@d.com')).toBe(true);
			expect(guard('a')).toBe(false); // too short
			expect(guard('thisisaverylongemailaddress@example.com')).toBe(false); // too long
		});

		it('should preserve helpers after refinements', () => {
			// .min(3) is a factory, should return Guard<string, StringHelpers>
			const min3 = is.string.min(3);
			expect(min3.email).toBeDefined();
			expect(min3.email('test@foo.com')).toBe(true);
		});
	});

	describe('Transformers', () => {
		it('trim', () => {
			expect(is.string.trim()('  foo  ')).toBe(true);
			expect(is.string.trim().min(3)('  ab  ')).toBe(false);
			expect(is.string.trim().min(3)('  abc  ')).toBe(true);
		});

		it('parsedJson', () => {
			const guard = is.string.parsedJson({ type: 'object' });
			expect(guard('{"a":1}')).toBe(true);
			expect(guard('[1,2]')).toBe(false);

			const schemaGuard = is.string.parsedJson({
				schema: is.object({ a: is.number }),
			});
			expect(schemaGuard('{"a":1}')).toBe(true);
			expect(schemaGuard('{"a":"1"}')).toBe(false);
		});

		it('should parse JSON into an object using .parse()', () => {
			const guard = is.string.parsedJson({
				schema: is.object({ a: is.number }),
			});
			const res = guard.parse('{"a":1}');
			expect(res.isOk()).toBe(true);
			const val = res.unwrap();
			expect(val).toEqual({ a: 1 });
			expect(typeof val).toBe('object');
		});

		it('should drop string helpers after parsedJson', () => {
			const guard = is.string.parsedJson();
			// @ts-expect-error - email should be gone
			expect(guard.email).toBeUndefined();
		});

		it('iso - basic validation', () => {
			expect(is.string.iso('2024-01-15')).toBe(true);
			expect(is.string.iso('2024-01-15T10:30:00Z')).toBe(true);
			expect(is.string.iso('not-a-date')).toBe(false);
			expect(is.string.iso(123)).toBe(false);
		});

		it('iso sub-helpers (date, time, datetime)', () => {
			// .date validates date-only ISO strings independently (still a property)
			expect(is.string.iso.date('2024-01-15')).toBe(true);
			expect(is.string.iso.date('2024-01-15T10:30:00Z')).toBe(false);

			// .datetime() default: requires timezone offset, arbitrary precision
			expect(is.string.iso.datetime()('2024-01-15T10:30:00Z')).toBe(true);
			expect(is.string.iso.datetime()('2024-01-15T10:30:00+05:00')).toBe(true);
			expect(is.string.iso.datetime()('2024-01-15T10:30:00')).toBe(false); // no offset
			expect(is.string.iso.datetime()('2024-01-15')).toBe(false);

			// .time() default: seconds optional, arbitrary sub-second
			expect(is.string.iso.time()('10:30:00')).toBe(true);
			expect(is.string.iso.time()('10:30')).toBe(true);
			expect(is.string.iso.time()('10:30:00.123')).toBe(true);
			expect(is.string.iso.time()('2024-01-15')).toBe(false);
		});

		it('iso.time precision', () => {
			expect(is.string.iso.time({ precision: -1 })('10:30')).toBe(true);
			expect(is.string.iso.time({ precision: -1 })('10:30:00')).toBe(false);
			expect(is.string.iso.time({ precision: 0 })('10:30:00')).toBe(true);
			expect(is.string.iso.time({ precision: 0 })('10:30:00.123')).toBe(false);
			expect(is.string.iso.time({ precision: 3 })('10:30:00.123')).toBe(true);
			expect(is.string.iso.time({ precision: 3 })('10:30:00.12')).toBe(false);
		});

		it('iso.datetime offset and local', () => {
			// offset: false — forbids timezone suffixes
			expect(is.string.iso.datetime({ offset: false })('2024-01-15T10:30:00')).toBe(true);
			expect(is.string.iso.datetime({ offset: false })('2024-01-15T10:30:00Z')).toBe(false);

			// local: true — offset becomes optional
			expect(is.string.iso.datetime({ local: true })('2024-01-15T10:30:00')).toBe(true);
			expect(is.string.iso.datetime({ local: true })('2024-01-15T10:30:00Z')).toBe(true);
		});

		it('iso.datetime precision', () => {
			expect(is.string.iso.datetime({ precision: 0 })('2024-01-15T10:30:00Z')).toBe(true);
			expect(is.string.iso.datetime({ precision: 0 })('2024-01-15T10:30:00.123Z')).toBe(false);
			expect(is.string.iso.datetime({ precision: 3 })('2024-01-15T10:30:00.123Z')).toBe(true);
			expect(is.string.iso.datetime({ precision: 3 })('2024-01-15T10:30:00Z')).toBe(false);
			expect(is.string.iso.datetime({ precision: -1 })('2024-01-15T10:30Z')).toBe(true);
			expect(is.string.iso.datetime({ precision: -1 })('2024-01-15T10:30:00Z')).toBe(false);
		});

		it('iso should merge with string helpers', () => {
			// string helpers should still be available after .iso
			const guard = is.string.iso.trim().min(10);
			expect(guard('  2024-01-15  ')).toBe(true);
			expect(guard('  2024-01  ')).toBe(false); // trimmed length < 10 & invalid ISO
		});
	});

	describe('Universal Methods', () => {
		it('nullable / optional / nullish', () => {
			expect(is.string.nullable(null)).toBe(true);
			expect(is.string.optional(undefined)).toBe(true);
			expect(is.string.nullish(null)).toBe(true);
			expect(is.string.nullish(undefined)).toBe(true);
		});

		it('or / and', () => {
			expect(is.string.or(is.number)(123)).toBe(true);
			expect(is.string.min(3).and(is.string.regex(/^[a-z]+$/))('abc')).toBe(true);
			expect(is.string.min(3).and(is.string.regex(/^[a-z]+$/))('ab')).toBe(false);
		});

		it('parse', () => {
			const res = is.string.min(5).parse('abc');
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()._tag).toBe('GuardErr');

			const okRes = is.string.min(5).parse('abcde');
			expect(okRes.isOk()).toBe(true);
			expect(okRes.unwrap()).toBe('abcde');
		});

		it('err (custom message)', () => {
			const guard = is.string.min(5).error('TOO SHORT');
			const res = guard.parse('abc');
			expect(res.unwrapErr().message).toBe('TOO SHORT');
		});
	});

	describe('multiple validations', () => {
		it('should validate multiple validations', () => {
			const guard = is.string.max(10).email.min(3);
			expect(guard('a@d.com')).toBe(true);
			expect(guard('a')).toBe(false); // too short
			expect(guard('thisisaverylongemailaddress@example.com')).toBe(false); // too long
		});
	});

	describe('boolStr', () => {
		it('should validate general boolStr', () => {
			expect(is.string.boolStr('true')).toBe(true);
			expect(is.string.boolStr('False')).toBe(true);
			expect(is.string.boolStr('1')).toBe(true);
			expect(is.string.boolStr('0')).toBe(true);
			expect(is.string.boolStr('yes')).toBe(true);
			expect(is.string.boolStr('no')).toBe(true);
			expect(is.string.boolStr('on')).toBe(true);
			expect(is.string.boolStr('off')).toBe(true);
			expect(is.string.boolStr('enabled')).toBe(true);
			expect(is.string.boolStr('disabled')).toBe(true);
			expect(is.string.boolStr('active')).toBe(true);
			expect(is.string.boolStr('inactive')).toBe(true);
			expect(is.string.boolStr('invalid')).toBe(false);
		});

		it('should validate truthy boolStr', () => {
			expect(is.string.boolStr.truthy()('true')).toBe(true);
			expect(is.string.boolStr.truthy()('1')).toBe(true);
			expect(is.string.boolStr.truthy()('yes')).toBe(true);
			expect(is.string.boolStr.truthy()('on')).toBe(true);
			expect(is.string.boolStr.truthy()('enabled')).toBe(true);
			expect(is.string.boolStr.truthy()('active')).toBe(true);
			expect(is.string.boolStr.truthy()('false')).toBe(false);
			expect(is.string.boolStr.truthy()('0')).toBe(false);
		});

		it('should handle caseSensitive in truthy', () => {
			const guard = is.string.boolStr.truthy({ caseSensitive: true });
			expect(guard('true')).toBe(true);
			expect(guard('True')).toBe(true);
			expect(guard('TRUE')).toBe(true);
			expect(guard('trUE')).toBe(false);
		});

		it('should handle custom values in truthy', () => {
			const guard = is.string.boolStr.truthy({ values: ['yup', 'yep'] });
			expect(guard('yup')).toBe(true);
			expect(guard('YEP')).toBe(true); // case-insensitive by default
			expect(guard('true')).toBe(false);
		});

		it('should validate falsy boolStr', () => {
			expect(is.string.boolStr.falsy()('false')).toBe(true);
			expect(is.string.boolStr.falsy()('0')).toBe(true);
			expect(is.string.boolStr.falsy()('no')).toBe(true);
			expect(is.string.boolStr.falsy()('off')).toBe(true);
			expect(is.string.boolStr.falsy()('disabled')).toBe(true);
			expect(is.string.boolStr.falsy()('inactive')).toBe(true);
			expect(is.string.boolStr.falsy()('true')).toBe(false);
			expect(is.string.boolStr.falsy()('1')).toBe(false);
		});

		it('should handle custom values in falsy', () => {
			const guard = is.string.boolStr.falsy({ values: ['nope', 'nah'] });
			expect(guard('nope')).toBe(true);
			expect(guard('NAH')).toBe(true);
			expect(guard('false')).toBe(false);
		});

		it('should transform to boolean using .asBool', () => {
			// asBool is a transformer, so it returns a boolean Result when parsed
			const trueVal = is.string.boolStr.asBool.parse('true').unwrap();
			expect(trueVal).toBe(true);
			expect(typeof trueVal).toBe('boolean');

			const falseVal = is.string.boolStr.asBool.parse('0').unwrap();
			expect(falseVal).toBe(false);

			// Should fail parsing if not a boolStr
			expect(is.string.boolStr.asBool.parse('invalid').isErr()).toBe(true);
		});

		it('should have .asBool on .truthy and .falsy', () => {
			expect(is.string.boolStr.truthy().asBool.parse('true').unwrap()).toBe(true);
			expect(is.string.boolStr.falsy().asBool.parse('false').unwrap()).toBe(false);

			// truthy.asBool should fail on a falsy string even if it is a boolStr
			expect(is.string.boolStr.truthy().asBool.parse('false').isErr()).toBe(true);
		});
	});
});
