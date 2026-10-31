// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IdentityExportKeyType } from "./identityExportKeyType.js";

/**
 * A private key held in an identity export.
 */
export interface IIdentityExportKey {
	/**
	 * The name of the key relative to the DID, the verification method fragment or "did" for the document key.
	 */
	id: string;

	/**
	 * The type of the key.
	 */
	type: IdentityExportKeyType;

	/**
	 * The private key in base64 format.
	 */
	privateKey: string;

	/**
	 * The public key in base64 format.
	 */
	publicKey: string;
}
