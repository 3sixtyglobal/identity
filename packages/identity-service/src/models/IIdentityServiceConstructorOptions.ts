// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityServiceConfig } from "./IIdentityServiceConfig.js";

/**
 * Options for the identity service constructor.
 */
export interface IIdentityServiceConstructorOptions {
	/**
	 * The configuration for the identity service.
	 */
	config?: IIdentityServiceConfig;

	/**
	 * The component type for the optional telemetry component used for event metrics.
	 */
	telemetryComponentType?: string;

	/**
	 * The vault connector type to use for migrating the mnemonic during health check initialisation.
	 * @default vault
	 */
	vaultConnectorType?: string;
}
