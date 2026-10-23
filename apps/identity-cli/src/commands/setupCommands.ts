// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	IotaIdentityConnector,
	IotaIdentityResolverConnector
} from "@3sixty/identity-connector-iota";
import type { IIdentityConnector, IIdentityResolverConnector } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityConnectorTypes } from "../models/identityConnectorTypes.js";
import type { IdentityResolverConnectorTypes } from "../models/identityResolverConnectorTypes.js";

/**
 * Setup the vault for use in the CLI commands.
 */
export function setupVault(): void {
	initSchema();

	EntityStorageConnectorFactory.register(
		"vault-key",
		() =>
			new MemoryEntityStorageConnector<VaultKey>({
				entitySchema: nameof<VaultKey>(),
				config: { storageKey: "vault-key" }
			})
	);
	EntityStorageConnectorFactory.register(
		"vault-secret",
		() =>
			new MemoryEntityStorageConnector<VaultSecret>({
				entitySchema: nameof<VaultSecret>(),
				config: { storageKey: "vault-secret" }
			})
	);

	const vaultConnector = new EntityStorageVaultConnector();
	VaultConnectorFactory.register("vault", () => vaultConnector);
}

/**
 * Setup the identity connector for use in the CLI commands.
 * @param options The options for the identity connector.
 * @param options.nodeEndpoint The node endpoint.
 * @param options.network The network.
 * @param options.addressIndex The wallet index.
 * @param options.vaultSeedId The vault seed ID.
 * @param connector The connector to use.
 * @returns The identity connector.
 */
export function setupIdentityConnector(
	options: { nodeEndpoint: string; network?: string; addressIndex?: number; vaultSeedId?: string },
	connector?: IdentityConnectorTypes
): IIdentityConnector {
	return new IotaIdentityConnector({
		config: {
			clientOptions: {
				url: options.nodeEndpoint
			},
			network: options.network ?? "",
			vaultSeedId: options.vaultSeedId,
			walletAddressIndex: options.addressIndex
		}
	});
}

/**
 * Setup the identity resolver connector for use in the CLI commands.
 * @param options The options for the identity connector.
 * @param options.nodeEndpoint The node endpoint.
 * @param options.network The network.
 * @param connector The connector to use.
 * @returns The identity connector.
 */
export function setupIdentityResolverConnector(
	options: { nodeEndpoint: string; network?: string },
	connector?: IdentityResolverConnectorTypes
): IIdentityResolverConnector {
	return new IotaIdentityResolverConnector({
		config: {
			clientOptions: {
				url: options.nodeEndpoint
			},
			network: options.network ?? ""
		}
	});
}
