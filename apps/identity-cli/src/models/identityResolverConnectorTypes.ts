// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The identity resolver connector types.
 */
export const IdentityResolverConnectorTypes = {
	/**
	 * IOTA.
	 */
	Iota: "iota"
} as const;

/**
 * The identity resolver connector types.
 */
export type IdentityResolverConnectorTypes =
	(typeof IdentityResolverConnectorTypes)[keyof typeof IdentityResolverConnectorTypes];
