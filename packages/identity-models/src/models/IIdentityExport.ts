// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import type { IIdentityExportAccount } from "./IIdentityExportAccount.js";
import type { IIdentityExportKey } from "./IIdentityExportKey.js";

/**
 * Everything needed to recreate an identity on another node, including private key material.
 */
export interface IIdentityExport {
	/**
	 * The version of the export format.
	 */
	version: number;

	/**
	 * The namespace of the connector which holds the identity, e.g. entity-storage or iota.
	 */
	namespace: string;

	/**
	 * Is the identity controlled by its own DID.
	 */
	selfControlled: boolean;

	/**
	 * The DID document.
	 */
	document: IDidDocument;

	/**
	 * The signature of the canonical document made with the document key in base64 format,
	 * only for connectors which sign their stored documents.
	 */
	documentSignature?: string;

	/**
	 * The private keys for the identity.
	 */
	keys: IIdentityExportKey[];

	/**
	 * The wallet account secrets, only for self-controlled identities on ledgers.
	 */
	account?: IIdentityExportAccount;
}
