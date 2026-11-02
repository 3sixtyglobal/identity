// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { Converter } from "@3sixty/core";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import type { IIdentityExport } from "../../src/models/IIdentityExport.js";
import { IdentityExportHelper } from "../../src/utils/identityExportHelper.js";

const DID = "did:entity-storage:0x0101010101010101010101010101010101010101010101010101010101010101";
const PUBLIC_KEY = new Uint8Array(32).fill(7);

function createExport(): IIdentityExport {
	const document: IDidDocument = {
		"@context": "https://www.w3.org/ns/did/v1",
		id: DID,
		assertionMethod: [
			{
				id: `${DID}#key-1`,
				controller: DID,
				type: "JsonWebKey2020",
				publicKeyJwk: {
					kty: "OKP",
					crv: "Ed25519",
					x: Converter.bytesToBase64Url(PUBLIC_KEY)
				}
			}
		]
	};

	return {
		version: IdentityExportHelper.VERSION,
		namespace: "entity-storage",
		selfControlled: false,
		document,
		keys: [
			{
				id: "key-1",
				type: "Ed25519",
				privateKey: Converter.bytesToBase64(new Uint8Array(32).fill(1)),
				publicKey: Converter.bytesToBase64(PUBLIC_KEY)
			}
		]
	};
}

