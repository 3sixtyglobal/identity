// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Is } from "@3sixty/core";
import {
	setupTestEnv,
	TEST_CLIENT_OPTIONS,
	TEST_USER_IDENTITY,
	TEST_MNEMONIC_NAME,
	TEST_NETWORK,
	TEST_GAS_BUDGET
} from "./setupTestEnv.js";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";

/**
 * The node rejects a transaction that references an owned object version a concurrent transaction
 * has already consumed. The public testnet endpoint is load balanced, so a replica that has not yet
 * indexed the previous transaction can hand back a stale gas coin, which is what this reproduces.
 */
const STALE_OBJECT_ERROR =
	"Transaction execution failed due to issues with transaction inputs, please review the errors and try again:\n" +
	"- Object ID 0x0000000000000000000000000000000000000000000000000000000000000001 Version 1 Digest 11111111111111111111111111111111 is not available for consumption, current version: 2";

const NON_RETRYABLE_ERROR = "Invalid user signature: signature is not valid for the given address";

let identityConnector: IotaIdentityConnector;

/**
 * Fail the first executions of a transaction block with the supplied node error, then let every
 * later call through to the real network.
 * @param errorMessage The node error message to return.
 * @param failureCount How many execution attempts to fail before letting them through.
 * @returns Handles to count the execution attempts and remove the interception.
 */
function failExecutions(
	errorMessage: string,
	failureCount: number
): { attempts: () => number; restore: () => void } {
	const realFetch = globalThis.fetch.bind(globalThis);
	let attempts = 0;

	const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		if (Is.string(init?.body) && init.body.includes('"iota_executeTransactionBlock"')) {
			attempts++;
			if (attempts <= failureCount) {
				const request = JSON.parse(init.body);
				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						id: request.id,
						error: { code: -32002, message: errorMessage }
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}
		}
		return realFetch(input, init);
	});

	return {
		attempts: () => attempts,
		restore: () => fetchSpy.mockRestore()
	};
}

describe("IotaIdentityConnector object conflict retries", () => {
	beforeAll(async () => {
		await setupTestEnv();

		identityConnector = new IotaIdentityConnector({
			config: {
				clientOptions: TEST_CLIENT_OPTIONS,
				vaultMnemonicId: TEST_MNEMONIC_NAME,
				network: TEST_NETWORK,
				gasBudget: TEST_GAS_BUDGET,
				didResolutionCacheTtlMs: 0
			}
		});
	});

	test("retries createDocument when the referenced object version is stale", async () => {
		const intercept = failExecutions(STALE_OBJECT_ERROR, 1);

		try {
			const document = await identityConnector.createDocument(TEST_USER_IDENTITY);
			expect(document.id.startsWith("did:iota")).toBeTruthy();
		} finally {
			intercept.restore();
		}

		expect(intercept.attempts()).toEqual(2);
	});

	test("retries removeDocument when the referenced object version is stale", async () => {
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);

		const intercept = failExecutions(STALE_OBJECT_ERROR, 1);

		try {
			await identityConnector.removeDocument(TEST_USER_IDENTITY, document.id);
		} finally {
			intercept.restore();
		}

		expect(intercept.attempts()).toEqual(2);
	});

	test("retries a document update when the referenced object version is stale", async () => {
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);

		const intercept = failExecutions(STALE_OBJECT_ERROR, 1);

		try {
			const service = await identityConnector.addService(
				TEST_USER_IDENTITY,
				document.id,
				"retryService",
				"TestServiceType",
				"https://example.com/service"
			);
			expect(service.id).toEqual(`${document.id}#retryService`);
		} finally {
			intercept.restore();
		}

		expect(intercept.attempts()).toEqual(2);
	});

	test("does not retry an error that is not an object conflict", async () => {
		const document = await identityConnector.createDocument(TEST_USER_IDENTITY);

		const intercept = failExecutions(NON_RETRYABLE_ERROR, 1);

		try {
			await expect(
				identityConnector.removeDocument(TEST_USER_IDENTITY, document.id)
			).rejects.toMatchObject({
				name: "GeneralError",
				message: "iotaIdentityConnector.removeDocumentFailed"
			});
		} finally {
			intercept.restore();
		}

		expect(intercept.attempts()).toEqual(1);
	});
});
