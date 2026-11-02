// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Request to export an identity.
 */
export interface IIdentityExportRequest {
	/**
	 * The path parameters.
	 */
	pathParams: {
		/**
		 * The identity to export.
		 */
		identity: string;
	};
}
