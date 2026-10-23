// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Coerce, Guards, Is } from "@3sixty/core";
import { Bip39 } from "@3sixty/crypto";
import { AccountHelper } from "@3sixty/dlt-account";
import { Iota } from "@3sixty/dlt-iota";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import * as dotenv from "dotenv";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({
	path: [path.join(__dirname, ".env.dev"), path.join(__dirname, ".env")],
	quiet: true
});

Guards.stringValue("TestEnv", "TEST_NODE_ENDPOINT", process.env.TEST_NODE_ENDPOINT);
Guards.stringValue("TestEnv", "TEST_COIN_TYPE", process.env.TEST_COIN_TYPE);
Guards.stringValue("TestEnv", "TEST_EXPLORER_URL", process.env.TEST_EXPLORER_URL);
Guards.stringValue("TestEnv", "TEST_NETWORK", process.env.TEST_NETWORK);
Guards.stringValue(
	"TestEnv",
	"TEST_GAS_STATION_AUTH_TOKEN",
	process.env.TEST_GAS_STATION_AUTH_TOKEN
);
Guards.stringValue("TestEnv", "TEST_GAS_STATION_URL", process.env.TEST_GAS_STATION_URL);
Guards.stringValue("TestEnv", "TEST_GAS_BUDGET", process.env.TEST_GAS_BUDGET);

if (!Is.stringValue(process.env.TEST_MNEMONIC)) {
	throw new Error(
		`Please define TEST_MNEMONIC as a 24 word mnemonic either as an environment variable or inside an .env.dev file
		 e.g. TEST_MNEMONIC="word0 word1 ... word23"
		 You can generate one using the following command
		 npx "@3sixty/crypto-cli" mnemonic --env ./tests/.env.dev --env-prefix TEST_`
	);
}

export const TEST_USER_IDENTITY = "test-identity";
export const TEST_MNEMONIC_NAME = "test-mnemonic";
export const TEST_FAUCET_ENDPOINT = process.env.TEST_FAUCET_ENDPOINT ?? "";
export const TEST_EXPLORER_URL = process.env.TEST_EXPLORER_URL ?? "";
export const TEST_GAS_STATION_ADDRESS = process.env.TEST_GAS_STATION_ADDRESS;

// Minimum balance required for tests (1 IOTA in nano units)
const MIN_BALANCE_REQUIRED = 100000n;

initSchema();

EntityStorageConnectorFactory.register(
	"vault-key",
	() =>
		new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-keys" }
		})
);
const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
	entitySchema: nameof<VaultSecret>(),
	config: { storageKey: "vault-secrets" }
});
EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

const TEST_VAULT_CONNECTOR = new EntityStorageVaultConnector();
VaultConnectorFactory.register("vault", () => TEST_VAULT_CONNECTOR);

export const TEST_NETWORK = process.env.TEST_NETWORK;
export const TEST_SEED = Bip39.mnemonicToSeed(process.env.TEST_MNEMONIC);
export const TEST_COIN_TYPE = Number.parseInt(process.env.TEST_COIN_TYPE, 10);

// Gas station environment variables for testing
export const TEST_GAS_STATION_URL = process.env.TEST_GAS_STATION_URL;
export const TEST_GAS_STATION_AUTH_TOKEN = process.env.TEST_GAS_STATION_AUTH_TOKEN;
export const TEST_GAS_BUDGET = Coerce.number(process.env.TEST_GAS_BUDGET);

export const TEST_CLIENT_OPTIONS = {
	url: process.env.TEST_NODE_ENDPOINT
};

export const TEST_IOTA_CONFIG = {
	clientOptions: TEST_CLIENT_OPTIONS,
	network: TEST_NETWORK,
	coinType: TEST_COIN_TYPE,
	vaultMnemonicId: TEST_MNEMONIC_NAME
};

await AccountHelper.createAccountKeys(
	TEST_IOTA_CONFIG,
	TEST_VAULT_CONNECTOR,
	TEST_USER_IDENTITY,
	process.env.TEST_MNEMONIC
);

const testAddress = await AccountHelper.getAddress(
	TEST_IOTA_CONFIG,
	TEST_VAULT_CONNECTOR,
	TEST_USER_IDENTITY,
	0,
	0
);
export const TEST_ADDRESS = testAddress;

/**
 * Setup the test environment.
 */
export async function setupTestEnv(): Promise<void> {
	await testFundGasStation();
	await ensureFundsForAddress(TEST_USER_IDENTITY, TEST_ADDRESS);
}

/**
 * Ensure an address has sufficient funds for testing.
 * Only requests from faucet if current balance is below minimum required.
 * @param identity The identity to use for wallet operations.
 * @param address The address to ensure funds for.
 * @returns Promise that resolves when funds are ensured.
 */
async function ensureFundsForAddress(identity: string, address: string): Promise<void> {
	try {
		// Use ensureBalance which will automatically request from faucet if needed
		const success = await Iota.ensureBalance(
			TEST_IOTA_CONFIG,
			TEST_FAUCET_ENDPOINT,
			identity,
			address,
			MIN_BALANCE_REQUIRED,
			30
		);

		const currentBalance = await Iota.getBalance(TEST_IOTA_CONFIG, address);
		console.debug(
			`[ensureFundsForAddress] Address ${TEST_EXPLORER_URL}address/${address}?network=${TEST_NETWORK} has balance: ${currentBalance}`
		);

		if (!success) {
			console.warn(
				`Failed to ensure funds from faucet for address ${address}, requiredBalance: ${MIN_BALANCE_REQUIRED}, currentBalance: ${currentBalance}`
			);
		}
	} catch (error) {
		console.warn(
			`[setupTestEnv] Ignoring faucet error while funding ${address}. Continuing test setup.`,
			error
		);
	}
}

/**
 * Fund the gas station address from the faucet if the address is provided in the environment variables.
 */
async function testFundGasStation(): Promise<void> {
	// Fund the gas station if its address is provided
	if (Is.stringValue(TEST_GAS_STATION_ADDRESS) && Is.stringValue(TEST_FAUCET_ENDPOINT)) {
		try {
			const balance = await Iota.getBalance(
				{
					clientOptions: TEST_CLIENT_OPTIONS,
					network: TEST_NETWORK
				},
				TEST_GAS_STATION_ADDRESS
			);

			if (balance < 2000000000) {
				console.debug(
					"Requesting IOTA from faucet to fund gas station address:",
					`${TEST_EXPLORER_URL}address/${TEST_GAS_STATION_ADDRESS}?network=${TEST_NETWORK}`
				);
				const response = await requestIotaFromFaucetV0({
					host: TEST_FAUCET_ENDPOINT,
					recipient: TEST_GAS_STATION_ADDRESS
				});
				console.debug("Funded gas station address from faucet:", response);
			}
		} catch (error) {
			console.error("Failed to request IOTA from faucet:", error);
		}
		console.debug(
			"Gas station balance",
			await Iota.getBalance(
				{
					clientOptions: TEST_CLIENT_OPTIONS,
					network: TEST_NETWORK
				},
				TEST_GAS_STATION_ADDRESS
			)
		);
	}
}
