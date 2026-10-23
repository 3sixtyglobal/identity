// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthCategory, HealthStatus, type IHealth } from "@3sixty/api-models";
import { ContextIdKeys, ContextIdStore, type IContextIds } from "@3sixty/context";
import { RandomHelper } from "@3sixty/core";
import { Bip39 } from "@3sixty/crypto";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	EntityStorageIdentityResolverConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@3sixty/identity-connector-entity-storage";
import {
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { DidContexts, DidVerificationMethodType } from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { IdentityResolverService } from "../src/identityResolverService.js";
import { IdentityService } from "../src/identityService.js";

export const TEST_IDENTITY_ID = "test-identity";
export const TEST_CONTROLLER = "test-controller";

let vaultKeyEntityStorageConnector: MemoryEntityStorageConnector<VaultKey>;
let identityDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let vaultSecretEntityStorageConnector: MemoryEntityStorageConnector<VaultSecret>;

describe("IdentityService", () => {
	beforeAll(async () => {
		initSchemaVault();
		initSchemaIdentity();

		identityDocumentEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
			entitySchema: nameof<IdentityDocument>(),
			config: { storageKey: "identity-document" }
		});

		vaultKeyEntityStorageConnector = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-keys" }
		});

		vaultSecretEntityStorageConnector = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secrets" }
		});

		EntityStorageConnectorFactory.register(
			"identity-document",
			() => identityDocumentEntityStorage
		);
		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorageConnector);

		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		IdentityConnectorFactory.register("entity-storage", () => new EntityStorageIdentityConnector());
		// Caching disabled: the factory hands every test the same resolver instance, and these
		// tests assert that a mutation made through IdentityService is visible on the next
		// resolve. Resolution caching is covered in the connector's own cache spec.
		IdentityResolverConnectorFactory.register(
			"entity-storage",
			() => new EntityStorageIdentityResolverConnector({ config: { didResolutionCacheTtlMs: 0 } })
		);

		// Force the connector to be constructed now, so its LruCache's internal
		// RandomHelper.generate call doesn't consume a tick of the deterministic
		// mock installed in beforeEach below.
		IdentityConnectorFactory.get("entity-storage");
	});

	beforeEach(() => {
		let randomCounter = 1;
		RandomHelper.generate = vi
			.fn()
			.mockImplementation(length => new Uint8Array(length).fill(randomCounter++));

		Bip39.randomMnemonic = vi
			.fn()
			.mockImplementation(
				() =>
					"elder blur tip exact organ pipe other same minute grace conduct father brother prosper tide icon pony suggest joy provide dignity domain nominee liquid"
			);

		vi.useFakeTimers().setSystemTime(new Date("2020-01-01"));
	});

	afterAll(async () => {
		await identityDocumentEntityStorage.teardown();
		await vaultKeyEntityStorageConnector.teardown();
		await vaultSecretEntityStorageConnector.teardown();
	});

	test("Can create identity service", () => {
		const service = new IdentityService();

		expect(service).toBeDefined();
	});

	test("Can create an identity", async () => {
		const service = new IdentityService();

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);

		expect(identity).toEqual({
			"@context": DidContexts.Context,
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			service: [
				{
					id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#revocation",
					type: "BitstringStatusList",
					serviceEndpoint:
						"data:application/octet-stream;base64,H4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
				}
			]
		});
	});

	test("Can create a verification method", async () => {
		const service = new IdentityService();

		const verificationMethod = await service.verificationMethodCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			DidVerificationMethodType.AssertionMethod,
			undefined,
			TEST_CONTROLLER
		);

		expect(verificationMethod).toEqual({
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo",
			controller:
				"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			type: "JsonWebKey2020",
			publicKeyJwk: {
				alg: "EdDSA",
				kty: "OKP",
				crv: "Ed25519",
				x: "RM9uVI3LuYa2n3UG1dcZcVoVjCV5rvfLS_uf33sq2bM",
				kid: "hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo"
			}
		});

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.assertionMethod).toHaveLength(1);
	});

	test("Can remove a verification method", async () => {
		const service = new IdentityService();

		await service.verificationMethodRemove(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#hGHGs0DxLAWcgzx0QjTbzJc3PO-NMqSFAPcdgzx_qQo",
			undefined,
			TEST_CONTROLLER
		);

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.assertionMethod).toBeUndefined();
	});

	test("Can create a service", async () => {
		const service = new IdentityService();

		const createdService = await service.serviceCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			"linked-domain",
			"LinkedDomains",
			"https://bar.example.com/",
			TEST_CONTROLLER
		);

		expect(createdService).toEqual({
			id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#linked-domain",
			type: "LinkedDomains",
			serviceEndpoint: "https://bar.example.com/"
		});

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.service).toHaveLength(2);
	});

	test("Can remove a service", async () => {
		const service = new IdentityService();

		await service.serviceRemove(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#linked-domain",
			TEST_CONTROLLER
		);

		const resolverService = new IdentityResolverService();
		const document = await resolverService.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);
		expect(document.service).toHaveLength(1);
	});

	test("Can create a verifiable credential", async () => {
		const service = new IdentityService();

		const verificationMethod = await service.verificationMethodCreate(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
			DidVerificationMethodType.AssertionMethod,
			"my-id",
			TEST_CONTROLLER
		);

		const vc = await service.verifiableCredentialCreate(
			verificationMethod.id,
			"https://example.com/credentials/3732",
			{
				"@context": "https://schema.org",
				"@type": "Person",
				name: "Jane Doe"
			},
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		expect(vc).toEqual({
			verifiableCredential: {
				"@context": [
					"https://www.w3.org/2018/credentials/v1",
					"https://schema.org",
					"https://w3id.org/security/data-integrity/v2"
				],
				id: "https://example.com/credentials/3732",
				type: "VerifiableCredential",
				credentialSubject: {
					"@type": "Person",
					name: "Jane Doe"
				},
				issuer:
					"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101",
				issuanceDate: "2020-01-01T00:00:00.000Z",
				credentialStatus: {
					id: "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#revocation",
					type: "BitstringStatusList",
					revocationBitmapIndex: "5"
				},
				proof: {
					created: "2020-01-01T00:00:00.000Z",
					cryptosuite: "eddsa-jcs-2022",
					proofPurpose: "assertionMethod",
					proofValue:
						"z4PUfbrBmpdZ4VNKWm6zkS7cjn2a7Qu6TupNHo923zYTWcncr5h7uJwJL6EUJyhCBTTrfZYA9wrto39ggnFhfNkiG",
					type: "DataIntegrityProof",
					verificationMethod:
						"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101#my-id"
				}
			},
			jwt: "eyJraWQiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHgwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxI215LWlkIiwidHlwIjoiSldUIiwiYWxnIjoiRWREU0EifQ.eyJpc3MiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHgwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxIiwibmJmIjoxNTc3ODM2ODAwLCJqdGkiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWxzLzM3MzIiLCJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vc2NoZW1hLm9yZyJdLCJ0eXBlIjoiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJAdHlwZSI6IlBlcnNvbiIsIm5hbWUiOiJKYW5lIERvZSJ9LCJjcmVkZW50aWFsU3RhdHVzIjp7ImlkIjoiZGlkOmVudGl0eS1zdG9yYWdlOjB4MDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMSNyZXZvY2F0aW9uIiwidHlwZSI6IkJpdHN0cmluZ1N0YXR1c0xpc3QiLCJyZXZvY2F0aW9uQml0bWFwSW5kZXgiOiI1In19fQ.b2cSnHw-4Llz4hU4I-kbq7sKWVVqA-bDkMN1IuWxDcW7bLpvIozgADAELPxOukWDNFXOM1-ZByXz9Dwgj3HABg"
		});
	});

	describe("health checks", () => {
		// Each test needs its own buffer region because MemoryEntityStorageConnector uses
		// SharedObjectBuffer keyed by storageKey - instances sharing a key share data.
		let healthTestIndex = 0;

		beforeEach(() => {
			healthTestIndex++;
			const idx = healthTestIndex;

			const freshDocumentStorage = new MemoryEntityStorageConnector<IdentityDocument>({
				entitySchema: nameof<IdentityDocument>(),
				config: { storageKey: `identity-document-health-${idx}` }
			});
			const freshVaultKeyStorage = new MemoryEntityStorageConnector<VaultKey>({
				entitySchema: nameof<VaultKey>(),
				config: { storageKey: `vault-key-health-${idx}` }
			});
			const freshVaultSecretStorage = new MemoryEntityStorageConnector<VaultSecret>({
				entitySchema: nameof<VaultSecret>(),
				config: { storageKey: `vault-secret-health-${idx}` }
			});

			// Register fresh storages; vault connector captures them at construction time
			EntityStorageConnectorFactory.register("identity-document", () => freshDocumentStorage);
			EntityStorageConnectorFactory.register("vault-key", () => freshVaultKeyStorage);
			EntityStorageConnectorFactory.register("vault-secret", () => freshVaultSecretStorage);

			// Evict cached connector instances so new ones are created using the fresh storages
			VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());
			IdentityConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageIdentityConnector()
			);
			// Caching disabled: the health lifecycle resolves the temporary DID during
			// healthApplication and then asserts it is gone after healthApplicationTeardown, so
			// the second resolve has to reach storage.
			IdentityResolverConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageIdentityResolverConnector({ config: { didResolutionCacheTtlMs: 0 } })
			);
		});

		afterEach(() => {
			EntityStorageConnectorFactory.register(
				"identity-document",
				() => identityDocumentEntityStorage
			);
			EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorageConnector);
			EntityStorageConnectorFactory.register(
				"vault-secret",
				() => vaultSecretEntityStorageConnector
			);

			// Evict cached connector instances so they are recreated with the original storages
			VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());
			IdentityConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageIdentityConnector()
			);
			IdentityResolverConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageIdentityResolverConnector({ config: { didResolutionCacheTtlMs: 0 } })
			);
		});

		test("healthApplication returns application ok after full lifecycle", async () => {
			const service = new IdentityService();

			const tempOrgDoc = await service.identityCreate(undefined, TEST_CONTROLLER);
			const initContextIds: IContextIds = { [ContextIdKeys.Organization]: tempOrgDoc.id };
			await service.healthApplicationInit(initContextIds);

			expect(initContextIds[ContextIdKeys.Organization]).toBeDefined();

			const combinedContextIds = { ...initContextIds };
			let results: IHealth[] = [];
			await ContextIdStore.run(combinedContextIds, async () => {
				results = (await service.healthApplication(async () => {})) ?? [];
			});

			expect(results).toHaveLength(1);
			expect(results[0].category).toEqual(HealthCategory.Application);
			expect(results[0].status).toEqual(HealthStatus.Ok);
		});

		test("healthApplicationTeardown removes the DID created in healthApplicationInit", async () => {
			const service = new IdentityService();

			const tempOrgDoc = await service.identityCreate(undefined, TEST_CONTROLLER);

			// The wallet service normally leaves the temporary controller's mnemonic in the vault,
			// which healthApplicationInit migrates to the new document id. Without it the init
			// bails part way through and never reaches the context id swap.
			await VaultConnectorFactory.get("vault").setSecret(
				`${tempOrgDoc.id}/mnemonic`,
				Bip39.randomMnemonic()
			);

			const initContextIds: IContextIds = { [ContextIdKeys.Organization]: tempOrgDoc.id };
			await service.healthApplicationInit(initContextIds);

			const orgDid = initContextIds[ContextIdKeys.Organization];
			expect(orgDid).toBeDefined();
			expect(orgDid).not.toEqual(tempOrgDoc.id);

			const combinedContextIds = { ...initContextIds };
			await ContextIdStore.run(combinedContextIds, async () => {
				await service.healthApplication(async () => {});
				await service.healthApplicationTeardown();
			});

			const resolverConnector = IdentityResolverConnectorFactory.get("entity-storage");
			await expect(resolverConnector.resolveDocument(orgDid ?? "")).rejects.toThrow();

			// The caller's own document, which the health check did not create, is left alone.
			await expect(resolverConnector.resolveDocument(tempOrgDoc.id)).resolves.toBeDefined();
		});

		test("healthApplication returns error when healthApplicationInit has not run", async () => {
			const service = new IdentityService();

			let results: IHealth[] = [];
			await ContextIdStore.run({}, async () => {
				results = (await service.healthApplication(async () => {})) ?? [];
			});

			expect(results).toHaveLength(1);
			expect(results[0].status).toEqual(HealthStatus.Error);
		});
	});
});
