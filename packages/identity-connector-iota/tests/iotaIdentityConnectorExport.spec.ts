// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, ObjectHelper } from "@3sixty/core";
import { Bip39, Ed25519 } from "@3sixty/crypto";
import { AccountHelper } from "@3sixty/dlt-account";
import type { IIdentityExport } from "@3sixty/identity-models";
import { ProofTypes } from "@3sixty/standards-w3c-did";
import { VaultConnectorFactory, type IVaultConnector } from "@3sixty/vault-models";
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

const TEST_DATA = {
	"@context": "https://schema.org",
	type: "Person",
	name: "Jane Doe"
};

const METHOD_FRAGMENT = "export-key";

describe("IotaIdentityConnector import validation", () => {
	const did = "did:iota:testnet:0x0101010101010101010101010101010101010101010101010101010101010101";
	const privateKey = new Uint8Array(32).fill(3);
	let connector: IotaIdentityConnector;

	/**
	 * Create an export which only needs to pass the checks made before the network is used.
	 * @returns The export.
	 */
	function createOfflineExport(): IIdentityExport {
		return {
			version: 1,
			namespace: "iota",
			selfControlled: false,
			document: { "@context": "https://www.w3.org/ns/did/v1", id: did },
			keys: [
				{
					id: METHOD_FRAGMENT,
					type: "Ed25519",
					privateKey: Converter.bytesToBase64(privateKey),
					publicKey: Converter.bytesToBase64(Ed25519.publicKeyFromPrivateKey(privateKey))
				}
			]
		};
	}

	beforeAll(() => {
		connector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK
			}
		});
	});

	test("can fail to import an unsupported version", async () => {
		await expect(
			connector.importDocument(TEST_USER_IDENTITY, { ...createOfflineExport(), version: 2 })
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.importDocumentFailed",
			cause: { message: "identityExportHelper.unsupportedVersion" }
		});
	});

	test("can fail to import an export for another namespace", async () => {
		const exported = createOfflineExport();
		exported.namespace = "entity-storage";
		await expect(connector.importDocument(TEST_USER_IDENTITY, exported)).rejects.toMatchObject({
			cause: { message: "identityExportHelper.namespaceMismatch" }
		});
	});

	test("can fail to import a private key which does not match its public key", async () => {
		const exported = createOfflineExport();
		exported.keys[0].privateKey = Converter.bytesToBase64(new Uint8Array(32).fill(4));
		await expect(connector.importDocument(TEST_USER_IDENTITY, exported)).rejects.toMatchObject({
			cause: {
				message: "iotaIdentityConnector.keyPairMismatch",
				properties: { keyId: METHOD_FRAGMENT }
			}
		});
	});

	test("can fail to import a self-controlled export without account secrets", async () => {
		const exported = createOfflineExport();
		exported.selfControlled = true;
		await expect(connector.importDocument(undefined, exported)).rejects.toMatchObject({
			cause: { message: "iotaIdentityConnector.accountMismatch" }
		});
	});

	test("can fail to import account secrets whose seed does not match the mnemonic", async () => {
		const exported = createOfflineExport();
		exported.selfControlled = true;
		exported.account = {
			mnemonic: Bip39.randomMnemonic(),
			seed: Converter.bytesToBase64(new Uint8Array(64).fill(1))
		};
		try {
			await connector.importDocument(undefined, exported);
			expect.fail("import should have failed");
		} catch (error) {
			expect(error).toMatchObject({
				cause: { message: "iotaIdentityConnector.accountSeedMismatch" }
			});
			expect(JSON.stringify(error)).not.toContain(exported.account.mnemonic);
		}
	});

	test("can fail to import without a controller when not self-controlled", async () => {
		await expect(connector.importDocument(undefined, createOfflineExport())).rejects.toMatchObject({
			cause: { name: "GuardError" }
		});
	});

	test("can fail to import a DID which is not in the format the connector creates", async () => {
		const exported = createOfflineExport();
		exported.document.id = `did:iota:testnet:0x${"AB".repeat(32)}`;
		await expect(connector.importDocument(TEST_USER_IDENTITY, exported)).rejects.toMatchObject({
			cause: { message: "identityExportHelper.invalidDidFormat" }
		});
	});

	test("can fail to import a method fragment which could escape the vault key name", async () => {
		const exported = createOfflineExport();
		exported.document.authentication = [`${did}#../other`];
		await expect(connector.importDocument(TEST_USER_IDENTITY, exported)).rejects.toMatchObject({
			cause: { message: "identityExportHelper.invalidMethodId" }
		});
	});

	test("can fail to import an account mnemonic which is not valid", async () => {
		const exported = createOfflineExport();
		exported.selfControlled = true;
		exported.account = { mnemonic: "not a valid mnemonic at all" };
		try {
			await connector.importDocument(undefined, exported);
			expect.fail("import should have failed");
		} catch (error) {
			expect(error).toMatchObject({
				cause: { message: "iotaIdentityConnector.invalidMnemonic" }
			});
			expect(JSON.stringify(error)).not.toContain(exported.account.mnemonic);
		}
	});
});

