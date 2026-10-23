// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for DID resolution caching in IotaIdentityResolverConnector.
 *
 * Covers: that a repeat resolve within the TTL is served from cache, that callers receive a
 * clone rather than the cached instance, that didResolutionCacheTtlMs of 0 disables caching
 * end-to-end, that a failed resolve leaves no zombie entry behind, and that stop releases the
 * cache.
 *
 * Like `iotaIdentityConnectorCache.spec.ts` this spies on the *real* connector against the live
 * testnet rather than stubbing the identity-wasm classes. `Resolver.prototype.resolve` is a
 * genuine, spy-able prototype method, and `vi.spyOn` keeps the original implementation, so the
 * spies here count real network resolves without changing behaviour.
 *
 * Unlike the identity connector, this connector caches third-party DIDs, so a non-zero TTL
 * means ledger changes (revocation, verification method removal) are only observed once the
 * entry expires. The long TTLs below are deliberate: they keep an entry alive across real
 * network calls so a cache hit cannot be confused with ordinary TTL expiry.
 */
import { Resolver } from "@iota/identity-wasm/node/index.js";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_USER_IDENTITY
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";
import { IotaIdentityResolverConnector } from "../src/iotaIdentityResolverConnector.js";

const TTL_MS = 60_000;

describe("IotaIdentityResolverConnector - resolution cache (live, spy-only)", () => {
	let testDocumentId: string;

	beforeAll(async () => {
		await setupTestEnv();

		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		const testDocument = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = testDocument.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("a repeat resolve of the same document is served from the cache", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: TTL_MS
			}
		});

		const resolveSpy = vi.spyOn(Resolver.prototype, "resolve");

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(first.id).toEqual(testDocumentId);
		expect(second).toEqual(first);
		expect(resolveSpy).toHaveBeenCalledTimes(1);
	});

	test("callers receive a clone, so mutating a resolved document cannot corrupt the cache", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: TTL_MS
			}
		});

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const originalServiceCount = first.service?.length;
		first.id = "did:iota:testnet:0xmutated";
		delete first.service;

		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(second.id).toEqual(testDocumentId);
		expect(second.service?.length).toEqual(originalServiceCount);
	});

	test("didResolutionCacheTtlMs of 0 resolves fresh on every call", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0
			}
		});

		const resolveSpy = vi.spyOn(Resolver.prototype, "resolve");

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(first.id).toEqual(testDocumentId);
		expect(second.id).toEqual(testDocumentId);
		expect(resolveSpy).toHaveBeenCalledTimes(2);
	});

	test("a failed resolve is not cached", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: TTL_MS
			}
		});

		const nonExistentId =
			"did:iota:testnet:0x0000000000000000000000000000000000000000000000000000000000000000";

		const resolveSpy = vi.spyOn(Resolver.prototype, "resolve");

		// LruCache.getOrSet only calls set() after the factory resolves successfully, so a
		// rejection must leave no entry behind for the next call to hit.
		await expect(resolverConnector.resolveDocument(nonExistentId)).rejects.toThrow();
		await expect(resolverConnector.resolveDocument(nonExistentId)).rejects.toThrow();

		expect(resolveSpy).toHaveBeenCalledTimes(2);
	});

	test("stop releases the cache without error", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: TTL_MS
			}
		});

		await resolverConnector.resolveDocument(testDocumentId);

		await expect(resolverConnector.stop()).resolves.toBeUndefined();
	});
});
