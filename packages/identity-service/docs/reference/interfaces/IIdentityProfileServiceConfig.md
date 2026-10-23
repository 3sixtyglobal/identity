# Interface: IIdentityProfileServiceConfig

Configuration for the Identity Profile Service.

## Properties

### selfUpdateDeniedProperties? {#selfupdatedeniedproperties}

> `optional` **selfUpdateDeniedProperties?**: `string`[]

The public and private profile properties which can only be added, changed or removed by callers with an admin scope.

#### Default

```ts
[]
```

***

### adminScopes? {#adminscopes}

> `optional` **adminScopes?**: `string`[]

The scopes which allow the denied properties to be modified, any one is sufficient.

#### Default

```ts
["user-admin", "global-admin"]
```
