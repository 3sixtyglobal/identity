# Class: IdentityDocument

Class describing the identity document.

## Constructors

### Constructor

> **new IdentityDocument**(): `IdentityDocument`

#### Returns

`IdentityDocument`

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

***

### dateCreated? {#datecreated}

> `optional` **dateCreated?**: `string`

The date the document was created, undefined for documents stored before it was captured.

***

### dateModified? {#datemodified}

> `optional` **dateModified?**: `string`

The date the document was last modified.
