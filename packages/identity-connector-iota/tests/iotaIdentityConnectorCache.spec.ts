// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for DID resolution caching in IotaIdentityConnector.
 *
 * Covers: the LruCache dependency contract this feature relies on, that the identity client is
 * rebuilt fresh on every call (never memoized - see the incident note on the describe block
 * below), that same-call document reuse collapses redundant resolves, that the role-1
 * (own-identity) cache serves hits within its TTL, evicts on mutation, and expires correctly, and
 * that role-2 (third-party proof verification) intentionally stays uncached so a removed
 * verification method is detected immediately.
 *
 * This spies on the *real* connector against the live testnet rather than stubbing the identity-wasm
 * classes - following the same pattern already used in `iotaIdentityConnector.spec.ts`
 * ("should use vault signing without exposing private key": `vi.spyOn(vaultConnector, ...)`).
 * `resolveDid` and `Iota.createClient` are confirmed genuine, spy-able prototype/static methods,
 * not WASM opaque internals.
 */
import { LruCache } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { Iota } from "@3sixty/dlt-iota";
import { ProofTypes, type IProof } from "@3sixty/standards-w3c-did";
import { IdentityClient, type IotaDocument } from "@iota/identity-wasm/node/index.js";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_USER_IDENTITY,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_GAS_BUDGET
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";

const CACHE_KEY_PREFIX = "identityConnectorCacheSpec:";

// Exercises @3sixty/core's LruCache directly, not the connector - this pins down the
// dependency contract the caching feature relies on (TTI hit/expiry, explicit delete). It cannot
// fail for a connector-level defect; see the "didResolutionCacheTtlMs: 0 disables caching
// end-to-end" block below for connector-level coverage of the bypass behavior.
describe("LruCache dependency contract (offline, not connector-specific)", () => {
	test("returns a cached value within the TTI window without re-invoking the factory", async () => {
		const cache = new LruCache<string>({ ttiMs: 30_000 });
		const factory = vi.fn().mockResolvedValue("resolved-document");
		const key = `${CACHE_KEY_PREFIX}own:testnet:did:iota:testnet:0xabc`;

		const first = await cache.getOrSet(key, factory);
		const second = await cache.getOrSet(key, factory);

		expect(first).toEqual("resolved-document");
		expect(second).toEqual("resolved-document");
		expect(factory).toHaveBeenCalledTimes(1);
	});

	test("re-invokes the factory after the TTI expires", async () => {
		vi.useFakeTimers();
		try {
			const cache = new LruCache<string>({ ttiMs: 1000 });
			const factory = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
			const key = `${CACHE_KEY_PREFIX}own:testnet:did:iota:testnet:0xdef`;

			const first = await cache.getOrSet(key, factory);
			vi.advanceTimersByTime(1001);
			const second = await cache.getOrSet(key, factory);

			expect(first).toEqual("first");
			expect(second).toEqual("second");
			expect(factory).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	test("delete forces the next call to re-invoke the factory", async () => {
		const cache = new LruCache<string>({ ttiMs: 30_000 });
		const factory = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
		const key = `${CACHE_KEY_PREFIX}own:testnet:did:iota:testnet:0xghi`;

		const first = await cache.getOrSet(key, factory);
		cache.delete(key);
		const second = await cache.getOrSet(key, factory);

		expect(first).toEqual("first");
		expect(second).toEqual("second");
		expect(factory).toHaveBeenCalledTimes(2);
	});

	test("ttiMs of 0 is invalid: a disabled cache is represented as undefined, not a zero-TTI cache", () => {
		expect(() => new LruCache({ ttiMs: 0 })).toThrow();
	});
});

// Incident: an earlier version of this suite expected client construction to collapse
// to 1 call after memoization. That memoization was reverted - IdentityClient.create()
// calls client.__destroy_into_raw() on the read-only client it's given (a wasm-bindgen move, not
// a borrow), so reusing the same instance across calls passed an already-destroyed handle into
// WASM on the second use ("null pointer passed to rust"). Rebuilding the client on every call is
// therefore permanent, correct behavior, not a temporary baseline.
describe("IotaIdentityConnector - identity client construction (live, spy-only)", () => {
	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET
			}
		});
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("each resolve-triggering call rebuilds the identity client (must never be memoized)", async () => {
		const createClientSpy = vi.spyOn(Iota, "createClient");

		// A bogus fragment is enough: getIdentityClient()/Iota.createClient() runs before the
		// "verification method missing" check, so this counts client construction without
		// needing a real, successful proof or any gas-costing transaction.
		const bogusProof = {
			type: ProofTypes.DataIntegrityProof,
			verificationMethod: `${testDocumentId}#doesNotExist`,
			proofPurpose: "assertionMethod",
			created: new Date().toISOString()
		} as unknown as IProof;
		const document: IJsonLdNodeObject = { "@context": "https://schema.org", "@type": "Thing" };

		await expect(identityConnector.verifyProof(document, bogusProof)).rejects.toThrow();
		await expect(identityConnector.verifyProof(document, bogusProof)).rejects.toThrow();

		// Permanent behavior (see the describe-block comment above): the client must be rebuilt
		// on every resolve-triggering call, not memoized.
		expect(createClientSpy).toHaveBeenCalledTimes(2);
	});
});

