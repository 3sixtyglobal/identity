// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import {
	DidContexts,
	DidVerificationMethodType,
	type IDataIntegrityProof,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredentialV1,
	type IDidVerifiablePresentationV1,
	ProofTypes
} from "@3sixty/standards-w3c-did";
import { HttpMethod } from "@3sixty/web";
import { IdentityRestClient } from "../src/identityRestClient.js";
import {
	jsonResponse,
	noContentResponse,
	setupFetchMock,
	teardownFetchMock
} from "./helpers/restClientTestHelpers.js";

// OpenAPI spec: ../../identity-service/docs/open-api/spec.json
const ENDPOINT = "http://localhost:8080";
const PREFIX = "identity";

const IDENTITY_URN = "urn:did:test:entity001";
const VERIFICATION_METHOD_ID = `${IDENTITY_URN}#key-1`;
const SERVICE_ID = `${IDENTITY_URN}#service-1`;
const ALIAS = "urn:did:test:alias001";
const JWT_TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJ1cm46ZGlkOnRlc3Q6ZW50aXR5MDAxIn0.signature";
const CREDENTIAL_INDEX = 0;

const TEST_DID_DOCUMENT: IDidDocument = {
	"@context": DidContexts.Context,
	id: IDENTITY_URN
};

const TEST_VERIFICATION_METHOD: IDidDocumentVerificationMethod = {
	id: VERIFICATION_METHOD_ID,
	controller: IDENTITY_URN,
	type: "JsonWebKey2020"
};

const TEST_SERVICE: IDidService = {
	id: SERVICE_ID,
	type: "LinkedDomains",
	serviceEndpoint: "https://example.com"
};

const TEST_SUBJECT: IJsonLdNodeObject = {
	id: "urn:did:test:subject001",
	type: "Person"
};

const TEST_VC: IDidVerifiableCredentialV1 = {
	"@context": DidContexts.ContextVCv1,
	type: "VerifiableCredential",
	credentialSubject: TEST_SUBJECT
};

const TEST_VP: IDidVerifiablePresentationV1 = {
	"@context": DidContexts.ContextVCv1,
	type: "VerifiablePresentation",
	verifiableCredential: [JWT_TOKEN]
};

const TEST_PROOF: IDataIntegrityProof = {
	type: ProofTypes.DataIntegrityProof,
	cryptosuite: "eddsa-2022",
	proofPurpose: "assertionMethod",
	verificationMethod: VERIFICATION_METHOD_ID,
	proofValue: "z58DAdFfa9SkqZMVPxAQpic9dFgJqeH3"
};

const TEST_UNSIGNED_DOCUMENT: IJsonLdNodeObject = {
	"@context": "https://schema.org/",
	type: "Person",
	name: "Alice"
};

const fetchMock = vi.fn();

