// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to remove an identity.
 */
export interface IIdentityRemoveRequest {
	/**
	 * The data for the request.
	 */
	pathParams: {
		/**
		 * The identity to remove.
		 */
		identity: string;
	};

	/**
	 * The query parameters.
	 */
	query?: {
		/**
		 * Also remove any associated private keys from the vault.
		 */
		removeKeys?: string;

		/**
		 * Also remove the document key from the vault.
		 */
		removeDocumentKey?: string;

		/**
		 * Keep a document published on a ledger, only removing what this node holds for it,
		 * so it can be imported again.
		 */
		retainDocument?: string;
	};
}
