// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIotaConfig } from "@3sixty/dlt-iota";

/**
 * Configuration for the IOTA Identity Connector.
 */
export interface IIotaIdentityConnectorConfig extends IIotaConfig {
	/**
	 * The wallet account index to use for funding and controlling the identity.
	 * @default 0
	 */
	walletAccountIndex?: number;

	/**
	 * The wallet address index to use for funding and controlling the identity.
	 * @default 0
	 */
	walletAddressIndex?: number;

	/**
	 * The package ID for the identity contract on the network.
	 * If not provided, a default value will be used based on the detected network type.
	 * For testnet: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555"
	 * For devnet: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"
	 */
	identityPkgId?: string;

	/**
	 * The standard gas price in nanos per computation unit for gas station transactions.
	 * (1 Nano = 0.000000001 IOTA)
	 * This should match the protocol's reference gas price.
	 * @default 1000
	 */
	standardGasPrice?: number;

	/**
	 * TTL in ms for caching DID documents resolved for the connector's own sign/mutate
	 * operations (create/update/revoke on an identity this connector controls). 0 disables
	 * caching. Does not affect proof or credential verification of third-party claims, which
	 * is never cached by this connector.
	 * @default 30000
	 */
	didResolutionCacheTtlMs?: number;

	/**
	 * Maximum number of DID documents kept in the own-DID resolution cache.
	 * Only used when didResolutionCacheTtlMs > 0.
	 * @default 1000
	 */
	didResolutionCacheCapacity?: number;

	/**
	 * Maximum time in milliseconds to wait for own-DID cache getOrSet mutex acquisition.
	 * Only used when didResolutionCacheTtlMs > 0.
	 */
	didResolutionCacheMutexTimeoutMs?: number;

	/**
	 * Timeout in ms for creating the read only identity client used for resolution and
	 * verification. Its construction makes an RPC call which can fail without ever settling,
	 * so the timeout bounds it. 0 waits indefinitely.
	 * @default 3000
	 */
	clientCreationTimeoutMs?: number;

	/**
	 * Timeout in ms for a single DID resolution call. 0 waits indefinitely.
	 * @default 5000
	 */
	didResolutionTimeoutMs?: number;

	/**
	 * Number of times to retry resolving a DID after a successful transaction,
	 * to handle propagation delays between transaction confirmation and ledger availability.
	 * @default 10
	 */
	didResolutionRetries?: number;

	/**
	 * Delay in milliseconds between each resolveDid retry.
	 * @default 500
	 */
	didResolutionRetryDelayMs?: number;
}
