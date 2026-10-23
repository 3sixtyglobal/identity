// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { nameof } from "@3sixty/nameof";
import {
	ProofHelper,
	type IDidDocument,
	type IDidVerifiableCredential,
	type IProof
} from "@3sixty/standards-w3c-did";
import { Jwk, Jwt, type IJwtHeader, type IJwtPayload } from "@3sixty/web";
import { DocumentHelper } from "./documentHelper.js";
import type { IIdentityResolverComponent } from "../models/IIdentityResolverComponent.js";

/**
 * Helper methods for verification.
 */
export class VerificationHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<VerificationHelper>();

	/**
	 * Verify the JWT and return the decoded header and payload.
	 * @param resolver The resolver to use for finding the document.
	 * @param jwt The token to verify.
	 * @returns The decoded header and payload.
	 */
	public static async verifyJwt<T extends IJwtHeader, U extends IJwtPayload>(
		resolver: IIdentityResolverComponent,
		jwt: string
	): Promise<{
		header: T;
		payload: U;
	}> {
		Guards.object<IIdentityResolverComponent>(
			VerificationHelper.CLASS_NAME,
			nameof(resolver),
			resolver
		);
		Guards.string(VerificationHelper.CLASS_NAME, nameof(jwt), jwt);

		const jwtDecoded = await Jwt.decode<T, U>(jwt);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (!Is.object(jwtHeader) || !Is.object(jwtPayload) || !Is.uint8Array(jwtSignature)) {
			throw new GeneralError(VerificationHelper.CLASS_NAME, "jwtDecodeFailed");
		}

		const iss = jwtHeader?.iss;
		const kid = jwtHeader?.kid;

		Guards.stringValue(VerificationHelper.CLASS_NAME, nameof(iss), iss);
		Guards.stringValue(VerificationHelper.CLASS_NAME, nameof(kid), kid);

		const didDocument = await resolver.identityResolve(iss);

		const jwk = DocumentHelper.getJwk(didDocument, kid);

		const publicKey = await Jwk.toCryptoKey(jwk);

		return Jwt.verify(jwt, publicKey);
	}

	/**
	 * Verify the proof for the document.
	 * @param resolver The resolver to use for finding the document.
	 * @param secureDocument The secure document to verify.
	 * @returns True if all proofs in the document are verified successfully.
	 */
	public static async verifyProof(
		resolver: IIdentityResolverComponent,
		secureDocument: IJsonLdNodeObject
	): Promise<boolean> {
		Guards.object<IIdentityResolverComponent>(
			VerificationHelper.CLASS_NAME,
			nameof(resolver),
			resolver
		);
		Guards.object<IJsonLdNodeObject>(
			VerificationHelper.CLASS_NAME,
			nameof(secureDocument),
			secureDocument
		);
		Guards.object<IJsonLdNodeObject>(
			VerificationHelper.CLASS_NAME,
			nameof(secureDocument.proof),
			secureDocument.proof
		);

		const proofList = Is.array<IProof>(secureDocument.proof)
			? secureDocument.proof
			: [secureDocument.proof];

		const documentCache: { [key: string]: IDidDocument } = {};

		for (const proof of proofList as IProof[]) {
			if (!Is.stringValue(proof?.verificationMethod)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "proofMissingVerificationMethod");
			}

			const proofVerificationMethod = DocumentHelper.parseId(proof.verificationMethod);
			if (!Is.stringValue(proofVerificationMethod.fragment)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "proofMissingVerificationMethod");
			}

			let document: IDidDocument;

			if (documentCache[proofVerificationMethod.id]) {
				document = documentCache[proofVerificationMethod.id];
			} else {
				document = await resolver.identityResolve(proofVerificationMethod.id);
				documentCache[proofVerificationMethod.id] = document;
			}

			const verificationJwk = DocumentHelper.getJwk(document, proofVerificationMethod.id);

			const verified = await ProofHelper.verifyProof(secureDocument, proof, verificationJwk);

			if (!verified) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Check a verifiable credential is within its validity period.
	 * @param credential The credential to check, either VC data model v1 or v2.
	 * @throws GeneralError if the credential has expired or is not yet valid.
	 */
	public static checkValidityPeriod(credential: IDidVerifiableCredential): void {
		Guards.object<IDidVerifiableCredential>(
			VerificationHelper.CLASS_NAME,
			nameof(credential),
			credential
		);

		const dated = credential as {
			issuanceDate?: string;
			validFrom?: string;
			expirationDate?: string;
			validUntil?: string;
		};
		const notBefore = dated.issuanceDate ?? dated.validFrom;
		const notAfter = dated.expirationDate ?? dated.validUntil;
		const now = Date.now();

		if (Is.stringValue(notBefore)) {
			if (!Is.dateTimeString(notBefore)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "credentialValidityDateInvalid", {
					date: notBefore
				});
			}
			if (new Date(notBefore).getTime() > now) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "credentialNotYetValid", {
					validFrom: notBefore
				});
			}
		}

		if (Is.stringValue(notAfter)) {
			if (!Is.dateTimeString(notAfter)) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "credentialValidityDateInvalid", {
					date: notAfter
				});
			}
			if (new Date(notAfter).getTime() < now) {
				throw new GeneralError(VerificationHelper.CLASS_NAME, "credentialExpired", {
					validUntil: notAfter
				});
			}
		}
	}
}
