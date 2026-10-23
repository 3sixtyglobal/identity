// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
// Note: IOTA connector is the primary source for shared test bodies.
import { Is, StringHelper, Urn } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import type { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";

import {
	DidContexts,
	DidTypes,
	ProofTypes,
	type DidVerificationMethodType,
	type IDidService,
	type IDidVerifiableCredential,
	type IProof
} from "@3sixty/standards-w3c-did";
import type { VaultSecret } from "@3sixty/vault-connector-entity-storage";
import { Jwt } from "@3sixty/web";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_EXPLORER_URL,
	TEST_USER_IDENTITY,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_GAS_BUDGET
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";
import { IotaIdentityResolverConnector } from "../src/iotaIdentityResolverConnector.js";

const DID_PREFIX = "did:iota";

const CREDENTIAL_STATUS_TYPE = "RevocationBitmap2022";

async function debugOutput(documentId: string): Promise<void> {
	const didUrn = Urn.fromValidString(documentId);
	const didParts = didUrn.parts();
	const objectId = didParts[didParts.length - 1];
	console.debug("DID Document", `${TEST_EXPLORER_URL}object/${objectId}?network=${TEST_NETWORK}`);
}

let testVcJwt: string;
let testVc: IDidVerifiableCredential;
let testDocumentId: string;
let testVerificationMethodId: string;
let identityConnector: IotaIdentityConnector;
let identityResolverConnector: IotaIdentityResolverConnector;

describe("IotaIdentityConnector", () => {
	beforeAll(async () => {
		await setupTestEnv();

		try {
			identityConnector = new IotaIdentityConnector({
				config: {
					clientOptions: TEST_CLIENT_OPTIONS,
					vaultMnemonicId: TEST_MNEMONIC_NAME,
					network: TEST_NETWORK,
					gasBudget: TEST_GAS_BUDGET,
					didResolutionCacheTtlMs: 0
				}
			});

			// Caching disabled: this suite shares one resolver across tests and asserts that
			// mutations made through identityConnector are visible on the next resolve, so a
			// cached entry would mask them. Resolution caching has its own coverage in
			// iotaIdentityResolverConnectorCache.spec.ts.
			identityResolverConnector = new IotaIdentityResolverConnector({
				config: {
					clientOptions: TEST_CLIENT_OPTIONS,
					vaultMnemonicId: TEST_MNEMONIC_NAME,
					network: TEST_NETWORK,
					didResolutionCacheTtlMs: 0
				}
			});

			// Create initial document so testDocumentId is available to all tests
			const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
			testDocumentId = document.id;
		} catch (error) {
			console.error("Error in beforeAll:", error);
		}
	});

	test("can create a document", async () => {
		const testDocument = await identityConnector.createDocument(TEST_USER_IDENTITY);
		testDocumentId = testDocument.id;
		await debugOutput(testDocumentId);

		expect(testDocument.id.startsWith(DID_PREFIX)).toBeTruthy();
		expect(testDocument.id).toBeDefined();
		expect(testDocument.service).toBeDefined();
		expect((testDocument.service?.[0] as IDidService)?.id).toEqual(`${testDocument.id}#revocation`);
	});

	test("can delete a document", async () => {
		const testDocument = await identityConnector.createDocument(TEST_USER_IDENTITY);
		expect(testDocument.id.startsWith(DID_PREFIX)).toBeTruthy();
		await debugOutput(testDocument.id);

		await identityConnector.removeDocument(TEST_USER_IDENTITY, testDocument.id);

		await expect(identityResolverConnector.resolveDocument(testDocument.id)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityResolverConnector.className())}.resolveDocumentFailed`,
			properties: {
				documentId: testDocument.id
			}
		});
	});

	test("can fail to resolve a document with no id", async () => {
		await expect(
			identityResolverConnector.resolveDocument(undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can resolve a document id", async () => {
		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);
		expect(resolvedDocument.service).toBeDefined();
		expect((resolvedDocument.service?.[0] as IDidService)?.id).toEqual(
			`${testDocumentId}#revocation`
		);
	});

	test("can fail to add a verification method with no document id", async () => {
		await expect(
			identityConnector.addVerificationMethod(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				undefined as unknown as DidVerificationMethodType,
				undefined
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a verification method with no verification method type", async () => {
		await expect(
			identityConnector.addVerificationMethod(
				TEST_USER_IDENTITY,
				"foo",
				undefined as unknown as DidVerificationMethodType,
				undefined
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.arrayOneOf",
			properties: {
				property: "verificationMethodType",
				value: "undefined"
			}
		});
	});

	test("can add a verification method", async () => {
		const verificationMethodType = "authentication";
		const verificationMethodId = "testVerificationMethod";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			verificationMethodType,
			verificationMethodId
		);

		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);
		expect(addedMethod.type).toEqual("JsonWebKey2020");
		testVerificationMethodId = addedMethod.id;

		const keyStore =
			await EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultSecret>>(
				"vault-key"
			).getStore();

		expect(keyStore[keyStore.length - 1].id).toEqual(`${testDocumentId}/${verificationMethodId}`);
	});

	test("can fail to remove a verification method with no verification method id", async () => {
		await expect(
			identityConnector.removeVerificationMethod(TEST_USER_IDENTITY, undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can remove a verification method", async () => {
		const verificationMethodType = "verificationMethod";
		const verificationMethodId = "methodToRemove";

		const addedMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			verificationMethodType,
			verificationMethodId
		);

		expect(addedMethod).toBeDefined();
		expect(addedMethod.id).toEqual(`${testDocumentId}#${verificationMethodId}`);

		await identityConnector.removeVerificationMethod(
			TEST_USER_IDENTITY,
			`${testDocumentId}#${verificationMethodId}`
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);

		const methodStillExists = resolvedDocument.verificationMethod?.some(method => {
			if (Is.string(method)) {
				return method === `${testDocumentId}#${verificationMethodId}`;
			}
			return method.id === `${testDocumentId}#${verificationMethodId}`;
		});

		expect(methodStillExists).toBeFalsy();
	});

	test("can fail to add a service with no document id", async () => {
		await expect(
			identityConnector.addService(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "documentId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service id", async () => {
		await expect(
			identityConnector.addService(
				TEST_USER_IDENTITY,
				"foo",
				undefined as unknown as string,
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service type", async () => {
		await expect(
			identityConnector.addService(
				TEST_USER_IDENTITY,
				"foo",
				"foo",
				undefined as unknown as string,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceType",
				value: "undefined"
			}
		});
	});

	test("can fail to add a service with no service endpoint", async () => {
		await expect(
			identityConnector.addService(
				TEST_USER_IDENTITY,
				"foo",
				"foo",
				"foo",
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceEndpoint",
				value: "undefined"
			}
		});
	});

	test("can add a service", async () => {
		const serviceId = "testService";
		const serviceType = "TestServiceType";
		const serviceEndpoint = "https://example.com/service";

		const addedService = await identityConnector.addService(
			TEST_USER_IDENTITY,
			testDocumentId,
			serviceId,
			serviceType,
			serviceEndpoint
		);

		expect(addedService).toBeDefined();
		expect(addedService.id).toEqual(`${testDocumentId}#${serviceId}`);
		expect(addedService.type).toEqual(serviceType);
		expect(addedService.serviceEndpoint).toEqual(serviceEndpoint);
	});

	test("can fail to remove a service with no service id", async () => {
		await expect(
			identityConnector.removeService(TEST_USER_IDENTITY, undefined as unknown as string)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "serviceId",
				value: "undefined"
			}
		});
	});

	test("can remove a service", async () => {
		const serviceId = "testServiceToRemove";
		const serviceType = "TestServiceType";
		const serviceEndpoint = "https://example.com/service-to-remove";

		const addedService = await identityConnector.addService(
			TEST_USER_IDENTITY,
			testDocumentId,
			serviceId,
			serviceType,
			serviceEndpoint
		);

		expect(addedService).toBeDefined();
		expect(addedService.id).toEqual(`${testDocumentId}#${serviceId}`);

		await identityConnector.removeService(TEST_USER_IDENTITY, addedService.id);
	});

	test("throws error when removing non-existent service", async () => {
		const nonExistentServiceId = `${testDocumentId}#nonExistentService`;

		await expect(
			identityConnector.removeService(TEST_USER_IDENTITY, nonExistentServiceId)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.removeServiceFailed`
		});
	});

	test("can fail to add alsoKnownAs with no alias", async () => {
		await expect(
			identityConnector.addAlsoKnownAs(
				TEST_USER_IDENTITY,
				testDocumentId,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "alias",
				value: "undefined"
			}
		});
	});

	test("can fail to add alsoKnownAs when alias is not a Url or Urn", async () => {
		await expect(
			identityConnector.addAlsoKnownAs(TEST_USER_IDENTITY, testDocumentId, "not a uri")
		).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.invalidAlias`,
			properties: { alias: "not a uri" }
		});
	});

	test("can add an alias to alsoKnownAs", async () => {
		await identityConnector.addAlsoKnownAs(
			TEST_USER_IDENTITY,
			testDocumentId,
			"did:example:linked"
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);
		expect(resolvedDocument.alsoKnownAs).toContain("did:example:linked");
	});

	test("addAlsoKnownAs is idempotent for duplicates", async () => {
		await identityConnector.addAlsoKnownAs(
			TEST_USER_IDENTITY,
			testDocumentId,
			"did:example:linked"
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);
		const aliases = Is.array(resolvedDocument.alsoKnownAs) ? resolvedDocument.alsoKnownAs : [];
		const occurrences = aliases.filter(a => a === "did:example:linked").length;
		expect(occurrences).toBe(1);
	});

	test("can fail to remove alsoKnownAs with no alias", async () => {
		await expect(
			identityConnector.removeAlsoKnownAs(
				TEST_USER_IDENTITY,
				testDocumentId,
				undefined as unknown as string
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "alias",
				value: "undefined"
			}
		});
	});

	test("can fail to remove alsoKnownAs when alias is not a Url or Urn", async () => {
		await expect(
			identityConnector.removeAlsoKnownAs(TEST_USER_IDENTITY, testDocumentId, "not a uri")
		).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.invalidAlias`,
			properties: { alias: "not a uri" }
		});
	});

	test("removeAlsoKnownAs is a no-op when alias is not present", async () => {
		await identityConnector.removeAlsoKnownAs(
			TEST_USER_IDENTITY,
			testDocumentId,
			"did:example:missing"
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);
		expect(resolvedDocument.alsoKnownAs).toContain("did:example:linked");
	});

	test("can remove an alias from alsoKnownAs", async () => {
		await identityConnector.removeAlsoKnownAs(
			TEST_USER_IDENTITY,
			testDocumentId,
			"did:example:linked"
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);
		expect(resolvedDocument.alsoKnownAs ?? []).not.toContain("did:example:linked");
	});

	test("can fail to create a verifiable credential with no verification method id", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				undefined,
				{},
				undefined
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a verifiable credential with no subject", async () => {
		await expect(
			identityConnector.createVerifiableCredential(
				TEST_USER_IDENTITY,
				"foo",
				undefined,
				undefined as unknown as IJsonLdNodeObject,
				undefined
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "subject",
				value: "undefined"
			}
		});
	});

	test("can create a verifiable credential", async () => {
		const did = testDocumentId;

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			did,
			"assertionMethod",
			"testVerificationMethod"
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod.id).toBeDefined();

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/3732",
			{
				"@context": ["https://schema.org"],
				type: "Person",
				id: did,
				name: "Jane Doe"
			},
			{
				revocationIndex: 123,
				expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
			}
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();

		expect(result.verifiableCredential.id).toEqual("https://example.edu/credentials/3732");
		expect(result.verifiableCredential.type).toContain("VerifiableCredential");
		expect(result.verifiableCredential.proof).toBeDefined();

		// Check credential status
		if (result.verifiableCredential.credentialStatus) {
			const status = Array.isArray(result.verifiableCredential.credentialStatus)
				? result.verifiableCredential.credentialStatus[0]
				: result.verifiableCredential.credentialStatus;

			expect(status.type).toEqual(CREDENTIAL_STATUS_TYPE);
			expect(status.revocationBitmapIndex).toEqual("123");
		}

		// Check JWT format
		expect(result.jwt).toBeDefined();
		expect(result.jwt.split(".").length).toEqual(3);

		testVcJwt = result.jwt;
		testVc = result.verifiableCredential;
	});

	test("can create a verifiable credential with custom jwt header fields", async () => {
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/jwt-header-test",
			{
				"@context": ["https://schema.org"],
				id: testDocumentId,
				name: "JWT Header Test"
			},
			{ jwtHeaderFields: { "x-custom": "header-value" } }
		);

		expect(result.jwt.split(".").length).toEqual(3);
		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.header).toMatchObject({ "x-custom": "header-value", typ: "JWT", alg: "EdDSA" });
		expect(decoded.header?.kid).toBeDefined();

		const check = await identityConnector.checkVerifiableCredential(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiableCredential).toBeDefined();
	});

	test("can create a verifiable credential with custom jwt payload fields", async () => {
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/jwt-payload-test",
			{
				"@context": ["https://schema.org"],
				id: testDocumentId,
				name: "JWT Payload Test"
			},
			{ jwtPayloadFields: { "x-custom": "payload-value" } }
		);

		expect(result.jwt.split(".").length).toEqual(3);
		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.payload).toMatchObject({ "x-custom": "payload-value" });
		expect(decoded.payload?.iss).toBeDefined();
		expect(decoded.payload?.nbf).toBeDefined();
		expect(decoded.payload?.vc).toBeDefined();

		const check = await identityConnector.checkVerifiableCredential(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiableCredential).toBeDefined();
	});

	test("standard jwt header fields take precedence over custom fields in verifiable credential", async () => {
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/jwt-header-overwrite",
			{
				"@context": ["https://schema.org"],
				id: testDocumentId,
				name: "JWT Header Overwrite Test"
			},
			{ jwtHeaderFields: { alg: "RS256", typ: "at+JWT", kid: "evil-kid" } }
		);

		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.header?.alg).toEqual("EdDSA");
		expect(decoded.header?.typ).toEqual("JWT");
		expect(decoded.header?.kid).toEqual(testVerificationMethodId);

		const check = await identityConnector.checkVerifiableCredential(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiableCredential).toBeDefined();
	});

	test("standard jwt payload fields take precedence over custom fields in verifiable credential", async () => {
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"https://example.edu/credentials/jwt-payload-overwrite",
			{
				"@context": ["https://schema.org"],
				id: testDocumentId,
				name: "JWT Payload Overwrite Test"
			},
			{ jwtPayloadFields: { iss: "evil-issuer", jti: "evil-id" } }
		);

		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.payload?.iss).toEqual(testDocumentId);
		expect(decoded.payload?.jti).toEqual("https://example.edu/credentials/jwt-payload-overwrite");

		const check = await identityConnector.checkVerifiableCredential(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiableCredential).toBeDefined();
	});

	test("can fail to validate a verifiable credential with no jwt", async () => {
		await expect(identityConnector.checkVerifiableCredential("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "credential",
				value: ""
			}
		});
	});

	test("can validate a verifiable credential jwt", async () => {
		const checkResult = await identityConnector.checkVerifiableCredential(testVcJwt);

		expect(checkResult).toBeDefined();
		expect(checkResult.revoked).toBeFalsy();
		expect(checkResult.verifiableCredential).toBeDefined();

		expect(checkResult.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(checkResult.verifiableCredential?.type).toContain("VerifiableCredential");

		const checkedCredentialSubject = checkResult.verifiableCredential?.credentialSubject;
		expect(checkedCredentialSubject).toBeDefined();
		if (checkedCredentialSubject && !Array.isArray(checkedCredentialSubject)) {
			expect(checkedCredentialSubject.name).toEqual("Jane Doe");
		}

		if (checkResult.verifiableCredential?.credentialStatus) {
			const status = Array.isArray(checkResult.verifiableCredential.credentialStatus)
				? checkResult.verifiableCredential.credentialStatus[0]
				: checkResult.verifiableCredential.credentialStatus;

			expect(status.type).toEqual(CREDENTIAL_STATUS_TYPE);
			expect(status.revocationBitmapIndex).toEqual("123");
		}
	});

	test("can validate a verifiable credential document", async () => {
		const checkResult = await identityConnector.checkVerifiableCredential(testVc);

		expect(checkResult).toBeDefined();
		expect(checkResult.revoked).toBeFalsy();
		expect(checkResult.verifiableCredential).toBeDefined();

		expect(checkResult.verifiableCredential?.id).toEqual("https://example.edu/credentials/3732");
		expect(checkResult.verifiableCredential?.type).toContain("VerifiableCredential");

		const checkedCredentialSubject = checkResult.verifiableCredential?.credentialSubject;
		expect(checkedCredentialSubject).toBeDefined();
		if (checkedCredentialSubject && !Array.isArray(checkedCredentialSubject)) {
			expect(checkedCredentialSubject.name).toEqual("Jane Doe");
		}

		if (checkResult.verifiableCredential?.credentialStatus) {
			const status = Array.isArray(checkResult.verifiableCredential.credentialStatus)
				? checkResult.verifiableCredential.credentialStatus[0]
				: checkResult.verifiableCredential.credentialStatus;

			expect(status.type).toEqual(CREDENTIAL_STATUS_TYPE);
			expect(status.revocationBitmapIndex).toEqual("123");
		}
	});

	test("can fail to validate a tampered verifiable credential document", async () => {
		const tampered = {
			...testVc,
			credentialSubject: {
				...(Array.isArray(testVc.credentialSubject)
					? testVc.credentialSubject[0]
					: testVc.credentialSubject),
				name: "Tampered Name"
			}
		};
		await expect(identityConnector.checkVerifiableCredential(tampered)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.signatureVerificationFailed`
		});
	});

	test("can fail to revoke a verifiable credential with no documentId", async () => {
		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				[123]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to revoke a verifiable credential with no credentialIndices", async () => {
		await expect(
			identityConnector.revokeVerifiableCredentials(
				TEST_USER_IDENTITY,
				testDocumentId,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can revoke a verifiable credential", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"revoke-test-key"
		);

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/revocation-standalone",
			{
				id: testDocumentId,
				name: "Revocation Standalone Test"
			},
			{ revocationIndex: 456 }
		);

		const vcJwt = result.jwt;

		const initialCheck = await identityConnector.checkVerifiableCredential(vcJwt);
		expect(initialCheck.revoked).toBeFalsy();

		await identityConnector.revokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [456]);

		const revokedCheck = await identityConnector.checkVerifiableCredential(vcJwt);
		expect(revokedCheck.revoked).toBeTruthy();
	});

	test("can fail to unrevoke a verifiable credential with no documentId", async () => {
		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				[123]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "issuerDocumentId",
				value: "undefined"
			}
		});
	});

	test("can fail to unrevoke a verifiable credential with no credentialIndices", async () => {
		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_USER_IDENTITY,
				testDocumentId,
				undefined as unknown as number[]
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.array",
			properties: {
				property: "credentialIndices",
				value: "undefined"
			}
		});
	});

	test("can unrevoke a verifiable credential", async () => {
		const didId = testDocumentId;

		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			didId,
			"assertionMethod",
			"unrevocation-test-key"
		);
		expect(verificationMethod).toBeDefined();
		expect(verificationMethod.id).toBeDefined();

		const revocationIndex = 789;
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/unrevocation-test",
			{
				id: didId,
				name: "Unrevocation Test"
			},
			{
				revocationIndex
			}
		);

		expect(result).toBeDefined();
		expect(result.verifiableCredential).toBeDefined();
		expect(result.jwt).toBeDefined();
		const vcJwt = result.jwt;

		const initialCheck = await identityConnector.checkVerifiableCredential(vcJwt);
		expect(initialCheck.revoked).toBeFalsy();

		await identityConnector.revokeVerifiableCredentials(TEST_USER_IDENTITY, didId, [
			revocationIndex
		]);

		await identityConnector.unrevokeVerifiableCredentials(TEST_USER_IDENTITY, didId, [
			revocationIndex
		]);
	});

	// checkVerifiableCredential must enforce credentialStatus the same way on both input forms.
	test("object-form credential verification detects revocation the same as the jwt form", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"object-form-revocation-repro-key"
		);

		const revocationIndex = 9101;
		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/object-form-revocation-repro",
			{
				id: testDocumentId,
				name: "Object Form Revocation Repro"
			},
			{ revocationIndex }
		);

		await identityConnector.revokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [
			revocationIndex
		]);

		const jwtCheck = await identityConnector.checkVerifiableCredential(result.jwt);
		expect(jwtCheck.revoked).toBeTruthy();

		const objectCheck = await identityConnector.checkVerifiableCredential(
			result.verifiableCredential
		);
		expect(objectCheck.revoked).toBeTruthy();
		expect(objectCheck.verifiableCredential).toBeUndefined();
	});

	// checkVerifiableCredential must enforce the validity period the same way on both input forms.
	test("object-form credential verification enforces expiry the same as the jwt form", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"object-form-expiry-repro-key"
		);

		// The jwt exp claim is stored with second precision and identity.rs treats a credential as
		// valid for the whole of its expiry second (checkExpiresOnOrAfter is inclusive), so anchor
		// the expiry to a second boundary rather than relying on sub-second timing.
		const expirationDate = new Date((Math.floor(Date.now() / 1000) + 2) * 1000);

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/object-form-expiry-repro",
			{
				id: testDocumentId,
				name: "Object Form Expiry Repro"
			},
			// Valid at creation time (checked internally when the JWT is first signed), but
			// expires shortly after so the checks below run against a genuinely expired credential.
			{ expirationDate }
		);

		// Wait until well past the end of the expiry second.
		await new Promise(resolve =>
			setTimeout(resolve, Math.max(0, expirationDate.getTime() + 1500 - Date.now()))
		);

		await expect(identityConnector.checkVerifiableCredential(result.jwt)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.checkingVerifiableCredentialFailed`
		});

		await expect(
			identityConnector.checkVerifiableCredential(result.verifiableCredential)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "verificationHelper.credentialExpired"
		});
	});

	test("a revoked verifiable credential document with a numeric revocation index reports revoked", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"numeric-revocation-index-key"
		);

		const revocationIndex = 9303;
		const unsignedCredential = {
			"@context": DidContexts.ContextVCv1,
			id: "https://example.edu/credentials/numeric-revocation-index",
			type: DidTypes.VerifiableCredential,
			credentialSubject: { id: testDocumentId, name: "Numeric Revocation Index Test" },
			issuer: testDocumentId,
			issuanceDate: new Date(Date.now() - 60000).toISOString(),
			credentialStatus: {
				id: `${testDocumentId}#revocation`,
				type: CREDENTIAL_STATUS_TYPE,
				revocationBitmapIndex: revocationIndex
			}
		};
		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			ProofTypes.DataIntegrityProof,
			unsignedCredential
		);

		await identityConnector.revokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [
			revocationIndex
		]);

		const objectCheck = await identityConnector.checkVerifiableCredential({
			...unsignedCredential,
			proof
		});
		expect(objectCheck.revoked).toBeTruthy();
	});

	test("cannot validate a verifiable credential document whose issuer does not match the proof signer", async () => {
		const mismatched = {
			...testVc,
			issuer: "did:iota:testnet:0x9999999999999999999999999999999999999999999999999999999999999999"
		};

		await expect(identityConnector.checkVerifiableCredential(mismatched)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.issuerMismatch`
		});
	});

	// The validity period is checked before the signature, so a tampered date field is a valid
	// way to exercise the not-yet-valid path which createVerifiableCredential cannot produce.
	test("cannot validate a verifiable credential document that is not yet valid", async () => {
		const notYetValid = {
			...testVc,
			issuanceDate: "2030-01-01T00:00:00.000Z"
		};

		await expect(identityConnector.checkVerifiableCredential(notYetValid)).rejects.toMatchObject({
			name: "GeneralError",
			message: "verificationHelper.credentialNotYetValid"
		});
	});

	// A proof made by a method outside the assertionMethod relationship must be rejected on both input forms.
	test("cannot validate a verifiable credential jwt signed by a method outside the assertionMethod relationship", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"authentication",
			"wrong-relationship-jwt-key"
		);

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/wrong-relationship-jwt",
			{
				id: testDocumentId,
				name: "Wrong Relationship Jwt Test"
			}
		);

		await expect(identityConnector.checkVerifiableCredential(result.jwt)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.checkingVerifiableCredentialFailed`
		});
	});

	test("cannot validate a verifiable credential document signed by a method outside the assertionMethod relationship", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"authentication",
			"wrong-relationship-document-key"
		);

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/wrong-relationship-document",
			{
				id: testDocumentId,
				name: "Wrong Relationship Document Test"
			}
		);

		await expect(
			identityConnector.checkVerifiableCredential(result.verifiableCredential)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "documentHelper.verificationMethodNotFound"
		});
	});

	// Mirrors the shape twin-immutable-proof relies on: no credentialStatus, no expirationDate.
	test("can validate a verifiable credential document with no status and no expiry", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"no-status-no-expiry-key"
		);

		const result = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/no-status-no-expiry",
			{
				id: testDocumentId,
				name: "No Status No Expiry Test"
			}
		);

		const objectCheck = await identityConnector.checkVerifiableCredential(
			result.verifiableCredential
		);
		expect(objectCheck.revoked).toBeFalsy();
		expect(objectCheck.verifiableCredential).toBeDefined();
	});

	test("a revoked embedded credential is reflected in checkVerifiablePresentation for both input forms", async () => {
		const verificationMethod = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId,
			"assertionMethod",
			"vp-embedded-revocation-key"
		);

		const revocationIndex = 9202;
		const credentialResult = await identityConnector.createVerifiableCredential(
			TEST_USER_IDENTITY,
			verificationMethod.id,
			"https://example.edu/credentials/vp-embedded-revocation",
			{
				id: testDocumentId,
				name: "VP Embedded Revocation Test"
			},
			{ revocationIndex }
		);

		const presentationResult = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/vp-embedded-revocation",
			DidContexts.ContextVCv1,
			["Person"],
			[credentialResult.jwt],
			{ expirationDate: new Date(Date.now() + 14400000) }
		);

		await identityConnector.revokeVerifiableCredentials(TEST_USER_IDENTITY, testDocumentId, [
			revocationIndex
		]);

		const jwtCheck = await identityConnector.checkVerifiablePresentation(presentationResult.jwt);
		expect(jwtCheck.revoked).toBeTruthy();

		const objectCheck = await identityConnector.checkVerifiablePresentation(
			presentationResult.verifiablePresentation
		);
		expect(objectCheck.revoked).toBeTruthy();
	});

	test("can fail to create a verifiable presentation with no verification method id", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_USER_IDENTITY,
				"",
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[testVcJwt],
				{ expirationDate: new Date(Date.now() + 14400000) }
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "verificationMethodId",
				value: ""
			}
		});
	});

	test("can fail to create a verifiable presentation with no verifiable credentials", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_USER_IDENTITY,
				testVerificationMethodId,
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[],
				{ expirationDate: new Date(Date.now() + 14400000) }
			)
		).rejects.toMatchObject({
			name: "GuardError",
			properties: {
				property: "verifiableCredentials",
				value: []
			}
		});
	});

	test("can fail to create a verifiable presentation with invalid expiry", async () => {
		await expect(
			identityConnector.createVerifiablePresentation(
				TEST_USER_IDENTITY,
				testVerificationMethodId,
				"http://example.com/12345",
				"https://schema.org",
				["Person"],
				[testVcJwt],
				{
					expirationDate: "foo" as unknown as Date
				}
			)
		).rejects.toHaveProperty("name", "GuardError");
	});

	test("can create a verifiable presentation", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/12345",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			{ expirationDate: new Date(Date.now() + 14400000) }
		);

		expect(result.verifiablePresentation["@context"]).toContain(DidContexts.ContextVCv1);
		expect(result.verifiablePresentation.type).toContain(DidTypes.VerifiablePresentation);
		expect(result.verifiablePresentation.type).toContain("Person");
		expect(result.verifiablePresentation.verifiableCredential).toBeDefined();
		expect((result.verifiablePresentation.verifiableCredential as string[])[0]).toEqual(testVcJwt);
		expect(result.verifiablePresentation.holder?.startsWith(DID_PREFIX)).toBeTruthy();
		expect(result.jwt.split(".").length).toEqual(3);
	});

	test("can create a verifiable presentation with custom jwt header fields", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/vp-header-test",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			{
				expirationDate: new Date(Date.now() + 14400000),
				jwtHeaderFields: { "x-custom": "header-value" }
			}
		);

		expect(result.jwt.split(".").length).toEqual(3);
		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.header).toMatchObject({ "x-custom": "header-value", typ: "JWT", alg: "EdDSA" });
		expect(decoded.header?.kid).toBeDefined();

		const check = await identityConnector.checkVerifiablePresentation(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiablePresentation).toBeDefined();
	});

	test("can create a verifiable presentation with custom jwt payload fields", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/vp-payload-test",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			{
				expirationDate: new Date(Date.now() + 14400000),
				jwtPayloadFields: { "x-custom": "payload-value" }
			}
		);

		expect(result.jwt.split(".").length).toEqual(3);
		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.payload).toMatchObject({ "x-custom": "payload-value" });
		expect(decoded.payload?.iss).toBeDefined();
		expect(decoded.payload?.nbf).toBeDefined();
		expect(decoded.payload?.vp).toBeDefined();

		const check = await identityConnector.checkVerifiablePresentation(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiablePresentation).toBeDefined();
	});

	test("standard jwt header fields take precedence over custom fields in verifiable presentation", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/vp-header-overwrite",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			{
				expirationDate: new Date(Date.now() + 14400000),
				jwtHeaderFields: { alg: "RS256", typ: "at+JWT", kid: "evil-kid" }
			}
		);

		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.header?.alg).toEqual("EdDSA");
		expect(decoded.header?.typ).toEqual("JWT");
		expect(decoded.header?.kid).toEqual(testVerificationMethodId);

		const check = await identityConnector.checkVerifiablePresentation(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiablePresentation).toBeDefined();
	});

	test("standard jwt payload fields take precedence over custom fields in verifiable presentation", async () => {
		const result = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/vp-payload-overwrite",
			DidContexts.ContextVCv1,
			["Person"],
			[testVcJwt],
			{
				expirationDate: new Date(Date.now() + 14400000),
				jwtPayloadFields: { iss: "evil-issuer" }
			}
		);

		const decoded = await Jwt.decode(result.jwt);
		expect(decoded.payload?.iss).toEqual(testDocumentId);

		const check = await identityConnector.checkVerifiablePresentation(result.jwt);
		expect(check.revoked).toBeFalsy();
		expect(check.verifiablePresentation).toBeDefined();
	});

	test("can fail to validate a verifiable presentation with no jwt", async () => {
		await expect(identityConnector.checkVerifiablePresentation("")).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.stringEmpty",
			properties: {
				property: "presentation",
				value: ""
			}
		});
	});

	test("can validate a verifiable presentation", async () => {
		const createResult = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/12345",
			"https://schema.org",
			["Person"],
			[testVcJwt],
			{ expirationDate: new Date(Date.now() + 14400000) }
		);

		const vpJwt = createResult.jwt;
		const jwtResult = await identityConnector.checkVerifiablePresentation(vpJwt);

		expect(jwtResult.revoked).toBeFalsy();
		expect(jwtResult.verifiablePresentation).toBeDefined();
		expect(jwtResult.verifiablePresentation?.["@context"]).toBeDefined();
		expect(jwtResult.verifiablePresentation?.type).toBeDefined();
		expect(jwtResult.verifiablePresentation?.verifiableCredential).toBeDefined();
		expect(jwtResult.verifiablePresentation?.holder).toBeDefined();
		expect(jwtResult.issuers).toBeDefined();
		expect(jwtResult.issuers?.length).toBeGreaterThan(0);

		const vpObject = createResult.verifiablePresentation;
		const objectResult = await identityConnector.checkVerifiablePresentation(vpObject);

		expect(objectResult.revoked).toBeFalsy();
		expect(objectResult.verifiablePresentation).toBeDefined();
		expect(objectResult.verifiablePresentation?.["@context"]).toBeDefined();
		expect(objectResult.verifiablePresentation?.type).toBeDefined();
	});

	test("can fail to validate a tampered verifiable presentation document", async () => {
		const createResult = await identityConnector.createVerifiablePresentation(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			"http://example.com/tampered",
			"https://schema.org",
			["Person"],
			[testVcJwt]
		);

		const tampered = {
			...createResult.verifiablePresentation,
			id: "http://example.com/tampered-different-id"
		};
		await expect(identityConnector.checkVerifiablePresentation(tampered)).rejects.toMatchObject({
			name: "GeneralError",
			message: `${StringHelper.camelCase(identityConnector.className())}.signatureVerificationFailed`
		});
	});

	test("can fail to create a proof with no verificationMethodId", async () => {
		await expect(
			identityConnector.createProof(
				TEST_USER_IDENTITY,
				undefined as unknown as string,
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.string",
			properties: {
				property: "verificationMethodId",
				value: "undefined"
			}
		});
	});

	test("can fail to create a proof with no document", async () => {
		await expect(
			identityConnector.createProof(
				TEST_USER_IDENTITY,
				"foo",
				ProofTypes.DataIntegrityProof,
				undefined as unknown as IJsonLdNodeObject
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "unsecureDocument",
				value: "undefined"
			}
		});
	});

	test("can create a proof", async () => {
		const testDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:example:123456789abcdefghi",
			name: "Test Document",
			description: "This is a test document for proof creation and verification"
		};
		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			testDocument
		);

		expect(proof).toBeDefined();
		expect(proof.type).toBe(ProofTypes.DataIntegrityProof);
		expect(proof.verificationMethod).toBe(testVerificationMethodId);
		expect(proof.proofPurpose).toBe("assertionMethod");
		expect(proof.created).toBeDefined();

		if (proof.type === ProofTypes.JsonWebSignature2020) {
			expect(proof.jws).toBeDefined();
		} else if (proof.type === ProofTypes.DataIntegrityProof) {
			expect(proof.proofValue).toBeDefined();
		}
	});

	test("should use vault signing without exposing private key", async () => {
		// eslint-disable-next-line @typescript-eslint/dot-notation
		const vaultConnector = identityConnector["_vaultConnector"];
		const getKeyTypeSpy = vi.spyOn(vaultConnector, "getKeyType");
		const signSpy = vi.spyOn(vaultConnector, "sign");

		const testDocument = {
			"@context": "https://www.w3.org/ns/did/v1",
			id: "did:example:123456789abcdefghi",
			name: "Test Document for Vault Security",
			description: "Verifies secure vault delegation pattern"
		};

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			testDocument
		);

		expect(getKeyTypeSpy).toHaveBeenCalledTimes(1);
		expect(signSpy).toHaveBeenCalledTimes(1);
		expect(proof).toBeDefined();
		expect(proof.type).toBe("DataIntegrityProof");

		getKeyTypeSpy.mockRestore();
		signSpy.mockRestore();
	});

	test("can fail to verify a proof with no document", async () => {
		await expect(
			identityConnector.verifyProof(
				undefined as unknown as IJsonLdNodeObject,
				undefined as unknown as IProof
			)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "document",
				value: "undefined"
			}
		});
	});

	test("can fail to verify a proof with no proof", async () => {
		await expect(
			identityConnector.verifyProof({}, undefined as unknown as IProof)
		).rejects.toMatchObject({
			name: "GuardError",
			message: "guard.objectUndefined",
			properties: {
				property: "proof",
				value: "undefined"
			}
		});
	});

	test("can verify a proof", async () => {
		const verificationMethodType = "assertionMethod";
		const verificationMethodId = "proofTestMethod";

		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
		const testDocumentId2 = document.id;

		const method = await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			testDocumentId2,
			verificationMethodType,
			verificationMethodId
		);

		expect(method).toBeDefined();
		expect(method.id).toBeDefined();

		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://www.w3.org/2018/credentials/examples/v1"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			method.id,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const isValid = await identityConnector.verifyProof(unsecuredDocument, proof);
		expect(isValid).toBeTruthy();
	});

	test("should fail to verify a tampered document", async () => {
		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://www.w3.org/2018/credentials/examples/v1"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const tamperedDocument = {
			...unsecuredDocument,
			name: "Tampered Document"
		} as unknown as IJsonLdNodeObject;

		const isValid = await identityConnector.verifyProof(tamperedDocument, proof);
		expect(isValid).toBeFalsy();
	});

	test("should fail to verify a tampered proof", async () => {
		const unsecuredDocument: IDidVerifiableCredential & IJsonLdNodeObject = {
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://www.w3.org/2018/credentials/examples/v1"
			],
			id: "urn:uuid:58172aac-d8ba-11ed-83dd-0b3aef56cc33",
			type: ["VerifiableCredential", "AlumniCredential"],
			name: "Alumni Credential",
			description: "A minimum viable example of an Alumni Credential.",
			issuer: "https://vc.example/issuers/5678",
			validFrom: "2023-01-01T00:00:00Z",
			credentialSubject: {
				id: "did:example:abcdefgh",
				alumniOf: "The School of Examples"
			}
		};

		const proof = await identityConnector.createProof(
			TEST_USER_IDENTITY,
			testVerificationMethodId,
			ProofTypes.DataIntegrityProof,
			unsecuredDocument
		);

		const tamperedProof = { ...proof };
		if (tamperedProof.type === "JsonWebSignature2020") {
			tamperedProof.jws += "tampered";
		} else if (tamperedProof.type === "DataIntegrityProof") {
			tamperedProof.proofValue += "tampered";
		}

		const isValid = await identityConnector.verifyProof(unsecuredDocument, tamperedProof);
		expect(isValid).toBeFalsy();
	});

	// ── IOTA-specific tests ───────────────────────────────────────────────────

	test("should follow IOTA DID Method Specification v2.0 format", async () => {
		const testDocument = await identityConnector.createDocument(TEST_USER_IDENTITY);

		// Check DID format based on network
		const didParts = testDocument.id.split(":");

		if (TEST_NETWORK === "testnet" || TEST_NETWORK === "devnet") {
			// For testnet/devnet, DID should include network identifier
			// Format: did:iota:network:objectId
			expect(didParts).toHaveLength(4);
			expect(didParts[0]).toBe("did");
			expect(didParts[1]).toBe("iota");
			expect(didParts[2]).toBe(TEST_NETWORK);
			expect(didParts[3]).toMatch(/^0x[\da-f]{64}$/);
		} else {
			// For mainnet (when network ID is "6364aad5"), DID should omit network identifier
			// Format: did:iota:objectId
			expect(didParts).toHaveLength(3);
			expect(didParts[0]).toBe("did");
			expect(didParts[1]).toBe("iota");
			expect(didParts[2]).toMatch(/^0x[\da-f]{64}$/);
		}
	});

	test("can verify verification methods in a resolved document", async () => {
		const documentId = testDocumentId;

		const verificationMethodType = "verificationMethod";
		// Must not reuse the testVcJwt signing key's fragment: inserting a method under an
		// existing fragment id replaces its relationship, which would break the scoped fixtures.
		const verificationMethodId = "resolvedMethodsGenericKey";

		await identityConnector.addVerificationMethod(
			TEST_USER_IDENTITY,
			documentId,
			verificationMethodType,
			verificationMethodId
		);

		const resolvedDocument = await identityResolverConnector.resolveDocument(documentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(documentId);

		expect(resolvedDocument.verificationMethod).toBeDefined();
		expect(Array.isArray(resolvedDocument.verificationMethod)).toBeTruthy();
		expect(resolvedDocument.verificationMethod?.length).toBeGreaterThan(0);

		// Find our specific verification method
		const specificMethod = resolvedDocument.verificationMethod?.find(method => {
			if (Is.string(method)) {
				return method === `${documentId}#${verificationMethodId}`;
			}
			return method.id === `${documentId}#${verificationMethodId}`;
		});

		// Verify the specific method exists and has correct properties
		expect(specificMethod).toBeDefined();
		if (!Is.string(specificMethod)) {
			expect(specificMethod?.id).toEqual(`${documentId}#${verificationMethodId}`);
			expect(specificMethod?.type).toEqual("JsonWebKey2020");
			expect(specificMethod?.controller).toEqual(documentId);

			// Verify the method has the expected properties for a JWK
			expect(specificMethod?.publicKeyJwk).toBeDefined();
			if (specificMethod?.publicKeyJwk) {
				expect(specificMethod.publicKeyJwk.kty).toBeDefined();
				expect(specificMethod.publicKeyJwk.crv).toBeDefined();
				expect(specificMethod.publicKeyJwk.x).toBeDefined();
			}
		}

		// Check that the document has the expected service structure
		expect(resolvedDocument.service).toBeDefined();
		expect(Array.isArray(resolvedDocument.service)).toBeTruthy();

		const revocationService = resolvedDocument.service?.find(service =>
			service.id.endsWith("#revocation")
		);

		expect(revocationService).toBeDefined();
		expect(revocationService?.type).toEqual("RevocationBitmap2022");
	});

	test("can resolve a document with added service", async () => {
		const resolvedDocument = await identityResolverConnector.resolveDocument(testDocumentId);

		expect(resolvedDocument).toBeDefined();
		expect(resolvedDocument.id).toEqual(testDocumentId);
		expect(resolvedDocument.service).toBeDefined();
		expect(Array.isArray(resolvedDocument.service)).toBeTruthy();

		const addedService = resolvedDocument.service?.find(
			service => service.id === `${testDocumentId}#testService`
		);

		expect(addedService).toBeDefined();
		expect(addedService?.type).toEqual("TestServiceType");
		expect(addedService?.serviceEndpoint).toEqual("https://example.com/service");
	});

	test("handles errors when unrevoking a verifiable credential with non-existent document", async () => {
		// Use a non-existent document ID
		const nonExistentDocumentId =
			"did:iota:e678123a:0x0000000000000000000000000000000000000000000000000000000000000000";

		// Attempt to unrevoke the credential and expect an error
		await expect(
			identityConnector.unrevokeVerifiableCredentials(
				TEST_USER_IDENTITY,
				nonExistentDocumentId,
				[123]
			)
		).rejects.toThrow();
	});

	test("can handle methods without a controller", async () => {
		const connectorWithoutController = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				didResolutionCacheTtlMs: 0
			}
		});

		expect(testVcJwt).toBeDefined();

		const checkResult = await connectorWithoutController.checkVerifiableCredential(testVcJwt);

		expect(checkResult).toBeDefined();
		expect(checkResult.revoked).toBeFalsy();
		expect(checkResult.verifiableCredential).toBeDefined();
	});
});
