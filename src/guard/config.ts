/**
 * Global configuration for the `is` guard library.
 */

export type UnknownKeyPolicy = 'strict' | 'strip' | 'passthrough';

let _defaultUnknownKeyPolicy: UnknownKeyPolicy = 'passthrough';

/**
 * Sets the default behavior for how `is.object()` handles unknown properties.
 *
 * - `'passthrough'` (default): Unknown properties are retained and ignored.
 * - `'strip'`: Unknown properties are removed from the parsed output during transformation.
 * - `'strict'`: Unknown properties cause validation to fail.
 *
 * NOTE: This setting applies at guard creation time. Existing guards are not affected
 * by subsequent changes to this setting.
 */
export function setDefaultUnknownKeyPolicy(policy: UnknownKeyPolicy): void {
	_defaultUnknownKeyPolicy = policy;
}

/**
 * Gets the current default unknown key policy.
 */
export function getDefaultUnknownKeyPolicy(): UnknownKeyPolicy {
	return _defaultUnknownKeyPolicy;
}
