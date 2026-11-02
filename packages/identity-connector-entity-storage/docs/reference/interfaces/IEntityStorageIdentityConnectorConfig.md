# Interface: IEntityStorageIdentityConnectorConfig

Configuration for the Entity Storage Identity Connector.

## Properties

### didResolutionCacheTtlMs? {#didresolutioncachettlms}

> `optional` **didResolutionCacheTtlMs?**: `number`

TTL in ms for caching DID documents resolved for the connector's own sign/mutate
operations (create/update/revoke on an identity this connector controls). 0 disables
caching. Does not affect proof or credential verification of third-party claims, which
is never cached by this connector. Refreshed by every mutation made through this
connector instance; a mutation made through a different instance or out-of-band is not
observed until the entry's TTL expires.

#### Default

```ts
30000
```

***

### didResolutionCacheCapacity? {#didresolutioncachecapacity}

> `optional` **didResolutionCacheCapacity?**: `number`

Maximum number of DID documents kept in the own-DID resolution cache.
Only used when didResolutionCacheTtlMs > 0.

#### Default

```ts
1000
```

***

### didResolutionCacheMutexTimeoutMs? {#didresolutioncachemutextimeoutms}

> `optional` **didResolutionCacheMutexTimeoutMs?**: `number`

Maximum time in milliseconds to wait for own-DID cache getOrSet mutex acquisition.
Only used when didResolutionCacheTtlMs > 0.

***

### exportLimits? {#exportlimits}

> `optional` **exportLimits?**: `IIdentityExportLimits`

The most keys accepted when an identity is imported.

#### Default

```ts
{ maxKeys: 64 }
```
