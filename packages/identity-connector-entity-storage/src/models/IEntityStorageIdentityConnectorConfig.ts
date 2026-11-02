// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IIdentityExportLimits } from "@3sixty/identity-models";

/**
 * Configuration for the Entity Storage Identity Connector.
 */
export interface IEntityStorageIdentityConnectorConfig {
	/**
	 * TTL in ms for caching DID documents resolved for the connector's own sign/mutate
	 * operations (create/update/revoke on an identity this connector controls). 0 disables
	 * caching. Does not affect proof or credential verification of third-party claims, which
	 * is never cached by this connector. Refreshed by every mutation made through this
	 * connector instance; a mutation made through a different instance or out-of-band is not
	 * observed until the entry's TTL expires.
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
	 * The most keys accepted when an identity is imported.
	 * @default { maxKeys: 64 }
	 */
	exportLimits?: IIdentityExportLimits;
}
