# Interface: IEntityStorageIdentityResolverConnectorConstructorOptions

Options for the entity storage identity connector constructor.

## Extended by

- [`IEntityStorageIdentityConnectorConstructorOptions`](IEntityStorageIdentityConnectorConstructorOptions.md)

## Properties

### config? {#config}

> `optional` **config?**: [`IEntityStorageIdentityResolverConnectorConfig`](IEntityStorageIdentityResolverConnectorConfig.md)

Configuration for the connector.

***

### didDocumentEntityStorageType? {#diddocumententitystoragetype}

> `optional` **didDocumentEntityStorageType?**: `string`

The entity storage for the did documents.

#### Default

```ts
identity-document
```

***

### vaultConnectorType? {#vaultconnectortype}

> `optional` **vaultConnectorType?**: `string`

The vault for the private keys.

#### Default

```ts
vault
```
