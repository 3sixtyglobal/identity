// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IProof } from "@3sixty/standards-w3c-did";

/**
 * Response to creating a proof.
 */
export interface IIdentityProofCreateResponse {
	/**
	 * The response payload.
	 */
	body: IProof;
}
