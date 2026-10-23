# Interface: IIotaIdentityConnectorConfig

Configuration for the IOTA Identity Connector.

## Extends

- `IIotaConfig`

## Properties

### walletAccountIndex? {#walletaccountindex}

> `optional` **walletAccountIndex?**: `number`

The wallet account index to use for funding and controlling the identity.

#### Default

```ts
0
```

***

### walletAddressIndex? {#walletaddressindex}

> `optional` **walletAddressIndex?**: `number`

The wallet address index to use for funding and controlling the identity.

#### Default

```ts
0
```

***

### identityPkgId? {#identitypkgid}

> `optional` **identityPkgId?**: `string`

The package ID for the identity contract on the network.
If not provided, a default value will be used based on the detected network type.
For testnet: "0x222741bbdff74b42df48a7b4733185e9b24becb8ccfbafe8eac864ab4e4cc555"
For devnet: "0x03242ae6b87406bd0eb5d669fbe874ed4003694c0be9c6a9ee7c315e6461a553"

***

### standardGasPrice? {#standardgasprice}

> `optional` **standardGasPrice?**: `number`

The standard gas price in nanos per computation unit for gas station transactions.
(1 Nano = 0.000000001 IOTA)
This should match the protocol's reference gas price.

#### Default

```ts
1000
```

***

### didResolutionCacheTtlMs? {#didresolutioncachettlms}

> `optional` **didResolutionCacheTtlMs?**: `number`

TTL in ms for caching DID documents resolved for the connector's own sign/mutate
operations (create/update/revoke on an identity this connector controls). 0 disables
caching. Does not affect proof or credential verification of third-party claims, which
is never cached by this connector.

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

### clientCreationTimeoutMs? {#clientcreationtimeoutms}

> `optional` **clientCreationTimeoutMs?**: `number`

Timeout in ms for creating the read only identity client used for resolution and
verification. Its construction makes an RPC call which can fail without ever settling,
so the timeout bounds it. 0 waits indefinitely.

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

***

### didResolutionRetries? {#didresolutionretries}

> `optional` **didResolutionRetries?**: `number`

Number of times to retry resolving a DID after a successful transaction,
to handle propagation delays between transaction confirmation and ledger availability.

#### Default

```ts
10
```

***

### didResolutionRetryDelayMs? {#didresolutionretrydelayms}

> `optional` **didResolutionRetryDelayMs?**: `number`

Delay in milliseconds between each resolveDid retry.

#### Default

```ts
500
```