describe("IdentityExportHelper", () => {
	test("can validate a well formed export", () => {
		expect(IdentityExportHelper.validate(createExport(), "entity-storage")).toEqual(DID);
	});

	test("can fail to validate an export which is not an object", () => {
		expect(() =>
			IdentityExportHelper.validate(undefined as unknown as IIdentityExport, "entity-storage")
		).toThrow("identityExportHelper.invalidExport");
	});

	test("can fail to validate an unsupported version", () => {
		const exported = createExport();
		exported.version = 99;
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.unsupportedVersion"
		);
	});

	test("can fail to validate a different namespace", () => {
		expect(() => IdentityExportHelper.validate(createExport(), "iota")).toThrow(
			"identityExportHelper.namespaceMismatch"
		);
	});

	test("can fail to validate a DID from another namespace", () => {
		const exported = createExport();
		exported.document.id = "did:iota:testnet:0x01";
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.didNamespaceMismatch"
		);
	});

	test("can fail to validate a DID with a fragment", () => {
		const exported = createExport();
		exported.document.id = `${DID}#key-1`;
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.didNamespaceMismatch"
		);
	});

	test("can fail to validate a malformed DID", () => {
		const exported = createExport();
		exported.document.id = "not-a-did";
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow();
	});

	test("can fail to validate a key id which could escape the vault key name", () => {
		const exported = createExport();
		exported.keys[0].id = "../other";
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidKey"
		);
	});

	test.each([".", "..", "did-", "did_", "-key", "key.", "account", "account_0_0_0", "account.0"])(
		"can fail to validate the key id %s which a vault could map onto another name",
		keyId => {
			const exported = createExport();
			exported.keys[0].id = keyId;
			expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
				"identityExportHelper.invalidKey"
			);
		}
	);

	test.each(["k", "key-1", "my_key.v2", "accounts", "account-1"])(
		"can validate the key id %s",
		keyId => {
			const exported = createExport();
			exported.keys[0].id = keyId;
			expect(IdentityExportHelper.validate(exported, "entity-storage")).toEqual(DID);
		}
	);

	test.each(["..", "key-", "account_0_0_0"])(
		"can fail to validate the method fragment %s which a vault could map onto another name",
		fragment => {
			const exported = createExport();
			exported.document.authentication = [`${DID}#${fragment}`];
			expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
				"identityExportHelper.invalidMethodId"
			);
		}
	);

	test("can fail to validate duplicate key ids", () => {
		const exported = createExport();
		exported.keys.push({ ...exported.keys[0] });
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidKey"
		);
	});

	test("can fail to validate an unsupported key type", () => {
		const exported = createExport();
		exported.keys[0].type = "RSA" as unknown as "Ed25519";
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.unsupportedKeyType"
		);
	});

	test("does not include key material in errors", () => {
		const exported = createExport();
		exported.keys[0].privateKey = "not base64 !!";
		try {
			IdentityExportHelper.validate(exported, "entity-storage");
			expect.fail("should have thrown");
		} catch (error) {
			expect(JSON.stringify(error)).not.toContain("not base64 !!");
			expect(error).toMatchObject({
				message: "identityExportHelper.invalidKey",
				properties: { keyId: "key-1" }
			});
		}
	});

	test("can fail to validate an invalid account", () => {
		const exported = createExport();
		exported.account = { mnemonic: "" };
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidAccount"
		);
	});

	test("can verify method keys", () => {
		const exported = createExport();
		expect(() =>
			IdentityExportHelper.verifyMethodKeys(exported.document, exported.keys)
		).not.toThrow();
	});

	test("can fail to verify a key with no method", () => {
		const exported = createExport();
		exported.keys[0].id = "key-2";
		expect(() => IdentityExportHelper.verifyMethodKeys(exported.document, exported.keys)).toThrow(
			"identityExportHelper.methodNotFound"
		);
	});

	test("can fail to verify a key which does not match its method", () => {
		const exported = createExport();
		exported.keys[0].publicKey = Converter.bytesToBase64(new Uint8Array(32).fill(8));
		expect(() => IdentityExportHelper.verifyMethodKeys(exported.document, exported.keys)).toThrow(
			"identityExportHelper.methodKeyMismatch"
		);
	});

	test("can get the method fragments", () => {
		const exported = createExport();
		exported.document.authentication = [`${DID}#key-1`, "did:other:123#foreign"];
		expect(IdentityExportHelper.getMethodFragments(exported.document)).toEqual(["key-1"]);
	});

	test("can validate a DID which matches the connector format", () => {
		expect(
			IdentityExportHelper.validate(
				createExport(),
				"entity-storage",
				/^did:entity-storage:0x[\da-f]{64}$/
			)
		).toEqual(DID);
	});

	test("can fail to validate a DID which does not match the connector format", () => {
		const exported = createExport();
		exported.document.id = "did:entity-storage:0xABC";
		expect(() =>
			IdentityExportHelper.validate(
				exported,
				"entity-storage",
				/^did:entity-storage:0x[\da-f]{64}$/
			)
		).toThrow("identityExportHelper.invalidDidFormat");
	});

	test("can fail to validate a method fragment which could escape the vault key name", () => {
		const exported = createExport();
		exported.document.authentication = [`${DID}#../other`];
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidMethodId"
		);
	});

	test("can fail to validate a foreign method fragment which could escape the vault key name", () => {
		const exported = createExport();
		exported.document.authentication = ["did:other:123#a/b"];
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidMethodId"
		);
	});

	test("can fail to validate a method without an id", () => {
		const exported = createExport();
		exported.document.authentication = [{} as unknown as string];
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.invalidDocument"
		);
	});

	test("can fail to validate too many keys", () => {
		const exported = createExport();
		exported.keys = Array.from({ length: IdentityExportHelper.DEFAULT_MAX_KEYS + 1 }, (v, i) => ({
			...exported.keys[0],
			id: `key-${i}`
		}));
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).toThrow(
			"identityExportHelper.tooManyKeys"
		);
	});

	test("can validate within the limits given", () => {
		const exported = createExport();
		exported.keys = [exported.keys[0], { ...exported.keys[0], id: "key-2" }];
		expect(() =>
			IdentityExportHelper.validate(exported, "entity-storage", undefined, { maxKeys: 1 })
		).toThrow("identityExportHelper.tooManyKeys");
	});

	test("can validate a large document, its content is checked rather than its size", () => {
		const exported = createExport();
		exported.document.alsoKnownAs = [`did:example:${"a".repeat(262144)}`];
		expect(() => IdentityExportHelper.validate(exported, "entity-storage")).not.toThrow();
	});

	test("can require a key for every method", () => {
		const exported = createExport();
		expect(() =>
			IdentityExportHelper.requireMethodKeys(exported.document, ["key-1"])
		).not.toThrow();
		expect(() => IdentityExportHelper.requireMethodKeys(exported.document, [])).toThrow(
			"identityExportHelper.methodKeyMissing"
		);
	});
});
