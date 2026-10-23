// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@3sixty/api-core";
import type { IBaseRestClientConfig, INoContentResponse } from "@3sixty/api-models";
import { Coerce, Guards, Is } from "@3sixty/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@3sixty/data-json-ld";
import {
	DocumentHelper,
	type IIdentityVerifiablePresentationVerifyDocumentRequest,
	type IIdentityAlsoKnownAsCreateRequest,
	type IIdentityAlsoKnownAsRemoveRequest,
	type IIdentityComponent,
	type IIdentityCreateRequest,
	type IIdentityCreateResponse,
	type IIdentityProofCreateRequest,
	type IIdentityProofCreateResponse,
	type IIdentityProofVerifyRequest,
	type IIdentityProofVerifyResponse,
	type IIdentityRemoveRequest,
	type IIdentityServiceCreateRequest,
	type IIdentityServiceCreateResponse,
	type IIdentityServiceRemoveRequest,
	type IIdentityVerifiableCredentialCreateRequest,
	type IIdentityVerifiableCredentialCreateResponse,
	type IIdentityVerifiableCredentialRevokeRequest,
	type IIdentityVerifiableCredentialUnrevokeRequest,
	type IIdentityVerifiableCredentialVerifyDocumentRequest,
	type IIdentityVerifiableCredentialVerifyRequest,
	type IIdentityVerifiableCredentialVerifyResponse,
	type IIdentityVerifiablePresentationCreateRequest,
	type IIdentityVerifiablePresentationCreateResponse,
	type IIdentityVerifiablePresentationVerifyRequest,
	type IIdentityVerifiablePresentationVerifyResponse,
	type IIdentityVerificationMethodCreateRequest,
	type IIdentityVerificationMethodCreateResponse,
	type IIdentityVerificationMethodRemoveRequest
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation,
	type IProof,
	ProofTypes
} from "@3sixty/standards-w3c-did";
import { HttpMethod } from "@3sixty/web";

/**
 * Client for performing identity through to REST endpoints.
 */
export class IdentityRestClient extends BaseRestClient implements IIdentityComponent {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityRestClient>();

	/**
	 * Create a new instance of IdentityRestClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityRestClient>(), config, "identity");
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return IdentityRestClient.CLASS_NAME;
	}

	/**
	 * Create a new identity.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @returns The created identity document.
	 */
	public async identityCreate(namespace?: string): Promise<IDidDocument> {
		const response = await this.fetch<IIdentityCreateRequest, IIdentityCreateResponse>(
			"/",
			HttpMethod.POST,
			{
				body: {
					namespace
				}
			}
		);

		return response.body;
	}