describe("IotaIdentityConnector export and import", () => {
	let identityConnector: IotaIdentityConnector;
	let vaultConnector: IVaultConnector;
	let documentId: string;
	let exported: IIdentityExport;

	beforeAll(async () => {
		await setupTestEnv();

		vaultConnector = VaultConnectorFactory.get("vault");
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
		documentId = document.id;
		await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			documentId,
			"assertionMethod",
			METHOD_FRAGMENT
		);
	});

	afterAll(async () => {
		try {
			await identityConnector.removeDocument(TEST_USER_IDENTITY, documentId, { removeKeys: true });
		} catch {}
	});

	test("can export a document with its verification method keys", async () => {
		exported = await identityConnector.exportDocument(TEST_USER_IDENTITY, documentId);

		expect(exported.version).toEqual(1);
		expect(exported.namespace).toEqual("iota");
		expect(exported.selfControlled).toEqual(false);
		expect(exported.account).toBeUndefined();
		expect(exported.document.id).toEqual(documentId);
		expect(exported.keys.map(k => k.id)).toEqual([METHOD_FRAGMENT]);
		expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
	});

	test("can fail to export for a controller which does not hold the controller token", async () => {
		const otherIdentity = `other-${Converter.bytesToHex(Bip39.mnemonicToSeed(Bip39.randomMnemonic()).slice(0, 8))}`;
		await AccountHelper.createAccountKeys(
			{ vaultMnemonicId: TEST_MNEMONIC_NAME },
			vaultConnector,
			otherIdentity
		);

		await expect(identityConnector.exportDocument(otherIdentity, documentId)).rejects.toMatchObject(
			{
				name: "GeneralError",
				message: "iotaIdentityConnector.exportDocumentFailed",
				cause: {
					name: "UnauthorizedError",
					message: "iotaIdentityConnector.notController"
				}
			}
		);
	});

	test("can fail to import while the keys are still present", async () => {
		await expect(
			identityConnector.importDocument(TEST_USER_IDENTITY, exported)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.importDocumentFailed",
			cause: {
				name: "ConflictError",
				message: "iotaIdentityConnector.keyAlreadyExists",
				properties: { conflicts: [METHOD_FRAGMENT] }
			}
		});
		expect(await vaultConnector.keyExists(`${documentId}/${METHOD_FRAGMENT}`)).toEqual(true);
	});

	test("can round trip export, remove keys, import, then sign and verify", async () => {
		await vaultConnector.removeKey(`${documentId}/${METHOD_FRAGMENT}`);

		const document = await identityConnector.importDocument(TEST_USER_IDENTITY, exported);
		expect(document.id).toEqual(documentId);

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			`${documentId}#${METHOD_FRAGMENT}`,
			ProofTypes.DataIntegrityProof,
			TEST_DATA
		);
		expect(await identityConnector.verifyProof(TEST_DATA, proof)).toEqual(true);
	});

	test("can fail to import a key from a different key pair and writes nothing", async () => {
		await vaultConnector.removeKey(`${documentId}/${METHOD_FRAGMENT}`);

		const foreignPrivate = new Uint8Array(32).fill(9);
		const tampered = ObjectHelper.clone(exported);
		tampered.keys[0].privateKey = Converter.bytesToBase64(foreignPrivate);
		tampered.keys[0].publicKey = Converter.bytesToBase64(
			Ed25519.publicKeyFromPrivateKey(foreignPrivate)
		);

		await expect(
			identityConnector.importDocument(TEST_USER_IDENTITY, tampered)
		).rejects.toMatchObject({
			cause: {
				message: "identityExportHelper.methodKeyMismatch",
				properties: { keyId: METHOD_FRAGMENT }
			}
		});
		expect(await vaultConnector.keyExists(`${documentId}/${METHOD_FRAGMENT}`)).toEqual(false);
	});

	test("can fail to import for a controller which does not hold the controller token", async () => {
		const otherIdentity = `other-${Converter.bytesToHex(Bip39.mnemonicToSeed(Bip39.randomMnemonic()).slice(0, 8))}`;
		await AccountHelper.createAccountKeys(
			{ vaultMnemonicId: TEST_MNEMONIC_NAME },
			vaultConnector,
			otherIdentity
		);

		await expect(identityConnector.importDocument(otherIdentity, exported)).rejects.toMatchObject({
			cause: { name: "UnauthorizedError", message: "iotaIdentityConnector.notController" }
		});
		expect(await vaultConnector.keyExists(`${documentId}/${METHOD_FRAGMENT}`)).toEqual(false);

		await identityConnector.importDocument(TEST_USER_IDENTITY, exported);
	});

	test("can fail to retain a document for a controller which does not hold the controller token", async () => {
		const otherIdentity = `other-${Converter.bytesToHex(Bip39.mnemonicToSeed(Bip39.randomMnemonic()).slice(0, 8))}`;
		await AccountHelper.createAccountKeys(
			{ vaultMnemonicId: TEST_MNEMONIC_NAME },
			vaultConnector,
			otherIdentity
		);

		await expect(
			identityConnector.removeDocument(otherIdentity, documentId, {
				removeKeys: true,
				retainDocument: true
			})
		).rejects.toMatchObject({
			message: "iotaIdentityConnector.removeDocumentFailed",
			cause: { name: "UnauthorizedError", message: "iotaIdentityConnector.notController" }
		});
		expect(await vaultConnector.keyExists(`${documentId}/${METHOD_FRAGMENT}`)).toEqual(true);
	});

	test("only one of two concurrent imports of the same identity succeeds", async () => {
		await vaultConnector.removeKey(`${documentId}/${METHOD_FRAGMENT}`);

		const results = await Promise.allSettled([
			identityConnector.importDocument(TEST_USER_IDENTITY, exported),
			identityConnector.importDocument(TEST_USER_IDENTITY, exported)
		]);

		expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find(r => r.status === "rejected");
		expect(rejected?.reason).toMatchObject({ cause: { name: "ConflictError" } });
		expect(await vaultConnector.keyExists(`${documentId}/${METHOD_FRAGMENT}`)).toEqual(true);
	});
});

