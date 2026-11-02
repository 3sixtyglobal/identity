# Class: IdentityExportHelper

Helper methods for validating identity exports.
Errors never carry key material, only the key id.

## Constructors

### Constructor

> **new IdentityExportHelper**(): `IdentityExportHelper`

#### Returns

`IdentityExportHelper`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

***

### VERSION {#version}

> `readonly` `static` **VERSION**: `number` = `1`

The current version of the export format.

***

### DEFAULT\_MAX\_KEYS {#default_max_keys}

> `readonly` `static` **DEFAULT\_MAX\_KEYS**: `number` = `64`

The most keys accepted in an export when the limits give no other.

***

### FRAGMENT\_PATTERN {#fragment_pattern}

> `readonly` `static` **FRAGMENT\_PATTERN**: `RegExp`

The format of a key id or verification method fragment, which form part of a vault key name.
It must start and end with a letter or digit, so it can never be a relative path segment such
as "..", or collapse onto another name in a vault which replaces or trims punctuation.

***

### RESERVED\_FRAGMENT\_PATTERN {#reserved_fragment_pattern}

> `readonly` `static` **RESERVED\_FRAGMENT\_PATTERN**: `RegExp`

The fragments reserved for the wallet account keys held under the same DID, which a vault that
replaces punctuation would map "account_0_0_0" onto.

## Methods

### validate() {#validate}

> `static` **validate**(`exported`, `namespace`, `didPattern?`, `limits?`): `string`

Validate the structure of an export for a namespace, without checking the key material.

#### Parameters

##### exported

[`IIdentityExport`](../interfaces/IIdentityExport.md)

The export to validate.

##### namespace

`string`

The namespace the importing connector supports.

##### didPattern?

`RegExp`

The exact format of the DIDs the importing connector creates.

##### limits?

[`IIdentityExportLimits`](../interfaces/IIdentityExportLimits.md)

The most keys accepted, the default when left out.

#### Returns

`string`

The DID of the exported identity.

#### Throws

UnprocessableError if the export is malformed, the version is unsupported or the namespace does not match.

***

### verifyMethodKeys() {#verifymethodkeys}

> `static` **verifyMethodKeys**(`document`, `keys`): `void`

Check every key matches the public key of the verification method with the same fragment.

#### Parameters

##### document

`IDidDocument`

The authoritative DID document.

##### keys

[`IIdentityExportKey`](../interfaces/IIdentityExportKey.md)[]

The keys to check.

#### Returns

`void`

#### Throws

UnprocessableError if a key has no verification method or its public key does not match.

***

### validateMethodIds() {#validatemethodids}

> `static` **validateMethodIds**(`document`): `void`

Check every verification method id in a document has a fragment which can form part of a
vault key name, whichever DID the method belongs to. Used on export as well as import, so a
document which could not be imported fails when it is exported.

#### Parameters

##### document

`IDidDocument`

The DID document.

#### Returns

`void`

#### Throws

UnprocessableError if a verification method id is missing or has an invalid fragment.

***

### requireMethodKeys() {#requiremethodkeys}

> `static` **requireMethodKeys**(`document`, `keyIds`): `void`

Check there is a key for every verification method which belongs to the document.

#### Parameters

##### document

`IDidDocument`

The DID document.

##### keyIds

`string`[]

The ids of the keys available for the document.

#### Returns

`void`

#### Throws

UnprocessableError if a verification method has no key.

***

### getMethodFragments() {#getmethodfragments}

> `static` **getMethodFragments**(`document`): `string`[]

Get the fragments of all the verification methods which belong to the document.

#### Parameters

##### document

`IDidDocument`

The DID document.

#### Returns

`string`[]

The unique fragments.
