// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	HttpParameterHelper,
	type IRouteAuthorization,
	type IConflictResponse,
	type IForbiddenResponse,
	type IHttpRequestContext,
	type INoContentRequest,
	type INoContentResponse,
	type INotFoundResponse,
	type IRestRoute,
	type ITag
} from "@3sixty/api-models";
import { ContextIdHelper, ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { Coerce, ComponentFactory, Guards } from "@3sixty/core";
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
import { HeaderTypes, HttpStatusCode, MimeTypes } from "@3sixty/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "identityProfileRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsIdentityProfile: ITag[] = [
	{
		name: "Identity Profile",
		description: "Service to provide all features related to digital identity profiles."
	}
];

/**
 * The default authorization for the routes, used to seed authorization rules.
 */
const DEFAULT_AUTHORIZATION_READER: IRouteAuthorization = {
	permission: "identity-profile:read",
	role: "identity-profile-admin"
};
const DEFAULT_AUTHORIZATION_WRITER: IRouteAuthorization = {
	permission: "identity-profile:write",
	role: "identity-profile-admin",
	inherits: [DEFAULT_AUTHORIZATION_READER.permission]
};

/**
 * The REST routes for identity.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesIdentityProfile(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const identityProfileCreateRoute: IRestRoute<IIdentityProfileCreateRequest, INoContentResponse> =
		{
			operationId: "identityProfileCreate",
			summary: "Create an identity profile",
			tag: tagsIdentityProfile[0].name,
			method: "POST",
			path: `${baseRouteName}/`,
			handler: async (httpRequestContext, request) =>
				identityProfileCreate(httpRequestContext, componentName, request),
			requestType: {
				type: nameof<IIdentityProfileCreateRequest>(),
				examples: [
					{
						id: "identityProfileCreateRequestExample",
						request: {
							body: {
								publicProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								},
								privateProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									telephone: "(425) 123-4567",
									url: "http://www.janedoe.com"
								}
							}
						}
					}
				]
			},
			responseType: [
				{
					type: nameof<INoContentResponse>()
				},
				{
					type: nameof<IConflictResponse>()
				}
			]
		};

	const identityProfileGetRoute: IRestRoute<
		IIdentityProfileGetRequest,
		IIdentityProfileGetResponse
	> = {
		operationId: "identityProfileGet",
		summary: "Get the identity profile properties",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			identityGet(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileGetRequest>(),
			examples: [
				{
					id: "identityGetProfileRequestExample",
					request: {
						query: {
							publicPropertyNames: "name,jobTitle"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileGetResponse>(),
				examples: [
					{
						id: "identityGetResponseExample",
						response: {
							body: {
								identity:
									"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
								publicProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								}
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityProfileAdminGetRoute: IRestRoute<
		IIdentityProfileAdminGetRequest,
		IIdentityProfileGetResponse
	> = {
		operationId: "identityProfileAdminGet",
		summary: "Get the identity profile properties of another user",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/:userIdentity`,
		handler: async (httpRequestContext, request) =>
			identityProfileAdminGet(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileAdminGetRequest>(),
			examples: [
				{
					id: "identityProfileAdminGetRequestExample",
					request: {
						pathParams: {
							userIdentity:
								"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						query: {
							publicPropertyNames: "name,jobTitle"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileGetResponse>(),
				examples: [
					{
						id: "identityProfileAdminGetResponseExample",
						response: {
							body: {
								identity:
									"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
								publicProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								}
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			},
			{
				type: nameof<IForbiddenResponse>()
			}
		],
		defaultAuthorization: DEFAULT_AUTHORIZATION_READER
	};

	const identityProfileGetPublicRoute: IRestRoute<
		IIdentityProfileGetPublicRequest,
		IIdentityProfileGetPublicResponse
	> = {
		operationId: "identityProfileGetPublic",
		summary: "Get the identity profile public properties",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/:identity/public`,
		skipAuth: true,
		handler: async (httpRequestContext, request) =>
			identityGetPublic(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileGetPublicRequest>(),
			examples: [
				{
					id: "identityGetPublicProfileRequestExample",
					request: {
						pathParams: {
							identity:
								"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						query: {
							propertyNames: "role,email,name"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileGetPublicResponse>(),
				mimeType: MimeTypes.JsonLd,
				examples: [
					{
						id: "identityGetPublicResponseExample",
						response: {
							headers: {
								[HeaderTypes.ContentType]: MimeTypes.JsonLd
							},
							body: {
								"@context": "https://schema.org",
								"@type": "Person",
								jobTitle: "Professor",
								name: "Jane Doe"
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityProfileUpdateRoute: IRestRoute<IIdentityProfileUpdateRequest, INoContentResponse> =
		{
			operationId: "identityProfileUpdate",
			summary: "Update an identity profile properties",
			tag: tagsIdentityProfile[0].name,
			method: "PUT",
			path: `${baseRouteName}/`,
			handler: async (httpRequestContext, request) =>
				identityProfileUpdate(httpRequestContext, componentName, request),
			requestType: {
				type: nameof<IIdentityProfileUpdateRequest>(),
				examples: [
					{
						id: "identityProfileUpdateRequestExample",
						request: {
							body: {
								publicProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									jobTitle: "Professor",
									name: "Jane Doe"
								},
								privateProfile: {
									"@context": "https://schema.org",
									"@type": "Person",
									telephone: "(425) 123-4567",
									url: "http://www.janedoe.com"
								}
							}
						}
					}
				]
			},
			responseType: [
				{
					type: nameof<INoContentResponse>()
				},
				{
					type: nameof<INotFoundResponse>()
				}
			]
		};

	const identityProfileAdminUpdateRoute: IRestRoute<
		IIdentityProfileAdminUpdateRequest,
		INoContentResponse
	> = {
		operationId: "identityProfileAdminUpdate",
		summary: "Update the identity profile properties of another user",
		tag: tagsIdentityProfile[0].name,
		method: "PUT",
		path: `${baseRouteName}/:userIdentity`,
		handler: async (httpRequestContext, request) =>
			identityProfileAdminUpdate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileAdminUpdateRequest>(),
			examples: [
				{
					id: "identityProfileAdminUpdateRequestExample",
					request: {
						pathParams: {
							userIdentity:
								"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						},
						body: {
							publicProfile: {
								"@context": "https://schema.org",
								"@type": "Person",
								jobTitle: "Professor",
								name: "Jane Doe"
							},
							privateProfile: {
								"@context": "https://schema.org",
								"@type": "Person",
								telephone: "(425) 123-4567",
								url: "http://www.janedoe.com"
							}
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			},
			{
				type: nameof<IForbiddenResponse>()
			}
		],
		defaultAuthorization: DEFAULT_AUTHORIZATION_WRITER
	};

	const identityProfileAdminRemoveRoute: IRestRoute<
		IIdentityProfileAdminRemoveRequest,
		INoContentResponse
	> = {
		operationId: "identityProfileAdminRemove",
		summary: "Remove the identity profile of another user",
		tag: tagsIdentityProfile[0].name,
		method: "DELETE",
		path: `${baseRouteName}/:userIdentity`,
		handler: async (httpRequestContext, request) =>
			identityProfileAdminRemove(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileAdminRemoveRequest>(),
			examples: [
				{
					id: "identityProfileAdminRemoveRequestExample",
					request: {
						pathParams: {
							userIdentity:
								"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			},
			{
				type: nameof<IForbiddenResponse>()
			}
		],
		defaultAuthorization: DEFAULT_AUTHORIZATION_WRITER
	};

	const identityProfileRemoveRoute: IRestRoute<INoContentRequest, INoContentResponse> = {
		operationId: "identityProfileRemove",
		summary: "Remove an identity profile",
		tag: tagsIdentityProfile[0].name,
		method: "DELETE",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			identityProfileRemove(httpRequestContext, componentName, request),
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const identityProfileListRoute: IRestRoute<
		IIdentityProfileListRequest,
		IIdentityProfileListResponse
	> = {
		operationId: "identitiesProfileList",
		summary: "Get the list of profile data for identities",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/query/`,
		handler: async (httpRequestContext, request) =>
			identitiesList(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileListRequest>(),
			examples: [
				{
					id: "identityProfileListRequestExample",
					request: {
						query: {}
					}
				},
				{
					id: "identityProfileListRequestFilteredExample",
					request: {
						query: {
							publicFilters: "jobTitle:Professor"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileListResponse>(),
				examples: [
					{
						id: "identitiesProfileListResponseExample",
						response: {
							body: {
								items: [
									{
										identity:
											"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
										publicProfile: {
											"@context": "https://schema.org",
											"@type": "Person",
											jobTitle: "Professor",
											name: "Jane Doe"
										}
									}
								],
								cursor: "1"
							}
						}
					}
				]
			}
		]
	};

	const identityProfileAdminListRoute: IRestRoute<
		IIdentityProfileAdminListRequest,
		IIdentityProfileAdminListResponse
	> = {
		operationId: "identitiesProfileAdminList",
		summary: "Get the list of profile data for identities including private properties",
		tag: tagsIdentityProfile[0].name,
		method: "GET",
		path: `${baseRouteName}/admin/query/`,
		handler: async (httpRequestContext, request) =>
			identitiesAdminList(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IIdentityProfileAdminListRequest>(),
			examples: [
				{
					id: "identityProfileAdminListRequestExample",
					request: {
						query: {}
					}
				},
				{
					id: "identityProfileAdminListRequestFilteredExample",
					request: {
						query: {
							publicFilters: "jobTitle:Professor",
							privateFilters: "department:Engineering"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IIdentityProfileAdminListResponse>(),
				examples: [
					{
						id: "identitiesProfileAdminListResponseExample",
						response: {
							body: {
								items: [
									{
										identity:
											"did:iota:tst:0xc57d94b088f4c6d2cb32ded014813d0c786aa00134c8ee22f84b1e2545602a70",
										publicProfile: {
											"@context": "https://schema.org",
											"@type": "Person",
											jobTitle: "Professor",
											name: "Jane Doe"
										},
										privateProfile: {
											"@context": "https://schema.org",
											"@type": "Person",
											telephone: "(425) 123-4567"
										}
									}
								],
								cursor: "1"
							}
						}
					}
				]
			},
			{
				type: nameof<IForbiddenResponse>()
			}
		],
		defaultAuthorization: DEFAULT_AUTHORIZATION_READER
	};

	return [
		identityProfileCreateRoute,
		identityProfileGetRoute,
		identityProfileAdminGetRoute,
		identityProfileGetPublicRoute,
		identityProfileUpdateRoute,
		identityProfileAdminUpdateRoute,
		identityProfileRemoveRoute,
		identityProfileAdminRemoveRoute,
		identityProfileListRoute,
		identityProfileAdminListRoute
	];
}

/**
 * Create an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileCreateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileCreateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const contextIds = await ContextIdStore.getContextIds();
	ContextIdHelper.guard(contextIds, ContextIdKeys.User);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.create(
		request.body.publicProfile,
		request.body.privateProfile,
		contextIds[ContextIdKeys.User]
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGet(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileGetRequest
): Promise<IIdentityProfileGetResponse> {
	Guards.object<IIdentityProfileGetRequest>(ROUTES_SOURCE, nameof(request), request);

	const contextIds = await ContextIdStore.getContextIds();
	ContextIdHelper.guard(contextIds, ContextIdKeys.User);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const result = await component.get(
		HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(request?.query?.publicPropertyNames),
		HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(
			request?.query?.privatePropertyNames
		),
		contextIds[ContextIdKeys.User]
	);

	return {
		body: result
	};
}

/**
 * Get the identity profile of another user as an admin.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileAdminGet(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileAdminGetRequest
): Promise<IIdentityProfileGetResponse> {
	Guards.object<IIdentityProfileAdminGetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.userIdentity),
		request.pathParams?.userIdentity
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const result = await component.get(
		HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(request?.query?.publicPropertyNames),
		HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(
			request?.query?.privatePropertyNames
		),
		request.pathParams.userIdentity
	);

	return {
		body: result
	};
}

/**
 * Get the identity public profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityGetPublic(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileGetPublicRequest
): Promise<IIdentityProfileGetPublicResponse> {
	Guards.object<IIdentityProfileGetPublicRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.identity),
		request.pathParams?.identity
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const result = await component.getPublic(
		request?.pathParams.identity,
		HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(request?.query?.propertyNames)
	);

	return {
		headers: {
			[HeaderTypes.ContentType]: MimeTypes.JsonLd
		},
		body: result
	};
}

/**
 * Update an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileUpdate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileUpdateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileUpdateRequest>(ROUTES_SOURCE, nameof(request), request);

	Guards.object<IIdentityProfileUpdateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);

	const contextIds = await ContextIdStore.getContextIds();
	ContextIdHelper.guard(contextIds, ContextIdKeys.User);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.update(
		request.body.publicProfile,
		request.body.privateProfile,
		contextIds[ContextIdKeys.User]
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Update the identity profile of another user as an admin.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileAdminUpdate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileAdminUpdateRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileAdminUpdateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IIdentityProfileAdminUpdateRequest["body"]>(
		ROUTES_SOURCE,
		nameof(request.body),
		request.body
	);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.userIdentity),
		request.pathParams?.userIdentity
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.update(
		request.body.publicProfile,
		request.body.privateProfile,
		request.pathParams.userIdentity
	);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove an identity profile.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: INoContentRequest
): Promise<INoContentResponse> {
	const contextIds = await ContextIdStore.getContextIds();
	ContextIdHelper.guard(contextIds, ContextIdKeys.User);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.remove(contextIds[ContextIdKeys.User]);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove the identity profile of another user as an admin.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identityProfileAdminRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileAdminRemoveRequest
): Promise<INoContentResponse> {
	Guards.object<IIdentityProfileAdminRemoveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.stringValue(
		ROUTES_SOURCE,
		nameof(request.pathParams?.userIdentity),
		request.pathParams?.userIdentity
	);

	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	await component.remove(request.pathParams.userIdentity);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Get the list of organizations.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identitiesList(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileListRequest
): Promise<IIdentityProfileListResponse> {
	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const publicFilterPairs = HttpParameterHelper.arrayFromString(request?.query?.publicFilters);
	const publicFilters = publicFilterPairs?.map(pair => {
		const parts = pair.split(":");
		return {
			propertyName: parts[0],
			propertyValue: parts[1]
		};
	});

	return {
		body: await component.list(
			publicFilters,
			HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(
				request?.query?.publicPropertyNames
			),
			request?.query?.cursor,
			Coerce.integer(request.query?.limit)
		)
	};
}

/**
 * Get the list of identity profiles including private properties as an admin.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function identitiesAdminList(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IIdentityProfileAdminListRequest
): Promise<IIdentityProfileAdminListResponse> {
	const component = ComponentFactory.get<IIdentityProfileComponent>(componentName);

	const publicFilterPairs = HttpParameterHelper.arrayFromString(request?.query?.publicFilters);
	const publicFilters = publicFilterPairs?.map(pair => {
		const parts = pair.split(":");
		return {
			propertyName: parts[0],
			propertyValue: parts[1]
		};
	});

	const privateFilterPairs = HttpParameterHelper.arrayFromString(request?.query?.privateFilters);
	const privateFilters = privateFilterPairs?.map(pair => {
		const parts = pair.split(":");
		return {
			propertyName: parts[0],
			propertyValue: parts[1]
		};
	});

	return {
		body: await component.listAdmin(
			publicFilters,
			privateFilters,
			HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(
				request?.query?.publicPropertyNames
			),
			HttpParameterHelper.arrayFromString<keyof IJsonLdDocument>(
				request?.query?.privatePropertyNames
			),
			request?.query?.cursor,
			Coerce.integer(request.query?.limit)
		)
	};
}
