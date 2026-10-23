// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/**
 * Tests that checkVerifiablePresentation rejects forged presentations in both input forms.
 *
 * The JWT form has to verify the token signature against a key taken from the document named by
 * iss, and the object form has to bind holder to the DID that owns the proof verification method.
 * Embedded credentials are checked whether they arrive as tokens or as objects.
 */
import { Converter } from "@3sixty/core";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import { nameof } from "@3sixty/nameof";
import { SchemaOrgDataTypes } from "@3sixty/standards-schema-org";
import {
	DidContexts,
	DidVerificationMethodType,
	JwsAlgorithms,
	type IDidVerifiableCredentialV1,
	type IDidVerifiablePresentationV1
} from "@3sixty/standards-w3c-did";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultConnectorHelper } from "@3sixty/vault-models";
import { Jwt } from "@3sixty/web";
import type { IdentityDocument } from "../src/entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "../src/entityStorageIdentityConnector.js";
import { initSchema as initSchemaIdentity } from "../src/schema.js";

const VICTIM_CONTROLLER = "victim-controller";
const ATTACKER_CONTROLLER = "attacker-controller";

// A fixed future date, so the exp claim the presentation carries survives verification against
// the real clock.
const VP_EXPIRY = new Date("2100-01-01T00:00:00.000Z");

let identityConnector: EntityStorageIdentityConnector;
let vaultConnector: EntityStorageVaultConnector;

let victimDocumentId: string;
let victimMethodId: string;
let attackerDocumentId: string;
let attackerMethodId: string;

/**
 * Build a presentation token naming the given holder, signed with the given vault key.
 * @param kid The verification method id to name in the header.
 * @param iss The holder DID to name as the token issuer.
 * @param signingKeyFragment The fragment of the attacker key used to sign.
 * @returns The encoded token.
 */
async function encodePresentationJwt(
	kid: string,
	iss: string,
	signingKeyFragment: string
): Promise<string> {
	return Jwt.encodeWithSigner(
		{ kid, typ: "JWT", alg: JwsAlgorithms.EdDSA },
		{
			iss,
			nbf: Math.floor(Date.now() / 1000),
			vp: {
				"@context": DidContexts.ContextVCv1,
				type: ["VerifiablePresentation"],
				verifiableCredential: []
			}
		},
		async (header, payload) =>
			VaultConnectorHelper.jwtSigner(
				vaultConnector,
				EntityStorageIdentityConnector.buildVaultKey(attackerDocumentId, signingKeyFragment),
				header,
				payload
			)
	);
}

/**
 * Replace a token's signature segment with bytes that cannot verify.
 * @param token The token to tamper with.
 * @returns The token carrying a junk signature.
 */
function withJunkSignature(token: string): string {
	const [header, payload] = token.split(".");
	return `${header}.${payload}.${Converter.bytesToBase64Url(new Uint8Array(64).fill(7))}`;
}

/**
 * Issue a credential from the given identity.
 * @param controller The controller of the issuing identity.
 * @param methodId The verification method to sign with.
 * @param id The credential id.
 * @returns The credential in both forms.
 */
async function issueCredential(
	controller: string,
	methodId: string,
	id: string
): Promise<{ verifiableCredential: IDidVerifiableCredentialV1; jwt: string }> {
	return identityConnector.createVerifiableCredential(controller, methodId, id, {
		"@context": "https://schema.org",
		"@type": "Person",
		name: "Test Subject"
	});
}

