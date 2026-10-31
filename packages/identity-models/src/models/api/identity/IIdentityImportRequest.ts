// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityExport } from "../../IIdentityExport.js";

/**
 * Request to import an identity.
 */
export interface IIdentityImportRequest {
	/**
	 * The exported identity to import.
	 */
	body: IIdentityExport;
}