describe("IotaIdentityConnector export and import self-controlled with Gas Station", () => {
	test("can round trip a self-controlled document", async () => {
		await setupTestEnv();

		const vaultConnector = VaultConnectorFactory.get<IVaultConnector>("vault");
		const config = {
			clientOptions: TEST_CLIENT_OPTIONS,
			vaultMnemonicId: TEST_MNEMONIC_NAME,
			network: TEST_NETWORK,
			gasBudget: TEST_GAS_BUDGET,
			didResolutionCacheTtlMs: 0,
			gasStation: {
				gasStationUrl: TEST_GAS_STATION_URL,
				gasStationAuthToken: TEST_GAS_STATION_AUTH_TOKEN
			}
		};
		const connector = new IotaIdentityConnector({ config });

		const document = await connector.createDocument(undefined, { selfControlled: true });
		await connector.addVerificationMethod(
			document.id,
			document.id,
			"assertionMethod",
			METHOD_FRAGMENT
		);

		const selfExport = await connector.exportDocument(document.id, document.id);
		expect(selfExport.selfControlled).toEqual(true);
		expect(selfExport.account?.mnemonic).toBeDefined();

		// Another wallet can not remove what the node holds for the identity.
		await expect(
			connector.removeDocument(TEST_USER_IDENTITY, document.id, {
				removeKeys: true,
				retainDocument: true
			})
		).rejects.toMatchObject({
			cause: { name: "UnauthorizedError", message: "iotaIdentityConnector.notController" }
		});
		expect(
			await vaultConnector.secretExists(
				AccountHelper.buildMnemonicKey(document.id, config.vaultMnemonicId)
			)
		).toEqual(true);

		// Remove the keys from this node only, the identity stays on-chain.
		await connector.removeDocument(document.id, document.id, {
			removeKeys: true,
			retainDocument: true
		});
		expect(await vaultConnector.keyExists(`${document.id}/${METHOD_FRAGMENT}`)).toEqual(false);
		expect(
			await vaultConnector.secretExists(
				AccountHelper.buildMnemonicKey(document.id, config.vaultMnemonicId)
			)
		).toEqual(false);

		// A wallet which does not hold the controller token is refused before anything is written.
		const foreignAccount = ObjectHelper.clone(selfExport);
		foreignAccount.account = { mnemonic: Bip39.randomMnemonic() };
		await expect(connector.importDocument(undefined, foreignAccount)).rejects.toMatchObject({
			cause: { name: "UnauthorizedError", message: "iotaIdentityConnector.notController" }
		});
		expect(
			await vaultConnector.secretExists(
				AccountHelper.buildMnemonicKey(document.id, config.vaultMnemonicId)
			)
		).toEqual(false);
		expect(await vaultConnector.keyExists(`${document.id}/${METHOD_FRAGMENT}`)).toEqual(false);

		await connector.importDocument(undefined, selfExport);

		const proof = await connector.createProof(
			document.id,
			`${document.id}#${METHOD_FRAGMENT}`,
			ProofTypes.DataIntegrityProof,
			TEST_DATA
		);
		expect(await connector.verifyProof(TEST_DATA, proof)).toEqual(true);

		await connector.removeDocument(document.id, document.id, { removeKeys: true });
	});
});
