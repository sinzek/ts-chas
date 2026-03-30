/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { is, type InferGuard } from '../../src/guard/index.js';

describe('is.custom', () => {
	it('creates a guard from a function that returns a boolean', () => {
		const isEvenNum = is.custom((n): n is number => typeof n === 'number' && n % 2 === 0);
		expect(isEvenNum(2)).toBe(true);
		expect(isEvenNum(3)).toBe(false);
		expect(isEvenNum('hello')).toBe(false);

		const inferred: InferGuard<typeof isEvenNum> = 2;
		const inferred2: InferGuard<typeof isEvenNum> = 3;
		// @ts-expect-error Fails as expected
		const inferred3: InferGuard<typeof isEvenNum> = 'hello';

		// @ts-expect-error Fails as expected
		const inferred4: typeof isEvenNum.array.$infer = 'hello';

		const inferred5: typeof isEvenNum.$infer = 2;
	});

	it('creates a guard that always returns true when no function is provided', () => {
		const guard = is.custom();
		expect(guard(1)).toBe(true);
		expect(guard('hello')).toBe(true);
		expect(guard(null)).toBe(true);
	});
});
