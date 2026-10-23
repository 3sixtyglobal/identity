// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { AlreadyExistsError, ComponentFactory, Is, RandomHelper } from "@3sixty/core";
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
import { DidVerificationMethodType } from "@3sixty/standards-w3c-did";
import {
	MetricType,
	type ITelemetryComponent,
	type ITelemetryMetric
} from "@3sixty/telemetry-models";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { IdentityService } from "../src/identityService.js";

const TEST_CONTROLLER = "test-controller";

interface MetricValueEntry {
	id: string;
	value: "inc" | "dec" | number;
	customData?: { [key: string]: unknown };
}

function makeMockTelemetry(): {
	component: ITelemetryComponent;
	created: ITelemetryMetric[];
	values: MetricValueEntry[];
} {
	const created: ITelemetryMetric[] = [];
	const values: MetricValueEntry[] = [];
	const component: ITelemetryComponent = {
		className: () => "MockTelemetry",
		start: async () => {},
		stop: async () => {},
		createMetric: async m => {
			for (const metric of Is.array(m) ? m : [m]) {
				created.push({ ...metric });
			}
		},
		getMetric: async () => ({ metric: {} as never, value: {} as never }),
		updateMetric: async () => {},
		addMetricValue: async (id, value, customData) => {
			values.push({ id, value, customData });
			return "v";
		},
		addMetricValues: async entries => {
			values.push(...entries);
			return entries.map(() => "v");
		},
		getMetricValue: async (id, valueId) => ({
			id: valueId,
			metricId: id,
			value: 0,
			ts: Date.now()
		}),
		removeMetric: async () => {},
		query: async () => ({ entities: [] }),
		queryValues: async () => ({ metric: {} as never, entities: [] })
	};
	return { component, created, values };
}

