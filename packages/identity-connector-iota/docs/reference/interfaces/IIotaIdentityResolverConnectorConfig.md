# Interface: IIotaIdentityResolverConnectorConfig

Configuration for the IOTA Identity Resolver Connector.

## Extends

- `IIotaConfig`

## Properties

### identityPkgId? {#identitypkgid}

> `optional` **identityPkgId?**: `string`

The package ID for the identity contract on the network.
If not provided, a default value will be used based on the detected network type.
For testnet: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555"
For devnet: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"

***

### didResolutionCacheTtlMs? {#didresolutioncachettlms}

> `optional` **didResolutionCacheTtlMs?**: `number`

TTL in ms for caching resolved DID documents. 0 disables caching. As the documents
resolved here can belong to third parties, a non-zero TTL means revocation and
verification method changes made on the ledger are only observed once the entry expires.

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

***

### clientCreationTimeoutMs? {#clientcreationtimeoutms}

> `optional` **clientCreationTimeoutMs?**: `number`

Timeout in ms for creating the read only identity client used for resolution. Its
construction makes an RPC call which can fail without ever settling, so the timeout
bounds it. 0 waits indefinitely.

#### Default

```ts
3000
```

***

### didResolutionTimeoutMs? {#didresolutiontimeoutms}

> `optional` **didResolutionTimeoutMs?**: `number`

Timeout in ms for a single DID resolution call. 0 waits indefinitely.

#### Default

```ts
5000
```
