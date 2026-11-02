# Interface: IEntityStorageIdentityConnectorConstructorOptions

Options for the entity storage identity connector constructor.

## Extends

- [`IEntityStorageIdentityResolverConnectorConstructorOptions`](IEntityStorageIdentityResolverConnectorConstructorOptions.md)

## Properties

### loggingComponentType? {#loggingcomponenttype}

> `optional` **loggingComponentType?**: `string`

The type of logging component to use.

***

### config? {#config}

> `optional` **config?**: [`IEntityStorageIdentityConnectorConfig`](IEntityStorageIdentityConnectorConfig.md)

Configuration for the connector.

#### Overrides

[`IEntityStorageIdentityResolverConnectorConstructorOptions`](IEntityStorageIdentityResolverConnectorConstructorOptions.md).[`config`](IEntityStorageIdentityResolverConnectorConstructorOptions.md#config)

***

### didDocumentEntityStorageType? {#diddocumententitystoragetype}

> `optional` **didDocumentEntityStorageType?**: `string`

The entity storage for the did documents.

#### Default

```ts
identity-document
```

#### Inherited from

[`IEntityStorageIdentityResolverConnectorConstructorOptions`](IEntityStorageIdentityResolverConnectorConstructorOptions.md).[`didDocumentEntityStorageType`](IEntityStorageIdentityResolverConnectorConstructorOptions.md#diddocumententitystoragetype)

***

### vaultConnectorType? {#vaultconnectortype}

> `optional` **vaultConnectorType?**: `string`

The vault for the private keys.

#### Default

```ts
vault
```

#### Inherited from

[`IEntityStorageIdentityResolverConnectorConstructorOptions`](IEntityStorageIdentityResolverConnectorConstructorOptions.md).[`vaultConnectorType`](IEntityStorageIdentityResolverConnectorConstructorOptions.md#vaultconnectortype)
