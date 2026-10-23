// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import type { ProofTypes } from "@3sixty/standards-w3c-did";

/**
 * Request to create a proof.
 */
export interface IIdentityProofCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the proof for.
		 */
		identity: string;

		/**
		 * The verification method id to use.
		 */
		verificationMethodId: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The type of proof to create.
		 */
		proofType: ProofTypes;

		/**
		 * The document to create the proof for.
		 */
		document: IJsonLdNodeObject;
	};
}
