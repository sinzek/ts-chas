export type NonVoid<T> = Exclude<T, void | undefined | null>;
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};
