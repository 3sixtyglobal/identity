// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdContextDefinitionRoot } from "@3sixty/data-json-ld";
import type { IDidVerifiableCredential } from "@3sixty/standards-w3c-did";

/**
 * Request to create a verifiable presentation.
 */
export interface IIdentityVerifiablePresentationCreateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to create the verification presentation for.
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
		 * The id of the presentation.
		 */
		presentationId?: string;

		/**
		 * The context to use for the presentation.
		 */
		contexts?: IJsonLdContextDefinitionRoot;

		/**
		 * The types of the presentation.
		 */
		types?: string | string[];

		/**
		 * The verifiable credentials to include in the presentation.
		 */
		verifiableCredentials: (string | IDidVerifiableCredential)[];

		/**
		 * The expiration date/time for the presentation.
		 */
		expirationDate?: string;

		/**
		 * Additional fields to include in the JWT header when creating the verifiable presentation in jwt format.
		 */
		jwtHeaderFields?: { [id: string]: string };

		/**
		 * Additional fields to include in the JWT payload when creating the verifiable presentation in jwt format.
		 */
		jwtPayloadFields?: { [id: string]: string };
	};
}
