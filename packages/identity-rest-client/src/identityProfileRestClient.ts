// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@3sixty/api-core";
import { HttpParameterHelper, type IBaseRestClientConfig } from "@3sixty/api-models";
import { Coerce, Guards, Is } from "@3sixty/core";
import type { IJsonLdDocument } from "@3sixty/data-json-ld";
import type {
	IIdentityProfileAdminGetRequest,
	IIdentityProfileAdminListRequest,
	IIdentityProfileAdminListResponse,
	IIdentityProfileAdminRemoveRequest,
	IIdentityProfileAdminUpdateRequest,
	IIdentityProfileComponent,
	IIdentityProfileCreateRequest,
	IIdentityProfileGetPublicRequest,
	IIdentityProfileGetPublicResponse,
	IIdentityProfileGetRequest,
	IIdentityProfileGetResponse,
	IIdentityProfileListRequest,
	IIdentityProfileListResponse,
	IIdentityProfileUpdateRequest
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { HttpMethod } from "@3sixty/web";

/**
 * Client for performing identity profile operations through REST endpoints.
 */
export class IdentityProfileRestClient<
	T extends IJsonLdDocument = IJsonLdDocument,
	U extends IJsonLdDocument = IJsonLdDocument
>
	extends BaseRestClient
	implements IIdentityProfileComponent<T, U>
{
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityProfileRestClient>();

	/**
	 * Create a new instance of IdentityProfileRestClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<IdentityProfileRestClient>(), config, "identity/profile");
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return IdentityProfileRestClient.CLASS_NAME;
	}

	/**
	 * Create the profile properties for an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @returns A promise that resolves when the profile has been created.
	 */
	public async create(publicProfile?: T, privateProfile?: U): Promise<void> {
		await this.fetch<IIdentityProfileCreateRequest, never>("/", HttpMethod.POST, {
			body: {
				publicProfile,
				privateProfile
			}
		});
	}

	/**
	 * Get the profile properties for an identity.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @param identity The identity to perform the profile operation on, defaults to the current user.
	 * @returns The identity and the items properties.
	 */
	public async get(
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[],
		identity?: string
	): Promise<{
		identity: string;
		publicProfile?: Partial<T>;
		privateProfile?: Partial<U>;
	}> {
		if (Is.notEmpty(identity)) {
			Guards.string(IdentityProfileRestClient.CLASS_NAME, nameof(identity), identity);
			const response = await this.fetch<
				IIdentityProfileAdminGetRequest,
				IIdentityProfileGetResponse
			>("/:userIdentity", HttpMethod.GET, {
				pathParams: {
					userIdentity: identity
				},
				query: {
					publicPropertyNames: HttpParameterHelper.arrayToString(publicPropertyNames),
					privatePropertyNames: HttpParameterHelper.arrayToString(privatePropertyNames)
				}
			});
			return {
				identity: response.body.identity,
				publicProfile: response.body.publicProfile as T,
				privateProfile: response.body.privateProfile as U
			};
		}
		const response = await this.fetch<IIdentityProfileGetRequest, IIdentityProfileGetResponse>(
			"/",
			HttpMethod.GET,
			{
				query: {
					publicPropertyNames: HttpParameterHelper.arrayToString(publicPropertyNames),
					privatePropertyNames: HttpParameterHelper.arrayToString(privatePropertyNames)
				}
			}
		);

		return {
			identity: response.body.identity,
			publicProfile: response.body.publicProfile as T,
			privateProfile: response.body.privateProfile as U
		};
	}

	/**
	 * Get the public profile properties for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @param propertyNames The public properties to get for the profile, defaults to all.
	 * @returns The items properties.
	 */
	public async getPublic(identity: string, propertyNames?: (keyof T)[]): Promise<Partial<T>> {
		Guards.string(IdentityProfileRestClient.CLASS_NAME, nameof(identity), identity);

		const response = await this.fetch<
			IIdentityProfileGetPublicRequest,
			IIdentityProfileGetPublicResponse
		>("/:identity/public", HttpMethod.GET, {
			pathParams: {
				identity
			},
			query: {
				propertyNames: HttpParameterHelper.arrayToString(propertyNames)
			}
		});

		return response.body as Partial<T>;
	}

	/**
	 * Update the profile properties of an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @param identity The identity to perform the profile operation on, defaults to the current user.
	 * @returns A promise that resolves when the profile has been updated.
	 */
	public async update(publicProfile?: T, privateProfile?: U, identity?: string): Promise<void> {
		if (Is.notEmpty(identity)) {
			Guards.string(IdentityProfileRestClient.CLASS_NAME, nameof(identity), identity);
			await this.fetch<IIdentityProfileAdminUpdateRequest, never>(
				"/:userIdentity",
				HttpMethod.PUT,
				{
					pathParams: {
						userIdentity: identity
					},
					body: {
						publicProfile,
						privateProfile
					}
				}
			);
			return;
		}
		await this.fetch<IIdentityProfileUpdateRequest, never>("/", HttpMethod.PUT, {
			body: {
				publicProfile,
				privateProfile
			}
		});
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to perform the profile operation on, defaults to the current user.
	 * @returns A promise that resolves when the profile has been removed.
	 */
	public async remove(identity?: string): Promise<void> {
		if (Is.notEmpty(identity)) {
			Guards.string(IdentityProfileRestClient.CLASS_NAME, nameof(identity), identity);
			await this.fetch<IIdentityProfileAdminRemoveRequest, never>(
				"/:userIdentity",
				HttpMethod.DELETE,
				{
					pathParams: {
						userIdentity: identity
					}
				}
			);
			return;
		}
		await this.fetch<never, never>("/", HttpMethod.DELETE);
	}

	/**
	 * Get a list of the requested identities.
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param cursor The cursor for paged requests.
	 * @param limit The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
		publicFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		publicPropertyNames?: (keyof T)[],
		cursor?: string,
		limit?: number
	): Promise<{
		/**
		 * The identities.
		 */
		items: {
			identity: string;
			publicProfile?: Partial<T>;
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}> {
		const response = await this.fetch<IIdentityProfileListRequest, IIdentityProfileListResponse>(
			"/query",
			HttpMethod.GET,
			{
				query: {
					publicFilters: HttpParameterHelper.arrayToString(
						publicFilters?.map(f => `${f.propertyName}:${Coerce.string(f.propertyValue) ?? ""}`)
					),
					publicPropertyNames: HttpParameterHelper.arrayToString(publicPropertyNames),
					cursor,
					limit: Coerce.string(limit)
				}
			}
		);
		return {
			items: response.body.items as {
				identity: string;
				publicProfile?: Partial<T>;
			}[],
			cursor: response.body.cursor
		};
	}

	/**
	 * Get the list of identity profiles including private properties.
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param privateFilters The filters to apply to the identities private profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to none.
	 * @param cursor The cursor for paged requests.
	 * @param limit The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async listAdmin(
		publicFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		privateFilters?: {
			propertyName: string;
			propertyValue: unknown;
		}[],
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[],
		cursor?: string,
		limit?: number
	): Promise<{
		items: {
			identity: string;
			publicProfile?: Partial<T>;
			privateProfile?: Partial<U>;
		}[];
		cursor?: string;
	}> {
		const response = await this.fetch<
			IIdentityProfileAdminListRequest,
			IIdentityProfileAdminListResponse
		>("/admin/query", HttpMethod.GET, {
			query: {
				publicFilters: HttpParameterHelper.arrayToString(
					publicFilters?.map(f => `${f.propertyName}:${Coerce.string(f.propertyValue) ?? ""}`)
				),
				privateFilters: HttpParameterHelper.arrayToString(
					privateFilters?.map(f => `${f.propertyName}:${Coerce.string(f.propertyValue) ?? ""}`)
				),
				publicPropertyNames: HttpParameterHelper.arrayToString(publicPropertyNames),
				privatePropertyNames: HttpParameterHelper.arrayToString(privatePropertyNames),
				cursor,
				limit: Coerce.string(limit)
			}
		});
		return {
			items: response.body.items as {
				identity: string;
				publicProfile?: Partial<T>;
				privateProfile?: Partial<U>;
			}[],
			cursor: response.body.cursor
		};
	}
}
