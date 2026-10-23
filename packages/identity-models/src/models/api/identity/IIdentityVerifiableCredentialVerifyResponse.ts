// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@3sixty/standards-w3c-did";

/**
 * Response to verifying a verifiable credential.
 */
export interface IIdentityVerifiableCredentialVerifyResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * Has the credential been revoked.
		 */
		revoked: boolean;

		/**
		 * The verifiable credential that was verified.
		 */
		verifiableCredential?: IDidVerifiableCredential;
	};
}
