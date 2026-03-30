import { makeGuard, type Guard, type InferGuard, type GuardErr, terminal } from '../shared.js';
import { AggregateGuardError } from '../schema.js';
import { ok, err, type Result, ResultAsync } from '../../result/result.js';
import { GlobalErrs } from '../../tagged-errs.js';

export interface FunctionGuardFactory {
	/**
	 * Creates a function guard that checks if a value is a function.
	 *
	 * Use `.impl` or `.implAsync` to create a validated wrapper that enforces
	 * input and output types at runtime.
	 */
	<Input extends Guard<any>[], Output extends Guard<any> | undefined = undefined>(types: {
		input: [...Input];
		output?: Output;
	}): Guard<
		(
			...args: { [K in keyof Input]: InferGuard<Input[K]> }
		) => Output extends Guard<any> ? InferGuard<Output> : unknown,
		FunctionHelpers<Input, Output>
	>;
}

export interface FunctionHelpers<Input extends Guard<any>[], Output extends Guard<any> | undefined> {
	/**
	 * Transforms the guard to return a validated version of the function.
	 *
	 * When the resulting function is called, it will validate its inputs against
	 * the `input` guards and its return value against the `output` guard.
	 *
	 * @throws {AggregateGuardError} If validation fails.
	 */
	impl: <F extends (...args: any[]) => any>(
		fn: F &
			((
				...args: { [K in keyof Input]: InferGuard<Input[K]> }
			) => Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>)
	) => (...args: Parameters<F>) => Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>;

	/**
	 * Similar to `.impl`, but handles async functions.
	 * Validates inputs synchronously, then validates the resolved return value.
	 *
	 * @throws {AggregateGuardError} If validation fails.
	 */
	implAsync: <F extends (...args: any[]) => any>(
		fn: F &
			((
				...args: { [K in keyof Input]: InferGuard<Input[K]> }
			) => Promise<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>>)
	) => (...args: Parameters<F>) => Promise<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>>;

	/**
	 * Similar to `.impl`, but instead of throwing an `AggregateGuardError`, returns a `Result`.
	 */
	implResult: <F extends (...args: any[]) => any>(
		fn: F &
			((
				...args: { [K in keyof Input]: InferGuard<Input[K]> }
			) => Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>)
	) => (
		...args: Parameters<F>
	) => Result<Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>, AggregateGuardError>;

	/**
	 * Similar to `.implAsync`, but returns a `ResultAsync` instead of throwing.
	 */
	implResultAsync: <F extends (...args: any[]) => any>(
		fn: F &
			((
				...args: { [K in keyof Input]: InferGuard<Input[K]> }
			) => Promise<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>>)
	) => (
		...args: Parameters<F>
	) => ResultAsync<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>, AggregateGuardError>;
}

const functionHelpers: any = {
	impl: terminal((target, origFn: any) => {
		const { inputGuards, outputGuard }: { inputGuards: Guard<any>[]; outputGuard?: Guard<any> } = target.meta;
		return (...args: any[]) => {
			const errs: GuardErr[] = [];
			// 1. Validate inputs
			for (let i = 0; i < inputGuards.length; i++) {
				const result = inputGuards[i]?.parse(args[i]);
				if (result && result.isErr()) {
					const error = result.error;
					errs.push(
						GlobalErrs.GuardErr({
							...error,
							message: error.message,
							path: [`args[${i}]`, ...error.path],
						})
					);
				}
			}

			if (errs.length > 0) {
				throw new AggregateGuardError(target.meta.name, errs);
			}

			// 2. Call original
			const result = origFn(...args);

			// 3. Validate output
			if (outputGuard) {
				const outRes = outputGuard.parse(result);
				if (outRes.isErr()) {
					const error = outRes.error;
					throw new AggregateGuardError(target.meta.name, [
						GlobalErrs.GuardErr({
							...error,
							message: error.message,
							path: ['return', ...error.path],
						}),
					]);
				}
				return outRes.value;
			}

			return result;
		};
	}),

	implAsync: terminal((target, origFn: any) => {
		const { inputGuards, outputGuard } = target.meta;
		return async (...args: any[]) => {
			const errs: GuardErr[] = [];
			// 1. Validate inputs (sync)
			for (let i = 0; i < inputGuards.length; i++) {
				const result = inputGuards[i]?.parse(args[i]);
				if (result && result.isErr()) {
					const error = result.error;
					errs.push(
						GlobalErrs.GuardErr({
							...error,
							message: error.message,
							path: [`args[${i}]`, ...error.path],
						})
					);
				}
			}

			if (errs.length > 0) {
				throw new AggregateGuardError(target.meta.name, errs);
			}

			// 2. Call original (await)
			const result = await origFn(...args);

			// 3. Validate output
			if (outputGuard) {
				const outRes = outputGuard.parse(result);
				if (outRes.isErr()) {
					const error = outRes.error;
					throw new AggregateGuardError(target.meta.name, [
						GlobalErrs.GuardErr({
							...error,
							message: error.message,
							path: ['return', ...error.path],
						}),
					]);
				}
				return outRes.value;
			}

			return result;
		};
	}),

	implResult: terminal((target, origFn: any) => {
		return (...args: any[]) => {
			try {
				const result = functionHelpers.impl(target, origFn)(...args);
				return ok(result);
			} catch (e: any) {
				if (e instanceof AggregateGuardError) {
					return err(e);
				}
				throw e;
			}
		};
	}),

	implResultAsync: terminal((target, origFn: any) => {
		return (...args: any[]) => {
			return ResultAsync.from(
				async () => {
					const result = await functionHelpers.implAsync(target, origFn)(...args);
					return ok(result);
				},
				(e: any) => (e instanceof AggregateGuardError ? e : undefined)
			).mapErr(e => {
				if (e instanceof AggregateGuardError) return e;
				throw e;
			});
		};
	}),
};

export const FunctionGuardFactory: FunctionGuardFactory = types => {
	return makeGuard(
		(v: unknown): v is any => typeof v === 'function',
		{
			name: `function(${types.input.map(g => g.meta?.name ?? 'unknown').join(', ')}) => ${(types.output as any)?.meta?.name ?? 'any'}`,
			id: 'function',
			inputGuards: types.input,
			outputGuard: types.output,
		},
		functionHelpers
	) as any;
};
