// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IHttpRequestContext } from "@3sixty/api-models";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { ComponentFactory, ObjectHelper } from "@3sixty/core";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@3sixty/identity-connector-entity-storage";
import { IdentityConnectorFactory, type IIdentityExport } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { DidVerificationMethodType, ProofTypes } from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import {
	generateRestRoutesIdentity,
	identityExport,
	identityImport,
	identityRemove
} from "../src/identityRoutes.js";
import { IdentityService } from "../src/identityService.js";

const TEST_CONTROLLER = "test-controller";
const TEST_DATA = {
	"@context": "https://schema.org",
	type: "Person",
	name: "Jane Doe"
};

describe("IdentityService export and import", () => {
	let identityDocStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let vaultKeyStorage: MemoryEntityStorageConnector<VaultKey>;
	let vaultSecretStorage: MemoryEntityStorageConnector<VaultSecret>;
	let service: IdentityService;

	/**
	 * Create an identity with an assertion method.
	 * @returns The DID and the method id.
	 */
	async function createIdentity(): Promise<{ did: string; methodId: string }> {
		const document = await service.identityCreate(undefined, TEST_CONTROLLER);
		const method = await service.verificationMethodCreate(
			document.id,
			DidVerificationMethodType.AssertionMethod,
			"assertion-key",
			TEST_CONTROLLER
		);
		return { did: document.id, methodId: method.id };
	}

	beforeAll(() => {
		initSchemaVault();
		initSchemaIdentity();
	});

	beforeEach(() => {
		identityDocStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>(),
			config: { storageKey: "identity-document" }
		});
		vaultKeyStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-key" }
		});
		vaultSecretStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secret" }
		});

		EntityStorageConnectorFactory.register("identity-document", () => identityDocStorage);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretStorage);
		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());
		IdentityConnectorFactory.register(
			"entity-storage",
			() => new EntityStorageIdentityConnector({ config: { didResolutionCacheTtlMs: 0 } })
		);

		service = new IdentityService();
	});

	afterEach(async () => {
		await identityDocStorage.teardown();
		await vaultKeyStorage.teardown();
		await vaultSecretStorage.teardown();
	});

	test("can round trip export, remove, import, then sign and verify", async () => {
		const { did, methodId } = await createIdentity();

		const exported = await service.identityExport(did, TEST_CONTROLLER);
		expect(exported.namespace).toEqual("entity-storage");
		expect(exported.keys.map(k => k.id)).toEqual(["did", "assertion-key"]);

		await service.identityRemove(
			did,
			{ removeKeys: true, removeDocumentKey: true },
			TEST_CONTROLLER
		);
		await expect(
			service.proofCreate(methodId, ProofTypes.DataIntegrityProof, TEST_DATA, TEST_CONTROLLER)
		).rejects.toBeDefined();

		const document = await service.identityImport(exported, TEST_CONTROLLER);
		expect(document.id).toEqual(did);

		const proof = await service.proofCreate(
			methodId,
			ProofTypes.DataIntegrityProof,
			TEST_DATA,
			TEST_CONTROLLER
		);
		expect(await service.proofVerify(TEST_DATA, proof)).toEqual(true);
	});

	test("can round trip a self-controlled identity without a controller", async () => {
		const document = await service.identityCreate(undefined, undefined, { selfControlled: true });
		const exported = await service.identityExport(document.id, document.id);
		expect(exported.selfControlled).toEqual(true);

		await service.identityRemove(
			document.id,
			{ removeKeys: true, removeDocumentKey: true },
			document.id
		);

		const imported = await service.identityImport(exported);
		expect(imported.id).toEqual(document.id);
	});

	test("can fail to export without a controller", async () => {
		const { did } = await createIdentity();
		await expect(service.identityExport(did)).rejects.toMatchObject({
			name: "GuardError",
			properties: { property: "controller" }
		});
	});

	test("can fail to export an identity which is not a DID", async () => {
		await expect(service.identityExport("urn:foo:bar", TEST_CONTROLLER)).rejects.toMatchObject({
			name: "GeneralError",
			message: "identityService.identityExportFailed",
			cause: { message: "identityService.namespaceMismatch" }
		});
	});

	test("can fail to import without a controller when not self-controlled", async () => {
		const { did } = await createIdentity();
		const exported = await service.identityExport(did, TEST_CONTROLLER);
		await expect(service.identityImport(exported)).rejects.toMatchObject({
			name: "GuardError",
			properties: { property: "controller" }
		});
	});

	test("can fail to import an export which is not an object without echoing it", async () => {
		const secret = "c2VjcmV0LWtleS1tYXRlcmlhbA==";
		try {
			await service.identityImport(secret as unknown as IIdentityExport, TEST_CONTROLLER);
			expect.fail("import should have failed");
		} catch (error) {
			expect(error).toMatchObject({ message: "identityService.invalidExport" });
			expect(JSON.stringify(error)).not.toContain(secret);
		}
	});

	test("can fail to import a namespace with no connector", async () => {
		const { did } = await createIdentity();
		const exported = await service.identityExport(did, TEST_CONTROLLER);
		await expect(
			service.identityImport({ ...exported, namespace: "iota" }, TEST_CONTROLLER)
		).rejects.toMatchObject({
			message: "identityService.identityImportFailed",
			cause: { message: "identityService.connectorNotFound" }
		});
	});

	test("can fail to import an identity which already exists", async () => {
		const { did } = await createIdentity();
		const exported = await service.identityExport(did, TEST_CONTROLLER);
		await expect(service.identityImport(exported, TEST_CONTROLLER)).rejects.toMatchObject({
			message: "identityService.identityImportFailed",
			cause: {
				message: "entityStorageIdentityConnector.importDocumentFailed",
				cause: { name: "ConflictError" }
			}
		});
	});

	test("can fail to import a mismatched key", async () => {
		const { did } = await createIdentity();
		const exported = await service.identityExport(did, TEST_CONTROLLER);
		await service.identityRemove(
			did,
			{ removeKeys: true, removeDocumentKey: true },
			TEST_CONTROLLER
		);

		const tampered = ObjectHelper.clone(exported);
		tampered.keys[1].publicKey = tampered.keys[0].publicKey;
		tampered.keys[1].privateKey = tampered.keys[0].privateKey;

		await expect(service.identityImport(tampered, TEST_CONTROLLER)).rejects.toMatchObject({
			cause: { cause: { message: "identityExportHelper.methodKeyMismatch" } }
		});
	});

	test("can fail to import a bad version", async () => {
		const { did } = await createIdentity();
		const exported = await service.identityExport(did, TEST_CONTROLLER);
		await expect(
			service.identityImport({ ...exported, version: 2 }, TEST_CONTROLLER)
		).rejects.toMatchObject({
			cause: { cause: { message: "identityExportHelper.unsupportedVersion" } }
		});
	});

	test("routes use their own permission and pass the organization as controller", async () => {
		const routes = generateRestRoutesIdentity("identity", "identity");
		const exportRoute = routes.find(r => r.operationId === "identityExport");
		const importRoute = routes.find(r => r.operationId === "identityImport");
		expect(exportRoute?.defaultAuthorization?.permission).toEqual("identity:keys");
		expect(importRoute?.defaultAuthorization?.permission).toEqual("identity:keys");
		expect(exportRoute?.path).toEqual("identity/:identity/export");
		expect(importRoute?.path).toEqual("identity/import");

		ComponentFactory.register("identity", () => service);
		const { did, methodId } = await createIdentity();

		await ContextIdStore.run({ [ContextIdKeys.Organization]: TEST_CONTROLLER }, async () => {
			const exportResponse = await identityExport({} as IHttpRequestContext, "identity", {
				pathParams: { identity: did }
			});
			expect(exportResponse.body.document.id).toEqual(did);
			expect(exportResponse.headers?.["cache-control"]).toEqual("no-store");

			await service.identityRemove(
				did,
				{ removeKeys: true, removeDocumentKey: true },
				TEST_CONTROLLER
			);

			const importResponse = await identityImport({} as IHttpRequestContext, "identity", {
				body: exportResponse.body
			});
			expect(importResponse.body.id).toEqual(did);
		});

		const proof = await service.proofCreate(
			methodId,
			ProofTypes.DataIntegrityProof,
			TEST_DATA,
			TEST_CONTROLLER
		);
		expect(await service.proofVerify(TEST_DATA, proof)).toEqual(true);
	});

	test("the remove route passes retainDocument through to the service", async () => {
		ComponentFactory.register("identity", () => service);
		const removeSpy = vi.spyOn(service, "identityRemove");
		const { did } = await createIdentity();

		await ContextIdStore.run({ [ContextIdKeys.Organization]: TEST_CONTROLLER }, async () => {
			await identityRemove({} as IHttpRequestContext, "identity", {
				pathParams: { identity: did },
				query: { removeKeys: "true", retainDocument: "true" }
			});
		});

		expect(removeSpy).toHaveBeenCalledWith(
			did,
			{ removeKeys: true, removeDocumentKey: undefined, retainDocument: true },
			TEST_CONTROLLER
		);
		removeSpy.mockRestore();
	});
});