describe("EntityStorageIdentityConnector - presentation verification", () => {
	beforeEach(async () => {
		initSchemaVault();
		initSchemaIdentity();
		SchemaOrgDataTypes.registerRedirects();

		EntityStorageConnectorFactory.register(
			"identity-document",
			() =>
				new MemoryEntityStorageConnector<IdentityDocument>({
					entitySchema: nameof<IdentityDocument>(),
					config: { storageKey: "identity-document" }
				})
		);
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
					config: { storageKey: "vault-secret" }
				})
		);

		vaultConnector = new EntityStorageVaultConnector();
		VaultConnectorFactory.register("vault", () => vaultConnector);

		identityConnector = new EntityStorageIdentityConnector();

		const victim = await identityConnector.createDocument(VICTIM_CONTROLLER);
		victimDocumentId = victim.id;
		victimMethodId = (
			await identityConnector.addVerificationMethod(
				VICTIM_CONTROLLER,
				victimDocumentId,
				DidVerificationMethodType.AssertionMethod,
				"victim-key"
			)
		).id;

		const attacker = await identityConnector.createDocument(ATTACKER_CONTROLLER);
		attackerDocumentId = attacker.id;
		attackerMethodId = (
			await identityConnector.addVerificationMethod(
				ATTACKER_CONTROLLER,
				attackerDocumentId,
				DidVerificationMethodType.AssertionMethod,
				"attacker-key"
			)
		).id;
	});

	test("a presentation token with a junk signature is rejected", async () => {
		const credential = await issueCredential(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/credentials/junk-signature"
		);

		const genuine = await identityConnector.createVerifiablePresentation(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/presentations/junk-signature",
			DidContexts.ContextVCv1,
			["Person"],
			[credential.jwt],
			{ expirationDate: VP_EXPIRY }
		);

		const forged = withJunkSignature(genuine.jwt);

		await expect(identityConnector.checkVerifiablePresentation(forged)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.checkingVerifiablePresentationFailed"
		});
	});

	test("a presentation token signed by another DID but naming the victim as holder is rejected", async () => {
		// The attacker signs with their own key while naming the victim's method in the header, so
		// the key resolved from the victim's document cannot verify the signature.
		const forged = await encodePresentationJwt(victimMethodId, victimDocumentId, "attacker-key");

		await expect(identityConnector.checkVerifiablePresentation(forged)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.checkingVerifiablePresentationFailed"
		});
	});

	test("a presentation token naming a verification method the holder does not own is rejected", async () => {
		const forged = await encodePresentationJwt(attackerMethodId, victimDocumentId, "attacker-key");

		await expect(identityConnector.checkVerifiablePresentation(forged)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.checkingVerifiablePresentationFailed"
		});
	});

	test("a tampered object credential embedded in a presentation token is rejected", async () => {
		const credential = await issueCredential(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/credentials/embedded-object"
		);

		const tampered = JSON.parse(
			JSON.stringify(credential.verifiableCredential)
		) as IDidVerifiableCredentialV1;
		(tampered.credentialSubject as { name: string }).name = "Tampered Subject";

		const presentation = await identityConnector.createVerifiablePresentation(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/presentations/embedded-object",
			DidContexts.ContextVCv1,
			["Person"],
			[tampered],
			{ expirationDate: VP_EXPIRY }
		);

		await expect(
			identityConnector.checkVerifiablePresentation(presentation.jwt)
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.checkingVerifiablePresentationFailed"
		});
	});

	test("an object presentation whose holder is not the signer is rejected", async () => {
		const credential = await issueCredential(
			ATTACKER_CONTROLLER,
			attackerMethodId,
			"https://example.com/credentials/holder-mismatch"
		);

		const presentation = await identityConnector.createVerifiablePresentation(
			ATTACKER_CONTROLLER,
			attackerMethodId,
			"https://example.com/presentations/holder-mismatch",
			DidContexts.ContextVCv1,
			["Person"],
			[credential.jwt],
			{ expirationDate: VP_EXPIRY }
		);

		const forged: IDidVerifiablePresentationV1 = {
			...presentation.verifiablePresentation,
			holder: victimDocumentId
		};

		await expect(identityConnector.checkVerifiablePresentation(forged)).rejects.toMatchObject({
			name: "GeneralError",
			message: "entityStorageIdentityConnector.holderMismatch",
			properties: { holder: victimDocumentId, method: attackerMethodId }
		});
	});

	test("the holder returned for a presentation token is the token issuer, not the credential issuer", async () => {
		const credential = await issueCredential(
			ATTACKER_CONTROLLER,
			attackerMethodId,
			"https://example.com/credentials/holder-reporting"
		);

		const presentation = await identityConnector.createVerifiablePresentation(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/presentations/holder-reporting",
			DidContexts.ContextVCv1,
			["Person"],
			[credential.jwt],
			{ expirationDate: VP_EXPIRY }
		);

		const check = await identityConnector.checkVerifiablePresentation(presentation.jwt);

		expect(check.revoked).toBeFalsy();
		expect(check.verifiablePresentation?.holder).toEqual(victimDocumentId);
		expect(check.issuers?.map(i => i.id)).toEqual([attackerDocumentId]);
	});

	test("a genuine presentation is accepted in both forms, with either credential form embedded", async () => {
		const tokenCredential = await issueCredential(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/credentials/genuine-token"
		);
		const objectCredential = await issueCredential(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/credentials/genuine-object"
		);

		const presentation = await identityConnector.createVerifiablePresentation(
			VICTIM_CONTROLLER,
			victimMethodId,
			"https://example.com/presentations/genuine",
			DidContexts.ContextVCv1,
			["Person"],
			[tokenCredential.jwt, objectCredential.verifiableCredential],
			{ expirationDate: VP_EXPIRY }
		);

		const jwtCheck = await identityConnector.checkVerifiablePresentation(presentation.jwt);
		expect(jwtCheck.revoked).toBeFalsy();
		expect(jwtCheck.verifiablePresentation?.holder).toEqual(victimDocumentId);

		const objectCheck = await identityConnector.checkVerifiablePresentation(
			presentation.verifiablePresentation
		);
		expect(objectCheck.revoked).toBeFalsy();
		expect(objectCheck.verifiablePresentation).toBeDefined();
	});
});
