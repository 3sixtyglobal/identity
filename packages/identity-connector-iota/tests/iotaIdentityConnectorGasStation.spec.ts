// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthCategory, HealthStatus } from "@3sixty/api-models";
import { Is } from "@3sixty/core";
import { DidVerificationMethodType, type IDidDocument } from "@3sixty/standards-w3c-did";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_GAS_BUDGET,
	TEST_GAS_STATION_AUTH_TOKEN,
	TEST_GAS_STATION_URL,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_USER_IDENTITY
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";
import type { IIotaIdentityConnectorConfig } from "../src/models/IIotaIdentityConnectorConfig.js";

describe("IotaIdentityConnector with Gas Station", () => {
	let gasStationConfig: IIotaIdentityConnectorConfig;
	let regularConfig: IIotaIdentityConnectorConfig;

	beforeAll(async () => {
		await setupTestEnv();

		gasStationConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			vaultMnemonicId: TEST_MNEMONIC_NAME,
			network: TEST_NETWORK,
			gasBudget: TEST_GAS_BUDGET,
			gasStation: {
				gasStationUrl: TEST_GAS_STATION_URL,
				gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
			}
		};

		regularConfig = {
			clientOptions: TEST_CLIENT_OPTIONS,
			vaultMnemonicId: TEST_MNEMONIC_NAME,
			network: TEST_NETWORK
		};
	});

	describe("Configuration", () => {
		test("Should create identity connector with gas station configuration", () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			expect(connector).toBeDefined();
			expect(IotaIdentityConnector.CLASS_NAME).toBe("IotaIdentityConnector");
		});

		test("Should create identity connector without gas station configuration", () => {
			const connector = new IotaIdentityConnector({
				config: regularConfig
			});

			expect(connector).toBeDefined();
			expect(IotaIdentityConnector.CLASS_NAME).toBe("IotaIdentityConnector");
		});

		test("Should create identity connector with custom standard gas price", () => {
			const customGasPriceConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				standardGasPrice: 2000, // Custom gas price (2x default)
				gasStation: {
					gasStationUrl: TEST_GAS_STATION_URL,
					gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
				}
			};

			const connector = new IotaIdentityConnector({
				config: customGasPriceConfig
			});

			expect(connector).toBeDefined();
			expect(IotaIdentityConnector.CLASS_NAME).toBe("IotaIdentityConnector");
		});
	});

	describe("Gas Station Integration", () => {
		test("Should test gas station connectivity before attempting identity operations", async () => {
			await expect(fetch(TEST_GAS_STATION_URL, { method: "GET" })).resolves.toMatchObject({
				ok: true
			});
		}, 10000);

		test("can get health status with gas station ok", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			const health = await connector.health();
			const appHealth = (await connector.healthApplication(async () => {})) ?? [];

			expect(health).toBeDefined();
			expect(health).toHaveLength(2);
			expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[0].status).toEqual(HealthStatus.Ok);
			expect(health[1].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[1].category).toEqual(HealthCategory.Connectivity);
			expect(health[1].status).toEqual(HealthStatus.Ok);

			expect(appHealth).toHaveLength(1);
			expect(appHealth[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(appHealth[0].category).toEqual(HealthCategory.Application);
			expect(appHealth[0].status).toEqual(HealthStatus.Ok);
		}, 10000);

		test("can get health status with gas station error when url is unreachable", async () => {
			const connector = new IotaIdentityConnector({
				config: {
					...gasStationConfig,
					gasStation: {
						gasStationUrl: "http://localhost:1",
						gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
					}
				}
			});

			const health = await connector.health();
			const appHealth = (await connector.healthApplication(async () => {})) ?? [];

			expect(health).toBeDefined();
			expect(health).toHaveLength(2);
			expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[0].status).toEqual(HealthStatus.Ok);
			expect(health[1].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[1].category).toEqual(HealthCategory.Connectivity);
			expect(health[1].status).toEqual(HealthStatus.Error);

			expect(appHealth).toHaveLength(1);
			expect(appHealth[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(appHealth[0].category).toEqual(HealthCategory.Application);
			expect(appHealth[0].status).toEqual(HealthStatus.Error);
		}, 10000);

		test("Should create identity document using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			const document = await connector.createDocument(TEST_USER_IDENTITY);

			expect(document).toBeDefined();
			expect(document.id).toBeDefined();
			expect(Is.stringValue(document.id)).toBe(true);
			expect(document.id.includes("did:iota:")).toBe(true);
		}, 30000);

		test("Should compare regular vs gas station transaction attempts", async () => {
			const regularConnector = new IotaIdentityConnector({
				config: regularConfig
			});

			const gasStationConnector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			// Regular creation first
			const regularDocument = await regularConnector.createDocument(TEST_USER_IDENTITY);

			// Gas station creation
			const gasStationDocument = await gasStationConnector.createDocument(TEST_USER_IDENTITY);

			expect(regularDocument).toBeDefined();
			expect(gasStationDocument).toBeDefined();
			expect(regularDocument.id).toBeDefined();
			expect(gasStationDocument.id).toBeDefined();

			expect(regularDocument.id).not.toBe(gasStationDocument.id);
		}, 60000);
	});

	describe("Document Update Operations with Gas Station", () => {
		let testDocument: IDidDocument;
		let testDocumentId: string;

		test("Should create a test document for update operations", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			testDocument = await connector.createDocument(TEST_USER_IDENTITY);
			testDocumentId = testDocument.id;

			expect(testDocument).toBeDefined();
			expect(testDocumentId).toBeDefined();
			expect(testDocumentId.includes("did:iota:")).toBe(true);
		}, 30000);

		test("Should add verification method using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			const verificationMethodType = "authentication";
			const verificationMethodId = "gasStationTestVerificationMethod";

			const addedMethod = await connector.addVerificationMethod(
				TEST_USER_IDENTITY,
				testDocumentId,
				verificationMethodType,
				verificationMethodId
			);

			expect(addedMethod).toBeDefined();
			expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);
			expect(addedMethod.type).toEqual("JsonWebKey2020");
		}, 60000);

		test("Should remove verification method using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.removeVerificationMethod(
					TEST_USER_IDENTITY,
					`${testDocumentId}#gasStationTestVerificationMethod`
				)
			).resolves.toBeUndefined();
		}, 30000);

		test("Should add service using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.addService(
					TEST_USER_IDENTITY,
					testDocumentId,
					"testService",
					"LinkedDomains",
					"https://example.com"
				)
			).resolves.toBeDefined();
		}, 30000);

		test("Should remove service using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.removeService(TEST_USER_IDENTITY, `${testDocumentId}#testService`)
			).resolves.toBeUndefined();
		}, 30000);

		test("Should revoke verifiable credentials using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.revokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [1, 2])
			).resolves.toBeUndefined();
		}, 30000);

		test("Should unrevoke verifiable credentials using gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			await expect(
				connector.unrevokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [1, 2])
			).resolves.toBeUndefined();
		}, 30000);
	});

	describe("Document Removal with Gas Station", () => {
		test("removeDocument resolves cleanly under gas station config, without a redundant second submission", async () => {
			const connector = new IotaIdentityConnector({ config: gasStationConfig });
			const document = await connector.createDocument(TEST_USER_IDENTITY);

			// removeDocument used to submit the delete transaction via the gas
			// station AND then unconditionally again via a direct buildAndExecute call on
			// the same (by then already wasm-consumed) builder. That crashed deep in the
			// wasm-bindgen ↔ JS boundary while marshaling the redundant call's result - a
			// crash that never rejected the promise removeDocument returned, only escaped
			// as a process-level uncaught exception, so removeDocument hung forever from
			// the caller's perspective. This regression-locks both halves of that fix: the
			// call must now settle (not hang) and must not raise an uncaught exception.
			const uncaughtErrors: Error[] = [];
			const captureUncaught = (error: Error): void => {
				uncaughtErrors.push(error);
			};
			process.on("uncaughtException", captureUncaught);

			try {
				const removeOutcome = (async (): Promise<"resolved" | "rejected"> => {
					try {
						await connector.removeDocument(TEST_USER_IDENTITY, document.id);
						return "resolved";
					} catch {
						return "rejected";
					}
				})();

				const TIMEOUT = Symbol("timeout");
				let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
				const timeoutOutcome = new Promise<typeof TIMEOUT>(resolve => {
					timeoutHandle = setTimeout(() => resolve(TIMEOUT), 20000);
				});
				const raceResult = await Promise.race([removeOutcome, timeoutOutcome]);
				clearTimeout(timeoutHandle);

				// The call must settle - and specifically resolve, not merely avoid hanging.
				expect(raceResult).toBe("resolved");

				// No stray uncaught exception from a redundant second submission.
				expect(uncaughtErrors).toHaveLength(0);
			} finally {
				process.off("uncaughtException", captureUncaught);
			}

			// The deletion must have genuinely happened on-chain - confirm the identity is
			// actually gone, not just that removeDocument returned without error.
			const regularConnector = new IotaIdentityConnector({ config: regularConfig });
			await expect(
				regularConnector.addVerificationMethod(
					TEST_USER_IDENTITY,
					document.id,
					DidVerificationMethodType.AssertionMethod,
					"postDeleteProbe"
				)
			).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.addVerificationMethodFailed"
			});
		}, 45000);
	});

	describe("Gas Station Budget Consistency (bug-174)", () => {
		test("createDocument succeeds under gas station when gasBudget is unset, because the reservation now matches the declared budget", async () => {
			const noBudgetGasStationConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				// gasBudget deliberately omitted - the one difference from
				// `gasStationConfig` above, and the only way this bug ever manifested:
				// every other test in this file sets gasBudget explicitly, which masks
				// the divergence between the connector's own default (1B) and
				// dlt-iota's reservation default (50M) that existed before the fix.
				gasStation: {
					gasStationUrl: TEST_GAS_STATION_URL,
					gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
				}
			};

			const connector = new IotaIdentityConnector({ config: noBudgetGasStationConfig });

			// Capture the real request sent to the gas station's /v1/reserve_gas
			// endpoint. This still calls through to the genuine fetch implementation
			// (matching this file's live convention) - it only observes the request,
			// it does not fake the response.
			let reservedGasBudget: number | undefined;
			const realFetch = globalThis.fetch;
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
				const url = Is.string(input) ? input : input.toString();
				if (url.includes("/v1/reserve_gas") && Is.string(init?.body)) {
					reservedGasBudget = JSON.parse(init.body).gas_budget;
				}
				return realFetch(input, init);
			});

			let document: IDidDocument;
			try {
				document = await connector.createDocument(TEST_USER_IDENTITY);
			} finally {
				fetchSpy.mockRestore();
			}

			expect(document).toBeDefined();
			expect(document.id.includes("did:iota:")).toBe(true);

			// The budget the connector resolved in its constructor and stamps onto the
			// transaction via .withGasBudget(...); deliberately not pinned to a literal
			// so a future default change keeps this invariant assertion valid.
			const declaredTransactionGasBudget = (connector as unknown as { _gasBudget: number })
				._gasBudget;

			expect(declaredTransactionGasBudget).toBeGreaterThan(0);
			expect(reservedGasBudget).toBe(declaredTransactionGasBudget);
		}, 30000);

		test("explicit gasBudget in config still reserves and declares the same, explicit amount", async () => {
			// Uses the file's existing `gasStationConfig` fixture, which sets
			// gasBudget: TEST_GAS_BUDGET explicitly - confirms the fix didn't disturb
			// the already-working explicit-budget case, only the previously-broken
			// unset-budget case above.
			const connector = new IotaIdentityConnector({ config: gasStationConfig });

			let reservedGasBudget: number | undefined;
			const realFetch = globalThis.fetch;
			const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
				const url = Is.string(input) ? input : input.toString();
				if (url.includes("/v1/reserve_gas") && Is.string(init?.body)) {
					reservedGasBudget = JSON.parse(init.body).gas_budget;
				}
				return realFetch(input, init);
			});

			try {
				await expect(connector.createDocument(TEST_USER_IDENTITY)).resolves.toBeDefined();
			} finally {
				fetchSpy.mockRestore();
			}

			const declaredTransactionGasBudget = (connector as unknown as { _gasBudget: number })
				._gasBudget;

			expect(declaredTransactionGasBudget).toBe(TEST_GAS_BUDGET);
			expect(reservedGasBudget).toBe(TEST_GAS_BUDGET);
			expect(reservedGasBudget).toBe(declaredTransactionGasBudget);
		}, 30000);
	});

	describe("Gas Station Error Handling", () => {
		test("Should handle gas station unavailable gracefully", async () => {
			const invalidGasStationConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasStation: {
					gasStationUrl: "http://localhost:9999", // Invalid port
					gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
				}
			};

			const connector = new IotaIdentityConnector({
				config: invalidGasStationConfig
			});

			await expect(connector.createDocument(TEST_USER_IDENTITY)).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.createDocumentFailed"
			});
		}, 20000);

		test("Should handle invalid gas station auth token", async () => {
			const invalidAuthConfig: IIotaIdentityConnectorConfig = {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasStation: {
					gasStationUrl: TEST_GAS_STATION_URL,
					gasStationAuthToken: "invalid-token"
				}
			};

			const connector = new IotaIdentityConnector({
				config: invalidAuthConfig
			});

			await expect(connector.createDocument(TEST_USER_IDENTITY)).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.createDocumentFailed"
			});
		}, 20000);

		test("Should handle document update errors with gas station", async () => {
			const connector = new IotaIdentityConnector({
				config: gasStationConfig
			});

			// Test with invalid document ID
			await expect(
				connector.addVerificationMethod(
					TEST_USER_IDENTITY,
					"invalid:document:id",
					DidVerificationMethodType.AssertionMethod,
					"testMethod"
				)
			).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.addVerificationMethodFailed"
			});
		}, 20000);
	});
});
