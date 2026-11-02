# Interface: IIdentityExportResponse

Response to exporting an identity.

## Properties

### headers? {#headers}

> `optional` **headers?**: `object`

The response headers, the export is never cached.

#### cache-control?

> `optional` **cache-control?**: `string`

Set to no-store.

***

### body {#body}

> **body**: [`IIdentityExport`](IIdentityExport.md)

The response payload, which contains private keys and must be protected.
