/**
 * Functional/monadic error handling for TypeScript, inspired by Rust's `Result` type.
 *
 * Provides `Result<T, E>` and `ResultAsync<T, E>` types for explicit, type-safe error
 * handling without exceptions, plus utilities for chaining, concurrency, and do-notation.
 *
 * @example
 * ```ts
 * import { chas } from 'chas';
 *
 * const result = chas.ok(42).map(v => v * 2); // Ok(84)
 * ```
 *
 * @module @sinzek/chas
 */
export * as chas from './result.js';
