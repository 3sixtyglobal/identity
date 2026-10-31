// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Metric IDs for the identity service.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityMetricIds = {
	/**
	 * Number of DIDs created.
	 */
	DidsCreated: "identity_dids_created",

	/**
	 * Number of DIDs removed.
	 */
	DidsRemoved: "identity_dids_removed",

	/**
	 * Number of DIDs exported.
	 */
	DidsExported: "identity_dids_exported",

	/**
	 * Number of DIDs imported.
	 */
	DidsImported: "identity_dids_imported",

	/**
	 * Number of verifiable credentials created.
	 */
	VcsCreated: "identity_vcs_created",

	/**
	 * Number of VC verifications succeeded.
	 */
	VcsVerified: "identity_vcs_verified",

	/**
	 * Number of VC verifications failed.
	 */
	VcsVerificationFailed: "identity_vcs_verification_failed",

	/**
	 * Number of VCs revoked.
	 */
	VcsRevoked: "identity_vcs_revoked",

	/**
	 * Number of VCs unrevoked.
	 */
	VcsUnrevoked: "identity_vcs_unrevoked",

	/**
	 * Number of verifiable presentations created.
	 */
	VpsCreated: "identity_vps_created",

	/**
	 * Number of VP verifications succeeded.
	 */
	VpsVerified: "identity_vps_verified",

	/**
	 * Number of VP verifications failed.
	 */
	VpsVerificationFailed: "identity_vps_verification_failed"
} as const;

/**
 * Union type of all identity service metric ID string values.
 */
export type IdentityMetricIds = (typeof IdentityMetricIds)[keyof typeof IdentityMetricIds];
