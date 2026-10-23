// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { HttpMethod } from "@3sixty/web";
import { IdentityProfileRestClient } from "../src/identityProfileRestClient.js";
import {
	jsonResponse,
	noContentResponse,
	setupFetchMock,
	teardownFetchMock
} from "./helpers/restClientTestHelpers.js";

// OpenAPI spec: ../../identity-service/docs/open-api/spec.json
const ENDPOINT = "http://localhost:8080";
const PREFIX = "identity/profile";

const IDENTITY_URN = "urn:did:test:entity001";

const TEST_PUBLIC_PROFILE: IJsonLdNodeObject = {
	"@context": "https://schema.org/",
	type: "Person",
	name: "Alice",
	email: "alice@example.com"
};

const TEST_PRIVATE_PROFILE: IJsonLdNodeObject = {
	"@context": "https://schema.org/",
	type: "Person",
	dateOfBirth: "1990-01-01",
	address: "123 Main St"
};

const TEST_GET_RESPONSE = {
	identity: IDENTITY_URN,
	publicProfile: TEST_PUBLIC_PROFILE,
	privateProfile: TEST_PRIVATE_PROFILE
};

const TEST_LIST_RESPONSE = {
	items: [
		{
			identity: IDENTITY_URN,
			publicProfile: TEST_PUBLIC_PROFILE
		}
	],
	cursor: undefined
};

const TEST_ADMIN_LIST_RESPONSE = {
	items: [
		{
			identity: IDENTITY_URN,
			publicProfile: TEST_PUBLIC_PROFILE,
			privateProfile: TEST_PRIVATE_PROFILE
		}
	],
	cursor: undefined
};

const fetchMock = vi.fn();

