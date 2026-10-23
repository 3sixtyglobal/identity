// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HttpContextIdKeys, ScopeHelper } from "@3sixty/api-models";
import { ContextIdStore } from "@3sixty/context";
import {
	BaseError,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper,
	UnauthorizedError
} from "@3sixty/core";
import type { IJsonLdDocument } from "@3sixty/data-json-ld";
import {
	IdentityProfileConnectorFactory,
	type IIdentityProfileComponent,
	type IIdentityProfileConnector
} from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import { IdentityService } from "./identityService.js";
import type { IIdentityProfileServiceConstructorOptions } from "./models/IIdentityProfileServiceConstructorOptions.js";

/**
 * Class which implements the identity profile contract.
 */
export class IdentityProfileService<
	T extends IJsonLdDocument = IJsonLdDocument,
	U extends IJsonLdDocument = IJsonLdDocument
> implements IIdentityProfileComponent<T, U> {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityProfileService>();

	/**
	 * The identity profile connector.
	 * @internal
	 */
	private readonly _identityProfileConnector: IIdentityProfileConnector<T, U>;

	/**
	 * The profile properties which can only be modified with an admin scope.
	 * @internal
	 */
	private readonly _selfUpdateDeniedProperties: string[];

	/**
	 * The scopes which allow the denied properties to be modified.
	 * @internal
	 */
	private readonly _adminScopes: string[];

	/**
	 * Create a new instance of IdentityProfileService.
	 * @param options The dependencies for the identity profile service.
	 */
	constructor(options?: IIdentityProfileServiceConstructorOptions) {
		this._identityProfileConnector = IdentityProfileConnectorFactory.get<
			IIdentityProfileConnector<T, U>
		>(options?.profileEntityConnectorType ?? "identity-profile");
		this._selfUpdateDeniedProperties = options?.config?.selfUpdateDeniedProperties ?? [];
		this._adminScopes = options?.config?.adminScopes ?? ["user-admin", "global-admin"];
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return IdentityService.CLASS_NAME;
	}

	/**
	 * Create the profile properties for an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @param identity The identity to perform the profile operation on.
	 * @returns A promise that resolves when the profile has been created.
	 */
	public async create(publicProfile?: T, privateProfile?: U, identity?: string): Promise<void> {
		Guards.stringValue(IdentityProfileService.CLASS_NAME, nameof(identity), identity);

		try {
			await this.assertSelfUpdateAllowed(identity, undefined, publicProfile, privateProfile);
			await this._identityProfileConnector.create(identity, publicProfile, privateProfile);
		} catch (error) {
			if (BaseError.someErrorClass(error, IdentityProfileService.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				IdentityProfileService.CLASS_NAME,
				"createFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @param identity The identity to perform the profile operation on.
	 * @returns The items identity and the properties.
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
		Guards.stringValue(IdentityProfileService.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(
				identity,
				publicPropertyNames,
				privatePropertyNames
			);
			if (Is.undefined(result)) {
				throw new NotFoundError(IdentityProfileService.CLASS_NAME, "notFound", identity);
			}
			return {
				identity,
				publicProfile: result.publicProfile,
				privateProfile: result.privateProfile
			};
		} catch (error) {
			if (BaseError.someErrorClass(error, IdentityProfileService.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(IdentityProfileService.CLASS_NAME, "getFailed", undefined, error);
		}
	}

	/**
	 * Get the public profile properties for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @param propertyNames The properties to get for the item, defaults to all.
	 * @returns The items properties.
	 */
	public async getPublic(identity: string, propertyNames?: (keyof T)[]): Promise<Partial<T>> {
		Guards.stringValue(IdentityProfileService.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(identity, propertyNames);
			if (Is.undefined(result)) {
				throw new NotFoundError(IdentityProfileService.CLASS_NAME, "notFound", identity);
			}
			return result.publicProfile;
		} catch (error) {
			if (BaseError.someErrorClass(error, IdentityProfileService.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				IdentityProfileService.CLASS_NAME,
				"getPublicFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Update the profile properties of an identity.
	 * @param publicProfile The public profile data as JSON-LD.
	 * @param privateProfile The private profile data as JSON-LD.
	 * @param identity The identity to perform the profile operation on.
	 * @returns A promise that resolves when the profile has been updated.
	 */
	public async update(publicProfile?: T, privateProfile?: U, identity?: string): Promise<void> {
		Guards.stringValue(IdentityProfileService.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(identity);
			if (Is.undefined(result)) {
				throw new NotFoundError(IdentityProfileService.CLASS_NAME, "notFound", identity);
			}
			await this.assertSelfUpdateAllowed(identity, result, publicProfile, privateProfile);
			await this._identityProfileConnector.update(identity, publicProfile, privateProfile);
		} catch (error) {
			if (BaseError.someErrorClass(error, IdentityProfileService.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				IdentityProfileService.CLASS_NAME,
				"updateFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to perform the profile operation on.
	 * @returns A promise that resolves when the profile has been removed.
	 */
	public async remove(identity?: string): Promise<void> {
		Guards.stringValue(IdentityProfileService.CLASS_NAME, nameof(identity), identity);

		try {
			const result = await this._identityProfileConnector.get(identity);
			if (Is.undefined(result)) {
				throw new NotFoundError(IdentityProfileService.CLASS_NAME, "notFound", identity);
			}
			await this._identityProfileConnector.remove(identity);
		} catch (error) {
			if (BaseError.someErrorClass(error, IdentityProfileService.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				IdentityProfileService.CLASS_NAME,
				"removeFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Get a list of the requested types.
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
		items: { identity: string; publicProfile?: Partial<T> }[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}> {
		try {
			// We don't want to return private profile for this type of query
			// as it would expose the values to the REST api
			const result = await this._identityProfileConnector.list(
				publicFilters,
				undefined,
				publicPropertyNames,
				undefined,
				cursor,
				limit
			);
			return {
				items: result.items.map(item => ({
					identity: item.identity,
					publicProfile: item.publicProfile
				})),
				cursor: result.cursor
			};
		} catch (error) {
			throw new GeneralError(IdentityProfileService.CLASS_NAME, "listFailed", undefined, error);
		}
	}

	/**
	 * Get a list of identities including private profile data.
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
		/**
		 * The identities.
		 */
		items: { identity: string; publicProfile?: Partial<T>; privateProfile?: Partial<U> }[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}> {
		try {
			return await this._identityProfileConnector.list(
				publicFilters,
				privateFilters,
				publicPropertyNames,
				privatePropertyNames,
				cursor,
				limit
			);
		} catch (error) {
			throw new GeneralError(
				IdentityProfileService.CLASS_NAME,
				"listAdminFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Reject changes to denied properties when the caller does not have an admin scope.
	 * @param identity The identity of the profile being modified.
	 * @param existing The currently stored profile.
	 * @param publicProfile The new public profile, undefined leaves the stored profile unchanged.
	 * @param privateProfile The new private profile, undefined leaves the stored profile unchanged.
	 * @internal
	 */
	private async assertSelfUpdateAllowed(
		identity: string,
		existing: { publicProfile?: Partial<T>; privateProfile?: Partial<U> } | undefined,
		publicProfile: T | undefined,
		privateProfile: U | undefined
	): Promise<void> {
		// If there are no self-update denied properties, any update is allowed.
		if (this._selfUpdateDeniedProperties.length === 0) {
			return;
		}

		// If the user has one of the admin scopes, they are allowed to update denied properties, so just return.
		const contextIds = await ContextIdStore.getContextIds();
		if (
			this._adminScopes.some(adminScope =>
				ScopeHelper.includes(contextIds?.[HttpContextIdKeys.Scope], adminScope)
			)
		) {
			return;
		}

		const deniedProperties = [
			...this.findChangedProperties("publicProfile", existing?.publicProfile, publicProfile),
			...this.findChangedProperties("privateProfile", existing?.privateProfile, privateProfile)
		];

		if (deniedProperties.length > 0) {
			throw new UnauthorizedError(IdentityProfileService.CLASS_NAME, "selfUpdateDenied", {
				identity,
				properties: deniedProperties.join(", ")
			});
		}
	}

	/**
	 * Find the denied properties which differ between the stored and new profile.
	 * @param profileName The name of the profile used to prefix the property names.
	 * @param existingProfile The currently stored profile.
	 * @param profile The new profile, undefined leaves the stored profile unchanged.
	 * @returns The prefixed names of the changed denied properties.
	 * @internal
	 */
	private findChangedProperties<V extends IJsonLdDocument>(
		profileName: string,
		existingProfile: Partial<V> | undefined,
		profile: V | undefined
	): string[] {
		if (!Is.object(profile)) {
			return [];
		}

		const hasExisting = Is.objectValue(existingProfile);

		return this._selfUpdateDeniedProperties
			.filter(
				propertyName =>
					!ObjectHelper.equal(
						hasExisting ? ObjectHelper.propertyGet(existingProfile, propertyName) : undefined,
						ObjectHelper.propertyGet(profile, propertyName),
						false
					)
			)
			.map(propertyName => `${profileName}.${propertyName}`);
	}
}
