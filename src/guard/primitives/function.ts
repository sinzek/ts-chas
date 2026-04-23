import { makeGuard, type Guard, type InferGuard, type GuardErr, terminal } from '../shared.js';
import { AggregateGuardErr } from '../schema.js';
import { ok, err, type Result, ResultAsync } from '../../result/result.js';
import { GlobalErrs } from '../../tagged-errs.js';

export type FunctionGuard<Input extends Guard<any>[], Output extends Guard<any> | undefined> = Guard<
	(...args: { [K in keyof Input]: InferGuard<Input[K]> }) => Output extends Guard<any> ? InferGuard<Output> : unknown,
	FunctionHelpers<Input, Output>
>;

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
	 * @throws {AggregateGuardErr} If validation fails.
	 */
	impl: <
		F extends (
			...args: { [K in keyof Input]: Exclude<InferGuard<Input[K]>, undefined> }
		) => Output extends Guard<any> ? InferGuard<Output> : any,
	>(
		fn: F
	) => (...args: Parameters<F>) => Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>;

	/**
	 * Similar to `.impl`, but handles async functions.
	 * Validates inputs synchronously, then validates the resolved return value.
	 *
	 * @throws {AggregateGuardErr} If validation fails.
	 */
	implAsync: <
		F extends (
			...args: { [K in keyof Input]: Exclude<InferGuard<Input[K]>, undefined> }
		) => Promise<Output extends Guard<any> ? InferGuard<Output> : any>,
	>(
		fn: F
	) => (...args: Parameters<F>) => Promise<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>>;

	/**
	 * Similar to `.impl`, but instead of throwing an `AggregateGuardErr`, returns a `Result<T, AggregateGuardErr>`.
	 */
	implResult: <
		F extends (
			...args: { [K in keyof Input]: Exclude<InferGuard<Input[K]>, undefined> }
		) => Output extends Guard<any> ? InferGuard<Output> : any,
	>(
		fn: F
	) => (
		...args: Parameters<F>
	) => Result<Output extends Guard<any> ? InferGuard<Output> : ReturnType<F>, AggregateGuardErr>;

	/**
	 * Similar to `.implAsync`, but returns a `ResultAsync<T, AggregateGuardErr>` instead of throwing.
	 */
	implResultAsync: <
		F extends (
			...args: { [K in keyof Input]: Exclude<InferGuard<Input[K]>, undefined> }
		) => Promise<Output extends Guard<any> ? InferGuard<Output> : any>,
	>(
		fn: F
	) => (
		...args: Parameters<F>
	) => ResultAsync<Output extends Guard<any> ? InferGuard<Output> : Awaited<ReturnType<F>>, AggregateGuardErr>;
}

function validateInputs(target: any, args: any[]): void {
	const { inputGuards }: { inputGuards: Guard<any>[] } = target.meta;
	const errs: GuardErr[] = [];
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
		throw new AggregateGuardErr(target.meta.name, errs);
	}
}

function validateOutput(target: any, result: any): any {
	const { outputGuard }: { outputGuard?: Guard<any> } = target.meta;
	if (!outputGuard) return result;
	const outRes = outputGuard.parse(result);
	if (outRes.isErr()) {
		const error = outRes.error;
		throw new AggregateGuardErr(target.meta.name, [
			GlobalErrs.GuardErr({
				...error,
				message: error.message,
				path: ['return', ...error.path],
			}),
		]);
	}
	return outRes.value;
}

function makeImpl(target: any, origFn: any) {
	return (...args: any[]) => {
		validateInputs(target, args);
		const result = origFn(...args);
		return validateOutput(target, result);
	};
}

function makeImplAsync(target: any, origFn: any) {
	return async (...args: any[]) => {
		validateInputs(target, args);
		const result = await origFn(...args);
		return validateOutput(target, result);
	};
}

const functionHelpers: any = {
	impl: terminal((target, origFn: any) => makeImpl(target, origFn)),

	implAsync: terminal((target, origFn: any) => makeImplAsync(target, origFn)),

	implResult: terminal((target, origFn: any) => {
		const wrapped = makeImpl(target, origFn);
		return (...args: any[]) => {
			try {
				return ok(wrapped(...args));
			} catch (e: any) {
				if (e instanceof AggregateGuardErr) {
					return err(e);
				}
				throw e;
			}
		};
	}),

	implResultAsync: terminal((target, origFn: any) => {
		const wrapped = makeImplAsync(target, origFn);
		return (...args: any[]) => {
			return ResultAsync.from(
				async () => ok(await wrapped(...args)),
				(e: any) => (e instanceof AggregateGuardErr ? e : undefined)
			).mapErr(e => {
				if (e instanceof AggregateGuardErr) return e;
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
