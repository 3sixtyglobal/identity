# Class: IdentityRestClient

Client for performing identity through to REST endpoints.

## Extends

- `BaseRestClient`

## Implements

- `IIdentityComponent`

## Constructors

### Constructor

> **new IdentityRestClient**(`config`): `IdentityRestClient`

Create a new instance of IdentityRestClient.

#### Parameters

##### config

`IBaseRestClientConfig`

The configuration for the client.

#### Returns

`IdentityRestClient`

#### Overrides

`BaseRestClient.constructor`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### className() {#classname}

> **className**(): `string`

Returns the class name of the component.

#### Returns

`string`

The class name of the component.

#### Implementation of

`IIdentityComponent.className`

***

### identityCreate() {#identitycreate}

> **identityCreate**(`namespace?`): `Promise`\<`IDidDocument`\>

Create a new identity.

#### Parameters

##### namespace?

`string`

The namespace of the connector to use for the identity, defaults to service configured namespace.

#### Returns

`Promise`\<`IDidDocument`\>

The created identity document.

#### Implementation of

`IIdentityComponent.identityCreate`

***

### identityRemove() {#identityremove}

> **identityRemove**(`identity`, `options?`): `Promise`\<`void`\>

Remove an identity.

#### Parameters

##### identity

`string`

The id of the document to remove.

##### options?

Optional settings.

###### removeKeys?

`boolean`

Also remove any associated private keys from the vault.

###### removeDocumentKey?

`boolean`

Also remove the document key from the vault.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the identity has been removed.

#### Implementation of

`IIdentityComponent.identityRemove`

***

### verificationMethodCreate() {#verificationmethodcreate}

> **verificationMethodCreate**(`identity`, `verificationMethodType`, `verificationMethodId?`): `Promise`\<`IDidDocumentVerificationMethod`\>

Add a verification method to the document in JSON Web key Format.

#### Parameters

##### identity

`string`

The id of the document to add the verification method to.

##### verificationMethodType

`DidVerificationMethodType`

The type of the verification method to add.

##### verificationMethodId?

`string`

The id of the verification method, if undefined uses the kid of the generated JWK.

#### Returns

`Promise`\<`IDidDocumentVerificationMethod`\>

The verification method.

#### Throws

NotFoundError if the id can not be resolved.

#### Throws

NotSupportedError if the platform does not support multiple keys.

#### Implementation of

`IIdentityComponent.verificationMethodCreate`

***

### verificationMethodRemove() {#verificationmethodremove}

> **verificationMethodRemove**(`verificationMethodId`, `options?`, `controller?`): `Promise`\<`void`\>

Remove a verification method from the document.

#### Parameters

##### verificationMethodId

`string`

The id of the verification method.

##### options?

Optional settings.

###### removeKeys?

`boolean`

Also remove any associated private key from the vault.

##### controller?

`string`

Unused by the REST client; the controller is resolved server-side from the session context.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the verification method has been removed.

#### Throws

NotFoundError if the id can not be resolved.

#### Throws

NotSupportedError if the platform does not support multiple revocable keys.

#### Implementation of

`IIdentityComponent.verificationMethodRemove`

***

### serviceCreate() {#servicecreate}

> **serviceCreate**(`identity`, `serviceId`, `serviceType`, `serviceEndpoint`): `Promise`\<`IDidService`\>

Add a service to the document.

#### Parameters

##### identity

`string`

The id of the document to add the service to.

##### serviceId

`string`

The id of the service.

##### serviceType

`string` \| `string`[]

The type of the service.

##### serviceEndpoint

`string` \| `string`[]

The endpoint for the service.

#### Returns

`Promise`\<`IDidService`\>

The service.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.serviceCreate`

***

### serviceRemove() {#serviceremove}

> **serviceRemove**(`serviceId`): `Promise`\<`void`\>

Remove a service from the document.

#### Parameters

##### serviceId

`string`

The id of the service.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the service has been removed.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.serviceRemove`

***

### alsoKnownAsAdd() {#alsoknownasadd}

> **alsoKnownAsAdd**(`documentId`, `alias`): `Promise`\<`void`\>

Add an alias to the alsoKnownAs property on the document.
If the alias is already present the operation is a no-op.

#### Parameters

##### documentId

`string`

The id of the document to update.

##### alias

`string`

The alias to add. Must be a Url or Urn (typically another DID).

#### Returns

`Promise`\<`void`\>

A promise that resolves when the alias has been added.

#### Throws

GeneralError if the alias is not a Url or Urn.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.alsoKnownAsAdd`

***

### alsoKnownAsRemove() {#alsoknownasremove}

> **alsoKnownAsRemove**(`documentId`, `alias`): `Promise`\<`void`\>

Remove an alias from the alsoKnownAs property on the document.
If the alias is not present the operation is a no-op.

#### Parameters

##### documentId

`string`

The id of the document to update.

##### alias

`string`

The alias to remove. Must be a Url or Urn.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the alias has been removed.

#### Throws

GeneralError if the alias is not a Url or Urn.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.alsoKnownAsRemove`

***

### verifiableCredentialCreate() {#verifiablecredentialcreate}

> **verifiableCredentialCreate**(`verificationMethodId`, `id`, `subject`, `options?`): `Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredential`; `jwt`: `string`; \}\>

Create a verifiable credential for a verification method.

