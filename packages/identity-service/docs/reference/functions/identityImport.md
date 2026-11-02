# Function: identityImport()

> **identityImport**(`httpRequestContext`, `componentName`, `request`): `Promise`\<`IIdentityImportResponse`\>

Import an identity.

## Parameters

### httpRequestContext

`IHttpRequestContext`

The request context for the API.

### componentName

`string`

The name of the component to use in the routes stored in the ComponentFactory.

### request

`IIdentityImportRequest`

The request.

## Returns

`Promise`\<`IIdentityImportResponse`\>

The response object with additional http response properties.
