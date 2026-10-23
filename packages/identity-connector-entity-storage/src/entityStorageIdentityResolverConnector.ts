// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, Guards, Is, LruCache, NotFoundError, ObjectHelper } from "@3sixty/core";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { IIdentityResolverConnector } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import type { IDidDocument } from "@3sixty/standards-w3c-did";
import { VaultConnectorFactory, type IVaultConnector } from "@3sixty/vault-models";
import type { IdentityDocument } from "./entities/identityDocument.js";
import { EntityStorageIdentityConnector } from "./entityStorageIdentityConnector.js";
import type { IEntityStorageIdentityResolverConnectorConstructorOptions } from "./models/IEntityStorageIdentityResolverConnectorConstructorOptions.js";

/**
 * Class for performing identity operations using entity storage.
 */
export class EntityStorageIdentityResolverConnector implements IIdentityResolverConnector {
	/**
	 * The namespace supported by the identity connector.
	 */
	public static readonly NAMESPACE: string = "entity-storage";

	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<EntityStorageIdentityResolverConnector>();

	/**
	 * The entity storage for identities.
	 * @internal
	 */
	protected readonly _didDocumentEntityStorage: IEntityStorageConnector<IdentityDocument>;

	/**
	 * The vault for the keys.
	 * @internal
	 */
	protected readonly _vaultConnector: IVaultConnector;

	/**
	 * TTL in ms for caching resolved DID documents. 0 disables caching.
	 * @internal
	 */
	private readonly _didResolutionCacheTtlMs: number;

	/**
	 * Maximum number of DID documents retained in cache.
	 * @internal
	 */
	private readonly _didResolutionCacheCapacity: number;

	/**
	 * Maximum wait time for resolution cache getOrSet mutex acquisition in milliseconds.
	 * @internal
	 */
	private readonly _didResolutionCacheMutexTimeoutMs?: number;

	/**
	 * LRU cache for resolved DID documents. Undefined when caching is disabled (ttl is 0).
	 * @internal
	 */
	private readonly _didResolutionCache?: LruCache<IDidDocument>;

	/**
	 * Create a new instance of EntityStorageIdentityResolverConnector.
	 * @param options The options for the identity connector.
	 */
	constructor(options?: IEntityStorageIdentityResolverConnectorConstructorOptions) {
		this._didDocumentEntityStorage = EntityStorageConnectorFactory.get(
			options?.didDocumentEntityStorageType ?? "identity-document"
		);
		this._vaultConnector = VaultConnectorFactory.get(options?.vaultConnectorType ?? "vault");

		this._didResolutionCacheTtlMs = options?.config?.didResolutionCacheTtlMs ?? 30_000;
		this._didResolutionCacheCapacity = options?.config?.didResolutionCacheCapacity ?? 1000;
		this._didResolutionCacheMutexTimeoutMs = options?.config?.didResolutionCacheMutexTimeoutMs;
		this._didResolutionCache =
			this._didResolutionCacheTtlMs > 0
				? new LruCache<IDidDocument>({
						capacity: this._didResolutionCacheCapacity,
						ttiMs: this._didResolutionCacheTtlMs,
						mutexTimeoutMs: this._didResolutionCacheMutexTimeoutMs
					})
				: undefined;
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return EntityStorageIdentityResolverConnector.CLASS_NAME;
	}

	/**
	 * Stop the service.
	 * Destroys in-memory resources owned by this component.
	 * @param nodeLoggingComponentType The node logging component type.
	 * @returns A promise that resolves when the service has stopped.
	 */
	public async stop(nodeLoggingComponentType?: string): Promise<void> {
		this._didResolutionCache?.destroy();
	}

	/**
	 * Resolve a document from its id, cached for didResolutionCacheTtlMs
	 * (0 disables caching and resolves fresh every call).
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 */
	public async resolveDocument(documentId: string): Promise<IDidDocument> {
		Guards.stringValue(
			EntityStorageIdentityResolverConnector.CLASS_NAME,
			nameof(documentId),
			documentId
		);

		if (Is.undefined(this._didResolutionCache)) {
			return this.loadDocument(documentId);
		}

		const document = await this._didResolutionCache.getOrSet(documentId, async () =>
			this.loadDocument(documentId)
		);

		// Return a deep clone, not the cached instance itself, so a caller mutating the document
		// it receives cannot corrupt the entry shared with every other caller.
		return ObjectHelper.clone(document);
	}

	/**
	 * Load and verify a document from storage, bypassing the cache.
	 * @param documentId The id of the document to resolve.
	 * @returns The resolved document.
	 * @throws NotFoundError if the id can not be resolved.
	 * @internal
	 */
	private async loadDocument(documentId: string): Promise<IDidDocument> {
		try {
			const didIdentityDocument = await this._didDocumentEntityStorage.get(documentId);
			if (Is.undefined(didIdentityDocument)) {
				throw new NotFoundError(
					EntityStorageIdentityResolverConnector.CLASS_NAME,
					"documentNotFound",
					documentId
				);
			}
			await EntityStorageIdentityConnector.verifyDocument(
				didIdentityDocument,
				this._vaultConnector
			);

			return didIdentityDocument.document;
		} catch (error) {
			throw new GeneralError(
				EntityStorageIdentityResolverConnector.CLASS_NAME,
				"resolveDocumentFailed",
				{ documentId },
				error
			);
		}
	}
}
