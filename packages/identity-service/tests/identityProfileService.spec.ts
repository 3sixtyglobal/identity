// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IAuthorizationComponent } from "@3sixty/authorization-models";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { ComponentFactory } from "@3sixty/core";
import type { IJsonLdDocument } from "@3sixty/data-json-ld";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	EntityStorageIdentityProfileConnector,
	type IdentityProfile,
	initSchema as initSchemaIdentity
} from "@3sixty/identity-connector-entity-storage";
import { IdentityProfileConnectorFactory } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { IdentityProfileService } from "../src/identityProfileService.js";

const TEST_USER = "did:entity-storage:user";
const TEST_ADMIN = "did:entity-storage:admin";

const DENIED_CONFIG = { config: { selfUpdateDeniedProperties: ["roles", "spatial"] } };

let identityProfileEntityStorage: MemoryEntityStorageConnector<IdentityProfile>;
let callerRoles: { [identity: string]: string[] };
let mockAuthorizationComponent: IAuthorizationComponent;

const basePublicProfile: IJsonLdDocument = {
	"@context": "https://schema.org",
	"@type": "Person",
	name: "Jane Doe"
};

const asUser = async <T>(user: string, method: () => Promise<T>, roles?: string): Promise<T> => {
	callerRoles[user] = roles?.split(",") ?? [];
	return ContextIdStore.run({ [ContextIdKeys.User]: user }, method);
};

