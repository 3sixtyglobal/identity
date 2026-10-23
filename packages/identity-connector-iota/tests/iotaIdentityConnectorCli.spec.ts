// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { DocumentHelper } from "@3sixty/identity-models";
import type { EntityStorageVaultConnector } from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import {
	TEST_CLIENT_OPTIONS,
	TEST_USER_IDENTITY,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	setupTestEnv,
	TEST_GAS_BUDGET
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";

describe("IotaIdentityConnector CLI", () => {
	let identityConnector: IotaIdentityConnector;
	let vaultConnector: EntityStorageVaultConnector;
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

		vaultConnector = VaultConnectorFactory.get<EntityStorageVaultConnector>("vault");

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = document.id;
	});

	test("key stored with 'local' prefix fails - connector expects document ID prefix", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cliTestMethod"
		);
		testVerificationMethodId = verificationMethod.id;

		const userProvidedPrivateKey = new Uint8Array(32);
		crypto.getRandomValues(userProvidedPrivateKey);

		const vmParts = DocumentHelper.parseId(testVerificationMethodId);

		// Store key with wrong "local/" prefix instead of document ID
		const localIdentity = "local";
		const cliKeyName = `${localIdentity}/${vmParts.fragment}`;

		try {
			await vaultConnector.removeKey(`${vmParts.id}/${vmParts.fragment}`);
		} catch {
			// Key might not exist
		}

		await vaultConnector.addKey(
			cliKeyName,
			VaultKeyType.Ed25519,
			userProvidedPrivateKey,
			new Uint8Array()
		);

		await expect(
			identityConnector.createVerifiableCredential(
				localIdentity,
				testVerificationMethodId,
				"https://example.edu/credentials/cli-test",
				{
					id: testDocumentId,
					name: "CLI Bug Test"
				}
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.createVerifiableCredentialFailed",
			properties: {
				error: {
					name: "NotFoundError",
					message: "entityStorageVaultConnector.keyNotFound"
				}
			}
		});
	});

	test("key stored with document ID prefix works for VC creation", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"fixedCliTestMethod"
		);

		const result = await identityConnector.createVerifiableCredential(
			"local",
			verificationMethod.id,
			"https://example.edu/credentials/fixed-cli-test",
			{
				id: testDocumentId,
				name: "Fixed CLI Test"
			}
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();
		expect(result.jwt).toBeDefined();
		expect(result.jwt.split(".").length).toEqual(3);
	});

	test("key stored with document ID prefix is found correctly", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"cliFixVerificationTest"
		);

		const vmParts = DocumentHelper.parseId(verificationMethod.id);
		const keyName = `${vmParts.id}/${vmParts.fragment}`;

		const storedKey = await vaultConnector.getKey(keyName);
		expect(storedKey).toBeDefined();
		expect(storedKey.privateKey).toBeDefined();

		const result = await identityConnector.createVerifiableCredential(
			vmParts.id,
			verificationMethod.id,
			"https://example.edu/credentials/cli-fix-test",
			{
				id: testDocumentId,
				name: "CLI Fix Verification Test"
			}
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();
		expect(result.jwt).toBeDefined();
	});
});
