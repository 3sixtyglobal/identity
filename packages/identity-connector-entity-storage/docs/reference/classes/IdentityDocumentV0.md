# Class: IdentityDocumentV0

Class describing the identity document, version 0. Covers every row written before the
version record existed, without the created and modified dates.

## Constructors

### Constructor

> **new IdentityDocumentV0**(): `IdentityDocumentV0`

#### Returns

`IdentityDocumentV0`

## Properties

### id {#id}

> **id**: `string`

The identity of the document.

***

### document {#document}

> **document**: `IDidDocument`

The DID document.

***

### signature {#signature}

> **signature**: `string`

The signature of the document.

***

### controller {#controller}

> **controller**: `string`

The controller of the document.
