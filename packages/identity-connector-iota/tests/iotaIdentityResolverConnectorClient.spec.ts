// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for read only identity client reuse and timeout bounding in
 * IotaIdentityResolverConnector.
 *
 * Covers: that IdentityClientReadOnly.create runs once per connector instead of once per
 * resolution (issue #223), that the memoised client is safe to hand to more than one Resolver,
 * that a failed construction is not memoised, and that neither client construction nor
 * resolution can hang forever (issue #224).
 *
 * Like the other suites in this package this spies on the *real* connector against the live
 * network. The two hang tests are the exception: the wasm binding panics rather than rejecting
 * when the chain identifier RPC fails, and a panic cannot be provoked from a test, so the
 * never-settling promise it leaves behind is simulated with a mock.
 */
import { BaseError } from "@3sixty/core";
import { IdentityClientReadOnly, Resolver } from "@iota/identity-wasm/node/index.js";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_USER_IDENTITY
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";
import { IotaIdentityResolverConnector } from "../src/iotaIdentityResolverConnector.js";

const TIMEOUT_MS = 250;

/**
 * Create a promise which never settles, standing in for the abandoned promise the wasm
 * binding leaves behind when it panics.
 * @returns A promise which never settles.
 */
async function neverSettles(): Promise<never> {
	return new Promise<never>(() => {});
}

describe("IotaIdentityResolverConnector - identity client reuse (live, spy-only)", () => {
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

	test("the read only client is built once and reused across uncached resolutions", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0
			}
		});

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");
		const resolveSpy = vi.spyOn(Resolver.prototype, "resolve");

		const first = await resolverConnector.resolveDocument(testDocumentId);
		const second = await resolverConnector.resolveDocument(testDocumentId);

		expect(first.id).toEqual(testDocumentId);
		expect(second.id).toEqual(testDocumentId);
		// Caching is off, so both calls really did resolve over the network, but the client that
		// costs an iota_getChainIdentifier RPC to construct was only built once. This also proves
		// the memoised client survives being handed to a second Resolver: the wasm binding keeps
		// it as a handle rather than consuming it the way IdentityClient.create does.
		expect(resolveSpy).toHaveBeenCalledTimes(2);
		expect(createSpy).toHaveBeenCalledTimes(1);
	});

	test("concurrent first callers share a single client construction", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0
			}
		});

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");

		const results = await Promise.all([
			resolverConnector.resolveDocument(testDocumentId),
			resolverConnector.resolveDocument(testDocumentId),
			resolverConnector.resolveDocument(testDocumentId)
		]);

		expect(results.map(document => document.id)).toEqual([
			testDocumentId,
			testDocumentId,
			testDocumentId
		]);
		expect(createSpy).toHaveBeenCalledTimes(1);
	});

	test("each connector instance builds its own client", async () => {
		const config = {
			clientOptions: TEST_CLIENT_OPTIONS,
			network: TEST_NETWORK,
			didResolutionCacheTtlMs: 0
		};

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");

		await new IotaIdentityResolverConnector({ config }).resolveDocument(testDocumentId);
		await new IotaIdentityResolverConnector({ config }).resolveDocument(testDocumentId);

		expect(createSpy).toHaveBeenCalledTimes(2);
	});

	test("a failed client construction is not memoised, so the next call retries", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0
			}
		});

		const createSpy = vi
			.spyOn(IdentityClientReadOnly, "create")
			.mockRejectedValueOnce(new Error("chain identifier unavailable"));

		await expect(resolverConnector.resolveDocument(testDocumentId)).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityResolverConnector.resolveDocumentFailed"
		});

		const recovered = await resolverConnector.resolveDocument(testDocumentId);

		expect(recovered.id).toEqual(testDocumentId);
		expect(createSpy).toHaveBeenCalledTimes(2);
	});

	test("a client construction which never settles is abandoned by the timeout", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0,
				clientCreationTimeoutMs: TIMEOUT_MS
			}
		});

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create").mockImplementation(neverSettles);

		const error = await resolverConnector.resolveDocument(testDocumentId).catch(err => err);

		expect(BaseError.flatten(error).map(entry => entry.message)).toEqual(
			expect.arrayContaining([
				"iotaIdentityResolverConnector.resolveDocumentFailed",
				"iotaIdentityResolverConnector.identityClientCreationTimeout"
			])
		);

		// The abandoned construction must not be left memoised, otherwise every later caller
		// would await the same promise that is never going to settle. A second attempt at
		// construction proves the memo was dropped rather than replayed.
		await expect(resolverConnector.resolveDocument(testDocumentId)).rejects.toThrow();

		expect(createSpy).toHaveBeenCalledTimes(2);
	});

	test("a resolution which never settles is abandoned by the timeout", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0,
				didResolutionTimeoutMs: TIMEOUT_MS
			}
		});

		vi.spyOn(Resolver.prototype, "resolve").mockImplementation(neverSettles);

		const error = await resolverConnector.resolveDocument(testDocumentId).catch(err => err);

		expect(BaseError.flatten(error).map(entry => entry.message)).toEqual(
			expect.arrayContaining([
				"iotaIdentityResolverConnector.resolveDocumentFailed",
				"iotaIdentityResolverConnector.didResolutionTimeout"
			])
		);
	});

	test("the timeouts bound the wait rather than merely reporting it", async () => {
		const resolverConnector = new IotaIdentityResolverConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0,
				clientCreationTimeoutMs: TIMEOUT_MS
			}
		});

		vi.spyOn(IdentityClientReadOnly, "create").mockImplementation(neverSettles);

		const start = Date.now();
		await expect(resolverConnector.resolveDocument(testDocumentId)).rejects.toThrow();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(TIMEOUT_MS * 20);
	});
});
