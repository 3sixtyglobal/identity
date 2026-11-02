// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidDocument } from "@3sixty/standards-w3c-did";

/**
 * Response to importing an identity.
 */
export interface IIdentityImportResponse {
	/**
	 * The response payload.
	 */
	body: IDidDocument;
}
