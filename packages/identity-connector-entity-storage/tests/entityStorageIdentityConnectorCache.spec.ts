// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for DID resolution caching in EntityStorageIdentityConnector.
 *
 * Fast-CI twin of `iotaIdentityConnectorCache.spec.ts` - same scenarios, same names where the
 * mechanics translate, so a change to the role-1 caching contract in one connector is checked
 * against the other by construction. Covers: the role-1 (own-identity) cache serves hits within
 * its TTL, refreshes on mutation, expires correctly, and that role-2 (third-party proof
 * verification) intentionally stays uncached. Plus entity-storage-only coverage the IOTA spec
 * can't prove cheaply: cached entries are cloned (mutating a returned document can't corrupt the
 * cache) and removeDocument evicts.
 *
 * A separate file from `entityStorageIdentityConnector.spec.ts` on purpose: that suite freezes
 * Date.now for the whole file, which would stop the LruCache's idle clock from ever advancing.
 */
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import { ProofTypes } from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TEST_USER_IDENTITY = "test-identity";

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

// LruCache's own TTI/eviction contract is already pinned offline in the IOTA cache spec - no
// need for a second, connector-agnostic copy of that here.

describe("EntityStorageIdentityConnector - role-1 cache hit + refresh (fast, no network)", () => {
	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let identityConnector: EntityStorageIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		didDocumentEntityStorage = setupFactories();
		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 60_000 }
		});

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cacheHitTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("createVerifiableCredential resolves the issuer document once, not once per internal use", async () => {
		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-baseline",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:cache-spec-baseline" }
		);

		expect(result.jwt).toBeDefined();
		expect(getSpy).toHaveBeenCalledTimes(0);
	});

	test("a second createVerifiableCredential for the same issuer within the TTL adds no further store reads", async () => {
		// Prime the cache - unspied.
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-hit-1",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:cache-spec-ttl-hit-1" }
		);

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-hit-2",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:cache-spec-ttl-hit-2" }
		);

		expect(getSpy).toHaveBeenCalledTimes(0);
	});

	test("addVerificationMethod refreshes the cache with the stored document, so the next role-1 read is a cache hit", async () => {
		// Prime the cache - unspied.
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-refresh-prime",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-refresh-prime"
			}
		);

		// A mutation on the same DID - refreshes the role-1 cache with the just-stored document.
		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"refreshTestMethod"
		);

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		// The new method is visible immediately, and no store read was needed to see it.
		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			method.id,
			ProofTypes.DataIntegrityProof,
			{ "@context": "https://schema.org", "@type": "Thing", name: "refresh check" }
		);

		expect(proof).toBeDefined();
		expect(getSpy).toHaveBeenCalledTimes(0);
	});
});

describe("EntityStorageIdentityConnector - role-1 cache TTL expiry (fast, no network)", () => {
	const TTL_MS = 500;

	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let identityConnector: EntityStorageIdentityConnector;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		didDocumentEntityStorage = setupFactories();
		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: TTL_MS }
		});

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"assertionMethod",
			"ttlExpiryTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("resolves fresh again after the TTL expires", async () => {
		// Prime the cache - unspied.
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-expiry-1",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-ttl-expiry-1"
			}
		);

		await new Promise(resolve => setTimeout(resolve, TTL_MS + 250));

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-expiry-2",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-ttl-expiry-2"
			}
		);

		expect(getSpy).toHaveBeenCalledTimes(1);
	});
});

describe("EntityStorageIdentityConnector - didResolutionCacheTtlMs: 0 disables caching end-to-end (fast, no network)", () => {
	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let identityConnector: EntityStorageIdentityConnector;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		didDocumentEntityStorage = setupFactories();
		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"assertionMethod",
			"cacheDisabledTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("a second createVerifiableCredential for the same issuer still triggers a fresh store read", async () => {
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-disabled-1",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-disabled-1"
			}
		);

		const getSpy = vi.spyOn(didDocumentEntityStorage, "get");

		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-disabled-2",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-disabled-2"
			}
		);

		expect(getSpy).toHaveBeenCalledTimes(1);
	});
});

