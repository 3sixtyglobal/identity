// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@3sixty/standards-w3c-did";

/**
 * Result returned by a Universal Resolver DIF resolution request.
 */
export interface IUniversalResolverResult {
	/**
	 * The resolved DID document.
	 */
	didDocument: IDidDocument;

	/**
	 * Metadata about the resolution process.
	 */
	didResolutionMetadata: {
		/**
		 * The created date of the DID document.
		 */
		created: string;

		/**
		 * The updated date of the DID document.
		 */
		updated: string;
	};

	/**
	 * Metadata about the DID document.
	 */
	didDocumentMetadata: unknown;
}
