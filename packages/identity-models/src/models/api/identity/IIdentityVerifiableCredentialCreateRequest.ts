// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";

/**
 * Request to create a verifiable credential.
 */
export interface IIdentityVerifiableCredentialCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the verification credential for.
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
		 * The id of the credential.
		 */
		credentialId?: string;

		/**
		 * The credential subject to store in the verifiable credential.
		 */
		subject: IJsonLdNodeObject;

		/**
		 * The bitmap revocation index of the credential, if undefined will not have revocation status.
		 */
		revocationIndex?: number;

		/**
		 * The date the verifiable credential is valid until.
		 */
		expirationDate?: string;

		/**
		 * Additional fields to include in the JWT when creating the verifiable credential in jwt format.
		 */
		jwtHeaderFields?: { [id: string]: string };

		/**
		 * Additional fields to include in the JWT payload when creating the verifiable credential in jwt format.
		 */
		jwtPayloadFields?: { [id: string]: string };
	};
}
