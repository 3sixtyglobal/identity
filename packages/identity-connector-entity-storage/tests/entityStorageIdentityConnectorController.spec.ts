// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests that every mutating and signing operation refuses a caller whose controller differs from
 * the one stored against the document.
 *
 * Entity storage has no ledger to enforce ownership the way the IOTA connector does, and the
 * document and vault stores are registered unpartitioned, so without this check a caller in one
 * tenant could address another tenant's DID through the identity path parameter and add a
 * verification method, take over the controller, sign with the other tenant's keys, or remove the
 * document outright.
 */
import { ObjectHelper } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import { DidVerificationMethodType, ProofTypes } from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TENANT_A = "did:org:a";
const TENANT_B = "did:org:b";

const TEST_SUBJECT: IJsonLdNodeObject = {
	"@context": "https://schema.org",
	"@type": "Person",
	name: "Test Subject"
};

let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let identityConnector: EntityStorageIdentityConnector;
let documentId: string;
let verificationMethodId: string;

/**
 * Build a matcher for the unauthorized error as the calling operation wraps it.
 * @param failureKey The i18n key the operation wraps its failures in.
 * @returns A matcher for the wrapped unauthorized error.
 */
function unauthorized(failureKey: string): object {
	return {
		name: "GeneralError",
		message: `entityStorageIdentityConnector.${failureKey}`,
		cause: {
			name: "UnauthorizedError",
			message: "entityStorageIdentityConnector.notController",
			properties: { documentId }
		}
	};
}

