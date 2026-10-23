// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthCategory, HealthStatus } from "@3sixty/api-models";
import { Iota } from "@3sixty/dlt-iota";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";

describe("IotaIdentityConnector Health", () => {
	let identityConnector: IotaIdentityConnector;

	beforeAll(async () => {
		await setupTestEnv();

		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});
	});

	test("can get health status", async () => {
		const health = await identityConnector.health();

		expect(health).toBeDefined();
		expect(health.length).toBeGreaterThan(0);
		expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
		expect(health[0].status).toEqual(HealthStatus.Ok);
	});

	test("can get health status error when node is unreachable", async () => {
		const badConnector = new IotaIdentityConnector({
			config: {
				clientOptions: { url: "http://localhost:1" },
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});

		const health = await badConnector.health();

		expect(health).toBeDefined();
		expect(health.length).toBeGreaterThan(0);
		expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
		expect(health[0].status).toEqual(HealthStatus.Error);
	});

	describe("gas station", () => {
		let gasStationConnector: IotaIdentityConnector;

		beforeAll(() => {
			gasStationConnector = new IotaIdentityConnector({
				config: {
					clientOptions: TEST_CLIENT_OPTIONS,
					vaultMnemonicId: TEST_MNEMONIC_NAME,
					network: TEST_NETWORK,
					gasStation: {
						gasStationUrl: "http://localhost:9527",
						gasStationAuthToken: "test-token"
					}
				}
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		test("health reports Ok for connectivity when gas station is reachable", async () => {
			vi.spyOn(Iota, "checkGasStationConnectivity").mockResolvedValue(true);

			const health = await gasStationConnector.health();

			expect(health).toHaveLength(2);
			expect(health[1].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[1].category).toEqual(HealthCategory.Connectivity);
			expect(health[1].status).toEqual(HealthStatus.Ok);
		});

		test("health reports Error for connectivity when gas station is unreachable", async () => {
			vi.spyOn(Iota, "checkGasStationConnectivity").mockResolvedValue(false);

			const health = await gasStationConnector.health();

			expect(health).toHaveLength(2);
			expect(health[1].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[1].category).toEqual(HealthCategory.Connectivity);
			expect(health[1].status).toEqual(HealthStatus.Error);
		});

		test("healthApplication reports Ok when sponsored transaction succeeds", async () => {
			vi.spyOn(Iota, "checkGasStationIsWorking").mockResolvedValue(undefined);

			const health = (await gasStationConnector.healthApplication(async () => {})) ?? [];

			expect(health).toHaveLength(1);
			expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[0].category).toEqual(HealthCategory.Application);
			expect(health[0].status).toEqual(HealthStatus.Ok);
		});

		test("healthApplication reports Error when sponsored transaction fails", async () => {
			vi.spyOn(Iota, "checkGasStationIsWorking").mockRejectedValue(
				new Error("sponsored transaction failed")
			);

			const health = (await gasStationConnector.healthApplication(async () => {})) ?? [];

			expect(health).toHaveLength(1);
			expect(health[0].source).toEqual(IotaIdentityConnector.CLASS_NAME);
			expect(health[0].category).toEqual(HealthCategory.Application);
			expect(health[0].status).toEqual(HealthStatus.Error);
		});

		test("healthApplication returns empty array when no gas station is configured", async () => {
			const health = (await identityConnector.healthApplication(async () => {})) ?? [];

			expect(health).toHaveLength(0);
		});
	});
});
