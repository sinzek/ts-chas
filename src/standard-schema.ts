/**
 * Vendored Standard Schema V1 types.
 * @see https://github.com/standard-schema/standard-schema
 */

/** The Standard Schema interface (v1). */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
	/** The Standard Schema properties. */
	export interface Props<Input = unknown, Output = Input> {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
		readonly types?: Types<Input, Output> | undefined;
	}

	/** The result type for the Standard Schema validate method. */
	export type Result<Output> = SuccessResult<Output> | FailureResult;

	/** The success result type. */
	export interface SuccessResult<Output> {
		readonly value: Output;
		readonly issues?: undefined;
	}

	/** The failure result type. */
	export interface FailureResult {
		readonly issues: ReadonlyArray<Issue>;
	}

	/** The issue type for Standard Schema. */
	export interface Issue {
		readonly message: string;
		readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
	}

	/** The path segment type for Standard Schema. */
	export interface PathSegment {
		readonly key: PropertyKey;
	}

	/** The type metadata interface. */
	export interface Types<Input = unknown, Output = Input> {
		readonly input: Input;
		readonly output: Output;
	}
}
