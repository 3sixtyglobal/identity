// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@3sixty/standards-w3c-did";

/**
 * Request to verify a verifiable credential.
 */
export interface IIdentityVerifiableCredentialVerifyDocumentRequest {
	/**
	 * The body parameters.
	 */
	body: IDidVerifiableCredential;
}
