import { describe, it, expect } from 'vitest';
import { is } from '../../src/guard/index.js';
import { defineErrs } from '../../src/tagged-errs.js';

// Test error factories
const AppError = defineErrs({
	NotFound: (resource: string, id: string) => ({ resource, id }),
	Generic: (message: string) => ({ message }),
	Empty: () => ({}),
});

// ===========================================================================
// is.tagged — string tag overload
// ===========================================================================

describe('is.tagged(string)', () => {
	const guard = is.tagged('NotFound');

	it('accepts tagged errors with matching tag', () => {
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
	});

	it('rejects tagged errors with different tag', () => {
		expect(guard(AppError.Generic('msg'))).toBe(false);
		expect(guard(AppError.Empty())).toBe(false);
	});

	it('accepts plain objects with matching _tag', () => {
		expect(guard({ _tag: 'NotFound' })).toBe(true);
		expect(guard({ _tag: 'NotFound', extra: 'data' })).toBe(true);
	});

	it('rejects plain objects with different _tag', () => {
		expect(guard({ _tag: 'Other' })).toBe(false);
	});

	it('rejects non-objects and missing _tag', () => {
		expect(guard(null)).toBe(false);
		expect(guard(undefined)).toBe(false);
		expect(guard('string')).toBe(false);
		expect(guard(42)).toBe(false);
		expect(guard(true)).toBe(false);
		expect(guard({})).toBe(false);
		expect(guard({ tag: 'NotFound' })).toBe(false);
	});
});

// ===========================================================================
// is.tagged — factory overload
// ===========================================================================

describe('is.tagged(factory)', () => {
	const guard = is.tagged(AppError.NotFound);

	it('accepts errors from the matching factory', () => {
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
		expect(guard(AppError.NotFound('post', '99'))).toBe(true);
	});

	it('rejects errors from a different factory', () => {
		expect(guard(AppError.Generic('msg'))).toBe(false);
		expect(guard(AppError.Empty())).toBe(false);
	});

	it('accepts plain objects that pass factory.is', () => {
		// factory.is checks _tag === 'NotFound'
		expect(guard({ _tag: 'NotFound' })).toBe(true);
	});

	it('rejects non-objects', () => {
		expect(guard(null)).toBe(false);
		expect(guard(undefined)).toBe(false);
		expect(guard('string')).toBe(false);
		expect(guard(42)).toBe(false);
	});
});

// ===========================================================================
// is.tagged — factories map overload (union of all variants)
// ===========================================================================

describe('is.tagged(factoriesMap)', () => {
	const guard = is.tagged(AppError.NotFound);

	it('accepts any error variant from the factories', () => {
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
		expect(guard(AppError.Generic('msg'))).toBe(false);
		expect(guard(AppError.Empty())).toBe(false);
	});

	it('rejects errors not in the factories', () => {
		const OtherError = defineErrs({ Other: () => ({}) });
		expect(guard(OtherError.Other())).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(guard(null)).toBe(false);
		expect(guard(undefined)).toBe(false);
		expect(guard('string')).toBe(false);
		expect(guard(42)).toBe(false);
	});

	it('rejects plain objects with unrelated _tag', () => {
		expect(guard({ _tag: 'Unknown' })).toBe(false);
	});

	it('accepts plain objects with matching _tag', () => {
		expect(guard({ _tag: 'NotFound' })).toBe(true);
		expect(guard({ _tag: 'Generic' })).toBe(false);
		expect(guard({ _tag: 'Empty' })).toBe(false);
	});
});

// ===========================================================================
// Type narrowing (compile-time)
// ===========================================================================

describe('type narrowing', () => {
	it('string tag narrows to TaggedErr & { _tag: Tag }', () => {
		const value: unknown = AppError.NotFound('user', '1');
		if (is.tagged('NotFound')(value)) {
			// This should compile — _tag is narrowed to 'NotFound'
			const tag: 'NotFound' = value._tag;
			expect(tag).toBe('NotFound');
		}
	});

	it('factories map narrows to union of all variants', () => {
		const value: unknown = AppError.NotFound('user', '1');
		if (is.tagged(AppError.NotFound)(value)) {
			// This should compile — _tag is a union of all variant tags
			const tag: 'NotFound' | 'Generic' | 'Empty' = value._tag;
			expect(tag).toBe('NotFound');
		}
	});

	it('factory narrows to full factory return type', () => {
		const value: unknown = AppError.NotFound('user', '1');
		if (is.tagged(AppError.NotFound)(value)) {
			// This should compile — full type with custom properties
			const tag: 'NotFound' = value._tag;
			const resource: string = value.resource;
			const id: string = value.id;
			expect(tag).toBe('NotFound');
			expect(resource).toBe('user');
			expect(id).toBe('1');
		}
	});
});

// ===========================================================================
// Universal helpers
// ===========================================================================

describe('universal helpers', () => {
	it('.parse() returns a Result', () => {
		const guard = is.tagged('NotFound');
		const result = guard.parse(AppError.NotFound('user', '1'));
		expect(result.isOk()).toBe(true);

		const result2 = guard.parse('not an error');
		expect(result2.isErr()).toBe(true);
	});

	it('.or() composes with other guards', () => {
		const guard = is.tagged('NotFound').or(is.tagged('Generic'));
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
		expect(guard(AppError.Generic('msg'))).toBe(true);
		expect(guard(AppError.Empty())).toBe(false);
	});

	it('.error() customizes error message', () => {
		const guard = is.tagged('NotFound').error('must be a NotFound error');
		const result = guard.parse('not an error');
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain('must be a NotFound error');
		}
	});

	it('.nullable() allows null', () => {
		const guard = is.tagged('NotFound').nullable;
		expect(guard(null)).toBe(true);
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
		expect(guard('string')).toBe(false);
	});

	it('.optional allows undefined', () => {
		const guard = is.tagged('NotFound').optional;
		expect(guard(undefined)).toBe(true);
		expect(guard(AppError.NotFound('user', '1'))).toBe(true);
		expect(guard('string')).toBe(false);
	});
});

// ===========================================================================
// Multiple factories
// ===========================================================================

describe('multiple error types', () => {
	it('different guards for different tags', () => {
		const isNotFound = is.tagged(AppError.NotFound);
		const isGeneric = is.tagged(AppError.Generic);

		const notFoundErr = AppError.NotFound('user', '1');
		const genericErr = AppError.Generic('oops');

		expect(isNotFound(notFoundErr)).toBe(true);
		expect(isNotFound(genericErr)).toBe(false);
		expect(isGeneric(genericErr)).toBe(true);
		expect(isGeneric(notFoundErr)).toBe(false);
	});
});
