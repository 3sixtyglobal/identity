// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityStorageIdentityConnectorConfig } from "./IEntityStorageIdentityConnectorConfig.js";
import type { IEntityStorageIdentityResolverConnectorConstructorOptions } from "./IEntityStorageIdentityResolverConnectorConstructorOptions.js";

/**
 * Options for the entity storage identity connector constructor.
 */
// eslint-disable-next-line max-len
export interface IEntityStorageIdentityConnectorConstructorOptions extends IEntityStorageIdentityResolverConnectorConstructorOptions {
	/**
	 * The type of logging component to use.
	 */
	loggingComponentType?: string;

	/**
	 * Configuration for the connector.
	 */
	config?: IEntityStorageIdentityConnectorConfig;
}
