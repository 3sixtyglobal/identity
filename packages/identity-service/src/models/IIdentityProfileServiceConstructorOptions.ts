// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityProfileServiceConfig } from "./IIdentityProfileServiceConfig.js";

/**
 * Options for the identity profile service constructor.
 */
export interface IIdentityProfileServiceConstructorOptions {
	/**
	 * The storage connector for the profiles.
	 * @default identity-profile
	 */
	profileEntityConnectorType?: string;

	/**
	 * The authorization component used to check the caller permissions.
	 * @default authorization
	 */
	authorizationComponentType?: string;

	/**
	 * The configuration for the identity profile service.
	 */
	config?: IIdentityProfileServiceConfig;
}
