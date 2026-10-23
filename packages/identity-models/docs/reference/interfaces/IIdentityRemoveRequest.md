# Interface: IIdentityRemoveRequest

Request to remove an identity.

## Properties

### pathParams {#pathparams}

> **pathParams**: `object`

The data for the request.

#### identity

> **identity**: `string`

The identity to remove.

***

### query? {#query}

> `optional` **query?**: `object`

The query parameters.

#### removeKeys?

> `optional` **removeKeys?**: `string`

Also remove any associated private keys from the vault.

#### removeDocumentKey?

> `optional` **removeDocumentKey?**: `string`

Also remove the document key from the vault.
