# Class: IdentityProfileV0

Class representing profile details for the identity, version 0. Covers every row written
before the version record existed, without the created and modified dates.

## Constructors

### Constructor

> **new IdentityProfileV0**(): `IdentityProfileV0`

#### Returns

`IdentityProfileV0`

## Properties

### identity {#identity}

> **identity**: `string`

The id for the identity.

***

### publicProfile? {#publicprofile}

> `optional` **publicProfile?**: `unknown`

The public profile data.

***

### privateProfile? {#privateprofile}

> `optional` **privateProfile?**: `unknown`

The private profile data.