describe("IdentityService - metrics", () => {
	let identityDocStorage: MemoryEntityStorageConnector<IdentityDocument>;
	let vaultKeyStorage: MemoryEntityStorageConnector<VaultKey>;
	let vaultSecretStorage: MemoryEntityStorageConnector<VaultSecret>;

	beforeAll(async () => {
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

		IdentityConnectorFactory.register("entity-storage", () => new EntityStorageIdentityConnector());
		IdentityResolverConnectorFactory.register(
			"entity-storage",
			() => new EntityStorageIdentityResolverConnector()
		);

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

	afterEach(async () => {
		await identityDocStorage.teardown();
		await vaultKeyStorage.teardown();
		await vaultSecretStorage.teardown();
	});

	test("start() registers all 10 counters with type Counter", async () => {
		const { component, created } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		expect(created).toHaveLength(10);
		for (const m of created) {
			expect(m.type).toBe(MetricType.Counter);
		}

		const ids = created.map(m => m.id);
		expect(ids).toContain("identity_dids_created");
		expect(ids).toContain("identity_dids_removed");
		expect(ids).toContain("identity_vcs_created");
		expect(ids).toContain("identity_vcs_verified");
		expect(ids).toContain("identity_vcs_verification_failed");
		expect(ids).toContain("identity_vcs_revoked");
		expect(ids).toContain("identity_vcs_unrevoked");
		expect(ids).toContain("identity_vps_created");
		expect(ids).toContain("identity_vps_verified");
		expect(ids).toContain("identity_vps_verification_failed");
	});

	test("start() is idempotent - AlreadyExistsError is swallowed", async () => {
		let callCount = 0;
		const component: ITelemetryComponent = {
			...makeMockTelemetry().component,
			createMetric: async () => {
				if (callCount++ > 0) {
					throw new AlreadyExistsError("test", "metric", "id");
				}
			}
		};
		ComponentFactory.register("test-telemetry-idempotent", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry-idempotent" });
		await service.start();
		await expect(service.start()).resolves.toBeUndefined();
	});

	test("identityCreate() emits identity_dids_created with namespace", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		await service.identityCreate(undefined, TEST_CONTROLLER);

		const created = values.filter(v => v.id === "identity_dids_created");
		expect(created).toHaveLength(1);
		expect(created[0].value).toBe("inc");
		expect(created[0].customData?.namespace).toBe("entity-storage");
	});

	test("identityRemove() emits identity_dids_removed", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		await service.identityRemove(identity.id, undefined, TEST_CONTROLLER);

		const removed = values.filter(v => v.id === "identity_dids_removed");
		expect(removed).toHaveLength(1);
		expect(removed[0].value).toBe("inc");
	});

	test("verifiableCredentialCreate() emits identity_vcs_created with hasRevocation and hasExpiration flags", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		const created = values.filter(v => v.id === "identity_vcs_created");
		expect(created).toHaveLength(1);
		expect(created[0].value).toBe("inc");
		expect(created[0].customData?.hasRevocation).toBe(true);
		expect(created[0].customData?.hasExpiration).toBe(false);
	});

	test("verifiableCredentialCreate() emits identity_vcs_created with hasExpiration true when expirationDate is set", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/2",
			{ "@context": "https://schema.org", "@type": "Person", name: "Bob" },
			{ expirationDate: new Date("2030-01-01") },
			TEST_CONTROLLER
		);

		const created = values.filter(v => v.id === "identity_vcs_created");
		expect(created).toHaveLength(1);
		expect(created[0].value).toBe("inc");
		expect(created[0].customData?.hasExpiration).toBe(true);
		expect(created[0].customData?.hasRevocation).toBe(false);
	});

	test("verifiableCredentialVerify() success path emits identity_vcs_verified", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		const result = await service.verifiableCredentialVerify(jwt);

		expect(result.revoked).toBe(false);
		expect(values.filter(v => v.id === "identity_vcs_verified")).toHaveLength(1);
		expect(values.filter(v => v.id === "identity_vcs_verification_failed")).toHaveLength(0);
	});

	test("verifiableCredentialVerify() revoked path emits identity_vcs_verification_failed with failureReason: revoked", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		await service.verifiableCredentialRevoke(identity.id, 5, TEST_CONTROLLER);

		const result = await service.verifiableCredentialVerify(jwt);

		expect(result.revoked).toBe(true);
		const failed = values.filter(v => v.id === "identity_vcs_verification_failed");
		expect(failed).toHaveLength(1);
		expect(failed[0].customData?.failureReason).toBe("revoked");
		expect(values.filter(v => v.id === "identity_vcs_verified")).toHaveLength(0);
	});

	test("verifiableCredentialRevoke() emits identity_vcs_revoked", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		await service.verifiableCredentialRevoke(identity.id, 5, TEST_CONTROLLER);

		expect(values.filter(v => v.id === "identity_vcs_revoked")).toHaveLength(1);
	});

	test("verifiableCredentialUnrevoke() emits identity_vcs_unrevoked", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		await service.verifiableCredentialRevoke(identity.id, 5, TEST_CONTROLLER);
		await service.verifiableCredentialUnrevoke(identity.id, 5, TEST_CONTROLLER);

		expect(values.filter(v => v.id === "identity_vcs_unrevoked")).toHaveLength(1);
	});

	test("verifiablePresentationCreate() emits identity_vps_created with credentialCount", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt: vcJwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		await service.verifiablePresentationCreate(
			vm.id,
			"https://example.com/presentations/1",
			undefined,
			undefined,
			[vcJwt],
			undefined,
			TEST_CONTROLLER
		);

		const created = values.filter(v => v.id === "identity_vps_created");
		expect(created).toHaveLength(1);
		expect(created[0].value).toBe("inc");
		expect(created[0].customData?.credentialCount).toBe(1);
	});

	test("verifiablePresentationVerify() success path emits identity_vps_verified", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt: vcJwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		const { jwt: vpJwt } = await service.verifiablePresentationCreate(
			vm.id,
			"https://example.com/presentations/1",
			undefined,
			undefined,
			[vcJwt],
			undefined,
			TEST_CONTROLLER
		);

		const result = await service.verifiablePresentationVerify(vpJwt);

		expect(result.revoked).toBe(false);
		expect(values.filter(v => v.id === "identity_vps_verified")).toHaveLength(1);
		expect(values.filter(v => v.id === "identity_vps_verification_failed")).toHaveLength(0);
	});

	test("verifiablePresentationVerify() revoked path emits identity_vps_verification_failed with failureReason: revoked", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new IdentityService({ telemetryComponentType: "test-telemetry" });

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt: vcJwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		const { jwt: vpJwt } = await service.verifiablePresentationCreate(
			vm.id,
			"https://example.com/presentations/1",
			undefined,
			undefined,
			[vcJwt],
			undefined,
			TEST_CONTROLLER
		);

		// The entity-storage connector has a known issue where it does not propagate
		// embedded VC revocation status through checkVerifiablePresentation. Mock the
		// connector to return revoked=true so we can verify the service metric logic.
		const connector = new EntityStorageIdentityConnector();
		vi.spyOn(connector, "checkVerifiablePresentation").mockResolvedValue({
			revoked: true,
			verifiablePresentation: undefined,
			issuers: []
		});
		IdentityConnectorFactory.register("entity-storage", () => connector);

		const serviceWithMock = new IdentityService({ telemetryComponentType: "test-telemetry" });
		const result = await serviceWithMock.verifiablePresentationVerify(vpJwt);

		expect(result.revoked).toBe(true);
		const failed = values.filter(v => v.id === "identity_vps_verification_failed");
		expect(failed).toHaveLength(1);
		expect(failed[0].customData?.failureReason).toBe("revoked");
		expect(values.filter(v => v.id === "identity_vps_verified")).toHaveLength(0);
	});

	test("service works without telemetryComponentType - no errors, all operations succeed", async () => {
		const service = new IdentityService();

		const identity = await service.identityCreate(undefined, TEST_CONTROLLER);
		expect(identity.id).toBeDefined();

		const vm = await service.verificationMethodCreate(
			identity.id,
			DidVerificationMethodType.AssertionMethod,
			"test-vm",
			TEST_CONTROLLER
		);

		const { jwt } = await service.verifiableCredentialCreate(
			vm.id,
			"https://example.com/credentials/1",
			{ "@context": "https://schema.org", "@type": "Person", name: "Alice" },
			{ revocationIndex: 5 },
			TEST_CONTROLLER
		);

		const result = await service.verifiableCredentialVerify(jwt);
		expect(result.revoked).toBe(false);
	});
});
