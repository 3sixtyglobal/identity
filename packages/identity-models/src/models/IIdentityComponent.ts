// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@3sixty/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@3sixty/data-json-ld";
import type {
	DidVerificationMethodType,
	IDidDocument,
	IDidDocumentVerificationMethod,
	IProof,
	IDidService,
	IDidVerifiableCredential,
	IDidVerifiablePresentation,
	ProofTypes
} from "@3sixty/standards-w3c-did";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentityComponent extends IComponent {
	/**
	 * Create a new identity.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created identity document.
	 */
	identityCreate(namespace?: string, controller?: string): Promise<IDidDocument>;

	/**
	 * Remove an identity.
	 * @param identity The id of the document to remove.
	 * @param options Optional settings.
	 * @param options.removeKeys Also remove any associated private keys from the vault.
	 * @param options.removeDocumentKey Also remove the document key from the vault.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the identity has been removed.
	 */
	identityRemove(
		identity: string,
		options?: { removeKeys?: boolean; removeDocumentKey?: boolean },
		controller?: string
	): Promise<void>;

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param identity The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	verificationMethodCreate(
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string,
		controller?: string
	): Promise<IDidDocumentVerificationMethod>;

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @param options Optional settings.
	 * @param options.removeKeys Also remove any associated private key from the vault.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the verification method has been removed.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	verificationMethodRemove(
		verificationMethodId: string,
		options?: { removeKeys?: boolean },
		controller?: string
	): Promise<void>;

	/**
	 * Add a service to the document.
	 * @param identity The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	serviceCreate(
		identity: string,
		serviceId: string,
		serviceType: string | string[],
		serviceEndpoint: string | string[],
		controller?: string
	): Promise<IDidService>;

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the service has been removed.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	serviceRemove(serviceId: string, controller?: string): Promise<void>;

	/**
	 * Add an alias to the alsoKnownAs property on the document.
	 * If the alias is already present the operation is a no-op.
	 * @param documentId The id of the document to update.
	 * @param alias The alias to add. Must be a Url or Urn (typically another DID).
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the alias has been added.
	 * @throws GeneralError if the alias is not a Url or Urn.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	alsoKnownAsAdd(documentId: string, alias: string, controller?: string): Promise<void>;

	/**
	 * Remove an alias from the alsoKnownAs property on the document.
	 * If the alias is not present the operation is a no-op.
	 * @param documentId The id of the document to update.
	 * @param alias The alias to remove. Must be a Url or Urn.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the alias has been removed.
	 * @throws GeneralError if the alias is not a Url or Urn.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	alsoKnownAsRemove(documentId: string, alias: string, controller?: string): Promise<void>;

	/**
	 * Create a verifiable credential for a verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param id The id of the credential.
	 * @param subject The credential subject to store in the verifiable credential.
	 * @param options Additional options for creating the verifiable credential.
	 * @param options.revocationIndex The bitmap revocation index of the credential, if undefined will not have revocation status.
	 * @param options.expirationDate The date the verifiable credential is valid until.
	 * @param options.jwtHeaderFields Additional fields to include in the JWT header when creating the verifiable credential in jwt format.
	 * @param options.jwtPayloadFields Additional fields to include in the JWT payload when creating the verifiable credential in jwt format.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	verifiableCredentialCreate(
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		options?: {
			revocationIndex?: number;
			expirationDate?: Date;
			jwtHeaderFields?: { [id: string]: string };
			jwtPayloadFields?: { [id: string]: string };
		},
		controller?: string
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}>;

	/**
	 * Verify a verifiable credential is valid.
	 * @param credential The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	verifiableCredentialVerify(credential: string | IDidVerifiableCredential): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}>;

	/**
	 * Revoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to revoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the credential has been revoked.
	 */
	verifiableCredentialRevoke(
		issuerId: string,
		credentialIndex: number,
		controller?: string
	): Promise<void>;

	/**
	 * Unrevoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to unrevoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the credential has been unrevoked.
	 */
	verifiableCredentialUnrevoke(
		issuerId: string,
		credentialIndex: number,
		controller?: string
	): Promise<void>;

	/**
	 * Create a verifiable presentation from the supplied verifiable credentials.
	 * @param verificationMethodId The method to associate with the presentation.
	 * @param presentationId The id of the presentation.
	 * @param contexts The contexts for the data stored in the verifiable credential.
	 * @param types The types for the data stored in the verifiable credential.
	 * @param verifiableCredentials The credentials to use for creating the presentation in jwt format.
	 * @param options Additional options for creating the verifiable presentation.
	 * @param options.expirationDate The date the verifiable presentation is valid until.
	 * @param options.jwtHeaderFields Additional fields to include in the JWT header when creating the verifiable presentation in jwt format.
	 * @param options.jwtPayloadFields	Additional fields to include in the JWT payload when creating the verifiable presentation in jwt format.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	verifiablePresentationCreate(
		verificationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential)[],
		options?: {
			expirationDate?: Date;
			jwtHeaderFields?: { [id: string]: string };
			jwtPayloadFields?: { [id: string]: string };
		},
		controller?: string
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}>;

	/**
	 * Verify a verifiable presentation is valid.
	 * @param presentation The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	verifiablePresentationVerify(presentation: string | IDidVerifiablePresentation): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}>;

	/**
	 * Create a proof for a document with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The proof.
	 */
	proofCreate(
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject,
		controller?: string
	): Promise<IProof>;

	/**
	 * Verify proof for a document with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	proofVerify(document: IJsonLdNodeObject, proof: IProof): Promise<boolean>;
}
