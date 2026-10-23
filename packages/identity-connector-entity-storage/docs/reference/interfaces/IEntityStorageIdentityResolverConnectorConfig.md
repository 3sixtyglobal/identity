# Interface: IEntityStorageIdentityResolverConnectorConfig

Configuration for the Entity Storage Identity Resolver Connector.

## Properties

### didResolutionCacheTtlMs? {#didresolutioncachettlms}

> `optional` **didResolutionCacheTtlMs?**: `number`

TTL in ms for caching resolved DID documents. 0 disables caching. As the documents
resolved here can belong to third parties, a non-zero TTL means changes made to a
document in storage, including revocation, are only observed once the entry expires.

#### Default

```ts
30000
```

***

### didResolutionCacheCapacity? {#didresolutioncachecapacity}

> `optional` **didResolutionCacheCapacity?**: `number`

Maximum number of DID documents kept in the resolution cache.
Only used when didResolutionCacheTtlMs > 0.

#### Default

```ts
1000
```

***

### didResolutionCacheMutexTimeoutMs? {#didresolutioncachemutextimeoutms}

> `optional` **didResolutionCacheMutexTimeoutMs?**: `number`

Maximum time in milliseconds to wait for resolution cache getOrSet mutex acquisition.
Only used when didResolutionCacheTtlMs > 0.
