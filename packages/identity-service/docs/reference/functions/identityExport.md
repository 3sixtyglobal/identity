# Function: identityExport()

> **identityExport**(`httpRequestContext`, `componentName`, `request`): `Promise`\<`IIdentityExportResponse`\>

Export an identity.

## Parameters

### httpRequestContext

`IHttpRequestContext`

The request context for the API.

### componentName

`string`

The name of the component to use in the routes stored in the ComponentFactory.

### request

`IIdentityExportRequest`

The request.

## Returns

`Promise`\<`IIdentityExportResponse`\>

The response object with additional http response properties.
