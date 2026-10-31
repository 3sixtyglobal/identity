// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The key types which can be held in an identity export.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityExportKeyType = {
	/**
	 * Ed25519 signing key.
	 */
	Ed25519: "Ed25519"
} as const;

/**
 * The key types which can be held in an identity export.
 */
export type IdentityExportKeyType =
	(typeof IdentityExportKeyType)[keyof typeof IdentityExportKeyType];
