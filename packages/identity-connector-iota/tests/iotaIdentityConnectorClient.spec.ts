// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests for read only identity client reuse and timeout bounding in IotaIdentityConnector.
 *
 * Covers: that the verification paths build IdentityClientReadOnly once per connector rather
 * than once per call (issue #223), that getIdentityClient still builds its own client because
 * IdentityClient.create consumes the one it is given, and that neither client construction nor
 * DID resolution can hang forever (issue #224).
 *
 * Like the other suites in this package this spies on the *real* connector against the live
 * network. The hang tests are the exception: the wasm binding panics rather than rejecting when
 * an RPC fails, and a panic cannot be provoked from a test, so the never-settling promise it
 * leaves behind is simulated with a mock.
 */
import { BaseError } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { ProofTypes, type IProof } from "@3sixty/standards-w3c-did";
import { IdentityClient, IdentityClientReadOnly } from "@iota/identity-wasm/node/index.js";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_GAS_BUDGET,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_USER_IDENTITY
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig.js";

const TIMEOUT_MS = 250;

/**
 * Create a promise which never settles, standing in for the abandoned promise the wasm
 * binding leaves behind when it panics.
 * @returns A promise which never settles.
 */
async function neverSettles(): Promise<never> {
	return new Promise<never>(() => {});
}

describe("IotaIdentityConnector - identity client reuse and timeouts (live, spy-only)", () => {
	let identityConnector: IotaIdentityConnector;
	let testDocumentId: string;
	let testVerificationMethodId: string;
	let testCredentialJwt: string;

	/**
	 * Create a connector for the test network.
	 * @param config Extra configuration to merge in.
	 * @returns The connector.
	 */
	function createConnector(config?: Partial<IIotaIdentityConnectorConfig>): IotaIdentityConnector {
		return new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				...config
			}
		});
	}

	/**
	 * Run a verifyProof which is expected to fail on a missing method, purely to exercise
	 * getIdentityClient without spending gas.
	 * @param connector The connector to exercise.
	 */
	async function verifyMissingMethod(connector: IotaIdentityConnector): Promise<void> {
		const document: IJsonLdNodeObject = { "@context": "https://schema.org", "@type": "Thing" };
		const bogusProof = {
			type: ProofTypes.DataIntegrityProof,
			verificationMethod: `${testDocumentId}#doesNotExist`,
			proofPurpose: "assertionMethod",
			created: new Date().toISOString()
		} as unknown as IProof;

		await expect(connector.verifyProof(document, bogusProof)).rejects.toThrow();
	}

	beforeAll(async () => {
		await setupTestEnv();

		identityConnector = createConnector();

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"clientReuseTestMethod"
		);
		testVerificationMethodId = method.id;

		const credential = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/client-reuse-spec",
			{
				"@context": "https://schema.org",
				"@type": "Thing",
				id: "did:example:client-reuse-spec-subject"
			}
		);
		testCredentialJwt = credential.jwt;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("checkVerifiableCredential builds the read only client once and reuses it", async () => {
		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");

		const first = await identityConnector.checkVerifiableCredential(testCredentialJwt);
		const second = await identityConnector.checkVerifiableCredential(testCredentialJwt);

		expect(first.revoked).toEqual(false);
		expect(second.revoked).toEqual(false);
		// Both checks resolved the issuer over the network, but only the first paid the
		// iota_getChainIdentifier RPC that constructing the client costs.
		expect(createSpy).toHaveBeenCalledTimes(1);
	});

	test("concurrent first callers share a single client construction", async () => {
		const freshConnector = createConnector();

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");

		const results = await Promise.all([
			freshConnector.checkVerifiableCredential(testCredentialJwt),
			freshConnector.checkVerifiableCredential(testCredentialJwt),
			freshConnector.checkVerifiableCredential(testCredentialJwt)
		]);

		expect(results.map(result => result.revoked)).toEqual([false, false, false]);
		expect(createSpy).toHaveBeenCalledTimes(1);
	});

	test("a failed client construction is not memoised, so the next call retries", async () => {
		const freshConnector = createConnector();

		const createSpy = vi
			.spyOn(IdentityClientReadOnly, "create")
			.mockRejectedValueOnce(new Error("chain identifier unavailable"));

		await expect(freshConnector.checkVerifiableCredential(testCredentialJwt)).rejects.toMatchObject(
			{
				name: "GeneralError",
				message: "iotaIdentityConnector.checkingVerifiableCredentialFailed"
			}
		);

		const recovered = await freshConnector.checkVerifiableCredential(testCredentialJwt);

		expect(recovered.revoked).toEqual(false);
		expect(createSpy).toHaveBeenCalledTimes(2);
	});

	test("a client construction which never settles is abandoned by the timeout", async () => {
		const freshConnector = createConnector({ clientCreationTimeoutMs: TIMEOUT_MS });

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create").mockImplementation(neverSettles);

		const start = Date.now();
		const error = await freshConnector
			.checkVerifiableCredential(testCredentialJwt)
			.catch(err => err);
		const elapsed = Date.now() - start;

		// checkVerifiableCredential reports the underlying failure in properties.error rather
		// than as a cause, so the timeout is asserted there.
		expect(error).toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.checkingVerifiableCredentialFailed",
			properties: {
				error: { message: "iotaIdentityConnector.identityClientCreationTimeout" }
			}
		});
		expect(elapsed).toBeLessThan(TIMEOUT_MS * 20);

		// The abandoned construction must not be left memoised, otherwise every later caller
		// would await the same promise that is never going to settle. A second attempt at
		// construction proves the memo was dropped rather than replayed.
		await expect(freshConnector.checkVerifiableCredential(testCredentialJwt)).rejects.toThrow();

		expect(createSpy).toHaveBeenCalledTimes(2);
	});

	test("a resolution which never settles is abandoned by the timeout", async () => {
		const freshConnector = createConnector({ didResolutionTimeoutMs: TIMEOUT_MS });

		vi.spyOn(IdentityClient.prototype, "resolveDid").mockImplementation(neverSettles);

		const document: IJsonLdNodeObject = { "@context": "https://schema.org", "@type": "Thing" };
		const proof = {
			type: ProofTypes.DataIntegrityProof,
			verificationMethod: testVerificationMethodId,
			proofPurpose: "assertionMethod",
			created: new Date().toISOString()
		} as unknown as IProof;

		const start = Date.now();
		const error = await freshConnector.verifyProof(document, proof).catch(err => err);
		const elapsed = Date.now() - start;

		expect(BaseError.flatten(error).map(entry => entry.message)).toEqual(
			expect.arrayContaining([
				"iotaIdentityConnector.verifyProofFailed",
				"iotaIdentityConnector.didResolutionTimeout"
			])
		);
		expect(elapsed).toBeLessThan(TIMEOUT_MS * 20);
	});

	test("getIdentityClient still builds its own client, it must never share the memoised one", async () => {
		const freshConnector = createConnector();

		const createSpy = vi.spyOn(IdentityClientReadOnly, "create");

		// verifyProof goes through getIdentityClient, whose IdentityClient.create consumes the
		// read only client it is handed (a wasm-bindgen move). Sharing the memoised instance here
		// would pass an already destroyed handle into wasm on the second call.
		await verifyMissingMethod(freshConnector);
		await verifyMissingMethod(freshConnector);

		expect(createSpy).toHaveBeenCalledTimes(2);
	});
});