	/**
	 * Remove an identity.
	 * @param identity The id of the document to remove.
	 * @param options Optional settings.
	 * @param options.removeKeys Also remove any associated private keys from the vault.
	 * @param options.removeDocumentKey Also remove the document key from the vault.
	 * @returns A promise that resolves when the identity has been removed.
	 */
	public async identityRemove(
		identity: string,
		options?: { removeKeys?: boolean; removeDocumentKey?: boolean }
	): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(identity), identity);
		await this.fetch<IIdentityRemoveRequest, INoContentResponse>("/:identity", HttpMethod.DELETE, {
			pathParams: {
				identity
			},
			query: {
				removeKeys: Coerce.string(options?.removeKeys),
				removeDocumentKey: Coerce.string(options?.removeDocumentKey)
			}
		});
	}

	/**
	 * Add a verification method to the document in JSON Web key Format.
	 * @param identity The id of the document to add the verification method to.
	 * @param verificationMethodType The type of the verification method to add.
	 * @param verificationMethodId The id of the verification method, if undefined uses the kid of the generated JWK.
	 * @returns The verification method.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple keys.
	 */
	public async verificationMethodCreate(
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(identity), identity);
		Guards.arrayOneOf<DidVerificationMethodType>(
			IdentityRestClient.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);
		const response = await this.fetch<
			IIdentityVerificationMethodCreateRequest,
			IIdentityVerificationMethodCreateResponse
		>("/:identity/verification-method", HttpMethod.POST, {
			pathParams: {
				identity
			},
			body: {
				verificationMethodType,
				verificationMethodId
			}
		});

		return response.body;
	}

	/**
	 * Remove a verification method from the document.
	 * @param verificationMethodId The id of the verification method.
	 * @param options Optional settings.
	 * @param options.removeKeys Also remove any associated private key from the vault.
	 * @param controller Unused by the REST client; the controller is resolved server-side from the session context.
	 * @returns A promise that resolves when the verification method has been removed.
	 * @throws NotFoundError if the id can not be resolved.
	 * @throws NotSupportedError if the platform does not support multiple revocable keys.
	 */
	public async verificationMethodRemove(
		verificationMethodId: string,
		options?: { removeKeys?: boolean },
		controller?: string
	): Promise<void> {
		Guards.stringValue(
			IdentityRestClient.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		const idParts = DocumentHelper.parseId(verificationMethodId);

		await this.fetch<IIdentityVerificationMethodRemoveRequest, INoContentResponse>(
			"/:identity/verification-method/:verificationMethodId",
			HttpMethod.DELETE,
			{
				pathParams: {
					identity: idParts.id,
					verificationMethodId: idParts.fragment ?? ""
				},
				query: { removeKeys: Coerce.string(options?.removeKeys) }
			}
		);
	}

	/**
	 * Add a service to the document.
	 * @param identity The id of the document to add the service to.
	 * @param serviceId The id of the service.
	 * @param serviceType The type of the service.
	 * @param serviceEndpoint The endpoint for the service.
	 * @returns The service.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceCreate(
		identity: string,
		serviceId: string,
		serviceType: string | string[],
		serviceEndpoint: string | string[]
	): Promise<IDidService> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(serviceId), serviceId);
		if (Is.array(serviceType)) {
			Guards.arrayValue<string>(IdentityRestClient.CLASS_NAME, nameof(serviceType), serviceType);
		} else {
			Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(serviceType), serviceType);
		}
		if (Is.array(serviceEndpoint)) {
			Guards.arrayValue<string>(
				IdentityRestClient.CLASS_NAME,
				nameof(serviceEndpoint),
				serviceEndpoint
			);
		} else {
			Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		}

		const response = await this.fetch<
			IIdentityServiceCreateRequest,
			IIdentityServiceCreateResponse
		>("/:identity/service", HttpMethod.POST, {
			pathParams: {
				identity
			},
			body: {
				serviceId,
				type: serviceType,
				endpoint: serviceEndpoint
			}
		});

		return response.body;
	}

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @returns A promise that resolves when the service has been removed.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(serviceId: string): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(serviceId), serviceId);

		const idParts = DocumentHelper.parseId(serviceId);

		await this.fetch<IIdentityServiceRemoveRequest, INoContentResponse>(
			"/:identity/service/:serviceId",
			HttpMethod.DELETE,
			{
				pathParams: {
					identity: idParts.id,
					serviceId: idParts.fragment ?? ""
				}
			}
		);
	}

	/**
	 * Add an alias to the alsoKnownAs property on the document.
	 * If the alias is already present the operation is a no-op.
	 * @param documentId The id of the document to update.
	 * @param alias The alias to add. Must be a Url or Urn (typically another DID).
	 * @returns A promise that resolves when the alias has been added.
	 * @throws GeneralError if the alias is not a Url or Urn.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async alsoKnownAsAdd(documentId: string, alias: string): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(alias), alias);

		await this.fetch<IIdentityAlsoKnownAsCreateRequest, INoContentResponse>(
			"/:identity/alias",
			HttpMethod.POST,
			{
				pathParams: {
					identity: documentId
				},
				body: {
					alias
				}
			}
		);
	}

	/**
	 * Remove an alias from the alsoKnownAs property on the document.
	 * If the alias is not present the operation is a no-op.
	 * @param documentId The id of the document to update.
	 * @param alias The alias to remove. Must be a Url or Urn.
	 * @returns A promise that resolves when the alias has been removed.
	 * @throws GeneralError if the alias is not a Url or Urn.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async alsoKnownAsRemove(documentId: string, alias: string): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(alias), alias);

		await this.fetch<IIdentityAlsoKnownAsRemoveRequest, INoContentResponse>(
			"/:identity/alias/:alias",
			HttpMethod.DELETE,
			{
				pathParams: {
					identity: documentId,
					alias
				}
			}
		);
	}

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
	 * @returns The created verifiable credential and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiableCredentialCreate(
		verificationMethodId: string,
		id: string | undefined,
		subject: IJsonLdNodeObject,
		options?: {
			revocationIndex?: number;
			expirationDate?: Date;
			jwtHeaderFields?: { [id: string]: string };
			jwtPayloadFields?: { [id: string]: string };
		}
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(
			IdentityRestClient.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.object<IJsonLdNodeObject>(IdentityRestClient.CLASS_NAME, nameof(subject), subject);
		if (!Is.undefined(options?.revocationIndex)) {
			Guards.number(
				IdentityRestClient.CLASS_NAME,
				nameof(options?.revocationIndex),
				options?.revocationIndex
			);
		}

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<
			IIdentityVerifiableCredentialCreateRequest,
			IIdentityVerifiableCredentialCreateResponse
		>("/:identity/verifiable-credential", HttpMethod.POST, {
			pathParams: {
				identity: idParts.id,
				verificationMethodId: idParts.fragment ?? ""
			},
			body: {
				credentialId: id,
				subject,
				revocationIndex: options?.revocationIndex,
				expirationDate: options?.expirationDate?.toISOString(),
				jwtHeaderFields: options?.jwtHeaderFields,
				jwtPayloadFields: options?.jwtPayloadFields
			}
		});

		return response.body;
	}

	/**
	 * Verify a verifiable credential is valid.
	 * @param credential The credential to verify.
	 * @returns The credential stored in the jwt and the revocation status.
	 */
	public async verifiableCredentialVerify(credential: string | IDidVerifiableCredential): Promise<{
		revoked: boolean;
		verifiableCredential?: IDidVerifiableCredential;
	}> {
		if (Is.object(credential)) {
			Guards.object<IDidVerifiableCredential>(
				IdentityRestClient.CLASS_NAME,
				nameof(credential),
				credential
			);
			const response = await this.fetch<
				IIdentityVerifiableCredentialVerifyDocumentRequest,
				IIdentityVerifiableCredentialVerifyResponse
			>("/verifiable-credential/verify/document", HttpMethod.POST, { body: credential });

			return response.body;
		}
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(credential), credential);

		const response = await this.fetch<
			IIdentityVerifiableCredentialVerifyRequest,
			IIdentityVerifiableCredentialVerifyResponse
		>("/verifiable-credential/verify", HttpMethod.GET, { query: { jwt: credential } });

		return response.body;
	}

	/**
	 * Revoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to revoke.
	 * @returns A promise that resolves when the credential has been revoked.
	 */
	public async verifiableCredentialRevoke(
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(issuerId), issuerId);
		Guards.integer(IdentityRestClient.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		await this.fetch<IIdentityVerifiableCredentialRevokeRequest, INoContentResponse>(
			"/:identity/verifiable-credential/revoke/:revocationIndex",
			HttpMethod.POST,
			{
				pathParams: {
					identity: issuerId,
					revocationIndex: credentialIndex.toString()
				}
			}
		);
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param issuerId The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to unrevoke.
	 * @returns A promise that resolves when the credential has been unrevoked.
	 */
	public async verifiableCredentialUnrevoke(
		issuerId: string,
		credentialIndex: number
	): Promise<void> {
		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(issuerId), issuerId);
		Guards.integer(IdentityRestClient.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		await this.fetch<IIdentityVerifiableCredentialUnrevokeRequest, INoContentResponse>(
			"/:identity/verifiable-credential/unrevoke/:revocationIndex",
			HttpMethod.POST,
			{
				pathParams: {
					identity: issuerId,
					revocationIndex: credentialIndex.toString()
				}
			}
		);
	}

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
	 * @param options.jwtPayloadFields Additional fields to include in the JWT payload when creating the verifiable presentation in jwt format.
	 * @returns The created verifiable presentation and its token.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async verifiablePresentationCreate(
		verificationMethodId: string,
		presentationId: string | undefined,
		contexts: IJsonLdContextDefinitionRoot | undefined,
		types: string | string[] | undefined,
		verifiableCredentials: (string | IDidVerifiableCredential)[],
		options?: {
			expirationDate?: Date;
			jwtHeaderFields?: { [id: string]: string };
			jwtPayloadFields?: { [id: string]: string };
		}
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(
			IdentityRestClient.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		if (Is.array(types)) {
			Guards.arrayValue(IdentityRestClient.CLASS_NAME, nameof(types), types);
		} else if (Is.string(types)) {
			Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(types), types);
		}
		Guards.arrayValue(
			IdentityRestClient.CLASS_NAME,
			nameof(verifiableCredentials),
			verifiableCredentials
		);
		if (!Is.undefined(options?.expirationDate)) {
			Guards.date(
				IdentityRestClient.CLASS_NAME,
				nameof(options.expirationDate),
				options?.expirationDate
			);
		}

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<
			IIdentityVerifiablePresentationCreateRequest,
			IIdentityVerifiablePresentationCreateResponse
		>("/:identity/verifiable-presentation", HttpMethod.POST, {
			pathParams: {
				identity: idParts.id,
				verificationMethodId: idParts.fragment ?? ""
			},
			body: {
				presentationId,
				contexts,
				types,
				verifiableCredentials,
				expirationDate: options?.expirationDate?.toISOString(),
				jwtHeaderFields: options?.jwtHeaderFields,
				jwtPayloadFields: options?.jwtPayloadFields
			}
		});

		return response.body;
	}

	/**
	 * Verify a verifiable presentation is valid.
	 * @param presentation The presentation to verify.
	 * @returns The presentation stored in the jwt and the revocation status.
	 */
	public async verifiablePresentationVerify(
		presentation: string | IDidVerifiablePresentation
	): Promise<{
		revoked: boolean;
		verifiablePresentation?: IDidVerifiablePresentation;
		issuers?: IDidDocument[];
	}> {
		if (Is.object(presentation)) {
			Guards.object<IDidVerifiablePresentation>(
				IdentityRestClient.CLASS_NAME,
				nameof(presentation),
				presentation
			);
			const response = await this.fetch<
				IIdentityVerifiablePresentationVerifyDocumentRequest,
				IIdentityVerifiablePresentationVerifyResponse
			>("/verifiable-presentation/verify/document", HttpMethod.POST, { body: presentation });

			return response.body;
		}

		Guards.stringValue(IdentityRestClient.CLASS_NAME, nameof(presentation), presentation);

		const response = await this.fetch<
			IIdentityVerifiablePresentationVerifyRequest,
			IIdentityVerifiablePresentationVerifyResponse
		>("/verifiable-presentation/verify", HttpMethod.POST, {
			query: {
				jwt: presentation
			}
		});

		return response.body;
	}

	/**
	 * Create a proof for a document with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @returns The proof.
	 */
	public async proofCreate(
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject
	): Promise<IProof> {
		Guards.stringValue(
			IdentityRestClient.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.arrayOneOf<ProofTypes>(
			IdentityRestClient.CLASS_NAME,
			nameof(proofType),
			proofType,
			Object.values(ProofTypes)
		);
		Guards.object<IJsonLdNodeObject>(
			IdentityRestClient.CLASS_NAME,
			nameof(unsecureDocument),
			unsecureDocument
		);

		const idParts = DocumentHelper.parseId(verificationMethodId);

		const response = await this.fetch<IIdentityProofCreateRequest, IIdentityProofCreateResponse>(
			"/:identity/proof",
			HttpMethod.POST,
			{
				pathParams: {
					identity: idParts.id,
					verificationMethodId: idParts.fragment ?? ""
				},
				body: {
					document: unsecureDocument,
					proofType
				}
			}
		);

		return response.body;
	}

	/**
	 * Verify proof for a document with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(document: IJsonLdNodeObject, proof: IProof): Promise<boolean> {
		Guards.object<IJsonLdNodeObject>(IdentityRestClient.CLASS_NAME, nameof(document), document);
		Guards.object<IProof>(IdentityRestClient.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(
			IdentityRestClient.CLASS_NAME,
			nameof(proof.verificationMethod),
			proof.verificationMethod
		);

		const response = await this.fetch<IIdentityProofVerifyRequest, IIdentityProofVerifyResponse>(
			"/proof/verify",
			HttpMethod.POST,
			{
				body: {
					document,
					proof
				}
			}
		);

		return response.body.verified;
	}
}
