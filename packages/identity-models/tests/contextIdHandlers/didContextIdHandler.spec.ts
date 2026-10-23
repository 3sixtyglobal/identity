// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@3sixty/core";
import { DidContextIdHandler } from "../../src/contextIdHandlers/didContextIdHandler.js";

describe("DidContextIdHandler", () => {
	let handler: DidContextIdHandler;

	beforeEach(() => {
		handler = new DidContextIdHandler();
	});

	describe("constructor", () => {
		test("should create an instance", () => {
			expect(handler).toBeInstanceOf(DidContextIdHandler);
		});
	});

	describe("short", () => {
		test("should return the identifier part of a valid DID", () => {
			const did = "did:example:0x0123456789abcdef";
			const result = handler.short(did);
			expect(result).toBe("ASNFZ4mrze8");
		});

		test("should return the identifier part for complex DIDs", () => {
			const did = "did:web:example.com:users:alice";
			const result = handler.short(did);
			expect(result).toBe("alice");
		});

		test("should return the identifier part for key DIDs", () => {
			const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
			const result = handler.short(did);
			expect(result).toBe("z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK");
		});

		test("should handle DIDs with minimal parts", () => {
			const did = "did:example:123";
			const result = handler.short(did);
			expect(result).toBe("123");
		});
	});

	describe("long", () => {
		test("should reconstruct a did:internal DID from a base64url short form", () => {
			const result = handler.long("ASNFZ4mrze8");
			expect(result).toBe("did:internal:0x0123456789abcdef");
		});

		test("should return the value as-is when it is a full DID", () => {
			const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
			expect(handler.long(did)).toBe(did);
		});

		test("should return the value as-is when it contains non-base64url characters", () => {
			const did = "did:web:example.com";
			expect(handler.long(did)).toBe(did);
		});
	});

	describe("short → long → short roundtrip", () => {
		test("should return the original short form after expanding a hex DID and shortening again", () => {
			const did = "did:example:0x0123456789abcdef";
			const shortened = handler.short(did);
			const expanded = handler.long(shortened);
			expect(handler.short(expanded)).toBe(shortened);
		});
	});

	describe("guard", () => {
		test("should not throw for valid DIDs", () => {
			expect(() => handler.guard("did:example:123456789abcdefghi")).not.toThrow();
			expect(() => handler.guard("did:web:example.com")).not.toThrow();
			expect(() =>
				handler.guard("did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK")
			).not.toThrow();
		});

		test("should throw GuardError for invalid URN format", () => {
			expect(() => handler.guard("invalid")).toThrow(GuardError);
			expect(() => handler.guard("")).toThrow(GuardError);
			expect(() => handler.guard("http://example.com")).toThrow(GuardError);
		});

		test("should throw GuardError for DIDs with too few parts", () => {
			expect(() => handler.guard("did")).toThrow(GuardError);
			expect(() => handler.guard("did:")).toThrow(GuardError);
			expect(() => handler.guard("did:example")).toThrow(GuardError);
			expect(() => handler.guard("did:example:")).toThrow(GuardError);
		});

		test("should throw GuardError for non-DID URNs", () => {
			expect(() => handler.guard("urn:example:123")).toThrow(GuardError);
			expect(() => handler.guard("uuid:550e8400-e29b-41d4-a716-446655440000")).toThrow(GuardError);
		});

		test("should throw GuardError with correct error codes", () => {
			try {
				handler.guard("did:example");
			} catch (error) {
				expect(error).toBeInstanceOf(GuardError);
				expect((error as GuardError).source).toBe("Did");
				expect((error as GuardError).message).toBe("guard.didPartsTooFew");
			}

			try {
				handler.guard("urn:example:123:aaa");
			} catch (error) {
				expect(error).toBeInstanceOf(GuardError);
				expect((error as GuardError).source).toBe("Did");
				expect((error as GuardError).message).toBe("guard.didInvalidStart");
			}
		});

		test("should throw GuardError for null or undefined", () => {
			expect(() => handler.guard(null as unknown as string)).toThrow(GuardError);
			expect(() => handler.guard(undefined as unknown as string)).toThrow(GuardError);
		});
	});
});
