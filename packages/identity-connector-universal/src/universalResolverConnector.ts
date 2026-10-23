// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	HealthCategory,
	HealthStatus,
	type IHealth,
	type IHealthProviderComponent
} from "@3sixty/api-models";
import { GeneralError, Guards, StringHelper } from "@3sixty/core";
import type { IIdentityResolverConnector } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import { FetchHelper, HttpMethod } from "@3sixty/web";
import type { IUniversalResolverResult } from "./models/api/IUniversalResolverResult.js";
import type { IUniversalResolverConnectorConfig } from "./models/IUniversalResolverConnectorConfig.js";
import type { IUniversalResolverConnectorConstructorOptions } from "./models/IUniversalResolverConnectorConstructorOptions.js";

/**
 * Class for performing identity operations on a universal resolver.
 */
export class UniversalResolverConnector
	implements IIdentityResolverConnector, IHealthProviderComponent
{
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "universal";

	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<UniversalResolverConnector>();

	/**
	 * The url for the resolver.
	 * @internal
	 */
	private readonly _resolverEndpoint: string;

	/**
	 * Create a new instance of UniversalResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options: IUniversalResolverConnectorConstructorOptions) {
		Guards.object(UniversalResolverConnector.CLASS_NAME, nameof(options), options);
		Guards.object<IUniversalResolverConnectorConfig>(
			UniversalResolverConnector.CLASS_NAME,
			nameof(options.config),
			options.config
		);
		Guards.stringValue(
			UniversalResolverConnector.CLASS_NAME,
			nameof(options.config.endpoint),
			options.config.endpoint
		);

		this._resolverEndpoint = options.config.endpoint;
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return UniversalResolverConnector.CLASS_NAME;
	}

	/**
	 * Returns the health status of the component.
	 * @returns The health status of the component.
	 */
	public async health(): Promise<IHealth[]> {
		try {
			const response = await FetchHelper.fetch(
				UniversalResolverConnector.CLASS_NAME,
				`${StringHelper.trimTrailingSlashes(this._resolverEndpoint)}/1.0/identifiers/did:iota:0`,
				HttpMethod.GET
			);

			const body = await response.text();

			if (!body.includes("invalid method id")) {
				return [
					{
						source: UniversalResolverConnector.CLASS_NAME,
						category: HealthCategory.Connectivity,
						status: HealthStatus.Error,
						description: "healthDescription",
						message: "resolverHealthCheckFailed",
						data: { endpoint: this._resolverEndpoint }
					}
				];
			}

			return [
				{
					source: UniversalResolverConnector.CLASS_NAME,
					category: HealthCategory.Connectivity,
					status: HealthStatus.Ok,
					description: "healthDescription",
					data: { endpoint: this._resolverEndpoint }
				}
			];
		} catch {
			return [
				{
					source: UniversalResolverConnector.CLASS_NAME,
					category: HealthCategory.Connectivity,
					status: HealthStatus.Error,
					description: "healthDescription",
					message: "resolverHealthCheckFailed",
					data: { endpoint: this._resolverEndpoint }
				}
			];
		}
	}

	/**
	 * Resolve a document from its id.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		try {
			const result = await FetchHelper.fetchJson<never, IUniversalResolverResult>(
				UniversalResolverConnector.CLASS_NAME,
				`${StringHelper.trimTrailingSlashes(this._resolverEndpoint)}/1.0/identifiers/${encodeURIComponent(documentId)}`,
				HttpMethod.GET
			);

			return result.didDocument;
		} catch (error) {
			throw new GeneralError(
				UniversalResolverConnector.CLASS_NAME,
				"resolveDocumentFailed",
				{ documentId },
				error
			);
		}
	}
}
