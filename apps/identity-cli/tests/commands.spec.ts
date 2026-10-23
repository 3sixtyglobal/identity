// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { CLIUtils } from "@3sixty/cli-core";
import { Converter, I18n, Is } from "@3sixty/core";
import { Bip39 } from "@3sixty/crypto";
import { actionCommandAddress } from "@3sixty/crypto-cli";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	DidVerificationMethodType,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@3sixty/standards-w3c-did";
import { actionCommandFaucet } from "@3sixty/wallet-cli";
import { TEST_MNEMONIC } from "./setupTestEnv.js";
import locales from "../dist/locales/en.json" with { type: "json" };
import { actionCommandAlsoKnownAsAdd } from "../src/commands/alsoKnownAsAdd.js";
import { actionCommandAlsoKnownAsRemove } from "../src/commands/alsoKnownAsRemove.js";
import { actionCommandIdentityCreate } from "../src/commands/identityCreate.js";
import { actionCommandIdentityResolve } from "../src/commands/identityResolve.js";
import { actionCommandProofCreate } from "../src/commands/proofCreate.js";
import { actionCommandProofVerify } from "../src/commands/proofVerify.js";
import { actionCommandServiceAdd } from "../src/commands/serviceAdd.js";
import { actionCommandServiceRemove } from "../src/commands/serviceRemove.js";
import { actionCommandVerifiableCredentialCreate } from "../src/commands/verifiableCredentialCreate.js";
import { actionCommandVerifiableCredentialRevoke } from "../src/commands/verifiableCredentialRevoke.js";
import { actionCommandVerifiableCredentialUnrevoke } from "../src/commands/verifiableCredentialUnrevoke.js";
import { actionCommandVerifiableCredentialVerify } from "../src/commands/verifiableCredentialVerify.js";
import { actionCommandVerifiablePresentationCreate } from "../src/commands/verifiablePresentationCreate.js";
import { actionCommandVerifiablePresentationVerify } from "../src/commands/verifiablePresentationVerify.js";
import { actionCommandVerificationMethodAdd } from "../src/commands/verificationMethodAdd.js";
import { actionCommandVerificationMethodRemove } from "../src/commands/verificationMethodRemove.js";
import { IdentityConnectorTypes } from "../src/models/identityConnectorTypes.js";

const tempDirectory = "./tests/.tmp/";

