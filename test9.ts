import { ResultAsync } from './src/result';

declare const a: ResultAsync<never, never>;
const b: ResultAsync<string, never> = a;
