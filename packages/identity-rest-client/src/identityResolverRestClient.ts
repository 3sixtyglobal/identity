// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@3sixty/api-core";
import type { IBaseRestClientConfig } from "@3sixty/api-models";
import { Urn } from "@3sixty/core";
import type {
	IIdentityResolverComponent,
	IIdentityResolveRequest,
	IIdentityResolveResponse
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import { HttpMethod } from "@3sixty/web";

/**
 * Client for performing identity resolution through REST endpoints.
 */
export class IdentityResolverRestClient
	extends BaseRestClient
	implements IIdentityResolverComponent
{
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityResolverRestClient>();

	/**
	 * Create a new instance of IdentityResolverRestClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityResolverRestClient>(), config, "identity");
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return IdentityResolverRestClient.CLASS_NAME;
	}

	/**
	 * Resolve an identity.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 */
	public async identityResolve(documentId: string): Promise<IDidDocument> {
		Urn.guard(IdentityResolverRestClient.CLASS_NAME, nameof(documentId), documentId);

		const response = await this.fetch<IIdentityResolveRequest, IIdentityResolveResponse>(
			"/:identity",
			HttpMethod.GET,
			{
				pathParams: {
					identity: documentId
				}
			}
		);

		return response.body;
	}
}
