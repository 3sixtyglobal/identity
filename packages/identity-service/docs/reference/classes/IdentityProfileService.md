# Class: IdentityProfileService\<T, U\>

Class which implements the identity profile contract.

## Type Parameters

### T {#t}

`T` *extends* `IJsonLdDocument` = `IJsonLdDocument`

### U {#u}

`U` *extends* `IJsonLdDocument` = `IJsonLdDocument`

## Implements

- `IIdentityProfileComponent`\<`T`, `U`\>

## Constructors

### Constructor

> **new IdentityProfileService**\<`T`, `U`\>(`options?`): `IdentityProfileService`\<`T`, `U`\>

Create a new instance of IdentityProfileService.

#### Parameters

##### options?

[`IIdentityProfileServiceConstructorOptions`](../interfaces/IIdentityProfileServiceConstructorOptions.md)

The dependencies for the identity profile service.

#### Returns

`IdentityProfileService`\<`T`, `U`\>

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

***

### DEFAULT\_ADMIN\_ROLE {#default_admin_role}

> `readonly` `static` **DEFAULT\_ADMIN\_ROLE**: `string` = `"identity-profile-admin"`

The default role which administers identity profiles.

***

### DEFAULT\_ESCALATED\_PRIVILEGE\_ROLE {#default_escalated_privilege_role}

> `readonly` `static` **DEFAULT\_ESCALATED\_PRIVILEGE\_ROLE**: `string` = `"global-admin"`

The default role that grants escalated privilege.

***

### ADMIN\_UPDATE\_OPERATION\_ID {#admin_update_operation_id}

> `readonly` `static` **ADMIN\_UPDATE\_OPERATION\_ID**: `string` = `"identityProfileAdminUpdate"`

The admin update operation, callers permitted to execute it can modify the denied properties.

***

### DEFAULT\_AUTHORIZATION\_MODEL\_ID {#default_authorization_model_id}

> `readonly` `static` **DEFAULT\_AUTHORIZATION\_MODEL\_ID**: `string` = `"system"`

The default authorization model ID used to check permissions.

## Methods

### className() {#classname}

> **className**(): `string`

Returns the class name of the component.

#### Returns

`string`

The class name of the component.

#### Implementation of

`IIdentityProfileComponent.className`

***

### create() {#create}

> **create**(`publicProfile?`, `privateProfile?`, `identity?`): `Promise`\<`void`\>

Create the profile properties for an identity.

#### Parameters

##### publicProfile?

`T`

The public profile data as JSON-LD.

##### privateProfile?

`U`

The private profile data as JSON-LD.

##### identity?

`string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the profile has been created.

#### Implementation of

`IIdentityProfileComponent.create`

***

### get() {#get}

> **get**(`publicPropertyNames?`, `privatePropertyNames?`, `identity?`): `Promise`\<\{ `identity`: `string`; `publicProfile?`: `Partial`\<`T`\>; `privateProfile?`: `Partial`\<`U`\>; \}\>

Get the profile properties for an identity.

#### Parameters

##### publicPropertyNames?

(keyof `T`)[]

The public properties to get for the profile, defaults to all.

##### privatePropertyNames?

(keyof `U`)[]

The private properties to get for the profile, defaults to all.

##### identity?

`string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<\{ `identity`: `string`; `publicProfile?`: `Partial`\<`T`\>; `privateProfile?`: `Partial`\<`U`\>; \}\>

The items identity and the properties.

#### Implementation of

`IIdentityProfileComponent.get`

***

### getPublic() {#getpublic}

> **getPublic**(`identity`, `propertyNames?`): `Promise`\<`Partial`\<`T`\>\>

Get the public profile properties for an identity.

#### Parameters

##### identity

`string`

The identity to perform the profile operation on.

##### propertyNames?

(keyof `T`)[]

The properties to get for the item, defaults to all.

#### Returns

`Promise`\<`Partial`\<`T`\>\>

The items properties.

#### Implementation of

`IIdentityProfileComponent.getPublic`

***

### update() {#update}

> **update**(`publicProfile?`, `privateProfile?`, `identity?`): `Promise`\<`void`\>

Update the profile properties of an identity.

#### Parameters

##### publicProfile?

`T`

The public profile data as JSON-LD.

##### privateProfile?

`U`

The private profile data as JSON-LD.

##### identity?

`string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the profile has been updated.

#### Implementation of

`IIdentityProfileComponent.update`

***

### remove() {#remove}

> **remove**(`identity?`): `Promise`\<`void`\>

Delete the profile for an identity.

#### Parameters

##### identity?

`string`

The identity to perform the profile operation on.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the profile has been removed.

#### Implementation of

`IIdentityProfileComponent.remove`

***

### list() {#list}

> **list**(`publicFilters?`, `publicPropertyNames?`, `cursor?`, `limit?`): `Promise`\<\{ `items`: `object`[]; `cursor?`: `string`; \}\>

Get a list of the requested types.

#### Parameters

##### publicFilters?

`object`[]

The filters to apply to the identities public profiles.

##### publicPropertyNames?

(keyof `T`)[]

The public properties to get for the profile, defaults to all.

##### cursor?

`string`

The cursor for paged requests.

##### limit?

`number`

The maximum number of items in a page.

#### Returns

`Promise`\<\{ `items`: `object`[]; `cursor?`: `string`; \}\>

The list of items and cursor for paging.

#### Implementation of

`IIdentityProfileComponent.list`

***

### listAdmin() {#listadmin}

> **listAdmin**(`publicFilters?`, `privateFilters?`, `publicPropertyNames?`, `privatePropertyNames?`, `cursor?`, `limit?`): `Promise`\<\{ `items`: `object`[]; `cursor?`: `string`; \}\>

Get a list of identities including private profile data.

#### Parameters

##### publicFilters?

`object`[]

The filters to apply to the identities public profiles.

##### privateFilters?

`object`[]

The filters to apply to the identities private profiles.

##### publicPropertyNames?

(keyof `T`)[]

The public properties to get for the profile, defaults to all.

##### privatePropertyNames?

(keyof `U`)[]

The private properties to get for the profile, defaults to none.

##### cursor?

`string`

The cursor for paged requests.

##### limit?

`number`

The maximum number of items in a page.

#### Returns

`Promise`\<\{ `items`: `object`[]; `cursor?`: `string`; \}\>

The list of items and cursor for paging.

#### Implementation of

`IIdentityProfileComponent.listAdmin`
