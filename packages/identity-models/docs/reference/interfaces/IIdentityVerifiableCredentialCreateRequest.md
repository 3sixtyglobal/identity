# Interface: IIdentityVerifiableCredentialCreateRequest

Request to create a verifiable credential.

## Properties

### pathParams {#pathparams}

> **pathParams**: `object`

The path parameters.

#### identity

> **identity**: `string`

The identity to create the verification credential for.

#### verificationMethodId

> **verificationMethodId**: `string`

The verification method id to use.

***

### body {#body}

> **body**: `object`

The data for the request.

#### credentialId?

> `optional` **credentialId?**: `string`

The id of the credential.

#### subject

> **subject**: `IJsonLdNodeObject`

The credential subject to store in the verifiable credential.

#### revocationIndex?

> `optional` **revocationIndex?**: `number`

The bitmap revocation index of the credential, if undefined will not have revocation status.

#### expirationDate?

> `optional` **expirationDate?**: `string`

The date the verifiable credential is valid until.

#### jwtHeaderFields?

> `optional` **jwtHeaderFields?**: `object`

Additional fields to include in the JWT when creating the verifiable credential in jwt format.

##### Index Signature

\[`id`: `string`\]: `string`

#### jwtPayloadFields?

> `optional` **jwtPayloadFields?**: `object`

Additional fields to include in the JWT payload when creating the verifiable credential in jwt format.

##### Index Signature

\[`id`: `string`\]: `string`

#### types?

> `optional` **types?**: `string`[]

The types of the credential after VerifiableCredential, such as
OrganizationMembershipCredential, only VerifiableCredential when omitted.
