// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEntityStorageIdentityResolverConnectorConfig } from "./IEntityStorageIdentityResolverConnectorConfig.js";

/**
 * Options for the entity storage identity connector constructor.
 */
export interface IEntityStorageIdentityResolverConnectorConstructorOptions {
	/**
	 * Configuration for the connector.
	 */
	config?: IEntityStorageIdentityResolverConnectorConfig;

	/**
	 * The entity storage for the did documents.
	 * @default identity-document
	 */
	didDocumentEntityStorageType?: string;

	/**
	 * The vault for the private keys.
	 * @default vault
	 */
	vaultConnectorType?: string;
}
