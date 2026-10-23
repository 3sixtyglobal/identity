// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests that a verification method is removed from the relationship array that actually holds it.
 *
 * getAllMethods flattens the six relationship arrays into one list, and an index taken from that
 * flat list does not address the per-relationship array it came from. With an earlier array
 * non-empty the removal used to report success while leaving the target published, or take out a
 * sibling instead.
 *
 * Also covers the revocation index range guard, since an index outside the bitmap was accepted at
 * issue time and then threw on every later revocation check.
 */
import { Is } from "@3sixty/core";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import { DidVerificationMethodType, type IDidDocument } from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { EntityStorageIdentityResolverConnector } from "../src/entityStorageIdentityResolverConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TEST_CONTROLLER = "test-controller";

// Matches _REVOCATION_BITS_SIZE on the connector.
const REVOCATION_BITS_SIZE = 131072;

let identityConnector: EntityStorageIdentityConnector;
let identityResolverConnector: EntityStorageIdentityResolverConnector;
let documentId: string;

/**
 * Collect the ids held in a relationship array.
 * @param document The document to read.
 * @param methodType The relationship to read.
 * @returns The method ids in that relationship.
 */
function methodIds(document: IDidDocument, methodType: DidVerificationMethodType): string[] {
	return (document[methodType] ?? []).map(m => (Is.string(m) ? m : m.id));
}

describe("EntityStorageIdentityConnector - verification method removal", () => {
	beforeEach(async () => {
		initSchemaVault();
		initSchemaIdentity();
		SchemaOrgDataTypes.registerRedirects();

		EntityStorageConnectorFactory.register(
			"identity-document",
			() =>
				new MemoryEntityStorageConnector<IdentityDocument>({
					entitySchema: nameof<IdentityDocument>(),
					config: { storageKey: "identity-document" }
				})
		);
		EntityStorageConnectorFactory.register(
			"vault-key",
			() =>
				new MemoryEntityStorageConnector<VaultKey>({
					entitySchema: nameof<VaultKey>(),
					config: { storageKey: "vault-keys" }
				})
		);
		EntityStorageConnectorFactory.register(
			"vault-secret",
			() =>
				new MemoryEntityStorageConnector<VaultSecret>({
					entitySchema: nameof<VaultSecret>(),
					config: { storageKey: "vault-secret" }
				})
		);
		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		identityConnector = new EntityStorageIdentityConnector();
		identityResolverConnector = new EntityStorageIdentityResolverConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});

		documentId = (await identityConnector.createDocument(TEST_CONTROLLER)).id;

		// An earlier non-empty relationship is what makes the flat index disagree with the
		// per-relationship index.
		await identityConnector.addVerificationMethod(
			TEST_CONTROLLER,
			documentId,
			DidVerificationMethodType.Authentication,
			"auth-1"
		);
		await identityConnector.addVerificationMethod(
			TEST_CONTROLLER,
			documentId,
			DidVerificationMethodType.AssertionMethod,
			"as-1"
		);
		await identityConnector.addVerificationMethod(
			TEST_CONTROLLER,
			documentId,
			DidVerificationMethodType.AssertionMethod,
			"as-2"
		);
	});

	test("removes the named method rather than a sibling in the same relationship", async () => {
		await identityConnector.removeVerificationMethod(TEST_CONTROLLER, `${documentId}#as-1`);

		const document = await identityResolverConnector.resolveDocument(documentId);

		expect(methodIds(document, DidVerificationMethodType.AssertionMethod)).toEqual([
			`${documentId}#as-2`
		]);
		expect(methodIds(document, DidVerificationMethodType.Authentication)).toEqual([
			`${documentId}#auth-1`
		]);
	});

	test("a credential signed with a removed method no longer verifies", async () => {
		const credential = await identityConnector.createVerifiableCredential(
			TEST_CONTROLLER,
			`${documentId}#as-1`,
			"https://example.com/credentials/removed-method",
			{ "@context": "https://schema.org", "@type": "Person", name: "Test Subject" }
		);

		await identityConnector.removeVerificationMethod(TEST_CONTROLLER, `${documentId}#as-1`);

		await expect(identityConnector.checkVerifiableCredential(credential.jwt)).rejects.toMatchObject(
			{
				name: "GeneralError",
				message: "entityStorageIdentityConnector.checkingVerifiableCredentialFailed"
			}
		);
	});

	test("removes a method held in an earlier relationship without disturbing the later one", async () => {
		await identityConnector.removeVerificationMethod(TEST_CONTROLLER, `${documentId}#auth-1`);

		const document = await identityResolverConnector.resolveDocument(documentId);

		expect(document[DidVerificationMethodType.Authentication]).toBeUndefined();
		expect(methodIds(document, DidVerificationMethodType.AssertionMethod)).toEqual([
			`${documentId}#as-1`,
			`${documentId}#as-2`
		]);
	});

	test("replacing a method updates it in place rather than removing a sibling", async () => {
		await identityConnector.addVerificationMethod(
			TEST_CONTROLLER,
			documentId,
			DidVerificationMethodType.AssertionMethod,
			"as-1"
		);

		const document = await identityResolverConnector.resolveDocument(documentId);

		expect(methodIds(document, DidVerificationMethodType.AssertionMethod).sort()).toEqual([
			`${documentId}#as-1`,
			`${documentId}#as-2`
		]);
		expect(methodIds(document, DidVerificationMethodType.Authentication)).toEqual([
			`${documentId}#auth-1`
		]);
	});

	test("removing an unknown method is reported as not found", async () => {
		await expect(
			identityConnector.removeVerificationMethod(TEST_CONTROLLER, `${documentId}#missing`)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.removeVerificationMethodFailed",
			cause: {
				name: "NotFoundError",
				message: "entityStorageIdentityConnector.verificationMethodNotFound"
			}
		});
	});

	test("a revocation index outside the bitmap is refused at issue time", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_CONTROLLER,
				`${documentId}#as-1`,
				"https://example.com/credentials/out-of-range",
				{ "@context": "https://schema.org", "@type": "Person", name: "Test Subject" },
				{ revocationIndex: REVOCATION_BITS_SIZE }
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.revocationIndexOutOfRange",
			properties: { revocationIndex: REVOCATION_BITS_SIZE, maxIndex: REVOCATION_BITS_SIZE - 1 }
		});
	});

	test("a negative revocation index is refused at issue time", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_CONTROLLER,
				`${documentId}#as-1`,
				"https://example.com/credentials/negative",
				{ "@context": "https://schema.org", "@type": "Person", name: "Test Subject" },
				{ revocationIndex: -1 }
			)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.revocationIndexOutOfRange"
		});
	});

	test("the highest in range revocation index is still accepted and revocable", async () => {
		const revocationIndex = REVOCATION_BITS_SIZE - 1;

		const credential = await identityConnector.createVerifiableCredential(
			TEST_CONTROLLER,
			`${documentId}#as-1`,
			"https://example.com/credentials/in-range",
			{ "@context": "https://schema.org", "@type": "Person", name: "Test Subject" },
			{ revocationIndex }
		);

		const before = await identityConnector.checkVerifiableCredential(credential.jwt);
		expect(before.revoked).toBeFalsy();

		await identityConnector.revokeVerifiableCredentials(TEST_CONTROLLER, documentId, [
			revocationIndex
		]);

		const after = await identityConnector.checkVerifiableCredential(credential.jwt);
		expect(after.revoked).toBeTruthy();
	});
});