describe("IotaIdentityConnector - resolveDid call count (live, spy-only)", () => {
	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET
			}
		});
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cacheTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("createVerifiableCredential resolves the issuer DID once, not once per internal use", async () => {
		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-baseline",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-baseline-subject"
			}
		);

		expect(result.jwt).toBeDefined();
		// Originally 2 (once directly, once again inside createProof for the same DID) before the
		// already-resolved issuerDocument was threaded through instead of re-resolved. Then 1 (plain
		// document-threading, no cache). Now 0: addVerificationMethod stores the settled document in
		// the role-1 cache, so createVerifiableCredential's resolveOwnDidCached is a cache hit.
		expect(resolveDidSpy).toHaveBeenCalledTimes(0);
	});
});

// resolveDid's real .d.ts types it non-nullable (not-found rejects instead of resolving empty),
// so this scenario is unreachable through the live network today. It's forced here by mocking a
// single resolveDid call, to prove the hardening added for it actually works: without it, a
// null/undefined document would be stored in the cache and corrupt all subsequent resolves for
// that DID within the TTI window.
describe("IotaIdentityConnector - resolveOwnDidCached rejects instead of hanging on an empty resolve (live, spy-only, mocked edge case)", () => {
	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET
			}
		});
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"nullishResolveTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("an empty resolveDid result rejects immediately instead of caching a nullish value", async () => {
		// Use a fresh connector with no cache entries - mutations on identityConnector (from
		// beforeAll) populate that instance's cache, but freshConnector has no entry for this DID,
		// so resolveOwnDidCached goes through the getOrSet factory and the mock is intercepted.
		const freshConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET
			}
		});

		const resolveDidSpy = vi
			.spyOn(IdentityClient.prototype, "resolveDid")
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			.mockResolvedValueOnce(undefined as unknown as IotaDocument);

		await expect(
			freshConnector.createProof(
				TEST_USER_IDENTITY,
				testVerificationMethodId,
				ProofTypes.DataIntegrityProof,
				{ "@context": "https://schema.org", "@type": "Thing" }
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.createProofFailed"
		});

		// No zombie cache entry left behind: LruCache.getOrSet only calls set() after the factory
		// resolves successfully, so a factory rejection is never stored in the cache. Clear the
		// call count (not the spy itself, which would restore the mockResolvedValueOnce-consumed
		// real implementation as a *new* spy and defeat the zombie-entry check) so this assertion
		// counts only the follow-up call.
		resolveDidSpy.mockClear();

		await expect(
			freshConnector.createProof(
				TEST_USER_IDENTITY,
				testVerificationMethodId,
				ProofTypes.DataIntegrityProof,
				{ "@context": "https://schema.org", "@type": "Thing" }
			)
		).resolves.toBeDefined();
		expect(resolveDidSpy).toHaveBeenCalledTimes(1);
	});
});

// Long, dedicated TTL (60s) - deliberately the opposite of a short TTL. Both tests below need
// the cache entry to never expire "by accident" during a real network/on-chain call, or the
// effect they're observing (a cache hit, an explicit eviction) becomes indistinguishable from
// ordinary TTL expiry.
describe("IotaIdentityConnector - role-1 cache hit + eviction (live, spy-only)", () => {
	const TTL_MS = 60_000;

	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				didResolutionCacheTtlMs: TTL_MS
			}
		});
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cacheHitEvictTestMethod"
		);
		testVerificationMethodId = method.id;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("a second createVerifiableCredential for the same issuer within the TTL adds no further resolveDid calls", async () => {
		// Prime the cache - unspied, so this priming call isn't counted below.
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-hit-1",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:cache-spec-ttl-hit-1" }
		);

		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");

		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-ttl-hit-2",
			{ "@context": "https://schema.org", "@type": "Thing", id: "did:example:cache-spec-ttl-hit-2" }
		);

		expect(resolveDidSpy).toHaveBeenCalledTimes(0);
	});

	test("addVerificationMethod updates the cache with the settled document, so the next role-1 resolve is a cache hit", async () => {
		// Prime the cache - unspied.
		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-evict-prime",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-evict-prime"
			}
		);

		// A mutation on the same DID - stores the settled document in the role-1 cache. At a 60s
		// TTL, the entry cannot have expired on its own by the time this on-chain call settles, so
		// the assertion below can only pass because the cache was updated with the settled document.
		await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"evictTestMethod"
		);

		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");

		await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/cache-spec-evict-after",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:cache-spec-evict-after"
			}
		);

		// A cache hit, not a network resolve - addVerificationMethod stored the settled document
		// in the cache, so the primed (now updated) entry is served immediately.
		expect(resolveDidSpy).toHaveBeenCalledTimes(0);
	});
});

