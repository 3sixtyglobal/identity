// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdDocument } from "@3sixty/data-json-ld";

/**
 * Response to get an admin list of identities including private profile data.
 */
export interface IIdentityProfileAdminListResponse {
	/**
	 * The response payload.
	 */
	body: {
		/**
		 * The identities.
		 */
		items: {
			/**
			 * The identity.
			 */
			identity: string;

			/**
			 * The public profile data.
			 */
			publicProfile?: Partial<IJsonLdDocument>;

			/**
			 * The private profile data.
			 */
			privateProfile?: Partial<IJsonLdDocument>;
		}[];

		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	};
}