describe("IdentityRestClient", () => {
	let client: IdentityRestClient;

	beforeEach(() => {
		setupFetchMock(fetchMock);
		client = new IdentityRestClient({ endpoint: ENDPOINT });
	});

	afterEach(() => {
		teardownFetchMock(fetchMock);
	});

	describe("identityCreate", () => {
		test("sends POST to /{prefix}", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			await client.identityCreate();

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends namespace in request body when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			await client.identityCreate("iota");

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.namespace).toBe("iota");
			expect(body.selfControlled).toBeUndefined();
		});

		test("throws when a controller is provided", async () => {
			await expect(client.identityCreate("iota", "did:iota:other")).rejects.toMatchObject({
				name: "NotSupportedError",
				message: "identityRestClient.controllerNotSupported"
			});
			expect(fetchMock).not.toHaveBeenCalled();
		});

		test("sends selfControlled in request body when the option is set", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			await client.identityCreate("iota", undefined, { selfControlled: true });

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.namespace).toBe("iota");
			expect(body.selfControlled).toBe(true);
		});

		test("returns the DID document from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			const result = await client.identityCreate();

			expect(result).toEqual(TEST_DID_DOCUMENT);
		});
	});

	describe("identityRemove", () => {
		test("throws when identity is empty", async () => {
			await expect(client.identityRemove("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:identity", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.identityRemove(IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.identityRemove(IDENTITY_URN);

			expect(result).toBeUndefined();
		});
	});

	describe("verificationMethodCreate", () => {
		test("throws when identity is empty", async () => {
			await expect(
				client.verificationMethodCreate("", DidVerificationMethodType.Authentication)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/verification-method", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION_METHOD));

			await client.verificationMethodCreate(IDENTITY_URN, DidVerificationMethodType.Authentication);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verification-method`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends verificationMethodType in request body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION_METHOD));

			await client.verificationMethodCreate(IDENTITY_URN, DidVerificationMethodType.Authentication);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.verificationMethodType).toBe(DidVerificationMethodType.Authentication);
		});

		test("sends verificationMethodId in request body when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION_METHOD));

			await client.verificationMethodCreate(
				IDENTITY_URN,
				DidVerificationMethodType.Authentication,
				"key-1"
			);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.verificationMethodId).toBe("key-1");
		});

		test("returns the verification method from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION_METHOD));

			const result = await client.verificationMethodCreate(
				IDENTITY_URN,
				DidVerificationMethodType.Authentication
			);

			expect(result).toEqual(TEST_VERIFICATION_METHOD);
		});
	});

	describe("verificationMethodRemove", () => {
		test("throws when verificationMethodId is empty", async () => {
			await expect(client.verificationMethodRemove("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:identity/verification-method/:verificationMethodId", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.verificationMethodRemove(VERIFICATION_METHOD_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verification-method/key-1`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.verificationMethodRemove(VERIFICATION_METHOD_ID);

			expect(result).toBeUndefined();
		});
	});

	describe("serviceCreate", () => {
		test("throws when identity is empty", async () => {
			await expect(
				client.serviceCreate("", SERVICE_ID, "LinkedDomains", "https://example.com")
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("throws when serviceId is empty", async () => {
			await expect(
				client.serviceCreate(IDENTITY_URN, "", "LinkedDomains", "https://example.com")
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/service", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_SERVICE));

			await client.serviceCreate(IDENTITY_URN, SERVICE_ID, "LinkedDomains", "https://example.com");

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/service`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends serviceId, type and endpoint in request body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_SERVICE));

			await client.serviceCreate(IDENTITY_URN, SERVICE_ID, "LinkedDomains", "https://example.com");

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.serviceId).toBe(SERVICE_ID);
			expect(body.type).toBe("LinkedDomains");
			expect(body.endpoint).toBe("https://example.com");
		});

		test("returns the service from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_SERVICE));

			const result = await client.serviceCreate(
				IDENTITY_URN,
				SERVICE_ID,
				"LinkedDomains",
				"https://example.com"
			);

			expect(result).toEqual(TEST_SERVICE);
		});
	});

	describe("serviceRemove", () => {
		test("throws when serviceId is empty", async () => {
			await expect(client.serviceRemove("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:identity/service/:serviceId", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.serviceRemove(SERVICE_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/service/service-1`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.serviceRemove(SERVICE_ID);

			expect(result).toBeUndefined();
		});
	});

	describe("alsoKnownAsAdd", () => {
		test("throws when documentId is empty", async () => {
			await expect(client.alsoKnownAsAdd("", ALIAS)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("throws when alias is empty", async () => {
			await expect(client.alsoKnownAsAdd(IDENTITY_URN, "")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/alias", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.alsoKnownAsAdd(IDENTITY_URN, ALIAS);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/alias`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends alias in request body", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.alsoKnownAsAdd(IDENTITY_URN, ALIAS);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.alias).toBe(ALIAS);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.alsoKnownAsAdd(IDENTITY_URN, ALIAS);

			expect(result).toBeUndefined();
		});
	});

	describe("alsoKnownAsRemove", () => {
		test("throws when documentId is empty", async () => {
			await expect(client.alsoKnownAsRemove("", ALIAS)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("throws when alias is empty", async () => {
			await expect(client.alsoKnownAsRemove(IDENTITY_URN, "")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:identity/alias/:alias", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.alsoKnownAsRemove(IDENTITY_URN, ALIAS);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/alias/${ALIAS}`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.alsoKnownAsRemove(IDENTITY_URN, ALIAS);

			expect(result).toBeUndefined();
		});
	});

	describe("verifiableCredentialCreate", () => {
		test("throws when verificationMethodId is empty", async () => {
			await expect(
				client.verifiableCredentialCreate("", undefined, TEST_SUBJECT)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/verifiable-credential", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ verifiableCredential: TEST_VC, jwt: JWT_TOKEN })
			);

			await client.verifiableCredentialCreate(VERIFICATION_METHOD_ID, undefined, TEST_SUBJECT);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verifiable-credential`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends subject in request body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ verifiableCredential: TEST_VC, jwt: JWT_TOKEN })
			);

			await client.verifiableCredentialCreate(VERIFICATION_METHOD_ID, undefined, TEST_SUBJECT);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.subject).toEqual(TEST_SUBJECT);
		});

		test("sends credentialId in request body when provided", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ verifiableCredential: TEST_VC, jwt: JWT_TOKEN })
			);

			await client.verifiableCredentialCreate(VERIFICATION_METHOD_ID, "urn:cred:001", TEST_SUBJECT);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.credentialId).toBe("urn:cred:001");
		});

		test("returns the verifiable credential and jwt from the response body", async () => {
			const responseData = { verifiableCredential: TEST_VC, jwt: JWT_TOKEN };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiableCredentialCreate(
				VERIFICATION_METHOD_ID,
				undefined,
				TEST_SUBJECT
			);

			expect(result).toEqual(responseData);
		});
	});

	describe("verifiableCredentialVerify (JWT string)", () => {
		test("throws when credential string is empty", async () => {
			await expect(client.verifiableCredentialVerify("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends GET to /{prefix}/verifiable-credential/verify with jwt query param", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiableCredential: TEST_VC })
			);

			await client.verifiableCredentialVerify(JWT_TOKEN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/verifiable-credential/verify`);
			expect(url).toContain("jwt=");
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns revoked status and credential from the response body", async () => {
			const responseData = { revoked: false, verifiableCredential: TEST_VC };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiableCredentialVerify(JWT_TOKEN);

			expect(result).toEqual(responseData);
		});
	});

	describe("verifiableCredentialVerify (document object)", () => {
		test("sends POST to /{prefix}/verifiable-credential/verify/document", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiableCredential: TEST_VC })
			);

			await client.verifiableCredentialVerify(TEST_VC);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/verifiable-credential/verify/document`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends the credential document as request body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiableCredential: TEST_VC })
			);

			await client.verifiableCredentialVerify(TEST_VC);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.type).toBe("VerifiableCredential");
		});

		test("returns revoked status from the response body", async () => {
			const responseData = { revoked: false, verifiableCredential: TEST_VC };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiableCredentialVerify(TEST_VC);

			expect(result).toEqual(responseData);
		});
	});

	describe("verifiableCredentialRevoke", () => {
		test("throws when issuerId is empty", async () => {
			await expect(client.verifiableCredentialRevoke("", CREDENTIAL_INDEX)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("throws when credentialIndex is not an integer", async () => {
			await expect(client.verifiableCredentialRevoke(IDENTITY_URN, 1.5)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.integer"
			});
		});

		test("sends GET to /{prefix}/:identity/verifiable-credential/revoke/:revocationIndex", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.verifiableCredentialRevoke(IDENTITY_URN, CREDENTIAL_INDEX);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(
				`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verifiable-credential/revoke/${CREDENTIAL_INDEX}`
			);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.verifiableCredentialRevoke(IDENTITY_URN, CREDENTIAL_INDEX);

			expect(result).toBeUndefined();
		});
	});

	describe("verifiableCredentialUnrevoke", () => {
		test("throws when issuerId is empty", async () => {
			await expect(client.verifiableCredentialUnrevoke("", CREDENTIAL_INDEX)).rejects.toMatchObject(
				{
					name: GuardError.CLASS_NAME,
					message: "guard.stringEmpty"
				}
			);
		});

		test("throws when credentialIndex is not an integer", async () => {
			await expect(client.verifiableCredentialUnrevoke(IDENTITY_URN, 1.5)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.integer"
			});
		});

		test("sends GET to /{prefix}/:identity/verifiable-credential/unrevoke/:revocationIndex", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.verifiableCredentialUnrevoke(IDENTITY_URN, CREDENTIAL_INDEX);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(
				`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verifiable-credential/unrevoke/${CREDENTIAL_INDEX}`
			);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.verifiableCredentialUnrevoke(IDENTITY_URN, CREDENTIAL_INDEX);

			expect(result).toBeUndefined();
		});
	});

	describe("verifiablePresentationCreate", () => {
		test("throws when verificationMethodId is empty", async () => {
			await expect(
				client.verifiablePresentationCreate("", undefined, undefined, undefined, [JWT_TOKEN])
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/verifiable-presentation", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ verifiablePresentation: TEST_VP, jwt: JWT_TOKEN })
			);

			await client.verifiablePresentationCreate(
				VERIFICATION_METHOD_ID,
				undefined,
				undefined,
				undefined,
				[JWT_TOKEN]
			);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/verifiable-presentation`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends verifiableCredentials in request body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ verifiablePresentation: TEST_VP, jwt: JWT_TOKEN })
			);

			await client.verifiablePresentationCreate(
				VERIFICATION_METHOD_ID,
				undefined,
				undefined,
				undefined,
				[JWT_TOKEN]
			);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.verifiableCredentials).toEqual([JWT_TOKEN]);
		});

		test("returns the verifiable presentation and jwt from the response body", async () => {
			const responseData = { verifiablePresentation: TEST_VP, jwt: JWT_TOKEN };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiablePresentationCreate(
				VERIFICATION_METHOD_ID,
				undefined,
				undefined,
				undefined,
				[JWT_TOKEN]
			);

			expect(result).toEqual(responseData);
		});
	});

	describe("verifiablePresentationVerify (JWT string)", () => {
		test("throws when presentation string is empty", async () => {
			await expect(client.verifiablePresentationVerify("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/verifiable-presentation/verify with jwt query param", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiablePresentation: TEST_VP })
			);

			await client.verifiablePresentationVerify(JWT_TOKEN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/verifiable-presentation/verify`);
			expect(url).toContain("jwt=");
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("returns revoked status and presentation from the response body", async () => {
			const responseData = { revoked: false, verifiablePresentation: TEST_VP };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiablePresentationVerify(JWT_TOKEN);

			expect(result).toEqual(responseData);
		});
	});

	describe("verifiablePresentationVerify (document object)", () => {
		test("sends POST to /{prefix}/verifiable-presentation/verify/document", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiablePresentation: TEST_VP })
			);

			await client.verifiablePresentationVerify(TEST_VP);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/verifiable-presentation/verify/document`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends the presentation document as request body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ revoked: false, verifiablePresentation: TEST_VP })
			);

			await client.verifiablePresentationVerify(TEST_VP);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.type).toBe("VerifiablePresentation");
		});

		test("returns revoked status from the response body", async () => {
			const responseData = { revoked: false, verifiablePresentation: TEST_VP };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseData));

			const result = await client.verifiablePresentationVerify(TEST_VP);

			expect(result).toEqual(responseData);
		});
	});

	describe("proofCreate", () => {
		test("throws when verificationMethodId is empty", async () => {
			await expect(
				client.proofCreate("", ProofTypes.DataIntegrityProof, TEST_UNSIGNED_DOCUMENT)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends POST to /{prefix}/:identity/proof", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PROOF));

			await client.proofCreate(
				VERIFICATION_METHOD_ID,
				ProofTypes.DataIntegrityProof,
				TEST_UNSIGNED_DOCUMENT
			);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/proof`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends document and proofType in request body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PROOF));

			await client.proofCreate(
				VERIFICATION_METHOD_ID,
				ProofTypes.DataIntegrityProof,
				TEST_UNSIGNED_DOCUMENT
			);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.document).toEqual(TEST_UNSIGNED_DOCUMENT);
			expect(body.proofType).toBe(ProofTypes.DataIntegrityProof);
		});

		test("returns the proof from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PROOF));

			const result = await client.proofCreate(
				VERIFICATION_METHOD_ID,
				ProofTypes.DataIntegrityProof,
				TEST_UNSIGNED_DOCUMENT
			);

			expect(result).toEqual(TEST_PROOF);
		});
	});

	describe("proofVerify", () => {
		test("throws when document is not an object", async () => {
			await expect(
				// @ts-expect-error testing invalid input
				client.proofVerify(null, TEST_PROOF)
			).rejects.toBeDefined();
		});

		test("sends POST to /{prefix}/proof/verify", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ verified: true }));

			await client.proofVerify(TEST_UNSIGNED_DOCUMENT, TEST_PROOF);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/proof/verify`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends document and proof in request body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ verified: true }));

			await client.proofVerify(TEST_UNSIGNED_DOCUMENT, TEST_PROOF);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.document).toEqual(TEST_UNSIGNED_DOCUMENT);
			expect(body.proof).toEqual(TEST_PROOF);
		});

		test("returns true when the proof is verified", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ verified: true }));

			const result = await client.proofVerify(TEST_UNSIGNED_DOCUMENT, TEST_PROOF);

			expect(result).toBe(true);
		});

		test("returns false when the proof fails verification", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ verified: false }));

			const result = await client.proofVerify(TEST_UNSIGNED_DOCUMENT, TEST_PROOF);

			expect(result).toBe(false);
		});
	});
});