// Short, dedicated TTL (3s) - the opposite need from the block above. This test specifically
// wants the TTL to elapse in a short, predictable amount of wall-clock time, so it gets its own
// connector instance rather than sharing one with the hit/eviction tests, which need a TTL long
// enough to never elapse by accident. Real timers, live testnet.
describe("IotaIdentityConnector - role-1 cache TTL expiry (live, spy-only)", () => {
	const TTL_MS = 3000;

	let identityConnector: IotaIdentityConnector;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				didResolutionCacheTtlMs: TTL_MS
			}
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

		await new Promise(resolve => setTimeout(resolve, TTL_MS + 500));

		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");

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

		expect(resolveDidSpy).toHaveBeenCalledTimes(1);
	});
});

// Connector-level coverage for the config-off switch: the offline "AsyncCache dependency
// contract" block above proves AsyncCache.exec itself bypasses caching at ttlMs: 0, but that
// only exercises @3sixty/core directly. This proves the connector actually wires
// didResolutionCacheTtlMs: 0 through to resolveOwnDidCached, so a real caller who disables the
// cache in config genuinely gets a fresh resolve on every call, not just a hit at the framework
// layer.
describe("IotaIdentityConnector - didResolutionCacheTtlMs: 0 disables caching end-to-end (live, spy-only)", () => {
	let identityConnector: IotaIdentityConnector;
	let testVerificationMethodId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				didResolutionCacheTtlMs: 0
			}
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

	test("a second createVerifiableCredential for the same issuer still triggers a fresh resolveDid", async () => {
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

		// Spy only during the second call so any invocation proves a fresh resolve attempt.
		// We avoid strict call counts because the SDK may retry internally on transient network behaviour.
		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");

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

		// With caching disabled (didResolutionCacheTtlMs: 0), the second credential creation
		// must trigger a live DID resolution instead of serving a cached result.
		expect(resolveDidSpy).toHaveBeenCalled();
	});
});

describe("IotaIdentityConnector - verifyProof stays safe against a removed method (live)", () => {
	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;

	beforeAll(async () => {
		await setupTestEnv();
		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET
			}
		});
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	test("role 2 is not cached: a proof made with a since-removed verification method correctly fails to verify", async () => {
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
			message: "iotaIdentityConnector.verifyProofFailed"
		});

		// If role-2 (verification-path) caching is ever enabled, add a
		// companion test here proving the OPPOSITE within the configured TTL window: the removed
		// method's proof still (incorrectly) validates - an explicit, asserted, intentional
		// characterization of the accepted tradeoff, not a silent gap. Do not add that test
		// unless role-2 caching actually ships.
	});
});

// A load-balanced RPC can serve a node that lags behind the one that settled the previous
// mutation, returning a document older than the cached one. The settle check must only accept a
// strictly newer document, otherwise the older one is cached and later mutations work against it.
// Replaying the creation-time document as the first post-update poll simulates this
// deterministically.
describe("IotaIdentityConnector - mutation does not cache an older document from a lagging node (live, spy-only, mocked edge case)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("addVerificationMethod retries past a poll older than the cached document", async () => {
		await setupTestEnv();
		const identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				didResolutionCacheTtlMs: 60_000
			}
		});

		const resolveDidSpy = vi.spyOn(IdentityClient.prototype, "resolveDid");
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		const olderDocument =
			await resolveDidSpy.mock.results[resolveDidSpy.mock.results.length - 1].value;

		// Caches the settled document, which is newer than olderDocument.
		await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"assertionMethod",
			"settledMethod"
		);

		// The pre-mutation resolve is a cache hit, so the first call is the first post-update poll.
		resolveDidSpy.mockClear();
		resolveDidSpy.mockResolvedValueOnce(olderDocument);

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			document.id,
			"verificationMethod",
			"laggingPollMethod"
		);

		expect(resolveDidSpy.mock.calls.length).toBeGreaterThan(1);

		// Served from the cache, so this only finds the method if the settled document was cached.
		await expect(
			identityConnector.removeVerificationMethod(TEST_USER_IDENTITY, method.id)
		).resolves.toBeUndefined();
	});
});
