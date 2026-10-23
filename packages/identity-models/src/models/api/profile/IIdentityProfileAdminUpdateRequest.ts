// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@3sixty/data-json-ld";

/**
 * Request to update the profile of another user as an admin.
 */
export interface IIdentityProfileAdminUpdateRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity of the user whose profile is to be updated.
		 */
		userIdentity: string;
	};

	/**
	 * The data for the request.
	 */
	body: {
		/**
		 * The public profile data.
		 */
		publicProfile?: IJsonLdDocument;

		/**
		 * The private profile data.
		 */
		privateProfile?: IJsonLdDocument;
	};
}
