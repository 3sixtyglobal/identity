// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiablePresentation } from "@3sixty/standards-w3c-did";

/**
 * Request to verify a verifiable presentation.
 */
export interface IIdentityVerifiablePresentationVerifyDocumentRequest {
	/**
	 * The body parameters.
	 */
	body: IDidVerifiablePresentation;
}
