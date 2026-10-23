# Interface: IIdentityProfileServiceConfig

Configuration for the Identity Profile Service.

## Properties

### selfUpdateDeniedProperties? {#selfupdatedeniedproperties}

> `optional` **selfUpdateDeniedProperties?**: `string`[]

The public and private profile properties which can only be added, changed or removed by callers with escalated privilege or permitted to execute the admin update operation.

#### Default

```ts
[]
```

***

### escalatedPrivilegeRole? {#escalatedprivilegerole}

> `optional` **escalatedPrivilegeRole?**: `string`

The role that grants escalated privilege, callers holding it can always modify the denied properties.

#### Default

```ts
global-admin
```

***

### authorizationModelId? {#authorizationmodelid}

> `optional` **authorizationModelId?**: `string`

The authorization model ID used to check permissions.

#### Default

```ts
system
```