describe("IdentityProfileService", () => {
	beforeAll(async () => {
		initSchemaIdentity();
	});

	beforeEach(async () => {
		identityProfileEntityStorage = new MemoryEntityStorageConnector<IdentityProfile>({
			entitySchema: nameof<IdentityProfile>(),
			config: { storageKey: "identity-profile" }
		});
		EntityStorageConnectorFactory.register("identity-profile", () => identityProfileEntityStorage);
		IdentityProfileConnectorFactory.register(
			"identity-profile",
			() => new EntityStorageIdentityProfileConnector()
		);

		callerRoles = {};
		mockAuthorizationComponent = {
			hasRoleForSubject: vi.fn(
				async (modelId: string, subject: string, role: string) =>
					callerRoles[subject]?.includes(role) ?? false
			),
			check: vi.fn(
				async (modelId: string, subject: string, object: string, action: string) =>
					object === IdentityProfileService.ADMIN_UPDATE_OPERATION_ID &&
					action === "execute" &&
					(callerRoles[subject]?.includes(IdentityProfileService.DEFAULT_ADMIN_ROLE) ?? false)
			)
		} as unknown as IAuthorizationComponent;
		ComponentFactory.register("authorization", () => mockAuthorizationComponent);
	});

	afterEach(async () => {
		await identityProfileEntityStorage.teardown();
		ComponentFactory.unregister("authorization");
	});

	test("Can not add denied properties when creating own profile", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);

		await expect(
			asUser(TEST_USER, async () =>
				service.create({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_USER)
			)
		).rejects.toMatchObject({
			name: "UnauthorizedError",
			message: "identityProfileService.selfUpdateDenied",
			properties: { identity: TEST_USER, properties: "publicProfile.roles" }
		});
		expect(await identityProfileEntityStorage.getStore()).toHaveLength(0);
	});

	test("Can create own profile without denied properties", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);

		await asUser(TEST_USER, async () => service.create(basePublicProfile, undefined, TEST_USER));

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual(
			basePublicProfile
		);
	});

	test("Can not add, change or remove denied properties when updating own profile", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await asUser(
			TEST_ADMIN,
			async () =>
				service.create(
					{ ...basePublicProfile, roles: ["user"], spatial: "DE" },
					undefined,
					TEST_USER
				),
			"identity-profile-admin"
		);

		for (const publicProfile of [
			{ ...basePublicProfile, roles: ["user", "auditor"], spatial: "DE" },
			{ ...basePublicProfile, roles: ["user"], spatial: "FR" },
			{ ...basePublicProfile, roles: ["user"] },
			basePublicProfile,
			{}
		]) {
			await expect(
				asUser(TEST_USER, async () => service.update(publicProfile, undefined, TEST_USER))
			).rejects.toMatchObject({
				name: "UnauthorizedError",
				message: "identityProfileService.selfUpdateDenied"
			});
		}

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["user"],
			spatial: "DE"
		});
	});

	test("Can update other properties on own profile when denied properties are unchanged", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await asUser(
			TEST_ADMIN,
			async () =>
				service.create(
					{ ...basePublicProfile, roles: ["user"], spatial: { country: "DE", region: "BY" } },
					undefined,
					TEST_USER
				),
			"identity-profile-admin"
		);

		await asUser(TEST_USER, async () =>
			service.update(
				{
					...basePublicProfile,
					name: "Jane Smith",
					roles: ["user"],
					spatial: { region: "BY", country: "DE" }
				},
				{ "@context": "https://schema.org", "@type": "Person", telephone: "123" },
				TEST_USER
			)
		);
		await asUser(TEST_USER, async () =>
			service.update(undefined, { "@context": "https://schema.org", "@type": "Person" }, TEST_USER)
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			name: "Jane Smith",
			roles: ["user"],
			spatial: { region: "BY", country: "DE" }
		});
	});

	test("Can assign denied properties on another user's profile with the admin role", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await service.create(basePublicProfile, undefined, TEST_USER);

		await expect(
			asUser(TEST_ADMIN, async () =>
				service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_USER)
			)
		).rejects.toMatchObject({ name: "UnauthorizedError" });

		await asUser(
			TEST_ADMIN,
			async () =>
				service.update(
					{ ...basePublicProfile, roles: ["auditor"], spatial: "DE" },
					undefined,
					TEST_USER
				),
			"identity-profile-admin"
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["auditor"],
			spatial: "DE"
		});
	});

	test("Can configure the denied properties", async () => {
		const service = new IdentityProfileService({
			config: { selfUpdateDeniedProperties: ["jobTitle"] }
		});
		await service.create(basePublicProfile, undefined, TEST_USER);

		await asUser(TEST_USER, async () =>
			service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_USER)
		);
		await expect(
			asUser(TEST_USER, async () =>
				service.update({ ...basePublicProfile, jobTitle: "Admin" }, undefined, TEST_USER)
			)
		).rejects.toMatchObject({
			name: "UnauthorizedError",
			properties: { identity: TEST_USER, properties: "publicProfile.jobTitle" }
		});
	});

	test("Can modify any property on own profile by default", async () => {
		const service = new IdentityProfileService();
		await service.create(basePublicProfile, undefined, TEST_USER);

		await asUser(TEST_USER, async () =>
			service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_USER)
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["auditor"]
		});
	});

	test("Can not add, change or remove denied properties in own private profile", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		const privateProfile: IJsonLdDocument = {
			"@context": "https://schema.org",
			"@type": "Person",
			roles: ["user"]
		};
		await asUser(
			TEST_ADMIN,
			async () => service.create(basePublicProfile, privateProfile, TEST_USER),
			"identity-profile-admin"
		);

		await expect(
			asUser(TEST_USER, async () =>
				service.update(
					undefined,
					{ ...privateProfile, roles: ["auditor"], spatial: "DE" },
					TEST_USER
				)
			)
		).rejects.toMatchObject({
			name: "UnauthorizedError",
			properties: {
				identity: TEST_USER,
				properties: "privateProfile.roles, privateProfile.spatial"
			}
		});

		await asUser(TEST_USER, async () =>
			service.update(undefined, { ...privateProfile, telephone: "123" }, TEST_USER)
		);

		expect((await identityProfileEntityStorage.getStore())[0].privateProfile).toEqual({
			...privateProfile,
			telephone: "123"
		});
	});

	test("Can not add denied properties to own private profile on create", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);

		await expect(
			asUser(TEST_USER, async () =>
				service.create(
					basePublicProfile,
					{ "@context": "https://schema.org", "@type": "Person", spatial: "DE" },
					TEST_USER
				)
			)
		).rejects.toMatchObject({
			name: "UnauthorizedError",
			properties: { identity: TEST_USER, properties: "privateProfile.spatial" }
		});
	});

	test("Can modify denied properties on own profile with the admin role", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await service.create(basePublicProfile, undefined, TEST_ADMIN);

		await asUser(
			TEST_ADMIN,
			async () =>
				service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_ADMIN),
			"identity-profile-admin"
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["auditor"]
		});
	});

	test("Can modify denied properties on own profile with the global admin role", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await service.create(basePublicProfile, undefined, TEST_ADMIN);

		await asUser(
			TEST_ADMIN,
			async () => service.update({ ...basePublicProfile, spatial: "DE" }, undefined, TEST_ADMIN),
			"global-admin"
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			spatial: "DE"
		});
	});

	test("Can configure the authorization model used to check permissions", async () => {
		const service = new IdentityProfileService({
			config: { selfUpdateDeniedProperties: ["roles"], authorizationModelId: "custom-model" }
		});
		await service.create(basePublicProfile, undefined, TEST_ADMIN);

		await asUser(
			TEST_ADMIN,
			async () =>
				service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_ADMIN),
			"identity-profile-admin"
		);

		expect(mockAuthorizationComponent.hasRoleForSubject).toHaveBeenCalledWith(
			"custom-model",
			TEST_ADMIN,
			IdentityProfileService.DEFAULT_ESCALATED_PRIVILEGE_ROLE
		);
		expect(mockAuthorizationComponent.check).toHaveBeenCalledWith(
			"custom-model",
			TEST_ADMIN,
			IdentityProfileService.ADMIN_UPDATE_OPERATION_ID,
			"execute"
		);
	});

	test("Can modify denied properties with escalated privilege without checking the admin permission", async () => {
		const service = new IdentityProfileService(DENIED_CONFIG);
		await service.create(basePublicProfile, undefined, TEST_ADMIN);

		await asUser(
			TEST_ADMIN,
			async () =>
				service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_ADMIN),
			"global-admin"
		);

		expect(mockAuthorizationComponent.check).not.toHaveBeenCalled();
		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["auditor"]
		});
	});

	test("Can configure the escalated privilege role", async () => {
		const service = new IdentityProfileService({
			config: { selfUpdateDeniedProperties: ["roles"], escalatedPrivilegeRole: "super-admin" }
		});
		await service.create(basePublicProfile, undefined, TEST_ADMIN);

		await expect(
			asUser(
				TEST_ADMIN,
				async () =>
					service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_ADMIN),
				"global-admin"
			)
		).rejects.toMatchObject({ name: "UnauthorizedError" });

		await asUser(
			TEST_ADMIN,
			async () =>
				service.update({ ...basePublicProfile, roles: ["auditor"] }, undefined, TEST_ADMIN),
			"super-admin"
		);

		expect((await identityProfileEntityStorage.getStore())[0].publicProfile).toEqual({
			...basePublicProfile,
			roles: ["auditor"]
		});
	});

	describe("role and property change matrix", () => {
		const withRoles = { ...basePublicProfile, roles: ["user"] };

		const roleCases: {
			label: string;
			isAdmin: boolean;
			run: <T>(method: () => Promise<T>) => Promise<T>;
		}[] = [
			{ label: "no context", isAdmin: false, run: async method => method() },
			{ label: "no roles", isAdmin: false, run: async method => asUser(TEST_USER, method) },
			{
				label: "non admin roles",
				isAdmin: false,
				run: async method => asUser(TEST_USER, method, "user,identity-profile-read")
			},
			{
				label: "identity-profile-admin role",
				isAdmin: true,
				run: async method => asUser(TEST_USER, method, "identity-profile-admin")
			},
			{
				label: "global-admin amongst other roles",
				isAdmin: true,
				run: async method => asUser(TEST_USER, method, "user,global-admin")
			}
		];

		const changeCases: {
			label: string;
			stored: IJsonLdDocument | undefined;
			updated: IJsonLdDocument;
			isDeniedChange: boolean;
		}[] = [
			{
				label: "added",
				stored: basePublicProfile,
				updated: { ...basePublicProfile, roles: ["auditor"] },
				isDeniedChange: true
			},
			{
				label: "added to empty stored profile",
				stored: undefined,
				updated: { ...basePublicProfile, roles: ["auditor"] },
				isDeniedChange: true
			},
			{
				label: "changed",
				stored: withRoles,
				updated: { ...basePublicProfile, roles: ["auditor"] },
				isDeniedChange: true
			},
			{
				label: "removed",
				stored: withRoles,
				updated: basePublicProfile,
				isDeniedChange: true
			},
			{
				label: "unchanged",
				stored: withRoles,
				updated: { ...withRoles, name: "Jane Smith" },
				isDeniedChange: false
			},
			{
				label: "absent from both",
				stored: basePublicProfile,
				updated: { ...basePublicProfile, name: "Jane Smith" },
				isDeniedChange: false
			}
		];

		const cases = (["publicProfile", "privateProfile"] as const).flatMap(profileName =>
			roleCases.flatMap(roleCase =>
				changeCases.map(changeCase => ({ profileName, roleCase, changeCase }))
			)
		);

		test.each(cases)(
			"$profileName denied property $changeCase.label with $roleCase.label",
			async ({ profileName, roleCase, changeCase }) => {
				const service = new IdentityProfileService(DENIED_CONFIG);
				await identityProfileEntityStorage.set({
					identity: TEST_USER,
					[profileName]: changeCase.stored
				});

				const update = async (): Promise<void> => {
					if (profileName === "publicProfile") {
						await service.update(changeCase.updated, undefined, TEST_USER);
					} else {
						await service.update(undefined, changeCase.updated, TEST_USER);
					}
				};

				if (changeCase.isDeniedChange && !roleCase.isAdmin) {
					await expect(roleCase.run(update)).rejects.toMatchObject({
						name: "UnauthorizedError",
						message: "identityProfileService.selfUpdateDenied",
						properties: { identity: TEST_USER, properties: `${profileName}.roles` }
					});
					expect((await identityProfileEntityStorage.getStore())[0][profileName]).toEqual(
						changeCase.stored
					);
				} else {
					await roleCase.run(update);
					expect((await identityProfileEntityStorage.getStore())[0][profileName]).toEqual(
						changeCase.updated
					);
				}
			}
		);
	});
});
