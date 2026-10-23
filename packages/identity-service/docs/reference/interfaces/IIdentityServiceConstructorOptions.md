# Interface: IIdentityServiceConstructorOptions

Options for the identity service constructor.

## Properties

### config? {#config}

> `optional` **config?**: [`IIdentityServiceConfig`](IIdentityServiceConfig.md)

The configuration for the identity service.

***

### telemetryComponentType? {#telemetrycomponenttype}

> `optional` **telemetryComponentType?**: `string`

The component type for the optional telemetry component used for event metrics.

***

### vaultConnectorType? {#vaultconnectortype}

> `optional` **vaultConnectorType?**: `string`

The vault connector type to use for migrating the mnemonic during health check initialisation.

#### Default

```ts
vault
```