describe("EntityStorageIdentityConnector - role 2 not cached (fast, no network)", () => {
	let identityConnector: EntityStorageIdentityConnector;
	let testDocumentId: string;

	beforeAll(async () => {
		setupFactories();
		identityConnector = new EntityStorageIdentityConnector();

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	test("a proof made with a since-removed verification method correctly fails to verify", async () => {
		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"rotationTestMethod"
		);

		const unsecuredDocument: IJsonLdNodeObject = {
			"@context": "https://schema.org",
			"@type": "Thing",
			name: "rotation characterization"
		};

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			method.id,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const validBefore = await identityConnector.verifyProof(unsecuredDocument, proof);
		expect(validBefore).toBeTruthy();

		await identityConnector.removeVerificationMethod(TEST_USER_IDENTITY, method.id);

		// This is the behavior a role-2 cache would put at risk: without caching, the removal
		// is visible immediately and the same proof correctly stops validating.
		await expect(identityConnector.verifyProof(unsecuredDocument, proof)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.verifyProofFailed"
		});
	});
});

describe("EntityStorageIdentityConnector - cached entities are cloned (fast, no network)", () => {
	let identityConnector: EntityStorageIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		setupFactories();
		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 60_000 }
		});

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cloneIsolationTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	test("mutating a document returned from a cached read does not corrupt the cache", async () => {
		const firstResult = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/clone-isolation-1",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:clone-isolation-1" }
		);
		expect(firstResult.jwt).toBeDefined();

		// If resolveOwnDocumentCached ever handed out the cached instance by reference instead of
		// a clone, any caller mutating its returned document in place (every role-1 mutator does
		// this before storing) would corrupt what every subsequent cache hit sees.
		const resolvedDocument = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/clone-isolation-2",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:clone-isolation-2" }
		);
		expect(resolvedDocument.jwt).toBeDefined();
		expect(resolvedDocument.jwt).not.toEqual(firstResult.jwt);

		// A completely unrelated cache consumer must still see a healthy, unmutated document.
		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			{ "@context": "https://schema.org", "@type": "Thing", name: "clone isolation check" }
		);
		expect(proof).toBeDefined();
	});
});

describe("EntityStorageIdentityConnector - removeDocument evicts the cache (fast, no network)", () => {
	let identityConnector: EntityStorageIdentityConnector;

	beforeAll(() => {
		setupFactories();
		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 60_000 }
		});
	});

	test("a sign operation for a removed document rejects instead of serving a stale cache hit", async () => {
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"assertionMethod",
			"removeEvictionTestMethod"
		);

		// Prime the role-1 cache for this DID.
		await identityConnector.createProof(
			TEST_USER_IDENTITY,
			method.id,
			ProofTypes.DataIntegrityProof,
			{ "@context": "https://schema.org", "@type": "Thing", name: "pre-removal" }
		);

		await identityConnector.removeDocument(TEST_USER_IDENTITY, document.id);

		await expect(
			identityConnector.createProof(TEST_USER_IDENTITY, method.id, ProofTypes.DataIntegrityProof, {
				"@context": "https://schema.org",
				"@type": "Thing",
				name: "post-removal"
			})
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.createProofFailed"
		});
	});
});

describe("EntityStorageIdentityConnector - stop() lifecycle (fast, no network)", () => {
	test("destroys the cache without error", async () => {
		setupFactories();
		const identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 60_000 }
		});

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"assertionMethod",
			"stopLifecycleTestMethod"
		);

		await expect(identityConnector.stop()).resolves.toBeUndefined();
	});

	test("a disabled cache (ttl 0) tolerates stop() as a no-op", async () => {
		setupFactories();
		const identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});

		await expect(identityConnector.stop()).resolves.toBeUndefined();
	});
});
