// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaIdentityConnectorConfig } from "./IIotaIdentityConnectorConfig.js";

/**
 * Options for the IOTA Identity Connector constructor.
 */
export interface IIotaIdentityConnectorConstructorOptions {
	/**
	 * The vault connector type for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;

	/**
	 * The type of logging component to use.
	 */
	loggingComponentType?: string;

	/**
	 * The configuration for the identity connector.
	 */
	config: IIotaIdentityConnectorConfig;
}
