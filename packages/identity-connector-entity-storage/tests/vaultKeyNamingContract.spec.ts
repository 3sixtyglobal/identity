// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { DocumentHelper } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TEST_IDENTITY_ID = "test-identity";

describe("Vault Key Naming Contract", () => {
	let identityConnector: EntityStorageIdentityConnector;
	let vaultConnector: EntityStorageVaultConnector;
	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let vaultKeyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
	let vaultSecretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

	beforeEach(() => {
		initSchemaVault();
		initSchemaIdentity();
		SchemaOrgDataTypes.registerRedirects();

		didDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>(),
			config: { storageKey: "identity-document" }
		});

		vaultKeyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-keys" }
		});

		vaultSecretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secrets" }
		});

		EntityStorageConnectorFactory.register("identity-document", () => didDocumentEntityStorage);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorage);

		vaultConnector = new EntityStorageVaultConnector();
		VaultConnectorFactory.register("vault", () => vaultConnector);

		identityConnector = new EntityStorageIdentityConnector();
	});

	afterEach(async () => {
		await didDocumentEntityStorage.teardown();
		await vaultKeyEntityStorage.teardown();
		await vaultSecretEntityStorage.teardown();
	});

	test("verification method keys are stored with document ID prefix", async () => {
		const document = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			document.id,
			"assertionMethod",
			"test-vm-id"
		);

		const vmParts = DocumentHelper.parseId(verificationMethod.id);
		const expectedKeyName = `${vmParts.id}/${vmParts.fragment}`;

		const storedKey = await vaultConnector.getKey(expectedKeyName);
		expect(storedKey).toBeDefined();
		expect(storedKey.privateKey).toBeDefined();
	});

	test("keys stored with wrong prefix fail to be found by connector", async () => {
		const document = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			document.id,
			"assertionMethod",
			"buggy-vm-id"
		);

		const vmParts = DocumentHelper.parseId(verificationMethod.id);

		await vaultConnector.removeKey(`${vmParts.id}/${vmParts.fragment}`);

		// Store key with wrong "local/" prefix instead of document ID
		const wrongKeyName = `local/${vmParts.fragment}`;
		await vaultConnector.addKey(
			wrongKeyName,
			VaultKeyType.Ed25519,
			new Uint8Array(32).fill(1),
			new Uint8Array()
		);

		await expect(
			identityConnector.createVerifiableCredential(
				"local",
				verificationMethod.id,
				"https://example.com/credentials/test",
				{
					"@context": "https://schema.org",
					"@type": "Person",
					id: document.id,
					name: "Test Subject"
				}
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.createVerifiableCredentialFailed"
		});
	});

	test("keys stored with correct document ID prefix work for VC creation", async () => {
		const document = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			document.id,
			"assertionMethod",
			"correct-vm-id"
		);

		const result = await identityConnector.createVerifiableCredential(
			TEST_IDENTITY_ID,
			verificationMethod.id,
			"https://example.com/credentials/test",
			{
				"@context": "https://schema.org",
				"@type": "Person",
				id: document.id,
				name: "Test Subject"
			}
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();
		expect(result.jwt).toBeDefined();
		expect(result.jwt.split(".").length).toEqual(3);
	});

	test("keys stored with correct document ID prefix work for proof creation", async () => {
		const document = await identityConnector.createDocument(TEST_IDENTITY_ID);

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_IDENTITY_ID,
			document.id,
			"assertionMethod",
			"proof-vm-id"
		);

		const proof = await identityConnector.createProof(
			TEST_IDENTITY_ID,
			verificationMethod.id,
			"DataIntegrityProof",
			{
				"@context": "https://schema.org",
				"@type": "Person",
				id: document.id,
				name: "Test Subject"
			}
		);

		expect(proof).toBeDefined();
		expect(proof.type).toEqual("DataIntegrityProof");
		expect(proof.verificationMethod).toEqual(verificationMethod.id);
	});

	test("buildVaultKey helper produces correct format", () => {
		const documentId = "did:entity-storage:0x1234567890abcdef";
		const fragment = "my-verification-method";

		const vaultKey = EntityStorageIdentityConnector.buildVaultKey(documentId, fragment);

		expect(vaultKey).toEqual(`${documentId}/${fragment}`);
		expect(vaultKey).toEqual("did:entity-storage:0x1234567890abcdef/my-verification-method");
	});
});
