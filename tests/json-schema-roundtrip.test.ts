import { describe, it } from 'vitest';
import fc from 'fast-check';
import { is, type Guard } from '../src/guard/index.js';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ strict: false, coerceTypes: false });
addFormats(ajv);

// Reproducible runs. Override locally with FC_SEED to investigate failures.
const SEED = Number(process.env['FC_SEED'] ?? 0xc0ffee);
const RUNS = Number(process.env['FC_RUNS'] ?? 200);
const FC_OPTS: fc.Parameters<unknown> = { seed: SEED, numRuns: RUNS };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasForbiddenKey(obj: unknown): boolean {
	if (typeof obj !== 'object' || obj === null) return false;
	if (Array.isArray(obj)) return obj.some(hasForbiddenKey);
	for (const k of Object.keys(obj)) {
		if (FORBIDDEN_KEYS.has(k)) return true;
		if (hasForbiddenKey((obj as any)[k])) return true;
	}
	return false;
}

interface AgreementOptions {
	/** Skip the "valid values agree" leg — useful when arbitrary() generation is unsupported. */
	skipValid?: boolean;
	/** Skip the "hostile values agree" leg — for degenerate schemas (e.g. xor → {}). */
	skipHostile?: boolean;
	/** Override the default fc parameters for a single test (e.g. lower numRuns for slow guards). */
	fcParams?: fc.Parameters<unknown>;
}

async function testJsonSchemaAgreement<T>(guard: Guard<T, any>, opts: AgreementOptions = {}) {
	const jsonSchema = guard.toJsonSchema();

	let validate: ReturnType<typeof ajv.compile>;
	try {
		validate = ajv.compile(jsonSchema);
	} catch (e: any) {
		throw new Error(`Failed to compile schema: ${JSON.stringify(jsonSchema, null, 2)}\nError: ${e.message}`, {
			cause: e,
		});
	}

	const params = { ...FC_OPTS, ...opts.fcParams };

	if (!opts.skipValid) {
		const arbitrary = await guard.arbitrary();
		fc.assert(
			fc.property(arbitrary, val => {
				const jsonVal = JSON.parse(JSON.stringify(val));
				const ajvValid = validate(jsonVal);
				const guardValid = guard(jsonVal);
				if (!ajvValid || !guardValid) {
					throw new Error(
						`Disagreement on generated valid value:\n  value: ${JSON.stringify(jsonVal)}\n  ajv: ${ajvValid}\n  guard: ${guardValid}\n  ajv errors: ${JSON.stringify(validate.errors)}`
					);
				}
				return true;
			}),
			params
		);
	}

	if (opts.skipHostile) return;

	// Hostile input leg: random values, must agree on accept/reject.
	const schemaType = (jsonSchema as any).type;
	const hasMultipleOf = typeof (jsonSchema as any).multipleOf === 'number';

	fc.assert(
		fc.property(fc.anything(), val => {
			if (val === undefined || typeof val === 'function' || typeof val === 'symbol') return true;
			let jsonVal: any;
			try {
				jsonVal = JSON.parse(JSON.stringify(val));
			} catch {
				return true; // unserializable; out of scope for JSON Schema
			}

			// Prototype-pollution keys: assert that the guard rejects them. JSON Schema
			// has no native way to forbid these key names, so we don't require AJV
			// agreement here — the guard's safety guarantee is the load-bearing one.
			if (hasForbiddenKey(jsonVal)) {
				if (guard(jsonVal)) {
					throw new Error(`Guard accepted forbidden-key payload: ${JSON.stringify(jsonVal)}`);
				}
				return true;
			}

			const ajvValid = validate(jsonVal);
			const guardValid = guard(jsonVal);
			if (ajvValid === guardValid) return true;

			// Documented numeric escape hatches for known float64 vs decimal divergences.
			// These are real-but-unavoidable disagreements between JS arithmetic and AJV's
			// big-decimal handling. Narrow as tightly as possible so they can't mask new bugs.
			if (typeof jsonVal === 'number') {
				// 1. multipleOf on non-integer floats: AJV uses exact decimal, JS uses float64.
				if (hasMultipleOf && !Number.isInteger(jsonVal)) return true;
				// 2. multipleOf on non-safe integers: precision is lost in float64.
				if (hasMultipleOf && !Number.isSafeInteger(jsonVal)) return true;
				// 3. is.number.int rejects values past Number.MAX_SAFE_INTEGER, but JSON
				//    Schema's `type: integer` accepts any integer-valued number. The guard's
				//    stricter behavior is intentional (precision is lost above 2^53).
				const isIntegerSchema =
					schemaType === 'integer' || (Array.isArray(schemaType) && schemaType.includes('integer'));
				if (isIntegerSchema && Number.isInteger(jsonVal) && !Number.isSafeInteger(jsonVal)) {
					return true;
				}
			}

			throw new Error(
				`Disagreement:\n  value: ${JSON.stringify(jsonVal)}\n  ajv: ${ajvValid}\n  guard: ${guardValid}`
			);
		}),
		params
	);
}