#### Parameters

##### verificationMethodId

`string`

The verification method id to use.

##### id

`string` \| `undefined`

The id of the credential.

##### subject

`IJsonLdNodeObject`

The credential subject to store in the verifiable credential.

##### options?

Additional options for creating the verifiable credential.

###### revocationIndex?

`number`

The bitmap revocation index of the credential, if undefined will not have revocation status.

###### expirationDate?

`Date`

The date the verifiable credential is valid until.

###### jwtHeaderFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to include in the JWT header when creating the verifiable credential in jwt format.

###### jwtPayloadFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to include in the JWT payload when creating the verifiable credential in jwt format.

#### Returns

`Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredential`; `jwt`: `string`; \}\>

The created verifiable credential and its token.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.verifiableCredentialCreate`

***

### verifiableCredentialVerify() {#verifiablecredentialverify}

> **verifiableCredentialVerify**(`credential`): `Promise`\<\{ `revoked`: `boolean`; `verifiableCredential?`: `IDidVerifiableCredential`; \}\>

Verify a verifiable credential is valid.

#### Parameters

##### credential

`string` \| `IDidVerifiableCredential`

The credential to verify.

#### Returns

`Promise`\<\{ `revoked`: `boolean`; `verifiableCredential?`: `IDidVerifiableCredential`; \}\>

The credential stored in the jwt and the revocation status.

#### Implementation of

`IIdentityComponent.verifiableCredentialVerify`

***

### verifiableCredentialRevoke() {#verifiablecredentialrevoke}

> **verifiableCredentialRevoke**(`issuerId`, `credentialIndex`): `Promise`\<`void`\>

Revoke verifiable credential.

#### Parameters

##### issuerId

`string`

The id of the document to update the revocation list for.

##### credentialIndex

`number`

The revocation bitmap index to revoke.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credential has been revoked.

#### Implementation of

`IIdentityComponent.verifiableCredentialRevoke`

***

### verifiableCredentialUnrevoke() {#verifiablecredentialunrevoke}

> **verifiableCredentialUnrevoke**(`issuerId`, `credentialIndex`): `Promise`\<`void`\>

Unrevoke verifiable credential.

#### Parameters

##### issuerId

`string`

The id of the document to update the revocation list for.

##### credentialIndex

`number`

The revocation bitmap index to unrevoke.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credential has been unrevoked.

#### Implementation of

`IIdentityComponent.verifiableCredentialUnrevoke`

***

### verifiablePresentationCreate() {#verifiablepresentationcreate}

> **verifiablePresentationCreate**(`verificationMethodId`, `presentationId`, `contexts`, `types`, `verifiableCredentials`, `options?`): `Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentation`; `jwt`: `string`; \}\>

Create a verifiable presentation from the supplied verifiable credentials.

#### Parameters

##### verificationMethodId

`string`

The method to associate with the presentation.

##### presentationId

`string` \| `undefined`

The id of the presentation.

##### contexts

`IJsonLdContextDefinitionRoot` \| `undefined`

The contexts for the data stored in the verifiable credential.

##### types

`string` \| `string`[] \| `undefined`

The types for the data stored in the verifiable credential.

##### verifiableCredentials

(`string` \| `IDidVerifiableCredential`)[]

The credentials to use for creating the presentation in jwt format.

##### options?

Additional options for creating the verifiable presentation.

###### expirationDate?

`Date`

The date the verifiable presentation is valid until.

###### jwtHeaderFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to include in the JWT header when creating the verifiable presentation in jwt format.

###### jwtPayloadFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to include in the JWT payload when creating the verifiable presentation in jwt format.

#### Returns

`Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentation`; `jwt`: `string`; \}\>

The created verifiable presentation and its token.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityComponent.verifiablePresentationCreate`

***

### verifiablePresentationVerify() {#verifiablepresentationverify}

> **verifiablePresentationVerify**(`presentation`): `Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentation`; `issuers?`: `IDidDocument`[]; \}\>

Verify a verifiable presentation is valid.

#### Parameters

##### presentation

`string` \| `IDidVerifiablePresentation`

The presentation to verify.

#### Returns

`Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentation`; `issuers?`: `IDidDocument`[]; \}\>

The presentation stored in the jwt and the revocation status.

#### Implementation of

`IIdentityComponent.verifiablePresentationVerify`

***

### proofCreate() {#proofcreate}

> **proofCreate**(`verificationMethodId`, `proofType`, `unsecureDocument`): `Promise`\<`IProof`\>

Create a proof for a document with the specified verification method.

#### Parameters

##### verificationMethodId

`string`

The verification method id to use.

##### proofType

`ProofTypes`

The type of proof to create.

##### unsecureDocument

`IJsonLdNodeObject`

The unsecure document to create the proof for.

#### Returns

`Promise`\<`IProof`\>

The proof.

#### Implementation of

`IIdentityComponent.proofCreate`

***

### proofVerify() {#proofverify}

> **proofVerify**(`document`, `proof`): `Promise`\<`boolean`\>

Verify proof for a document with the specified verification method.

#### Parameters

##### document

`IJsonLdNodeObject`

The document to verify.

##### proof

`IProof`

The proof to verify.

#### Returns

`Promise`\<`boolean`\>

True if the proof is verified.

#### Implementation of

`IIdentityComponent.proofVerify`
