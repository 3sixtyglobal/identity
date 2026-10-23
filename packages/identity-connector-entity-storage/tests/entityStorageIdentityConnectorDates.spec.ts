// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory } from "@3sixty/entity";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import type { IdentityDocumentV0 } from "../src/entities/identityDocumentV0.js";
import type { IdentityProfile } from "../src/entities/identityProfile.js";
import type { IdentityProfileV0 } from "../src/entities/identityProfileV0.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const TEST_CONTROLLER = "test-controller";
const CREATED_TIME = Date.UTC(2026, 0, 1);
const MODIFIED_TIME = Date.UTC(2026, 0, 2);

let didDocumentEntityStorage: MemoryEntityStorageConnector<IdentityDocument>;
let identityConnector: EntityStorageIdentityConnector;

describe("EntityStorageIdentityConnector - document dates", () => {
	beforeEach(() => {
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
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("sets both dates when a document is created", async () => {
		vi.spyOn(Date, "now").mockReturnValue(CREATED_TIME);

		const document = await identityConnector.createDocument(TEST_CONTROLLER);

		const stored = await didDocumentEntityStorage.get(document.id);
		expect(stored?.dateCreated).toEqual(new Date(CREATED_TIME).toISOString());
		expect(stored?.dateModified).toEqual(new Date(CREATED_TIME).toISOString());
	});

	test("keeps the created date and advances the modified date on update", async () => {
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(CREATED_TIME);
		const document = await identityConnector.createDocument(TEST_CONTROLLER);

		nowSpy.mockReturnValue(MODIFIED_TIME);
		await identityConnector.addAlsoKnownAs(TEST_CONTROLLER, document.id, "did:example:alias");

		const stored = await didDocumentEntityStorage.get(document.id);
		expect(stored?.dateCreated).toEqual(new Date(CREATED_TIME).toISOString());
		expect(stored?.dateModified).toEqual(new Date(MODIFIED_TIME).toISOString());
	});

	test("registers the current schema as version 1 alongside the version 0 history", () => {
		const current = EntitySchemaFactory.get(nameof<IdentityDocument>());
		expect(current.version).toEqual(1);
		expect(current.properties?.some(p => p.property === "dateCreated")).toEqual(true);
		expect(current.properties?.some(p => p.property === "dateModified")).toEqual(true);

		const history = EntitySchemaFactory.get(nameof<IdentityDocumentV0>());
		expect(history.version).toEqual(0);
		expect(history.properties?.some(p => p.property === "dateCreated")).toEqual(false);
		expect(history.properties?.some(p => p.property === "dateModified")).toEqual(false);
	});

	test("registers the current profile schema as version 1 alongside the version 0 history", () => {
		const current = EntitySchemaFactory.get(nameof<IdentityProfile>());
		expect(current.version).toEqual(1);
		expect(current.properties?.some(p => p.property === "dateCreated")).toEqual(true);
		expect(current.properties?.some(p => p.property === "dateModified")).toEqual(true);

		const history = EntitySchemaFactory.get(nameof<IdentityProfileV0>());
		expect(history.version).toEqual(0);
		expect(history.properties?.some(p => p.property === "dateCreated")).toEqual(false);
		expect(history.properties?.some(p => p.property === "dateModified")).toEqual(false);
	});
});
