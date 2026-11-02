# Interface: IIdentityExport

Everything needed to recreate an identity on another node, including private key material.

## Properties

### version {#version}

> **version**: `number`

The version of the export format.

***

### namespace {#namespace}

> **namespace**: `string`

The namespace of the connector which holds the identity, e.g. entity-storage or iota.

***

### selfControlled {#selfcontrolled}

> **selfControlled**: `boolean`

Is the identity controlled by its own DID.

***

### document {#document}

> **document**: `IDidDocument`

The DID document.

***

### documentSignature? {#documentsignature}

> `optional` **documentSignature?**: `string`

The signature of the canonical document made with the document key in base64 format,
only for connectors which sign their stored documents.

***

### keys {#keys}

> **keys**: [`IIdentityExportKey`](IIdentityExportKey.md)[]

The private keys for the identity.

***

### account? {#account}

> `optional` **account?**: [`IIdentityExportAccount`](IIdentityExportAccount.md)

The wallet account secrets, only for self-controlled identities on ledgers.
