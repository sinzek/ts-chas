import { Result, ResultAsync, OptionAsync } from './src/result';

declare const a: Promise<Result<never, string>>;
const b: Promise<Result<number, string>> = a; // Promise to Promise
const c: PromiseLike<Result<number, string>> = a; // Promise to PromiseLike