describe('JSON Schema Agreement (2.3)', () => {
	describe('primitives', () => {
		it('agrees on string base + length constraints', async () => {
			await testJsonSchemaAgreement(is.string);
			await testJsonSchemaAgreement(is.string.min(5).max(10));
			await testJsonSchemaAgreement(is.string.regex(/^[a-z]+$/));
		});

		it('agrees on string formats', async () => {
			await testJsonSchemaAgreement(is.string.email);
			await testJsonSchemaAgreement(is.string.uuid());
			await testJsonSchemaAgreement(is.string.ipv4);
			await testJsonSchemaAgreement(is.string.ipv6);
		});

		it('agrees on number base + refinements', async () => {
			await testJsonSchemaAgreement(is.number);
			await testJsonSchemaAgreement(is.number.int.between(-100, 100));
			await testJsonSchemaAgreement(is.number.multipleOf(5));
			await testJsonSchemaAgreement(is.number.positive);
			await testJsonSchemaAgreement(is.number.gt(0).lt(1));
		});

		it('agrees on boolean and null', async () => {
			await testJsonSchemaAgreement(is.boolean);
			await testJsonSchemaAgreement(is.null);
		});

		it('agrees on nullable / optional positions', async () => {
			await testJsonSchemaAgreement(is.string.nullable);
			await testJsonSchemaAgreement(is.number.int.nullable);
		});
	});

	describe('literals and enums', () => {
		it('agrees on mixed-type literal', async () => {
			await testJsonSchemaAgreement(is.literal('a', 'b', 1, 2, false));
		});

		it('agrees on string enum', async () => {
			await testJsonSchemaAgreement(is.enum(['red', 'green', 'blue'] as const));
		});

		it('agrees on numeric enum', async () => {
			await testJsonSchemaAgreement(is.enum([1, 2, 3] as const));
		});
	});

	describe('objects', () => {
		it('agrees on basic and nested shapes', async () => {
			await testJsonSchemaAgreement(
				is.object({
					name: is.string,
					age: is.number.int.positive,
					email: is.string.email.optional,
				})
			);

			await testJsonSchemaAgreement(
				is.object({
					profile: is.object({
						handle: is.string.min(1),
						verified: is.boolean,
					}),
					tags: is.array(is.string),
				})
			);
		});

		it('agrees on .strict (additionalProperties: false)', async () => {
			await testJsonSchemaAgreement(
				is.object({
					a: is.string,
					b: is.number,
				}).strict
			);
		});

		it('agrees on .catchall', async () => {
			await testJsonSchemaAgreement(
				is
					.object({
						a: is.string,
					})
					.catchall(is.number)
			);
		});

		it('agrees on .partial reshape', async () => {
			await testJsonSchemaAgreement(is.object({ a: is.string, b: is.number }).partial());
		});

		it('agrees on .required reshape', async () => {
			await testJsonSchemaAgreement(is.object({ a: is.string.optional, b: is.number.optional }).required());
		});

		it('agrees on partial-then-required round-trip', async () => {
			await testJsonSchemaAgreement(is.object({ a: is.string, b: is.number }).partial().required());
		});

		it('agrees on partial(specific keys)', async () => {
			await testJsonSchemaAgreement(is.object({ a: is.string, b: is.number, c: is.boolean }).partial('b'));
		});

		it('agrees on required(specific keys)', async () => {
			await testJsonSchemaAgreement(
				is.object({ a: is.string.optional, b: is.number.optional, c: is.boolean.optional }).required('a')
			);
		});
	});

	describe('arrays and tuples', () => {
		it('agrees on array with length + uniqueness constraints', async () => {
			await testJsonSchemaAgreement(is.array(is.string).min(2).max(5));
			await testJsonSchemaAgreement(is.array(is.number).unique);
		});

		it('agrees on heterogeneous tuples', async () => {
			await testJsonSchemaAgreement(is.tuple([is.string, is.number]));
			await testJsonSchemaAgreement(is.tuple([is.literal('kind'), is.string, is.boolean]));
		});
	});

	describe('records', () => {
		it('agrees on open-ended records', async () => {
			await testJsonSchemaAgreement(is.record(is.string, is.number));
			await testJsonSchemaAgreement(is.record(is.string.min(3), is.boolean));
		});
	});

	describe('combinators', () => {
		it('agrees on unions', async () => {
			await testJsonSchemaAgreement(is.union(is.string, is.number));
			await testJsonSchemaAgreement(is.union(is.boolean, is.null, is.string));
		});

		it('agrees on discriminated unions', async () => {
			await testJsonSchemaAgreement(
				is.discriminatedUnion('kind', {
					a: is.object({ x: is.number }),
					b: is.object({ y: is.string }),
				})
			);
		});

		it('agrees on intersections', async () => {
			await testJsonSchemaAgreement(is.intersection(is.object({ a: is.string }), is.object({ b: is.number })));
		});

		it('agrees on xor (oneOf)', async () => {
			// xor exports as JSON Schema 2020-12 `oneOf` — exactly one branch matches.
			await testJsonSchemaAgreement(
				is.xor(is.object({ a: is.string }).strict, is.object({ b: is.number }).strict)
			);
		});
	});

	describe('refinement preservation in schema export', () => {
		it('size constraints survive .partial()', async () => {
			// Skip the valid-leg: when partial keys are generated as `undefined`, the
			// JSON round-trip strips them and the size(2) constraint fails after parse.
			// That's a JS/JSON impedance mismatch (Object.keys counts undefined keys,
			// JSON.stringify drops them), not a schema/guard disagreement. The hostile
			// leg still verifies guard ↔ AJV agreement.
			const guard = is.object({ a: is.string, b: is.number }).size(2).partial();
			await testJsonSchemaAgreement(guard, { skipValid: true });
		});

		it('strict survives .pick / .omit', async () => {
			const base = is.object({ a: is.string, b: is.number, c: is.boolean }).strict;
			await testJsonSchemaAgreement(base.pick(['a', 'b']));
			await testJsonSchemaAgreement(base.omit(['c']));
		});
	});
});
