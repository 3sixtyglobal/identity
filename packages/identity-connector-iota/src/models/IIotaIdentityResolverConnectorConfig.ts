// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaConfig } from "@3sixty/dlt-iota";

/**
 * Configuration for the IOTA Identity Resolver Connector.
 */
export interface IIotaIdentityResolverConnectorConfig extends IIotaConfig {
	/**
	 * The package ID for the identity contract on the network.
	 * If not provided, a default value will be used based on the detected network type.
	 * For testnet: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555"
	 * For devnet: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"
	 */
	identityPkgId?: string;

	/**
	 * TTL in ms for caching resolved DID documents. 0 disables caching. As the documents
	 * resolved here can belong to third parties, a non-zero TTL means revocation and
	 * verification method changes made on the ledger are only observed once the entry expires.
	 * @default 30000
	 */
	didResolutionCacheTtlMs?: number;

	/**
	 * Maximum number of DID documents kept in the resolution cache.
	 * Only used when didResolutionCacheTtlMs > 0.
	 * @default 1000
	 */
	didResolutionCacheCapacity?: number;

	/**
	 * Maximum time in milliseconds to wait for resolution cache getOrSet mutex acquisition.
	 * Only used when didResolutionCacheTtlMs > 0.
	 */
	didResolutionCacheMutexTimeoutMs?: number;

	/**
	 * Timeout in ms for creating the read only identity client used for resolution. Its
	 * construction makes an RPC call which can fail without ever settling, so the timeout
	 * bounds it. 0 waits indefinitely.
	 * @default 3000
	 */
	clientCreationTimeoutMs?: number;

	/**
	 * Timeout in ms for a single DID resolution call. 0 waits indefinitely.
	 * @default 5000
	 */
	didResolutionTimeoutMs?: number;
}