describe("IdentityProfileRestClient", () => {
	let client: IdentityProfileRestClient<IJsonLdNodeObject, IJsonLdNodeObject>;

	beforeEach(() => {
		setupFetchMock(fetchMock);
		client = new IdentityProfileRestClient<IJsonLdNodeObject, IJsonLdNodeObject>({
			endpoint: ENDPOINT
		});
	});

	afterEach(() => {
		teardownFetchMock(fetchMock);
	});

	describe("create", () => {
		test("sends POST to /{prefix}", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.create(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends publicProfile and privateProfile in request body", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.create(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(body.privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.create(TEST_PUBLIC_PROFILE);

			expect(result).toBeUndefined();
		});
	});

	describe("get", () => {
		test("sends GET to /{prefix}/", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			await client.get();

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("includes publicPropertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			await client.get(["name"], undefined);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("publicPropertyNames=");
		});

		test("includes privatePropertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			await client.get(undefined, ["dateOfBirth"]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("privatePropertyNames=");
		});

		test("returns identity and profiles from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			const result = await client.get();

			expect(result.identity).toBe(IDENTITY_URN);
			expect(result.publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(result.privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});

		test("throws when identity is provided but not a string", async () => {
			await expect(
				// @ts-expect-error testing invalid input
				client.get(undefined, undefined, 123)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.string"
			});
		});

		test("sends GET to /{prefix}/:identity when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			await client.get(undefined, undefined, IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns identity and profiles from the response body when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_GET_RESPONSE));

			const result = await client.get(undefined, undefined, IDENTITY_URN);

			expect(result.identity).toBe(IDENTITY_URN);
			expect(result.publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(result.privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});
	});

	describe("getPublic", () => {
		test("throws when identity is not a string", async () => {
			await expect(
				// @ts-expect-error testing invalid input
				client.getPublic(null)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.string"
			});
		});

		test("sends GET to /{prefix}/:identity/public", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PUBLIC_PROFILE));

			await client.getPublic(IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}/public`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("includes propertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PUBLIC_PROFILE));

			await client.getPublic(IDENTITY_URN, ["name"]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("propertyNames=");
		});

		test("returns the public profile from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_PUBLIC_PROFILE));

			const result = await client.getPublic(IDENTITY_URN);

			expect(result).toEqual(TEST_PUBLIC_PROFILE);
		});
	});

	describe("update", () => {
		test("sends PUT to /{prefix}/", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.update(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.PUT);
		});

		test("sends publicProfile and privateProfile in request body", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.update(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(body.privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.update(TEST_PUBLIC_PROFILE);

			expect(result).toBeUndefined();
		});

		test("throws when identity is provided but not a string", async () => {
			await expect(
				// @ts-expect-error testing invalid input
				client.update(undefined, undefined, 123)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.string"
			});
		});

		test("sends PUT to /{prefix}/:identity when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.update(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE, IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}`);
			expect(options.method).toBe(HttpMethod.PUT);
		});

		test("sends publicProfile and privateProfile in request body when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.update(TEST_PUBLIC_PROFILE, TEST_PRIVATE_PROFILE, IDENTITY_URN);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(body.privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});
	});

	describe("remove", () => {
		test("sends DELETE to /{prefix}/", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.remove();

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.remove();

			expect(result).toBeUndefined();
		});

		test("throws when identity is provided but not a string", async () => {
			await expect(
				// @ts-expect-error testing invalid input
				client.remove(123)
			).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.string"
			});
		});

		test("sends DELETE to /{prefix}/:identity when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.remove(IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value when identity provided", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			const result = await client.remove(IDENTITY_URN);

			expect(result).toBeUndefined();
		});
	});

	describe("list", () => {
		test("sends GET to /{prefix}/query", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			await client.list();

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/query`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("includes cursor as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			await client.list(undefined, undefined, "page2");

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("cursor=page2");
		});

		test("includes limit as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			await client.list(undefined, undefined, undefined, 10);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("limit=10");
		});

		test("includes publicFilters as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			await client.list([{ propertyName: "name", propertyValue: "Alice" }]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("publicFilters=");
		});

		test("includes publicPropertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			await client.list(undefined, ["name"]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("publicPropertyNames=");
		});

		test("returns items from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			const result = await client.list();

			expect(result.items).toHaveLength(1);
			expect(result.items[0].identity).toBe(IDENTITY_URN);
		});

		test("returns undefined cursor when no cursor in response", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_LIST_RESPONSE));

			const result = await client.list();

			expect(result.cursor).toBeUndefined();
		});

		test("returns cursor from the response body when present", async () => {
			const responseWithCursor = { ...TEST_LIST_RESPONSE, cursor: "page2" };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseWithCursor));

			const result = await client.list();

			expect(result.cursor).toBe("page2");
		});
	});

	describe("listAdmin", () => {
		test("sends GET to /{prefix}/admin/query", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin();

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toContain(`${ENDPOINT}/${PREFIX}/admin/query`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("includes publicFilters as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin([{ propertyName: "name", propertyValue: "Alice" }]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("publicFilters=");
		});

		test("includes publicPropertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin(undefined, undefined, ["name"]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("publicPropertyNames=");
		});

		test("includes privateFilters as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin(undefined, [{ propertyName: "department", propertyValue: "Eng" }]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("privateFilters=");
		});

		test("includes privatePropertyNames as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin(undefined, undefined, undefined, ["dateOfBirth"]);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("privatePropertyNames=");
		});

		test("includes cursor as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin(undefined, undefined, undefined, undefined, "page2");

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("cursor=page2");
		});

		test("includes limit as query parameter when provided", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			await client.listAdmin(undefined, undefined, undefined, undefined, undefined, 10);

			const [url] = fetchMock.mock.calls[0];
			expect(url).toContain("limit=10");
		});

		test("returns items with public and private profiles from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			const result = await client.listAdmin();

			expect(result.items).toHaveLength(1);
			expect(result.items[0].identity).toBe(IDENTITY_URN);
			expect(result.items[0].publicProfile).toEqual(TEST_PUBLIC_PROFILE);
			expect(result.items[0].privateProfile).toEqual(TEST_PRIVATE_PROFILE);
		});

		test("returns undefined cursor when no cursor in response", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_ADMIN_LIST_RESPONSE));

			const result = await client.listAdmin();

			expect(result.cursor).toBeUndefined();
		});

		test("returns cursor from the response body when present", async () => {
			const responseWithCursor = { ...TEST_ADMIN_LIST_RESPONSE, cursor: "page2" };
			fetchMock.mockResolvedValueOnce(jsonResponse(responseWithCursor));

			const result = await client.listAdmin();

			expect(result.cursor).toBe("page2");
		});
	});
});
