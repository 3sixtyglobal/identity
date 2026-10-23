// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for DID resolution caching in EntityStorageIdentityResolverConnector.
 *
 * Fast-CI twin of `iotaIdentityResolverConnectorCache.spec.ts` - same scenarios, same names
 * where the mechanics translate, so a change to the resolver caching contract in one connector
 * is checked against the other by construction. Covers: a repeat resolve within the TTL is
 * served from cache, callers receive a clone rather than the cached instance,
 * didResolutionCacheTtlMs of 0 disables caching end-to-end, a failed resolve leaves no zombie
 * entry, the entry expires on TTL, and stop releases the cache.
 *
 * Unlike the identity connector, this connector caches third-party DIDs, so a non-zero TTL
 * means changes written to storage out-of-band are only observed once the entry expires.
 */
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { EntityStorageIdentityResolverConnector } from "../src/entityStorageIdentityResolverConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TEST_USER_IDENTITY = "test-identity";
const TTL_MS = 60_000;

function setupFactories(): MemoryEntityStorageConnector<IdentityDocument> {
	initSchemaVault();
	initSchemaIdentity();

	const didDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
		entitySchema: nameof<IdentityDocument>(),
		config: { storageKey: "identity-document" }
	});
	const vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<VaultKey>({
		entitySchema: nameof<VaultKey>(),
		config: { storageKey: "vault-keys" }
	});
	const vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<VaultSecret>({
		entitySchema: nameof<VaultSecret>(),
		config: { storageKey: "vault-secret" }
	});

	EntityStorageConnectorFactory.register("identity-document", () => didDocumentEntityStorage);
	EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
	EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorageConnector);
	VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

	return didDocumentEntityStorage;
}

describe("EntityStorageIdentityResolverConnector - resolution cache (fast, no network)", () => {
	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let testDocumentId: string;

	beforeAll(async () => {
		didDocumentEntityStorage = setupFactories();

		const identityConnector = new EntityStorageIdentityConnector();
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("a repeat resolve of the same document is served from the cache", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: TTL_MS }
		});

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(first.id).toEqual(testDocumentId);
		expect(second).toEqual(first);
		expect(getSpy).toHaveBeenCalledTimes(1);
	});

	test("callers receive a clone, so mutating a resolved document cannot corrupt the cache", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: TTL_MS }
		});

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const originalServiceCount = first.service?.length;
		first.id = "did:entity-storage:0xmutated";
		delete first.service;

		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(second.id).toEqual(testDocumentId);
		expect(second.service?.length).toEqual(originalServiceCount);
	});

	test("didResolutionCacheTtlMs of 0 resolves fresh on every call", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(first.id).toEqual(testDocumentId);
		expect(second.id).toEqual(testDocumentId);
		expect(getSpy).toHaveBeenCalledTimes(2);
	});

	test("a failed resolve is not cached", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: TTL_MS }
		});

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		// LruCache.getOrSet only calls set() after the factory resolves successfully, so a
		// rejection must leave no entry behind for the next call to hit.
		await expect(
			resolverConnector.resolveDocument("did:entity-storage:0xnotpresent")
		).rejects.toThrow();
		await expect(
			resolverConnector.resolveDocument("did:entity-storage:0xnotpresent")
		).rejects.toThrow();

		expect(getSpy).toHaveBeenCalledTimes(2);
	});

	test("stop releases the cache without error", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: TTL_MS }
		});

		await resolverConnector.resolveDocument(testDocumentId);

		await expect(resolverConnector.stop()).resolves.toBeUndefined();
	});

	test("a disabled cache (ttl 0) tolerates stop() as a no-op", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});

		await expect(resolverConnector.stop()).resolves.toBeUndefined();
	});
});

describe("EntityStorageIdentityResolverConnector - resolution cache TTL expiry (fast, no network)", () => {
	const SHORT_TTL_MS = 500;

	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let testDocumentId: string;

	beforeAll(async () => {
		didDocumentEntityStorage = setupFactories();

		const identityConnector = new EntityStorageIdentityConnector();
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("resolves fresh again after the TTL expires", async () => {
		const resolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: SHORT_TTL_MS }
		});

		// Prime the cache - unspied.
		await resolverConnector.resolveDocument(testDocumentId);

		await new Promise(resolve => setTimeout(resolve, SHORT_TTL_MS + 250));

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		const resolved = await resolverConnector.resolveDocument(testDocumentId);

		expect(resolved.id).toEqual(testDocumentId);
		expect(getSpy).toHaveBeenCalledTimes(1);
	});
});
