// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidService } from "@3sixty/standards-w3c-did";

/**
 * Response to creating a service.
 */
export interface IIdentityServiceCreateResponse {
	/**
	 * The response payload.
	 */
	body: IDidService;
}
