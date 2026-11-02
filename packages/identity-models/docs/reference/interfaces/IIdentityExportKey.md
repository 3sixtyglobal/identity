# Interface: IIdentityExportKey

A private key held in an identity export.

## Properties

### id {#id}

> **id**: `string`

The name of the key relative to the DID, the verification method fragment or "did" for the document key.

***

### type {#type}

> **type**: `"Ed25519"`

The type of the key.

***

### privateKey {#privatekey}

> **privateKey**: `string`

The private key in base64 format.

***

### publicKey {#publickey}

> **publicKey**: `string`

The public key in base64 format.
