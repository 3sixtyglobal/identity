# Interface: IIdentityProfileServiceConstructorOptions

Options for the identity profile service constructor.

## Properties

### profileEntityConnectorType? {#profileentityconnectortype}

> `optional` **profileEntityConnectorType?**: `string`

The storage connector for the profiles.

#### Default

```ts
identity-profile
```

***

### authorizationComponentType? {#authorizationcomponenttype}

> `optional` **authorizationComponentType?**: `string`

The authorization component used to check the caller permissions.

#### Default

```ts
authorization
```

***

### config? {#config}

> `optional` **config?**: [`IIdentityProfileServiceConfig`](IIdentityProfileServiceConfig.md)

The configuration for the identity profile service.
