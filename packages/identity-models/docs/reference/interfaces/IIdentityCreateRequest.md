# Interface: IIdentityCreateRequest

Request to create an identity.

## Properties

### body? {#body}

> `optional` **body?**: `object`

The data for the request.

#### namespace?

> `optional` **namespace?**: `string`

The optional namespace to create the identity in.

#### selfControlled?

> `optional` **selfControlled?**: `boolean`

Create the identity controlled by its own DID, defaults to false.