describe("EntityStorageIdentityConnector - controller enforcement", () => {
	beforeEach(async () => {
		initSchemaVault();
		initSchemaIdentity();
		SchemaOrgDataTypes.registerRedirects();

		didDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>(),
			config: { storageKey: "identity-document" }
		});
		const vaultKeyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-keys" }
		});
		const vaultSecretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secret" }
		});

		EntityStorageConnectorFactory.register("identity-document", () => didDocumentEntityStorage);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorage);
		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		identityConnector = new EntityStorageIdentityConnector();

		const document = await identityConnector.createDocument(TENANT_A);
		documentId = document.id;

		const method = await identityConnector.addVerificationMethod(
			TENANT_A,
			documentId,
			DidVerificationMethodType.AssertionMethod,
			"test-method"
		);
		verificationMethodId = method.id;

		await identityConnector.addService(
			TENANT_A,
			documentId,
			`${documentId}#linked`,
			"LinkedDomains",
			"https://example.com"
		);
		await identityConnector.addAlsoKnownAs(TENANT_A, documentId, "did:example:alias");
	});

	test("a foreign controller cannot add a verification method or take over the controller", async () => {
		await expect(
			identityConnector.addVerificationMethod(
				TENANT_B,
				documentId,
				DidVerificationMethodType.AssertionMethod,
				"hijacked"
			)
		).rejects.toMatchObject(unauthorized("addVerificationMethodFailed"));

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored?.controller).toEqual(TENANT_A);
		expect(ObjectHelper.propertyGet(stored?.document, "assertionMethod")).toHaveLength(1);
	});

	test("a foreign controller cannot remove a verification method", async () => {
		await expect(
			identityConnector.removeVerificationMethod(TENANT_B, verificationMethodId)
		).rejects.toMatchObject(unauthorized("removeVerificationMethodFailed"));

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored?.controller).toEqual(TENANT_A);
		expect(ObjectHelper.propertyGet(stored?.document, "assertionMethod")).toHaveLength(1);
	});

	test("a foreign controller cannot remove the document", async () => {
		await expect(identityConnector.removeDocument(TENANT_B, documentId)).rejects.toMatchObject(
			unauthorized("removeDocumentFailed")
		);

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored).toBeDefined();
		expect(stored?.controller).toEqual(TENANT_A);
	});

	test("a foreign controller cannot add or remove a service", async () => {
		await expect(
			identityConnector.addService(
				TENANT_B,
				documentId,
				`${documentId}#hijacked`,
				"LinkedDomains",
				"https://attacker.example.com"
			)
		).rejects.toMatchObject(unauthorized("addServiceFailed"));

		await expect(
			identityConnector.removeService(TENANT_B, `${documentId}#linked`)
		).rejects.toMatchObject(unauthorized("removeServiceFailed"));

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored?.controller).toEqual(TENANT_A);
		expect(ObjectHelper.propertyGet(stored?.document, "service")).toHaveLength(2);
	});

	test("a foreign controller cannot add or remove an alsoKnownAs alias", async () => {
		await expect(
			identityConnector.addAlsoKnownAs(TENANT_B, documentId, "did:example:hijacked")
		).rejects.toMatchObject(unauthorized("addAlsoKnownAsFailed"));

		await expect(
			identityConnector.removeAlsoKnownAs(TENANT_B, documentId, "did:example:alias")
		).rejects.toMatchObject(unauthorized("removeAlsoKnownAsFailed"));

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored?.controller).toEqual(TENANT_A);
		expect(ObjectHelper.propertyGet(stored?.document, "alsoKnownAs")).toEqual([
			"did:example:alias"
		]);
	});

	test("a foreign controller cannot revoke or unrevoke credentials", async () => {
		await expect(
			identityConnector.revokeVerifiableCredentials(TENANT_B, documentId, [5])
		).rejects.toMatchObject(unauthorized("revokeVerifiableCredentialsFailed"));

		await expect(
			identityConnector.unrevokeVerifiableCredentials(TENANT_B, documentId, [5])
		).rejects.toMatchObject(unauthorized("unrevokeVerifiableCredentialsFailed"));

		const stored = await didDocumentEntityStorage.get(documentId);
		expect(stored?.controller).toEqual(TENANT_A);
	});

	test("a foreign controller cannot sign with the stored controller's keys", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TENANT_B,
				verificationMethodId,
				"https://example.com/credentials/1",
				TEST_SUBJECT
			)
		).rejects.toMatchObject(unauthorized("createVerifiableCredentialFailed"));

		await expect(
			identityConnector.createProof(
				TENANT_B,
				verificationMethodId,
				ProofTypes.DataIntegrityProof,
				TEST_SUBJECT
			)
		).rejects.toMatchObject(unauthorized("createProofFailed"));
	});

	test("a foreign controller cannot create a presentation as the holder", async () => {
		const { jwt } = await identityConnector.createVerifiableCredential(
			TENANT_A,
			verificationMethodId,
			"https://example.com/credentials/1",
			TEST_SUBJECT
		);

		await expect(
			identityConnector.createVerifiablePresentation(
				TENANT_B,
				verificationMethodId,
				"https://example.com/presentations/1",
				undefined,
				undefined,
				[jwt]
			)
		).rejects.toMatchObject(unauthorized("createVerifiablePresentationFailed"));
	});

	test("the stored controller can still perform every guarded operation", async () => {
		await identityConnector.addService(
			TENANT_A,
			documentId,
			`${documentId}#second`,
			"LinkedDomains",
			"https://example.org"
		);
		await identityConnector.removeService(TENANT_A, `${documentId}#second`);
		await identityConnector.addAlsoKnownAs(TENANT_A, documentId, "did:example:second");
		await identityConnector.removeAlsoKnownAs(TENANT_A, documentId, "did:example:second");
		await identityConnector.revokeVerifiableCredentials(TENANT_A, documentId, [5]);
		await identityConnector.unrevokeVerifiableCredentials(TENANT_A, documentId, [5]);

		const proof = await identityConnector.createProof(
			TENANT_A,
			verificationMethodId,
			ProofTypes.DataIntegrityProof,
			TEST_SUBJECT
		);
		expect(proof).toBeDefined();

		await identityConnector.removeVerificationMethod(TENANT_A, verificationMethodId);
		await identityConnector.removeDocument(TENANT_A, documentId);

		expect(await didDocumentEntityStorage.get(documentId)).toBeUndefined();
	});

	test("the document's own DID controls a document created with a temporary controller", async () => {
		const bootstrap = await identityConnector.createDocument("did:temp:bootstrap");

		const method = await identityConnector.addVerificationMethod(
			bootstrap.id,
			bootstrap.id,
			DidVerificationMethodType.AssertionMethod,
			"key-1"
		);

		const stored = await didDocumentEntityStorage.get(bootstrap.id);
		expect(stored?.controller).toEqual(bootstrap.id);

		const proof = await identityConnector.createProof(
			bootstrap.id,
			method.id,
			ProofTypes.DataIntegrityProof,
			TEST_SUBJECT
		);
		expect(proof).toBeDefined();

		await expect(
			identityConnector.addVerificationMethod(
				TENANT_B,
				bootstrap.id,
				DidVerificationMethodType.AssertionMethod,
				"hijacked"
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.addVerificationMethodFailed",
			cause: {
				name: "UnauthorizedError",
				message: "entityStorageIdentityConnector.notController",
				properties: { documentId: bootstrap.id }
			}
		});
	});
});
