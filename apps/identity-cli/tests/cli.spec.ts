// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { CLIDisplay } from "@3sixty/cli-core";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { DocumentHelper } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import { CLI } from "../src/cli.js";

let writeBuffer: string[] = [];
let errorBuffer: string[] = [];
const localesDirectory = "./dist/locales/";

describe("CLI", () => {
	beforeEach(() => {
		writeBuffer = [];
		errorBuffer = [];

		CLIDisplay.write = (buffer: string | Uint8Array): void => {
			writeBuffer.push(...buffer.toString().split("\n"));
		};

		CLIDisplay.writeError = (buffer: string | Uint8Array): void => {
			errorBuffer.push(...buffer.toString().split("\n"));
		};
	});

	test("Can execute with no command line options and receive help", async () => {
		const cli = new CLI();
		const exitCode = await cli.run(["", path.join(__dirname, "identity-cli")], localesDirectory, {
			overrideOutputWidth: 1000
		});
		expect(exitCode).toBe(0);
	});
});

describe("CLI Vault Key Naming", () => {
	let vaultConnector: EntityStorageVaultConnector;
	let vaultKeyEntityStorage: MemoryEntityStorageConnector<VaultKey>;
	let vaultSecretEntityStorage: MemoryEntityStorageConnector<VaultSecret>;

	beforeEach(() => {
		initSchemaVault();

		vaultKeyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
			entitySchema: nameof<VaultKey>(),
			config: { storageKey: "vault-keys" }
		});

		vaultSecretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
			entitySchema: nameof<VaultSecret>(),
			config: { storageKey: "vault-secrets" }
		});

		EntityStorageConnectorFactory.register("vault-key", () => vaultKeyEntityStorage);
		EntityStorageConnectorFactory.register("vault-secret", () => vaultSecretEntityStorage);

		vaultConnector = new EntityStorageVaultConnector();
		VaultConnectorFactory.register("vault", () => vaultConnector);
	});

	afterEach(async () => {
		await vaultKeyEntityStorage.teardown();
		await vaultSecretEntityStorage.teardown();
	});

	describe("verifiable-credential-create key naming", () => {
		test("should store key with document ID prefix", async () => {
			const verificationMethodId =
				"did:iota:testnet:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef#test-vm";
			const privateKey = new Uint8Array(32).fill(42);

			const vmParts = DocumentHelper.parseId(verificationMethodId);
			const correctKeyName = `${vmParts.id}/${vmParts.fragment}`;

			await vaultConnector.addKey(
				correctKeyName,
				VaultKeyType.Ed25519,
				privateKey,
				new Uint8Array()
			);

			const storedKey = await vaultConnector.getKey(correctKeyName);
			expect(storedKey).toBeDefined();
			expect(storedKey.privateKey).toBeDefined();
			expect(correctKeyName).toContain("did:iota:testnet:");
			expect(correctKeyName).not.toContain("local/");
		});

		test("keys with local prefix cannot be found by connector", async () => {
			const verificationMethodId =
				"did:iota:testnet:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef#test-vm";
			const privateKey = new Uint8Array(32).fill(42);

			const vmParts = DocumentHelper.parseId(verificationMethodId);
			const buggyKeyName = `local/${vmParts.fragment}`;

			await vaultConnector.addKey(buggyKeyName, VaultKeyType.Ed25519, privateKey, new Uint8Array());

			const correctKeyName = `${vmParts.id}/${vmParts.fragment}`;
			await expect(vaultConnector.getKey(correctKeyName)).rejects.toMatchObject({
				name: "NotFoundError",
				message: "entityStorageVaultConnector.keyNotFound"
			});
		});
	});

	describe("proof-create key naming", () => {
		test("should store key with document ID prefix", async () => {
			const verificationMethodId =
				"did:iota:testnet:0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890#proof-vm";
			const privateKey = new Uint8Array(32).fill(99);

			const vmParts = DocumentHelper.parseId(verificationMethodId);
			const correctKeyName = `${vmParts.id}/${vmParts.fragment}`;

			await vaultConnector.addKey(
				correctKeyName,
				VaultKeyType.Ed25519,
				privateKey,
				new Uint8Array()
			);

			const storedKey = await vaultConnector.getKey(correctKeyName);
			expect(storedKey).toBeDefined();
			expect(storedKey.privateKey).toBeDefined();
			expect(correctKeyName).toContain("did:iota:testnet:");
			expect(correctKeyName).not.toContain("local/");
		});
	});

	describe("DocumentHelper.parseId", () => {
		test("parses verification method ID into document ID and fragment", () => {
			const vmId =
				"did:iota:testnet:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef#my-vm-id";

			const parts = DocumentHelper.parseId(vmId);

			expect(parts.id).toEqual(
				"did:iota:testnet:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
			);
			expect(parts.fragment).toEqual("my-vm-id");
		});

		test("handles entity-storage DIDs", () => {
			const vmId = "did:entity-storage:0xabcdef#test-fragment";

			const parts = DocumentHelper.parseId(vmId);

			expect(parts.id).toEqual("did:entity-storage:0xabcdef");
			expect(parts.fragment).toEqual("test-fragment");
		});
	});
});
