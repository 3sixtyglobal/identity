// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@3sixty/core";
import { DidContexts, type IDidDocument } from "@3sixty/standards-w3c-did";
import { HttpMethod } from "@3sixty/web";
import { IdentityResolverRestClient } from "../src/identityResolverRestClient.js";
import {
	jsonResponse,
	setupFetchMock,
	teardownFetchMock
} from "./helpers/restClientTestHelpers.js";

// OpenAPI spec: ../../identity-service/docs/open-api/spec.json
const ENDPOINT = "http://localhost:8080";
const PREFIX = "identity";

const IDENTITY_URN = "urn:did:test:entity001";

const TEST_DID_DOCUMENT: IDidDocument = {
	"@context": DidContexts.Context,
	id: IDENTITY_URN
};

const fetchMock = vi.fn();

describe("IdentityResolverRestClient", () => {
	let client: IdentityResolverRestClient;

	beforeEach(() => {
		setupFetchMock(fetchMock);
		client = new IdentityResolverRestClient({ endpoint: ENDPOINT });
	});

	afterEach(() => {
		teardownFetchMock(fetchMock);
	});

	describe("identityResolve", () => {
		test("throws when documentId is not a URN", async () => {
			await expect(client.identityResolve("not-a-urn")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.urn"
			});
		});

		test("sends GET to /{prefix}/:identity", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			await client.identityResolve(IDENTITY_URN);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${IDENTITY_URN}`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns the DID document from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_DID_DOCUMENT));

			const result = await client.identityResolve(IDENTITY_URN);

			expect(result).toEqual(TEST_DID_DOCUMENT);
		});
	});
});