function getEnvValue(env: string[] | undefined, lineIndex: number): string {
	return (env?.[lineIndex].split("=")[1] ?? "").replace(/"/g, "");
}

describe("CLI Commands", () => {
	let createdAlias: string | undefined;
	let createdDid: string | undefined;
	let createdVerificationMethodId: string | undefined;
	let createdVerificationMethodPrivateKeyHex: string | undefined;
	let createdServiceId: string | undefined;
	let createdVerifiableCredentialJwt: string | undefined;
	let revocationServiceEndpointBefore: string | undefined;
	const createdVerifiableCredentialRevocationIndex = "5";

	function didDocumentContainsId(didDocument: unknown, id: string): boolean {
		if (didDocument === null || didDocument === undefined) {
			return false;
		}
		if (Is.string(didDocument)) {
			return didDocument === id;
		}
		if (Array.isArray(didDocument)) {
			return didDocument.some(item => didDocumentContainsId(item, id));
		}
		if (Is.object(didDocument)) {
			return Object.values(didDocument).some(value => didDocumentContainsId(value, id));
		}
		return false;
	}

	function getRevocationServiceEndpoint(didDocument: unknown): string | undefined {
		const doc = didDocument as { service?: { id?: string; serviceEndpoint?: unknown }[] };
		const service = doc?.service?.find(s => Is.string(s?.id) && s.id.endsWith("#revocation"));
		const endpoint = service?.serviceEndpoint;
		return Is.string(endpoint) ? endpoint : undefined;
	}

	beforeAll(async () => {
		await mkdir(tempDirectory, { recursive: true });

		I18n.addDictionary("en", locales);
		const seed = Bip39.mnemonicToSeed(TEST_MNEMONIC);
		const seedHex = Converter.bytesToHex(seed, true);
		await CLIUtils.writeEnvFile(
			`${tempDirectory}wallet.env`,
			[`MNEMONIC="${TEST_MNEMONIC}"`, `SEED="${seedHex}"`],
			true
		);

		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);

		await actionCommandAddress({
			seed: getEnvValue(walletEnv, 1),
			start: "0",
			count: "4",
			account: "0",
			coin: "4218",
			keyType: "Ed25519",
			keyFormat: "hex",
			console: false,
			env: `${tempDirectory}address.env`,
			json: `${tempDirectory}address.json`,
			mergeEnv: true,
			mergeJson: true
		});

		const addressEnv = await CLIUtils.readLinesFile(`${tempDirectory}address.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");

		try {
			await actionCommandFaucet({
				address: getEnvValue(addressEnv, 0),
				faucet: getEnvValue(configEnv, 1),
				node: getEnvValue(configEnv, 0),
				explorer: getEnvValue(configEnv, 4)
			});
		} catch (error) {
			console.warn("Error executing faucet command:", error);
		}
	});

	afterAll(async () => {
		await rm(tempDirectory, { recursive: true, force: true });
	});

	afterEach(async () => {
		await EntityStorageConnectorFactory.get("vault-key")?.teardown?.();
		await EntityStorageConnectorFactory.get("vault-secret")?.teardown?.();
	});

	test("Can execute identity-create", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");

		const identityJsonPath = `${tempDirectory}identity.json`;
		const identityEnvPath = `${tempDirectory}identity.env`;

		await actionCommandIdentityCreate({
			seed: getEnvValue(walletEnv, 1),
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0",
			console: false,
			json: identityJsonPath,
			env: identityEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const identityEnv = await CLIUtils.readLinesFile(identityEnvPath);
		const didLine = identityEnv?.find(l => l.startsWith("DID=")) ?? "";
		const didFromEnv = (didLine.split("=")[1] ?? "").replace(/"/g, "");
		createdDid = didFromEnv;
		expect(didFromEnv).toMatch(/^did:/);

		const jsonObj = await CLIUtils.readJsonFile<{ did?: string }>(identityJsonPath);
		expect(jsonObj?.did).toMatch(/^did:/);
		expect(jsonObj?.did).toEqual(didFromEnv);
	});

	test("Can execute identity-resolve", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		const didDocumentJsonPath = `${tempDirectory}did-document.json`;

		await actionCommandIdentityResolve({
			did,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			console: false,
			json: didDocumentJsonPath,
			mergeJson: true,
			mergeEnv: true
		});

		const didDocument = await CLIUtils.readJsonFile<{ id?: string }>(didDocumentJsonPath);
		expect(didDocument?.id).toEqual(did);
		revocationServiceEndpointBefore = getRevocationServiceEndpoint(didDocument);
		expect(revocationServiceEndpointBefore).toBeTruthy();
	});

	test("Can execute verification-method-add", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		const verificationMethodJsonPath = `${tempDirectory}verification-method.json`;
		const verificationMethodEnvPath = `${tempDirectory}verification-method.env`;

		await actionCommandVerificationMethodAdd({
			seed: getEnvValue(walletEnv, 1),
			did,
			// assertionMethod: the fixture is used later to issue and verify credentials/
			// presentations, and it requires the signing method to be in this
			// relationship for the verification to succeed.
			type: DidVerificationMethodType.AssertionMethod,
			id: "my-id",
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0",
			console: false,
			json: verificationMethodJsonPath,
			env: verificationMethodEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vmEnv = await CLIUtils.readLinesFile(verificationMethodEnvPath);
		const vmIdLine = vmEnv?.find(l => l.startsWith("DID_VERIFICATION_METHOD_ID=")) ?? "";
		const vmId = (vmIdLine.split("=")[1] ?? "").replace(/"/g, "");
		createdVerificationMethodId = vmId;
		expect(vmId).toMatch(/^did:/);
		expect(vmId).toContain(did);
		expect(vmId).toContain("#");

		const privHexLine =
			vmEnv?.find(l => l.startsWith("DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX=")) ?? "";
		const privHex = (privHexLine.split("=")[1] ?? "").replace(/"/g, "");
		createdVerificationMethodPrivateKeyHex = privHex;
		expect(privHex).toMatch(/^0x[\da-f]+$/i);

		const pubHexLine =
			vmEnv?.find(l => l.startsWith("DID_VERIFICATION_METHOD_PUBLIC_KEY_HEX=")) ?? "";
		const pubHex = (pubHexLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(pubHex).toMatch(/^0x[\da-f]+$/i);

		const vmJson = await CLIUtils.readJsonFile<{
			verificationMethodId?: string;
			privateKeyHex?: string;
			publicKeyHex?: string;
		}>(verificationMethodJsonPath);
		expect(vmJson?.verificationMethodId).toEqual(vmId);
		expect(vmJson?.privateKeyHex).toEqual(privHex);
		expect(vmJson?.publicKeyHex).toEqual(pubHex);
	});

	test("Can execute service-add", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		const serviceJsonPath = `${tempDirectory}service.json`;
		const serviceEnvPath = `${tempDirectory}service.env`;

		await actionCommandServiceAdd({
			seed: getEnvValue(walletEnv, 1),
			did,
			id: "linked-domain",
			type: "LinkedDomains",
			endpoint: "https://www.iota.org",
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0",
			console: false,
			json: serviceJsonPath,
			env: serviceEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const serviceEnv = await CLIUtils.readLinesFile(serviceEnvPath);
		const serviceIdLine = serviceEnv?.find(l => l.startsWith("DID_SERVICE_ID=")) ?? "";
		const serviceId = (serviceIdLine.split("=")[1] ?? "").replace(/"/g, "");
		createdServiceId = serviceId;
		expect(serviceId).toEqual(`${did}#linked-domain`);

		const serviceTypeLine = serviceEnv?.find(l => l.startsWith("DID_SERVICE_TYPE=")) ?? "";
		const serviceType = (serviceTypeLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(serviceType).toEqual("LinkedDomains");

		const serviceEndpointLine = serviceEnv?.find(l => l.startsWith("DID_SERVICE_ENDPOINT=")) ?? "";
		const serviceEndpoint = (serviceEndpointLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(serviceEndpoint.replace(/\/+$/, "")).toEqual("https://www.iota.org");

		const serviceJson = await CLIUtils.readJsonFile<{
			id?: string;
			type?: string | string[];
			serviceEndpoint?: string | string[];
		}>(serviceJsonPath);
		expect(serviceJson?.id).toEqual(serviceId);
		expect(Array.isArray(serviceJson?.type) ? serviceJson?.type[0] : serviceJson?.type).toEqual(
			"LinkedDomains"
		);
		expect(
			Array.isArray(serviceJson?.serviceEndpoint)
				? serviceJson?.serviceEndpoint[0]
				: serviceJson?.serviceEndpoint?.toString().replace(/\/+$/, "")
		).toEqual("https://www.iota.org");
	});

	test("Can execute verifiable-credential-create", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const verificationMethodId =
			createdVerificationMethodId ??
			(() => {
				throw new Error("Verification method not created by previous test");
			})();
		const verificationMethodPrivateKeyHex =
			createdVerificationMethodPrivateKeyHex ??
			(() => {
				throw new Error("Verification method private key not created by previous test");
			})();

		const subjectJsonPath = `${tempDirectory}subject.json`;
		await writeFile(
			subjectJsonPath,
			JSON.stringify(
				{
					id: createdDid,
					name: "Alice"
				},
				null,
				2
			),
			"utf8"
		);

		const vcJsonPath = `${tempDirectory}vc.json`;
		const vcEnvPath = `${tempDirectory}vc.env`;

		await actionCommandVerifiableCredentialCreate({
			verificationMethodId,
			privateKey: verificationMethodPrivateKeyHex,
			credentialId: "https://example.edu/credentials/3732",
			subjectJson: subjectJsonPath,
			revocationIndex: createdVerifiableCredentialRevocationIndex,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: vcJsonPath,
			env: vcEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vcEnv = await CLIUtils.readLinesFile(vcEnvPath);
		const jwtLine = vcEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_JWT=")) ?? "";
		const jwtFromEnv = (jwtLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(jwtFromEnv).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);

		const vcJson = await CLIUtils.readJsonFile<{
			verifiableCredentialJwt?: string;
			verifiableCredential?: IDidVerifiableCredential;
		}>(vcJsonPath);
		expect(vcJson?.verifiableCredentialJwt).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);
		expect(vcJson?.verifiableCredentialJwt).toEqual(jwtFromEnv);
		expect(vcJson?.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(vcJson?.verifiableCredential?.type).toContain("VerifiableCredential");
		expect(vcJson?.verifiableCredential?.credentialSubject).toMatchObject({
			id: createdDid,
			name: "Alice"
		});
		createdVerifiableCredentialJwt = vcJson?.verifiableCredentialJwt ?? "";
	});

	test("Can execute verifiable-credential-verify (not revoked)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const jwt =
			createdVerifiableCredentialJwt ??
			(() => {
				throw new Error("Verifiable credential jwt not created by previous test");
			})();

		const verifiedJsonPath = `${tempDirectory}verified.json`;
		const verifiedEnvPath = `${tempDirectory}verified.env`;

		await actionCommandVerifiableCredentialVerify({
			jwt,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: verifiedJsonPath,
			env: verifiedEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const verifiedEnv = await CLIUtils.readLinesFile(verifiedEnvPath);
		const verifiedLine =
			verifiedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_VERIFIED=")) ?? "";
		expect((verifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");
		const verifiedRevokedLine =
			verifiedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_REVOKED=")) ?? "";
		expect((verifiedRevokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");

		const verifiedJson = await CLIUtils.readJsonFile<{ isVerified?: boolean; isRevoked?: boolean }>(
			verifiedJsonPath
		);
		expect(verifiedJson?.isVerified).toEqual(true);
		expect(verifiedJson?.isRevoked).toEqual(false);

		// Verify via JSON-LD file
		const vcJson = await CLIUtils.readJsonFile<{
			verifiableCredential?: IDidVerifiableCredential;
		}>(`${tempDirectory}vc.json`);
		const credentialJsonPath = `${tempDirectory}credential.json`;
		await writeFile(
			credentialJsonPath,
			JSON.stringify(vcJson?.verifiableCredential, null, 2),
			"utf8"
		);

		const verifiedJsonLdJsonPath = `${tempDirectory}verified-jsonld.json`;
		const verifiedJsonLdEnvPath = `${tempDirectory}verified-jsonld.env`;

		await actionCommandVerifiableCredentialVerify({
			jsonLd: credentialJsonPath,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: verifiedJsonLdJsonPath,
			env: verifiedJsonLdEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const verifiedJsonLdEnv = await CLIUtils.readLinesFile(verifiedJsonLdEnvPath);
		const verifiedJsonLdLine =
			verifiedJsonLdEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_VERIFIED=")) ?? "";
		expect((verifiedJsonLdLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");
		const verifiedJsonLdRevokedLine =
			verifiedJsonLdEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_REVOKED=")) ?? "";
		expect((verifiedJsonLdRevokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");

		const verifiedJsonLdJson = await CLIUtils.readJsonFile<{
			isVerified?: boolean;
			isRevoked?: boolean;
		}>(verifiedJsonLdJsonPath);
		expect(verifiedJsonLdJson?.isVerified).toEqual(true);
		expect(verifiedJsonLdJson?.isRevoked).toEqual(false);

		// Error when neither --jwt nor --json-ld is provided
		await expect(
			actionCommandVerifiableCredentialVerify({
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				console: false,
				mergeJson: true,
				mergeEnv: true
			})
		).rejects.toMatchObject({ name: "GeneralError" });
	});

	test("Can execute verifiable-credential-revoke", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		await actionCommandVerifiableCredentialRevoke({
			seed: getEnvValue(walletEnv, 1),
			did,
			revocationIndex: createdVerifiableCredentialRevocationIndex,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			addressIndex: "0"
		});

		const beforeEndpoint =
			revocationServiceEndpointBefore ??
			(() => {
				throw new Error("Revocation service endpoint was not captured");
			})();

		// The on-ledger update can take a moment to become visible.
		let afterEndpoint: string | undefined;
		for (let attempt = 0; attempt < 10; attempt++) {
			const didDocumentJsonPath = `${tempDirectory}did-document-revoked.json`;
			await actionCommandIdentityResolve({
				did,
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				explorer: getEnvValue(configEnv, 4),
				console: false,
				json: didDocumentJsonPath,
				mergeJson: true,
				mergeEnv: true
			});

			const didDocument = await CLIUtils.readJsonFile(didDocumentJsonPath);
			afterEndpoint = getRevocationServiceEndpoint(didDocument);
			if (afterEndpoint && afterEndpoint !== beforeEndpoint) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		expect(afterEndpoint).toBeTruthy();
		expect(afterEndpoint).not.toEqual(beforeEndpoint);
	});

	test("Can execute verifiable-credential-verify (after revoke)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const jwt =
			createdVerifiableCredentialJwt ??
			(() => {
				throw new Error("Verifiable credential jwt not created by previous test");
			})();

		const revokedJsonPath = `${tempDirectory}revoked.json`;
		const revokedEnvPath = `${tempDirectory}revoked.env`;

		await actionCommandVerifiableCredentialVerify({
			jwt,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: revokedJsonPath,
			env: revokedEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const revokedEnv = await CLIUtils.readLinesFile(revokedEnvPath);
		const revokedVerifiedLine =
			revokedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_VERIFIED=")) ?? "";
		expect((revokedVerifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");
		const revokedRevokedLine =
			revokedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_REVOKED=")) ?? "";
		expect((revokedRevokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");

		const revokedJson = await CLIUtils.readJsonFile<{ isVerified?: boolean; isRevoked?: boolean }>(
			revokedJsonPath
		);
		expect(revokedJson?.isVerified).toEqual(false);
		expect(revokedJson?.isRevoked).toEqual(true);
	});

	test("Can execute verifiable-credential-unrevoke", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		await actionCommandVerifiableCredentialUnrevoke({
			seed: getEnvValue(walletEnv, 1),
			did,
			revocationIndex: createdVerifiableCredentialRevocationIndex,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			addressIndex: "0"
		});

		const beforeEndpoint =
			revocationServiceEndpointBefore ??
			(() => {
				throw new Error("Revocation service endpoint was not captured");
			})();

		let afterEndpoint: string | undefined;
		for (let attempt = 0; attempt < 10; attempt++) {
			const didDocumentJsonPath = `${tempDirectory}did-document-unrevoked.json`;
			await actionCommandIdentityResolve({
				did,
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				explorer: getEnvValue(configEnv, 4),
				console: false,
				json: didDocumentJsonPath,
				mergeJson: true,
				mergeEnv: true
			});

			const didDocument = await CLIUtils.readJsonFile(didDocumentJsonPath);
			afterEndpoint = getRevocationServiceEndpoint(didDocument);
			if (afterEndpoint && afterEndpoint === beforeEndpoint) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		expect(afterEndpoint).toBeTruthy();
		expect(afterEndpoint).toEqual(beforeEndpoint);
	});

	test("Can execute verifiable-credential-verify (unrevoked)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const jwt =
			createdVerifiableCredentialJwt ??
			(() => {
				throw new Error("Verifiable credential jwt not created by previous test");
			})();

		const unrevokedJsonPath = `${tempDirectory}unrevoked.json`;
		const unrevokedEnvPath = `${tempDirectory}unrevoked.env`;

		await actionCommandVerifiableCredentialVerify({
			jwt,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: unrevokedJsonPath,
			env: unrevokedEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const unrevokedEnv = await CLIUtils.readLinesFile(unrevokedEnvPath);
		const unrevokedVerifiedLine =
			unrevokedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_VERIFIED=")) ?? "";
		expect((unrevokedVerifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");
		const unrevokedRevokedLine =
			unrevokedEnv?.find(l => l.startsWith("DID_VERIFIABLE_CREDENTIAL_REVOKED=")) ?? "";
		expect((unrevokedRevokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");

		const unrevokedJson = await CLIUtils.readJsonFile<{
			isVerified?: boolean;
			isRevoked?: boolean;
		}>(unrevokedJsonPath);
		expect(unrevokedJson?.isVerified).toEqual(true);
		expect(unrevokedJson?.isRevoked).toEqual(false);
	});

	test("Can execute verifiable-presentation-create (from jwt)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const verificationMethodId =
			createdVerificationMethodId ??
			(() => {
				throw new Error("Verification method not created by previous test");
			})();
		const verificationMethodPrivateKeyHex =
			createdVerificationMethodPrivateKeyHex ??
			(() => {
				throw new Error("Verification method private key not created by previous test");
			})();
		const jwt =
			createdVerifiableCredentialJwt ??
			(() => {
				throw new Error("Verifiable credential jwt not created by previous test");
			})();

		const vpJsonPath = `${tempDirectory}vp-jwt.json`;
		const vpEnvPath = `${tempDirectory}vp-jwt.env`;

		await actionCommandVerifiablePresentationCreate({
			verificationMethodId,
			privateKey: verificationMethodPrivateKeyHex,
			presentationId: "https://example.edu/presentations/1",
			jwt,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: vpJsonPath,
			env: vpEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vpEnv = await CLIUtils.readLinesFile(vpEnvPath);
		const vpJwtLine = vpEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_JWT=")) ?? "";
		const jwtFromEnv = (vpJwtLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(jwtFromEnv).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);

		const vpJson = await CLIUtils.readJsonFile<{
			verifiablePresentationJwt?: string;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(vpJsonPath);
		expect(vpJson?.verifiablePresentationJwt).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);
		expect(vpJson?.verifiablePresentationJwt).toEqual(jwtFromEnv);
		expect(vpJson?.verifiablePresentation?.id).toEqual("https://example.edu/presentations/1");
		expect(vpJson?.verifiablePresentation?.type).toContain("VerifiablePresentation");

		// Error when neither --jwt nor --json-ld is provided
		await expect(
			actionCommandVerifiablePresentationCreate({
				verificationMethodId,
				privateKey: verificationMethodPrivateKeyHex,
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				console: false,
				mergeJson: true,
				mergeEnv: true
			})
		).rejects.toMatchObject({ name: "GeneralError" });
	});

	test("Can execute verifiable-presentation-create (from json-ld)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const verificationMethodId =
			createdVerificationMethodId ??
			(() => {
				throw new Error("Verification method not created by previous test");
			})();
		const verificationMethodPrivateKeyHex =
			createdVerificationMethodPrivateKeyHex ??
			(() => {
				throw new Error("Verification method private key not created by previous test");
			})();

		const vpJsonPath = `${tempDirectory}vp-jsonld.json`;
		const vpEnvPath = `${tempDirectory}vp-jsonld.env`;

		await actionCommandVerifiablePresentationCreate({
			verificationMethodId,
			privateKey: verificationMethodPrivateKeyHex,
			jsonLd: `${tempDirectory}credential.json`,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: vpJsonPath,
			env: vpEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vpEnv = await CLIUtils.readLinesFile(vpEnvPath);
		const vpJwtLine = vpEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_JWT=")) ?? "";
		const jwtFromEnv = (vpJwtLine.split("=")[1] ?? "").replace(/"/g, "");
		expect(jwtFromEnv).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);

		const vpJson = await CLIUtils.readJsonFile<{
			verifiablePresentationJwt?: string;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(vpJsonPath);
		expect(vpJson?.verifiablePresentationJwt).toMatch(/^(?:[\w-]+\.){2}[\w-]+$/);
		expect(vpJson?.verifiablePresentationJwt).toEqual(jwtFromEnv);
		expect(vpJson?.verifiablePresentation?.type).toContain("VerifiablePresentation");
	});

	test("Can execute verifiable-presentation-verify (from jwt)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");

		const vpJson = await CLIUtils.readJsonFile<{
			verifiablePresentationJwt?: string;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(`${tempDirectory}vp-jwt.json`);
		const jwt =
			vpJson?.verifiablePresentationJwt ??
			(() => {
				throw new Error("Verifiable presentation jwt not created by previous test");
			})();

		const vpVerifyJsonPath = `${tempDirectory}vp-verify-jwt.json`;
		const vpVerifyEnvPath = `${tempDirectory}vp-verify-jwt.env`;

		await actionCommandVerifiablePresentationVerify({
			jwt,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: vpVerifyJsonPath,
			env: vpVerifyEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vpVerifyEnv = await CLIUtils.readLinesFile(vpVerifyEnvPath);
		const verifiedLine =
			vpVerifyEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_VERIFIED=")) ?? "";
		expect((verifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");
		const revokedLine =
			vpVerifyEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_REVOKED=")) ?? "";
		expect((revokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");

		const vpVerifyJson = await CLIUtils.readJsonFile<{
			isVerified?: boolean;
			isRevoked?: boolean;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(vpVerifyJsonPath);
		expect(vpVerifyJson?.isVerified).toEqual(true);
		expect(vpVerifyJson?.isRevoked).toEqual(false);
		expect(vpVerifyJson?.verifiablePresentation?.type).toContain("VerifiablePresentation");

		// Error when neither --jwt nor --json-ld is provided
		await expect(
			actionCommandVerifiablePresentationVerify({
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				console: false,
				mergeJson: true,
				mergeEnv: true
			})
		).rejects.toMatchObject({ name: "GeneralError" });
	});

	test("Can execute verifiable-presentation-verify (from json-ld)", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");

		const vpJson = await CLIUtils.readJsonFile<{
			verifiablePresentationJwt?: string;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(`${tempDirectory}vp-jsonld.json`);
		const presentationJsonPath = `${tempDirectory}presentation.json`;
		await writeFile(
			presentationJsonPath,
			JSON.stringify(vpJson?.verifiablePresentation, null, 2),
			"utf8"
		);

		const vpVerifyJsonPath = `${tempDirectory}vp-verify-jsonld.json`;
		const vpVerifyEnvPath = `${tempDirectory}vp-verify-jsonld.env`;

		await actionCommandVerifiablePresentationVerify({
			jsonLd: presentationJsonPath,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: vpVerifyJsonPath,
			env: vpVerifyEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const vpVerifyEnv = await CLIUtils.readLinesFile(vpVerifyEnvPath);
		const verifiedLine =
			vpVerifyEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_VERIFIED=")) ?? "";
		expect((verifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");
		const revokedLine =
			vpVerifyEnv?.find(l => l.startsWith("DID_VERIFIABLE_PRESENTATION_REVOKED=")) ?? "";
		expect((revokedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("false");

		const vpVerifyJson = await CLIUtils.readJsonFile<{
			isVerified?: boolean;
			isRevoked?: boolean;
			verifiablePresentation?: IDidVerifiablePresentation;
		}>(vpVerifyJsonPath);
		expect(vpVerifyJson?.isVerified).toEqual(true);
		expect(vpVerifyJson?.isRevoked).toEqual(false);
		expect(vpVerifyJson?.verifiablePresentation?.type).toContain("VerifiablePresentation");
	});

	test("Can execute proof-create", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const verificationMethodId =
			createdVerificationMethodId ??
			(() => {
				throw new Error("Verification method not created by previous test");
			})();
		const verificationMethodPrivateKeyHex =
			createdVerificationMethodPrivateKeyHex ??
			(() => {
				throw new Error("Verification method private key not created by previous test");
			})();

		const unsecuredDocPath = "./tests/unsecured.json";

		const proofJsonPath = `${tempDirectory}data-proof.json`;
		const proofEnvPath = `${tempDirectory}data-proof.env`;

		await actionCommandProofCreate({
			id: verificationMethodId,
			privateKey: verificationMethodPrivateKeyHex,
			documentFilename: unsecuredDocPath,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: proofJsonPath,
			env: proofEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const proofEnv = await CLIUtils.readLinesFile(proofEnvPath);
		const proofEnvLine = proofEnv?.find(l => l.startsWith("DID_PROOF=")) ?? "";
		expect(proofEnvLine).toBeTruthy();

		const proofJson = await CLIUtils.readJsonFile<{ type?: string; verificationMethod?: string }>(
			proofJsonPath
		);
		expect(proofJson?.type).toBeTruthy();
		expect(proofJson?.verificationMethod).toBeTruthy();
	});

	test("Can execute proof-verify", async () => {
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const unsecuredDocPath = "./tests/unsecured.json";
		const proofJsonPath = `${tempDirectory}data-proof.json`;

		const verifiedProofJsonPath = `${tempDirectory}data-verified.json`;
		const verifiedProofEnvPath = `${tempDirectory}data-verified.env`;

		await actionCommandProofVerify({
			documentFilename: unsecuredDocPath,
			proofFilename: proofJsonPath,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			console: false,
			json: verifiedProofJsonPath,
			env: verifiedProofEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const verifiedProofEnvData = await CLIUtils.readLinesFile(verifiedProofEnvPath);
		const proofVerifiedLine =
			verifiedProofEnvData?.find(l => l.startsWith("DID_PROOF_VERIFIED=")) ?? "";
		expect((proofVerifiedLine.split("=")[1] ?? "").replace(/"/g, "")).toEqual("true");

		const verifiedProofJson = await CLIUtils.readJsonFile<{ isVerified?: boolean }>(
			verifiedProofJsonPath
		);
		expect(verifiedProofJson?.isVerified).toEqual(true);
	});

	test("Can execute also-known-as-add", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();

		const aliasJsonPath = `${tempDirectory}alias.json`;
		const aliasEnvPath = `${tempDirectory}alias.env`;
		const alias = "https://example.org/alias";

		await actionCommandAlsoKnownAsAdd({
			seed: getEnvValue(walletEnv, 1),
			did,
			alias,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0",
			console: false,
			json: aliasJsonPath,
			env: aliasEnvPath,
			mergeJson: true,
			mergeEnv: true
		});

		const aliasEnv = await CLIUtils.readLinesFile(aliasEnvPath);
		const envLine = aliasEnv?.find(l => l.startsWith("DID_ALSO_KNOWN_AS="));
		const envAliases = envLine
			? (envLine.split("=")[1] ?? "").replace(/"/g, "").split(",").filter(Boolean)
			: [];
		createdAlias = alias;
		expect(envAliases).toContain(alias);
		expect(envAliases.length).toBeGreaterThanOrEqual(1);

		const aliasJson = await CLIUtils.readJsonFile<{ alsoKnownAs?: string[] }>(aliasJsonPath);
		expect(Array.isArray(aliasJson?.alsoKnownAs)).toBe(true);
		expect(aliasJson?.alsoKnownAs).toContain(alias);
		expect(aliasJson?.alsoKnownAs?.length ?? 0).toBeGreaterThanOrEqual(1);
	});

	test("Can execute also-known-as-remove", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();
		const alias =
			createdAlias ??
			(() => {
				throw new Error("Alias not created by previous test");
			})();

		await actionCommandAlsoKnownAsRemove({
			seed: getEnvValue(walletEnv, 1),
			did,
			alias,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0",
			console: false,
			json: `${tempDirectory}alias-removed.json`,
			env: `${tempDirectory}alias-removed.env`,
			mergeJson: true,
			mergeEnv: true
		});

		const aliasRemovedEnv = await CLIUtils.readLinesFile(`${tempDirectory}alias-removed.env`);
		const envLine = aliasRemovedEnv?.find(l => l.startsWith("DID_ALSO_KNOWN_AS="));
		const envAliases = envLine
			? (envLine.split("=")[1] ?? "").replace(/"/g, "").split(",").filter(Boolean)
			: [];
		expect(envAliases).not.toContain(alias);

		const aliasJson = await CLIUtils.readJsonFile<{ alsoKnownAs?: string[] }>(
			`${tempDirectory}alias-removed.json`
		);
		expect(Array.isArray(aliasJson?.alsoKnownAs)).toBe(true);
		expect(aliasJson?.alsoKnownAs).not.toContain(alias);
	});

	test("Can execute service-remove", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();
		const serviceId =
			createdServiceId ??
			(() => {
				throw new Error("Service not created by previous test");
			})();

		await actionCommandServiceRemove({
			seed: getEnvValue(walletEnv, 1),
			id: serviceId,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0"
		});

		let serviceRemoved = false;
		for (let attempt = 0; attempt < 10; attempt++) {
			const didDocumentJsonPath = `${tempDirectory}did-document-service-removed.json`;
			await actionCommandIdentityResolve({
				did,
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				explorer: getEnvValue(configEnv, 4),
				console: false,
				json: didDocumentJsonPath,
				mergeJson: true,
				mergeEnv: true
			});

			const didDocument = await CLIUtils.readJsonFile(didDocumentJsonPath);
			serviceRemoved = !didDocumentContainsId(didDocument, serviceId);
			if (serviceRemoved) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		expect(serviceRemoved).toEqual(true);
	});

	test("Can execute verification-method-remove", async () => {
		const walletEnv = await CLIUtils.readLinesFile(`${tempDirectory}wallet.env`);
		const configEnv = await CLIUtils.readLinesFile("./tests/config.env");
		const did =
			createdDid ??
			(() => {
				throw new Error("DID not created by previous test");
			})();
		const verificationMethodId =
			createdVerificationMethodId ??
			(() => {
				throw new Error("Verification method not created by previous test");
			})();

		await actionCommandVerificationMethodRemove({
			seed: getEnvValue(walletEnv, 1),
			id: verificationMethodId,
			connector: IdentityConnectorTypes.Iota,
			node: getEnvValue(configEnv, 0),
			network: getEnvValue(configEnv, 3),
			explorer: getEnvValue(configEnv, 4),
			addressIndex: "0"
		});

		let verificationMethodRemoved = false;
		for (let attempt = 0; attempt < 10; attempt++) {
			const didDocumentJsonPath = `${tempDirectory}did-document-vm-removed.json`;
			await actionCommandIdentityResolve({
				did,
				connector: IdentityConnectorTypes.Iota,
				node: getEnvValue(configEnv, 0),
				network: getEnvValue(configEnv, 3),
				explorer: getEnvValue(configEnv, 4),
				console: false,
				json: didDocumentJsonPath,
				mergeJson: true,
				mergeEnv: true
			});

			const didDocument = await CLIUtils.readJsonFile(didDocumentJsonPath);
			verificationMethodRemoved = !didDocumentContainsId(didDocument, verificationMethodId);
			if (verificationMethodRemoved) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		expect(verificationMethodRemoved).toEqual(true);
	});
});
