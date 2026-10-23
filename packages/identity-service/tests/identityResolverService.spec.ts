// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
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
import { DidContexts } from "@3sixty/standards-w3c-did";
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

describe("IdentityResolverService", () => {
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
		IdentityResolverConnectorFactory.register(
			"entity-storage",
			() => new EntityStorageIdentityResolverConnector()
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

	test("Can create identity resolver service", () => {
		const service = new IdentityResolverService();

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

	test("Can resolve an identity", async () => {
		const service = new IdentityResolverService();

		const identity = await service.identityResolve(
			"did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101"
		);

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
});
