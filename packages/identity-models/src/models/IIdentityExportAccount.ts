// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The wallet account secrets of a self-controlled identity held in an identity export.
 */
export interface IIdentityExportAccount {
	/**
	 * The mnemonic for the account.
	 */
	mnemonic: string;

	/**
	 * The seed derived from the mnemonic in base64 format.
	 */
	seed?: string;
}
