// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { ComponentFactory, Converter, JsonHelper, ObjectHelper } from "@3sixty/core";
import { Ed25519 } from "@3sixty/crypto";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import type { IIdentityExport } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import { ProofTypes } from "@3sixty/standards-w3c-did";
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

const TEST_CONTROLLER = "test-controller";
const TEST_DATA = {
	"@context": "https://schema.org",
	type: "Person",
	name: "Jane Doe"
};

describe("EntityStorageIdentityConnector export and import", () => {
	let identityConnector: EntityStorageIdentityConnector;
	let vaultConnector: EntityStorageVaultConnector;
	let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let vaultKeyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
	let vaultSecretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

	/**
	 * Create a document with an assertion method and export it.
	 * @param selfControlled Create the document controlled by its own DID.
	 * @returns The export and the method id.
	 */
	async function createAndExport(
		selfControlled: boolean = false
	): Promise<{ exported: IIdentityExport; methodId: string; controller: string }> {
		const document = await identityConnector.createDocument(
			selfControlled ? undefined : TEST_CONTROLLER,
			{ selfControlled }
		);
		const controller = selfControlled ? document.id : TEST_CONTROLLER;
		const method = await identityConnector.addVerificationMethod(
			controller,
			document.id,
			"assertionMethod",
			"assertion-key"
		);
		const exported = await identityConnector.exportDocument(controller, document.id);
		return { exported, methodId: method.id, controller };
	}

	/**
	 * Remove a document and all its keys from this node.
	 * @param controller The controller of the document.
	 * @param documentId The document to remove.
	 */
	async function removeAll(controller: string, documentId: string): Promise<void> {
		await identityConnector.removeDocument(controller, documentId, {
			removeKeys: true,
			removeDocumentKey: true
		});
	}

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

		identityConnector = new EntityStorageIdentityConnector({
			config: { didResolutionCacheTtlMs: 0 }
		});
	});

	afterEach(async () => {
		await didDocumentEntityStorage.teardown();
		await vaultKeyEntityStorage.teardown();
		await vaultSecretEntityStorage.teardown();
	});

	test("can export a document with its keys", async () => {
		const { exported, methodId } = await createAndExport();

		expect(exported.version).toEqual(1);
		expect(exported.namespace).toEqual("entity-storage");
		expect(exported.selfControlled).toEqual(false);
		expect(exported.documentSignature).toBeDefined();
		expect(exported.account).toBeUndefined();
		expect(exported.keys.map(k => k.id)).toEqual(["did", "assertion-key"]);
		expect(exported.keys.every(k => k.type === "Ed25519")).toEqual(true);

		const vaultKey = await vaultConnector.getKey(methodId.replace("#", "/"));
		expect(exported.keys[1].privateKey).toEqual(
			Converter.bytesToBase64(vaultKey.privateKey ?? new Uint8Array())
		);
		expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
	});

	test("can fail to export a document for another controller", async () => {
		const { exported } = await createAndExport();

		await expect(
			identityConnector.exportDocument("other-controller", exported.document.id)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.exportDocumentFailed",
			cause: {
				name: "UnauthorizedError",
				message: "entityStorageIdentityConnector.notController"
			}
		});
	});

	test("can fail to export a document which does not exist", async () => {
		await expect(
			identityConnector.exportDocument(TEST_CONTROLLER, "did:entity-storage:0x1234")
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.exportDocumentFailed",
			cause: { name: "NotFoundError" }
		});
	});

	test("can round trip export, remove, import, then sign and verify", async () => {
		const { exported, methodId, controller } = await createAndExport();
		const proofBefore = await identityConnector.createProof(
			controller,
			methodId,
			ProofTypes.DataIntegrityProof,
			TEST_DATA
		);

		await removeAll(controller, exported.document.id);
		expect(await vaultConnector.keyExists(`${exported.document.id}/did`)).toEqual(false);
		expect(await vaultConnector.keyExists(methodId.replace("#", "/"))).toEqual(false);

		const imported = await identityConnector.importDocument(controller, exported);
		expect(imported).toEqual(exported.document);

		expect(await identityConnector.verifyProof(TEST_DATA, proofBefore)).toEqual(true);

		const proofAfter = await identityConnector.createProof(
			controller,
			methodId,
			ProofTypes.DataIntegrityProof,
			TEST_DATA
		);
		expect(await identityConnector.verifyProof(TEST_DATA, proofAfter)).toEqual(true);

		// The imported document can be changed by its controller again.
		await identityConnector.addVerificationMethod(
			controller,
			exported.document.id,
			"authentication",
			"after-import"
		);

		const reExported = await identityConnector.exportDocument(controller, exported.document.id);
		expect(reExported.keys).toEqual(expect.arrayContaining(exported.keys));
		expect(reExported.keys.map(k => k.id)).toContain("after-import");
	});

	test("can round trip a self-controlled document", async () => {
		const { exported, methodId } = await createAndExport(true);
		expect(exported.selfControlled).toEqual(true);

		await removeAll(exported.document.id, exported.document.id);

		await identityConnector.importDocument(undefined, exported);
		const stored = await didDocumentEntityStorage.get(exported.document.id);
		expect(stored?.controller).toEqual(exported.document.id);

		const proof = await identityConnector.createProof(
			exported.document.id,
			methodId,
			ProofTypes.DataIntegrityProof,
			TEST_DATA
		);
		expect(await identityConnector.verifyProof(TEST_DATA, proof)).toEqual(true);
	});

	test("can import a document under a new controller", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		await identityConnector.importDocument("new-controller", exported);

		const stored = await didDocumentEntityStorage.get(exported.document.id);
		expect(stored?.controller).toEqual("new-controller");
	});

	test("can fail to import without a controller when not self-controlled", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		await expect(identityConnector.importDocument(undefined, exported)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.importDocumentFailed",
			cause: { name: "GuardError" }
		});
	});

	test("can fail to import a document which already exists and leaves it untouched", async () => {
		const { exported, methodId } = await createAndExport();
		const vaultKeyBefore = await vaultConnector.getKey(methodId.replace("#", "/"));

		await expect(identityConnector.importDocument(TEST_CONTROLLER, exported)).rejects.toMatchObject(
			{
				name: "GeneralError",
				message: "entityStorageIdentityConnector.importDocumentFailed",
				cause: {
					name: "ConflictError",
					message: "entityStorageIdentityConnector.documentAlreadyExists"
				}
			}
		);

		const vaultKeyAfter = await vaultConnector.getKey(methodId.replace("#", "/"));
		expect(vaultKeyAfter).toEqual(vaultKeyBefore);
		expect(await didDocumentEntityStorage.get(exported.document.id)).toBeDefined();
	});

	test("can fail to import when a key already exists in the vault and does not remove it", async () => {
		const { exported, methodId } = await createAndExport();
		await identityConnector.removeDocument(TEST_CONTROLLER, exported.document.id, {
			removeDocumentKey: true
		});

		await expect(identityConnector.importDocument(TEST_CONTROLLER, exported)).rejects.toMatchObject(
			{
				name: "GeneralError",
				message: "entityStorageIdentityConnector.importDocumentFailed",
				cause: {
					name: "ConflictError",
					message: "entityStorageIdentityConnector.keyAlreadyExists",
					properties: { conflicts: ["assertion-key"] }
				}
			}
		);

		expect(await vaultConnector.keyExists(methodId.replace("#", "/"))).toEqual(true);
		expect(await vaultConnector.keyExists(`${exported.document.id}/did`)).toEqual(false);
		expect(await didDocumentEntityStorage.get(exported.document.id)).toBeUndefined();
	});

	test("can fail to import an unsupported version", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		await expect(
			identityConnector.importDocument(TEST_CONTROLLER, { ...exported, version: 2 })
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.importDocumentFailed",
			cause: { message: "identityExportHelper.unsupportedVersion" }
		});
	});

	test("can fail to import an export for another namespace", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		await expect(
			identityConnector.importDocument(TEST_CONTROLLER, { ...exported, namespace: "iota" })
		).rejects.toMatchObject({
			cause: { message: "identityExportHelper.namespaceMismatch" }
		});
	});

	test("can fail to import a verification method key from a different key pair", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const foreignPrivate = new Uint8Array(32).fill(9);
		const tampered = ObjectHelper.clone(exported);
		tampered.keys[1].privateKey = Converter.bytesToBase64(foreignPrivate);
		tampered.keys[1].publicKey = Converter.bytesToBase64(
			Ed25519.publicKeyFromPrivateKey(foreignPrivate)
		);

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: {
					message: "identityExportHelper.methodKeyMismatch",
					properties: { keyId: "assertion-key" }
				}
			}
		);
		expect(await vaultConnector.keyExists(`${exported.document.id}/did`)).toEqual(false);
	});

	test("can fail to import a private key which does not match its public key", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.keys[1].privateKey = Converter.bytesToBase64(new Uint8Array(32).fill(9));

		try {
			await identityConnector.importDocument(TEST_CONTROLLER, tampered);
			expect.fail("import should have failed");
		} catch (error) {
			expect(error).toMatchObject({
				cause: {
					message: "entityStorageIdentityConnector.keyPairMismatch",
					properties: { keyId: "assertion-key" }
				}
			});
			const serialised = JSON.stringify(error);
			for (const key of tampered.keys) {
				expect(serialised).not.toContain(key.privateKey);
			}
		}
	});

	test("can fail to import a document which was changed after signing", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.document.alsoKnownAs = ["did:example:attacker"];

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "entityStorageIdentityConnector.signatureVerificationFailed" }
			}
		);
	});

	test("can fail to import a document signed by a foreign document key", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const foreignPrivate = new Uint8Array(32).fill(5);
		const tampered = ObjectHelper.clone(exported);
		tampered.keys[0].privateKey = Converter.bytesToBase64(foreignPrivate);
		tampered.keys[0].publicKey = Converter.bytesToBase64(
			Ed25519.publicKeyFromPrivateKey(foreignPrivate)
		);

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "entityStorageIdentityConnector.signatureVerificationFailed" }
			}
		);
	});

	test("can fail to import without the document key", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.keys = tampered.keys.filter(k => k.id !== "did");

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "entityStorageIdentityConnector.documentKeyMissing" }
			}
		);
	});

	test("removes everything written when an import fails part way", async () => {
		const { exported, methodId } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const storageSet = didDocumentEntityStorage.set.bind(didDocumentEntityStorage);
		didDocumentEntityStorage.set = vi.fn().mockRejectedValueOnce(new Error("storage failed"));

		await expect(identityConnector.importDocument(TEST_CONTROLLER, exported)).rejects.toMatchObject(
			{
				message: "entityStorageIdentityConnector.importDocumentFailed"
			}
		);
		didDocumentEntityStorage.set = storageSet;

		expect(await vaultConnector.keyExists(`${exported.document.id}/did`)).toEqual(false);
		expect(await vaultConnector.keyExists(methodId.replace("#", "/"))).toEqual(false);
		expect(await didDocumentEntityStorage.get(exported.document.id)).toBeUndefined();

		await identityConnector.importDocument(TEST_CONTROLLER, exported);
		expect(await didDocumentEntityStorage.get(exported.document.id)).toBeDefined();
	});

	test("logs a warning for each step of a failed import which can not be undone", async () => {
		const log = vi.fn();
		ComponentFactory.register("export-test-logging", () => ({ className: () => "Logging", log }));
		const loggingConnector = new EntityStorageIdentityConnector({
			loggingComponentType: "export-test-logging",
			config: { didResolutionCacheTtlMs: 0 }
		});

		const { exported, methodId } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const storageSet = didDocumentEntityStorage.set.bind(didDocumentEntityStorage);
		didDocumentEntityStorage.set = vi.fn().mockRejectedValueOnce(new Error("storage failed"));
		const removeKey = vaultConnector.removeKey.bind(vaultConnector);
		const methodVaultKey = methodId.replace("#", "/");
		vaultConnector.removeKey = vi.fn(async (name: string) => {
			if (name === methodVaultKey) {
				throw new Error("vault failed");
			}
			return removeKey(name);
		});

		await expect(loggingConnector.importDocument(TEST_CONTROLLER, exported)).rejects.toMatchObject({
			message: "entityStorageIdentityConnector.importDocumentFailed"
		});
		didDocumentEntityStorage.set = storageSet;
		vaultConnector.removeKey = removeKey;
		ComponentFactory.unregister("export-test-logging");

		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "warn",
				source: EntityStorageIdentityConnector.CLASS_NAME,
				message: "importRollbackFailed",
				data: { documentId: exported.document.id, name: methodVaultKey }
			})
		);
		expect(JSON.stringify(log.mock.calls)).not.toContain(exported.keys[0].privateKey);
	});

	/**
	 * Re-sign a changed document with the document key from its export.
	 * @param exported The export to update.
	 */
	function resign(exported: IIdentityExport): void {
		const documentKey = exported.keys.find(k => k.id === "did");
		exported.documentSignature = Converter.bytesToBase64(
			Ed25519.sign(
				Converter.base64ToBytes(documentKey?.privateKey ?? ""),
				Converter.utf8ToBytes(JsonHelper.canonicalize(exported.document))
			)
		);
	}

	test("can fail to import a DID which is not in the format the connector creates", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.document.id = "did:entity-storage:0xABC";

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "identityExportHelper.invalidDidFormat" }
			}
		);
	});

	test("can fail to import a method fragment which could escape the vault key name", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.document.authentication = [`${exported.document.id}#../other`];
		resign(tampered);

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "identityExportHelper.invalidMethodId" }
			}
		);
	});

	test("can fail to import a method without its key", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.keys = tampered.keys.filter(k => k.id !== "assertion-key");

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: {
					message: "identityExportHelper.methodKeyMissing",
					properties: { keyId: "assertion-key" }
				}
			}
		);
		expect(await vaultConnector.keyExists(`${exported.document.id}/did`)).toEqual(false);
	});

	test("can fail to import when the document key already exists in the vault", async () => {
		const { exported } = await createAndExport();
		await identityConnector.removeDocument(TEST_CONTROLLER, exported.document.id, {
			removeKeys: true
		});

		await expect(identityConnector.importDocument(TEST_CONTROLLER, exported)).rejects.toMatchObject(
			{
				cause: {
					name: "ConflictError",
					properties: { conflicts: ["did"] }
				}
			}
		);
		expect(await vaultConnector.keyExists(`${exported.document.id}/assertion-key`)).toEqual(false);
	});

	test("can fail to import more keys than the maximum", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		for (let i = 0; i < 64; i++) {
			tampered.keys.push({ ...tampered.keys[1], id: `extra-${i}` });
		}

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "identityExportHelper.tooManyKeys" }
			}
		);
	});

	test("can fail to import a document larger than the maximum", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const tampered = ObjectHelper.clone(exported);
		tampered.document.alsoKnownAs = [`did:example:${"a".repeat(65536)}`];

		await expect(identityConnector.importDocument(TEST_CONTROLLER, tampered)).rejects.toMatchObject(
			{
				cause: { message: "identityExportHelper.documentTooLarge" }
			}
		);
	});

	test("only one of two concurrent imports of the same identity succeeds", async () => {
		const { exported } = await createAndExport();
		await removeAll(TEST_CONTROLLER, exported.document.id);

		const results = await Promise.allSettled([
			identityConnector.importDocument(TEST_CONTROLLER, exported),
			identityConnector.importDocument(TEST_CONTROLLER, exported)
		]);

		expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find(r => r.status === "rejected");
		expect(rejected?.reason).toMatchObject({ cause: { name: "ConflictError" } });
		expect(await didDocumentEntityStorage.get(exported.document.id)).toBeDefined();
		expect(await vaultConnector.keyExists(`${exported.document.id}/assertion-key`)).toEqual(true);
	});

	test("can fail to export a document whose method key is missing", async () => {
		const { exported, methodId } = await createAndExport();
		await vaultConnector.removeKey(methodId.replace("#", "/"));

		await expect(
			identityConnector.exportDocument(TEST_CONTROLLER, exported.document.id)
		).rejects.toMatchObject({
			message: "entityStorageIdentityConnector.exportDocumentFailed",
			cause: {
				message: "entityStorageIdentityConnector.exportKeyFailed",
				properties: { keyId: "assertion-key" }
			}
		});
	});

	test("can fail to export a document with a fragment which could not be imported", async () => {
		const { exported } = await createAndExport();
		const stored = await didDocumentEntityStorage.get(exported.document.id);
		if (stored) {
			stored.document.authentication = [`${exported.document.id}#bad fragment`];
			const documentKey = await vaultConnector.getKey(`${exported.document.id}/did`);
			stored.signature = Converter.bytesToBase64(
				Ed25519.sign(
					documentKey.privateKey ?? new Uint8Array(),
					Converter.utf8ToBytes(JsonHelper.canonicalize(stored.document))
				)
			);
			await didDocumentEntityStorage.set(stored);
		}

		await expect(
			identityConnector.exportDocument(TEST_CONTROLLER, exported.document.id)
		).rejects.toMatchObject({
			cause: { message: "identityExportHelper.invalidMethodId" }
		});
	});
});
