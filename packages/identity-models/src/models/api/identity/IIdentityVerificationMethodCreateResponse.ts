// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocumentVerificationMethod } from "@3sixty/standards-w3c-did";

/**
 * Response to creating a verification method.
 */
export interface IIdentityVerificationMethodCreateResponse {
	/**
	 * The response payload.
	 */
	body: IDidDocumentVerificationMethod;
}
