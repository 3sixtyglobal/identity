// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the Entity Storage Identity Resolver Connector.
 */
export interface IEntityStorageIdentityResolverConnectorConfig {
	/**
	 * TTL in ms for caching resolved DID documents. 0 disables caching. As the documents
	 * resolved here can belong to third parties, a non-zero TTL means changes made to a
	 * document in storage, including revocation, are only observed once the entry expires.
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
}
