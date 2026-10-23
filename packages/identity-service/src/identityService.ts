// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	HealthCategory,
	HealthStatus,
	type HealthApplicationCallback,
	type IHealth,
	type IHealthProviderComponent
} from "@3sixty/api-models";
import type { IContextIds } from "@3sixty/context";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { BaseError, ComponentFactory, GeneralError, Guards, Is, Urn } from "@3sixty/core";
import type { IJsonLdContextDefinitionRoot, IJsonLdNodeObject } from "@3sixty/data-json-ld";
import { AccountHelper } from "@3sixty/dlt-account";
import {
	DocumentHelper,
	IdentityConnectorFactory,
	IdentityMetricIds,
	IdentityMetrics,
	IdentityResolverConnectorFactory,
	type IIdentityComponent,
	type IIdentityConnector,
	type IIdentityResolverConnector
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import {
	DidVerificationMethodType,
	ProofTypes,
	type IDidDocument,
	type IDidDocumentVerificationMethod,
	type IProof,
	type IDidService,
	type IDidVerifiableCredential,
	type IDidVerifiablePresentation
} from "@3sixty/standards-w3c-did";
import { MetricHelper, type ITelemetryComponent } from "@3sixty/telemetry-models";
import { type IVaultConnector, VaultConnectorFactory } from "@3sixty/vault-models";
import { Jwt } from "@3sixty/web";
import type { IIdentityServiceConstructorOptions } from "./models/IIdentityServiceConstructorOptions.js";

/**
 * Class which implements the identity contract.
 */
export class IdentityService implements IIdentityComponent, IHealthProviderComponent {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityService>();

	/**
	 * The default namespace for the connector to use.
	 * @internal
	 */
	private readonly _defaultNamespace: string;

	/**
	 * The vault connector type used for mnemonic migration during health check init.
	 * @internal
	 */
	private readonly _vaultConnector: IVaultConnector;

	/**
	 * The telemetry component.
	 * @internal
	 */
	private readonly _telemetryComponent?: ITelemetryComponent;

	/**
	 * The DID document created by healthApplicationInit, for teardown to remove.
	 * @internal
	 */
	private _healthDocument?: { controller: string; documentId: string };

	/**
	 * Create a new instance of IdentityService.
	 * @param options The options for the service.
	 * @throws GeneralError if no connectors are registered.
	 */
	constructor(options?: IIdentityServiceConstructorOptions) {
		const names = IdentityConnectorFactory.names();
		if (names.length === 0) {
			throw new GeneralError(IdentityService.CLASS_NAME, "noConnectors");
		}

		this._defaultNamespace = options?.config?.defaultNamespace ?? names[0];

		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");

		this._telemetryComponent = ComponentFactory.getIfExists<ITelemetryComponent>(
			options?.telemetryComponentType
		);
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return IdentityService.CLASS_NAME;
	}

	/**
	 * Register all identity metrics with the telemetry component.
	 * @returns A promise that resolves when all metrics have been registered.
	 */
	public async start(): Promise<void> {
		if (Is.undefined(this._telemetryComponent)) {
			return;
		}

		await MetricHelper.createMetrics(this._telemetryComponent, IdentityMetrics);
	}

	/**
	 * Creates a temporary DID document for the application health check.
	 * @param contextIds The context IDs accumulated by prior init steps.
	 */
	public async healthApplicationInit(contextIds: IContextIds): Promise<void> {
		// The wallet service has already setup a temporary controller DID mnemonic for the health check
		// so we can use that to create a new document and add a verification method to it.
		const controller = contextIds[ContextIdKeys.Organization];
		if (!Is.stringValue(controller)) {
			return;
		}
		try {
			const connector = this.getConnectorByNamespace();
			const doc = await connector.createDocument(controller);
			this._healthDocument = { controller, documentId: doc.id };
			await connector.addVerificationMethod(
				controller,
				doc.id,
				DidVerificationMethodType.AssertionMethod,
				"health-assertion"
			);

			// The original seed/mnemonic/keys were created with the temp orgId
			// so we need to migrate them to the new document id so that the health check can resolve the DID.
			await AccountHelper.renameAccountKeys(undefined, this._vaultConnector, controller, doc.id);

			// Replace the updated contextIds with the new document id for the health check.
			contextIds[ContextIdKeys.Organization] = doc.id;
		} catch {}
	}

	/**
	 * Returns the application health status of the identity service by resolving the DID created
	 * in healthApplicationInit.
	 * @param callback Callback for deferred results.
	 * @returns The health status of the service.
	 */
	public async healthApplication(
		callback: HealthApplicationCallback
	): Promise<IHealth[] | undefined> {
		const contextIds = (await ContextIdStore.getContextIds()) ?? {};
		const orgDid = contextIds[ContextIdKeys.Organization];

		if (!Is.stringValue(orgDid)) {
			return [
				{
					source: IdentityService.CLASS_NAME,
					category: HealthCategory.Application,
					status: HealthStatus.Error,
					description: "healthDescription",
					message: "createDocumentFailed",
					data: {
						did: orgDid
					}
				}
			];
		}

		try {
			const resolverConnector =
				IdentityResolverConnectorFactory.getIfExists<IIdentityResolverConnector>(
					this._defaultNamespace
				);
			if (!Is.undefined(resolverConnector)) {
				const resolved = await resolverConnector.resolveDocument(orgDid);
				return [
					{
						source: IdentityService.CLASS_NAME,
						category: HealthCategory.Application,
						status: Is.object(resolved) ? HealthStatus.Ok : HealthStatus.Error,
						description: "healthDescription",
						message: Is.object(resolved) ? undefined : "resolveDocumentFailed",
						data: { did: orgDid }
					}
				];
			}
			return [
				{
					source: IdentityService.CLASS_NAME,
					category: HealthCategory.Application,
					status: HealthStatus.Ok,
					description: "healthDescription",
					data: { did: orgDid }
				}
			];
		} catch (error) {
			return [
				{
					source: IdentityService.CLASS_NAME,
					category: HealthCategory.Application,
					status: HealthStatus.Error,
					description: "healthDescription",
					message: "resolveDocumentFailed",
					data: { did: orgDid },
					error: BaseError.fromError(error)
				}
			];
		}
	}

	/**
	 * Removes the DID document created in healthApplicationInit.
	 */
	public async healthApplicationTeardown(): Promise<void> {
		if (Is.empty(this._healthDocument)) {
			return;
		}
		const healthDocument = this._healthDocument;
		this._healthDocument = undefined;

		try {
			const connector = this.getConnectorByNamespace();
			await connector.removeVerificationMethod(
				healthDocument.controller,
				`${healthDocument.documentId}#health-assertion`,
				{
					removeKeys: true
				}
			);
			await connector.removeDocument(healthDocument.controller, healthDocument.documentId);
		} catch {}
	}

	/**
	 * Create a new identity.
	 * @param namespace The namespace of the connector to use for the identity, defaults to service configured namespace.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The created identity document.
	 */
	public async identityCreate(namespace?: string, controller?: string): Promise<IDidDocument> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);

		try {
			const identityConnector = this.getConnectorByNamespace(namespace);
			const result = await identityConnector.createDocument(controller);
			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.DidsCreated, {
				namespace: namespace ?? this._defaultNamespace
			});
			return result;
		} catch (error) {
			throw new GeneralError(IdentityService.CLASS_NAME, "identityCreateFailed", undefined, error);
		}
	}

	/**
	 * Remove an identity.
	 * @param identity The id of the document to remove.
	 * @param options Optional settings.
	 * @param options.removeKeys Also remove any associated private keys from the vault.
	 * @param options.removeDocumentKey Also remove the document key from the vault.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the identity has been removed.
	 */
	public async identityRemove(
		identity: string,
		options?: { removeKeys?: boolean; removeDocumentKey?: boolean },
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);

		try {
			const identityConnector = this.getConnectorByUri(identity);
			const result = await identityConnector.removeDocument(controller, identity, options);
			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.DidsRemoved);
			return result;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"identityRemoveFailed",
				{ identity },
				error
			);
		}
	}

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
	public async verificationMethodCreate(
		identity: string,
		verificationMethodType: DidVerificationMethodType,
		verificationMethodId?: string,
		controller?: string
	): Promise<IDidDocumentVerificationMethod> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Urn.guard(IdentityService.CLASS_NAME, nameof(identity), identity);

		Guards.arrayOneOf(
			IdentityService.CLASS_NAME,
			nameof(verificationMethodType),
			verificationMethodType,
			Object.values(DidVerificationMethodType)
		);

		try {
			const identityConnector = this.getConnectorByUri(identity);

			const verificationMethod = await identityConnector.addVerificationMethod(
				controller,
				identity,
				verificationMethodType,
				verificationMethodId
			);

			return verificationMethod;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verificationMethodCreateFailed",
				{ identity },
				error
			);
		}
	}

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
	public async verificationMethodRemove(
		verificationMethodId: string,
		options?: { removeKeys?: boolean },
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Urn.guard(IdentityService.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeVerificationMethod(controller, verificationMethodId, options);
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verificationMethodRemoveFailed",
				{ verificationMethodId },
				error
			);
		}
	}

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
	public async serviceCreate(
		identity: string,
		serviceId: string,
		serviceType: string | string[],
		serviceEndpoint: string | string[],
		controller?: string
	): Promise<IDidService> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Urn.guard(IdentityService.CLASS_NAME, nameof(identity), identity);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(serviceId), serviceId);
		if (Is.array(serviceType)) {
			Guards.arrayValue<string>(IdentityService.CLASS_NAME, nameof(serviceType), serviceType);
		} else {
			Guards.stringValue(IdentityService.CLASS_NAME, nameof(serviceType), serviceType);
		}
		if (Is.array(serviceEndpoint)) {
			Guards.arrayValue<string>(
				IdentityService.CLASS_NAME,
				nameof(serviceEndpoint),
				serviceEndpoint
			);
		} else {
			Guards.stringValue(IdentityService.CLASS_NAME, nameof(serviceEndpoint), serviceEndpoint);
		}

		try {
			const identityConnector = this.getConnectorByUri(identity);

			const service = await identityConnector.addService(
				controller,
				identity,
				serviceId,
				serviceType,
				serviceEndpoint
			);

			return service;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"serviceCreateFailed",
				{ identity, serviceId },
				error
			);
		}
	}

	/**
	 * Remove a service from the document.
	 * @param serviceId The id of the service.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the service has been removed.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async serviceRemove(serviceId: string, controller?: string): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Urn.guard(IdentityService.CLASS_NAME, nameof(serviceId), serviceId);

		try {
			const idParts = DocumentHelper.parseId(serviceId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeService(controller, serviceId);
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"serviceRemoveFailed",
				{ serviceId },
				error
			);
		}
	}

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
	public async alsoKnownAsAdd(
		documentId: string,
		alias: string,
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(alias), alias);

		try {
			const idParts = DocumentHelper.parseId(documentId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.addAlsoKnownAs(controller, documentId, alias);
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"alsoKnownAsAddFailed",
				{ identity: documentId, alias },
				error
			);
		}
	}

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
	public async alsoKnownAsRemove(
		documentId: string,
		alias: string,
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(documentId), documentId);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(alias), alias);

		try {
			const idParts = DocumentHelper.parseId(documentId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			await identityConnector.removeAlsoKnownAs(controller, documentId, alias);
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"alsoKnownAsRemoveFailed",
				{ identity: documentId, alias },
				error
			);
		}
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
	 * @param controller The controller of the identity who can make changes.
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
		},
		controller?: string
	): Promise<{
		verifiableCredential: IDidVerifiableCredential;
		jwt: string;
	}> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Urn.guard(IdentityService.CLASS_NAME, nameof(verificationMethodId), verificationMethodId);
		Guards.object(IdentityService.CLASS_NAME, nameof(subject), subject);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const service = await identityConnector.createVerifiableCredential(
				controller,
				verificationMethodId,
				id,
				subject,
				options
			);

			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VcsCreated, {
				hasRevocation: Is.number(options?.revocationIndex),
				hasExpiration: Is.date(options?.expirationDate)
			});

			return service;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiableCredentialCreateFailed",
				{ verificationMethodId },
				error
			);
		}
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
			Guards.objectValue<IDidVerifiableCredential>(
				IdentityService.CLASS_NAME,
				nameof(credential),
				credential
			);
			Guards.stringValue(IdentityService.CLASS_NAME, nameof(credential.issuer), credential.issuer);
			Guards.objectValue<IDidVerifiableCredential>(
				IdentityService.CLASS_NAME,
				nameof(credential.proof),
				credential.proof
			);

			try {
				const identityConnector = this.getConnectorByUri(credential.issuer);

				const service = await identityConnector.checkVerifiableCredential(credential);

				if (service.revoked) {
					await MetricHelper.metricIncrement(
						this._telemetryComponent,
						IdentityMetricIds.VcsVerificationFailed,
						{ failureReason: "revoked" }
					);
				} else {
					await MetricHelper.metricIncrement(
						this._telemetryComponent,
						IdentityMetricIds.VcsVerified
					);
				}

				return service;
			} catch (error) {
				throw new GeneralError(
					IdentityService.CLASS_NAME,
					"verifiableCredentialVerifyFailed",
					undefined,
					error
				);
			}
		}

		Guards.stringValue(IdentityService.CLASS_NAME, nameof(credential), credential);

		const jwtDecoded = await Jwt.decode(credential);

		const jwtHeader = jwtDecoded.header;
		const jwtPayload = jwtDecoded.payload;
		const jwtSignature = jwtDecoded.signature;

		if (
			Is.undefined(jwtHeader) ||
			Is.undefined(jwtPayload) ||
			Is.undefined(jwtPayload.iss) ||
			Is.undefined(jwtSignature)
		) {
			throw new GeneralError(IdentityService.CLASS_NAME, "jwtDecodeFailed");
		}

		try {
			const identityConnector = this.getConnectorByUri(jwtPayload.iss);

			const service = await identityConnector.checkVerifiableCredential(credential);

			if (service.revoked) {
				await MetricHelper.metricIncrement(
					this._telemetryComponent,
					IdentityMetricIds.VcsVerificationFailed,
					{ failureReason: "revoked" }
				);
			} else {
				await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VcsVerified);
			}

			return service;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiableCredentialVerifyFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Revoke verifiable credential.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to revoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the credential has been revoked.
	 */
	public async verifiableCredentialRevoke(
		issuerIdentity: string,
		credentialIndex: number,
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(issuerIdentity), issuerIdentity);
		Guards.number(IdentityService.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		try {
			const idParts = DocumentHelper.parseId(issuerIdentity);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const result = await identityConnector.revokeVerifiableCredentials(
				controller,
				issuerIdentity,
				[credentialIndex]
			);

			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VcsRevoked);

			return result;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiableCredentialRevokeFailed",
				{ issuerIdentity, credentialIndex },
				error
			);
		}
	}

	/**
	 * Unrevoke verifiable credential.
	 * @param issuerIdentity The id of the document to update the revocation list for.
	 * @param credentialIndex The revocation bitmap index to un revoke.
	 * @param controller The controller of the identity who can make changes.
	 * @returns A promise that resolves when the credential has been unrevoked.
	 */
	public async verifiableCredentialUnrevoke(
		issuerIdentity: string,
		credentialIndex: number,
		controller?: string
	): Promise<void> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(issuerIdentity), issuerIdentity);
		Guards.number(IdentityService.CLASS_NAME, nameof(credentialIndex), credentialIndex);

		try {
			const idParts = DocumentHelper.parseId(issuerIdentity);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const result = await identityConnector.unrevokeVerifiableCredentials(
				controller,
				issuerIdentity,
				[credentialIndex]
			);

			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VcsUnrevoked);

			return result;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiableCredentialUnrevokeFailed",
				{ issuerIdentity, credentialIndex },
				error
			);
		}
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
	 * @param options.jwtPayloadFields	Additional fields to include in the JWT payload when creating the verifiable presentation in jwt format.
	 * @param controller The controller of the identity who can make changes.
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
		},
		controller?: string
	): Promise<{
		verifiablePresentation: IDidVerifiablePresentation;
		jwt: string;
	}> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(
			IdentityService.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const result = await identityConnector.createVerifiablePresentation(
				controller,
				verificationMethodId,
				presentationId,
				contexts,
				types,
				verifiableCredentials,
				options
			);

			await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VpsCreated, {
				credentialCount: verifiableCredentials.length
			});

			return result;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiablePresentationCreateFailed",
				{ verificationMethodId },
				error
			);
		}
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
		let holder;
		if (Is.stringValue(presentation)) {
			Guards.stringValue(IdentityService.CLASS_NAME, nameof(presentation), presentation);

			const jwtDecoded = await Jwt.decode(presentation);

			const jwtHeader = jwtDecoded.header;
			const jwtPayload = jwtDecoded.payload;
			const jwtSignature = jwtDecoded.signature;

			if (
				Is.undefined(jwtHeader) ||
				Is.undefined(jwtPayload) ||
				Is.undefined(jwtPayload.iss) ||
				Is.undefined(jwtSignature)
			) {
				throw new GeneralError(IdentityService.CLASS_NAME, "jwtDecodeFailed");
			}

			holder = jwtPayload.iss;
		} else {
			holder = presentation.holder;
		}
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(holder), holder);

		try {
			const identityConnector = this.getConnectorByUri(holder);

			const service = await identityConnector.checkVerifiablePresentation(presentation);

			if (service.revoked) {
				await MetricHelper.metricIncrement(
					this._telemetryComponent,
					IdentityMetricIds.VpsVerificationFailed,
					{ failureReason: "revoked" }
				);
			} else {
				await MetricHelper.metricIncrement(this._telemetryComponent, IdentityMetricIds.VpsVerified);
			}

			return service;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"verifiablePresentationVerifyFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Create a proof for a document with the specified verification method.
	 * @param verificationMethodId The verification method id to use.
	 * @param proofType The type of proof to create.
	 * @param unsecureDocument The unsecure document to create the proof for.
	 * @param controller The controller of the identity who can make changes.
	 * @returns The proof.
	 */
	public async proofCreate(
		verificationMethodId: string,
		proofType: ProofTypes,
		unsecureDocument: IJsonLdNodeObject,
		controller?: string
	): Promise<IProof> {
		Guards.stringValue(IdentityService.CLASS_NAME, nameof(controller), controller);
		Guards.stringValue(
			IdentityService.CLASS_NAME,
			nameof(verificationMethodId),
			verificationMethodId
		);
		Guards.arrayOneOf<ProofTypes>(
			IdentityService.CLASS_NAME,
			nameof(proofType),
			proofType,
			Object.values(ProofTypes)
		);
		Guards.object<IJsonLdNodeObject>(
			IdentityService.CLASS_NAME,
			nameof(unsecureDocument),
			unsecureDocument
		);

		try {
			const idParts = DocumentHelper.parseId(verificationMethodId);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const result = await identityConnector.createProof(
				controller,
				verificationMethodId,
				proofType,
				unsecureDocument
			);
			return result;
		} catch (error) {
			throw new GeneralError(
				IdentityService.CLASS_NAME,
				"proofCreateFailed",
				{ verificationMethodId },
				error
			);
		}
	}

	/**
	 * Verify proof for a document with the specified verification method.
	 * @param document The document to verify.
	 * @param proof The proof to verify.
	 * @returns True if the proof is verified.
	 */
	public async proofVerify(document: IJsonLdNodeObject, proof: IProof): Promise<boolean> {
		Guards.object<IJsonLdNodeObject>(IdentityService.CLASS_NAME, nameof(document), document);
		Guards.object<IProof>(IdentityService.CLASS_NAME, nameof(proof), proof);
		Guards.stringValue(
			IdentityService.CLASS_NAME,
			nameof(proof.verificationMethod),
			proof.verificationMethod
		);

		try {
			const idParts = DocumentHelper.parseId(proof.verificationMethod);

			const identityConnector = this.getConnectorByUri(idParts.id);

			const result = await identityConnector.verifyProof(document, proof);
			return result;
		} catch (error) {
			throw new GeneralError(IdentityService.CLASS_NAME, "proofVerifyFailed", undefined, error);
		}
	}

	/**
	 * Get the connector from the namespace.
	 * @param namespace The namespace for the identity.
	 * @returns The connector.
	 * @throws GeneralError if the connector is not found.
	 * @internal
	 */
	private getConnectorByNamespace(namespace?: string): IIdentityConnector {
		const namespaceMethod = namespace ?? this._defaultNamespace;

		const connector = IdentityConnectorFactory.getIfExists<IIdentityConnector>(namespaceMethod);

		if (Is.empty(connector)) {
			throw new GeneralError(IdentityService.CLASS_NAME, "connectorNotFound", {
				namespace: namespaceMethod
			});
		}

		return connector;
	}

	/**
	 * Get the connector from the uri.
	 * @param id The id of the identity in urn format.
	 * @returns The connector.
	 * @throws GeneralError if the namespace does not match or the connector is not found.
	 * @internal
	 */
	private getConnectorByUri(id: string): IIdentityConnector {
		const idUri = Urn.fromValidString(id);

		if (idUri.namespaceIdentifier() !== "did") {
			throw new GeneralError(IdentityService.CLASS_NAME, "namespaceMismatch", {
				namespace: "did",
				id
			});
		}

		return this.getConnectorByNamespace(idUri.namespaceMethod());
	}
}
