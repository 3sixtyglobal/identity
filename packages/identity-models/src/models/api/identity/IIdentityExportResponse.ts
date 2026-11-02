// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityExport } from "../../IIdentityExport.js";

/**
 * Response to exporting an identity.
 */
export interface IIdentityExportResponse {
	/**
	 * The response headers, the export is never cached.
	 */
	headers?: {
		/**
		 * Set to no-store.
		 */
		"cache-control"?: string;
	};

	/**
	 * The response payload, which contains private keys and must be protected.
	 */
	body: IIdentityExport;
}
