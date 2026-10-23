// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	AlreadyExistsError,
	BaseError,
	GeneralError,
	Guards,
	Is,
	NotFoundError,
	ObjectHelper
} from "@3sixty/core";
import type { IJsonLdDocument } from "@3sixty/data-json-ld";
import { ComparisonOperator } from "@3sixty/entity";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IIdentityProfileConnector } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import type { IdentityProfile } from "./entities/identityProfile.js";
import type { IEntityStorageIdentityProfileConnectorConstructorOptions } from "./models/IEntityStorageIdentityProfileConnectorConstructorOptions.js";

/**
 * Class which implements the identity profile connector contract.
 */
export class EntityStorageIdentityProfileConnector<
	T extends IJsonLdDocument = IJsonLdDocument,
	U extends IJsonLdDocument = IJsonLdDocument
> implements IIdentityProfileConnector<T, U> {
	/**
	 * The namespace supported by the identity profile connector.
	 */
	public static readonly NAMESPACE: string = "entity-storage";

	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<EntityStorageIdentityProfileConnector>();

	/**
	 * The storage connector for the profiles.
	 * @internal
	 */
	private readonly _profileEntityStorage: IEntityStorageConnector<IdentityProfile>;

	/**
	 * Create a new instance of EntityStorageIdentityProfileConnector.
	 * @param options The options for the identity service.
	 */
	constructor(options?: IEntityStorageIdentityProfileConnectorConstructorOptions) {
		this._profileEntityStorage = EntityStorageConnectorFactory.get(
			options?.profileEntityStorageType ?? "identity-profile"
		);
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return EntityStorageIdentityProfileConnector.CLASS_NAME;
	}

	/**
	 * Create the profile properties for an identity.
	 * @param identity The identity of the profile to create.
	 * @param publicProfile The public profile data.
	 * @param privateProfile The private profile data.
	 * @returns A promise that resolves when the profile has been created.
	 */
	public async create(identity: string, publicProfile?: T, privateProfile?: U): Promise<void> {
		Guards.stringValue(
			EntityStorageIdentityProfileConnector.CLASS_NAME,
			nameof(identity),
			identity
		);

		try {
			const profile = await this._profileEntityStorage.get(identity);

			if (Is.notEmpty(profile)) {
				throw new AlreadyExistsError(
					EntityStorageIdentityProfileConnector.CLASS_NAME,
					"alreadyExists",
					identity
				);
			}

			const now = new Date(Date.now()).toISOString();

			await this._profileEntityStorage.set({
				identity,
				publicProfile,
				privateProfile,
				dateCreated: now,
				dateModified: now
			});
		} catch (error) {
			if (BaseError.someErrorClass(error, EntityStorageIdentityProfileConnector.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				EntityStorageIdentityProfileConnector.CLASS_NAME,
				"createFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * @param identity The identity of the item to get.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @returns The items properties.
	 */
	public async get(
		identity: string,
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[]
	): Promise<{
		publicProfile: Partial<T>;
		privateProfile: Partial<U>;
	}> {
		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (!profile) {
				throw new NotFoundError(
					EntityStorageIdentityProfileConnector.CLASS_NAME,
					"identityNotFound",
					identity
				);
			}

			return this.pickProperties(profile, publicPropertyNames, privatePropertyNames);
		} catch (error) {
			if (BaseError.someErrorClass(error, EntityStorageIdentityProfileConnector.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				EntityStorageIdentityProfileConnector.CLASS_NAME,
				"getFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Update the profile properties of an identity.
	 * @param identity The identity to update.
	 * @param publicProfile The public profile data.
	 * @param privateProfile The private profile data.
	 * @returns A promise that resolves when the profile has been updated.
	 */
	public async update(identity: string, publicProfile?: T, privateProfile?: U): Promise<void> {
		Guards.stringValue(
			EntityStorageIdentityProfileConnector.CLASS_NAME,
			nameof(identity),
			identity
		);

		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (Is.empty(profile)) {
				throw new NotFoundError(
					EntityStorageIdentityProfileConnector.CLASS_NAME,
					"notFound",
					identity
				);
			}

			profile.publicProfile = publicProfile ?? profile.publicProfile;
			profile.privateProfile = privateProfile ?? profile.privateProfile;
			profile.dateModified = new Date(Date.now()).toISOString();

			await this._profileEntityStorage.set(profile);
		} catch (error) {
			if (BaseError.someErrorClass(error, EntityStorageIdentityProfileConnector.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				EntityStorageIdentityProfileConnector.CLASS_NAME,
				"updateFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Delete the profile for an identity.
	 * @param identity The identity to delete.
	 * @returns A promise that resolves when the profile has been removed.
	 */
	public async remove(identity: string): Promise<void> {
		Guards.stringValue(
			EntityStorageIdentityProfileConnector.CLASS_NAME,
			nameof(identity),
			identity
		);

		try {
			const profile = await this._profileEntityStorage.get(identity);
			if (Is.empty(profile)) {
				throw new NotFoundError(
					EntityStorageIdentityProfileConnector.CLASS_NAME,
					"notFound",
					identity
				);
			}

			await this._profileEntityStorage.remove(identity);
		} catch (error) {
			if (BaseError.someErrorClass(error, EntityStorageIdentityProfileConnector.CLASS_NAME)) {
				throw error;
			}
			throw new GeneralError(
				EntityStorageIdentityProfileConnector.CLASS_NAME,
				"removeFailed",
				{ identity },
				error
			);
		}
	}

	/**
	 * Get a list of the requested types.
	 * @param publicFilters The filters to apply to the identities public profiles.
	 * @param privateFilters The filters to apply to the identities private profiles.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @param cursor The cursor for paged requests.
	 * @param limit The maximum number of items in a page.
	 * @returns The list of items and cursor for paging.
	 */
	public async list(
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
		items: {
			identity: string;
			publicProfile?: Partial<T>;
			privateProfile?: Partial<U>;
		}[];
		/**
		 * An optional cursor, when defined can be used to call find to get more entities.
		 */
		cursor?: string;
	}> {
		try {
			const conditions = [];

			if (Is.arrayValue(publicFilters)) {
				for (const filter of publicFilters) {
					conditions.push({
						property: `publicProfile.${filter.propertyName}`,
						value: filter.propertyValue,
						comparison: ComparisonOperator.Equals
					});
				}
			}
			if (Is.arrayValue(privateFilters)) {
				for (const filter of privateFilters) {
					conditions.push({
						property: `privateProfile.${filter.propertyName}`,
						value: filter.propertyValue,
						comparison: ComparisonOperator.Equals
					});
				}
			}

			const result = await this._profileEntityStorage.query(
				Is.arrayValue(conditions)
					? {
							conditions
						}
					: undefined,
				undefined,
				undefined,
				cursor,
				limit
			);

			const items: {
				identity: string;
				publicProfile?: Partial<T>;
				privateProfile?: Partial<U>;
			}[] = [];
			for (const resultEntity of result.entities) {
				items.push({
					identity: resultEntity.identity ?? "",
					...this.pickProperties(resultEntity, publicPropertyNames, privatePropertyNames)
				});
			}

			return {
				items,
				cursor: result.cursor
			};
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityProfileConnector.CLASS_NAME,
				"listFailed",
				undefined,
				error
			);
		}
	}

	/**
	 * Get the profile properties for an identity.
	 * @param profile The profile to pick the properties from.
	 * @param publicPropertyNames The public properties to get for the profile, defaults to all.
	 * @param privatePropertyNames The private properties to get for the profile, defaults to all.
	 * @returns The identity profile, will only return private data if you have correct permissions.
	 * @internal
	 */
	private pickProperties(
		profile: Partial<IdentityProfile>,
		publicPropertyNames?: (keyof T)[],
		privatePropertyNames?: (keyof U)[]
	): {
		publicProfile: Partial<T>;
		privateProfile: Partial<U>;
	} {
		return {
			publicProfile: Is.array(publicPropertyNames)
				? ObjectHelper.pick(profile.publicProfile as T, publicPropertyNames)
				: (profile.publicProfile as T),
			privateProfile: Is.array(privatePropertyNames)
				? ObjectHelper.pick(profile.privateProfile as U, privatePropertyNames)
				: (profile.privateProfile as U)
		};
	}
}
