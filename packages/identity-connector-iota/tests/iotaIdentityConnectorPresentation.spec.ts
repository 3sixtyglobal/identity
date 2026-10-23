// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests that an object presentation naming a holder other than the DID owning the proof
 * verification method is refused. The comparison happens before the proof is resolved, so this
 * runs offline with no node or ledger.
 */
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import {
	DidContexts,
	DidTypes,
	ProofTypes,
	type IDidVerifiablePresentationV1
} from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { IotaIdentityConnector } from "../src/iotaIdentityConnector.js";

const VICTIM_DID =
	"did:iota:testnet:0x1111111111111111111111111111111111111111111111111111111111111111";
const ATTACKER_DID =
	"did:iota:testnet:0x2222222222222222222222222222222222222222222222222222222222222222";
const ATTACKER_METHOD_ID = `${ATTACKER_DID}#attacker-key`;

let identityConnector: IotaIdentityConnector;

/**
 * Build an object presentation naming the given holder, signed by the attacker's method.
 * @param holder The holder to name on the presentation.
 * @returns The presentation.
 */
function buildPresentation(holder: string): IDidVerifiablePresentationV1 {
	return {
		"@context": DidContexts.ContextVCv1,
		type: [DidTypes.VerifiablePresentation],
		holder,
		verifiableCredential: [],
		proof: {
			type: ProofTypes.DataIntegrityProof,
			cryptosuite: "eddsa-jcs-2022",
			created: "2024-01-31T16:00:45.490Z",
			proofPurpose: "assertionMethod",
			proofValue: "z3FXxDxDxDxDxDxDxDxDxDxDxDxDxDxDxDxDxDxDxDxD",
			verificationMethod: ATTACKER_METHOD_ID
		}
	};
}

describe("IotaIdentityConnector - presentation holder binding (offline)", () => {
	beforeEach(() => {
		initSchemaVault();

		EntityStorageConnectorFactory.register(
			"vault-key",
			() =>
				new MemoryEntityStorageConnector<VaultKey>({
					entitySchema: nameof<VaultKey>(),
					config: { storageKey: "vault-keys" }
				})
		);
		EntityStorageConnectorFactory.register(
			"vault-secret",
			() =>
				new MemoryEntityStorageConnector<VaultSecret>({
					entitySchema: nameof<VaultSecret>(),
					config: { storageKey: "vault-secrets" }
				})
		);
		VaultConnectorFactory.register("vault", () => new EntityStorageVaultConnector());

		identityConnector = new IotaIdentityConnector({
			config: { clientOptions: { url: "http://localhost:9000" }, network: "testnet" }
		});
	});

	test("an object presentation whose holder is not the signer is rejected", async () => {
		await expect(
			identityConnector.checkVerifiablePresentation(buildPresentation(VICTIM_DID))
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "iotaIdentityConnector.holderMismatch",
			properties: { holder: VICTIM_DID, method: ATTACKER_METHOD_ID }
		});
	});
});
