# Interface: IIdentityComponent

Interface describing a contract which provides identity operations.

## Extends

- `IComponent`

## Methods

### identityCreate() {#identitycreate}

> **identityCreate**(`namespace?`, `controller?`): `Promise`\<`IDidDocument`\>

Create a new identity.

#### Parameters

##### namespace?

`string`

The namespace of the connector to use for the identity, defaults to service configured namespace.

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`IDidDocument`\>

The created identity document.

***

### identityRemove() {#identityremove}

> **identityRemove**(`identity`, `options?`, `controller?`): `Promise`\<`void`\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the identity has been removed.

***

### verificationMethodCreate() {#verificationmethodcreate}

> **verificationMethodCreate**(`identity`, `verificationMethodType`, `verificationMethodId?`, `controller?`): `Promise`\<`IDidDocumentVerificationMethod`\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`IDidDocumentVerificationMethod`\>

The verification method.

#### Throws

NotFoundError if the id can not be resolved.

#### Throws

NotSupportedError if the platform does not support multiple keys.

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

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the verification method has been removed.

#### Throws

NotFoundError if the id can not be resolved.

#### Throws

NotSupportedError if the platform does not support multiple revocable keys.

***

### serviceCreate() {#servicecreate}

> **serviceCreate**(`identity`, `serviceId`, `serviceType`, `serviceEndpoint`, `controller?`): `Promise`\<`IDidService`\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`IDidService`\>

The service.

#### Throws

NotFoundError if the id can not be resolved.

***

### serviceRemove() {#serviceremove}

> **serviceRemove**(`serviceId`, `controller?`): `Promise`\<`void`\>

Remove a service from the document.

#### Parameters

##### serviceId

`string`

The id of the service.

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the service has been removed.

#### Throws

NotFoundError if the id can not be resolved.

***

### alsoKnownAsAdd() {#alsoknownasadd}

> **alsoKnownAsAdd**(`documentId`, `alias`, `controller?`): `Promise`\<`void`\>

Add an alias to the alsoKnownAs property on the document.
If the alias is already present the operation is a no-op.

#### Parameters

##### documentId

`string`

The id of the document to update.

##### alias

`string`

The alias to add. Must be a Url or Urn (typically another DID).

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the alias has been added.

#### Throws

GeneralError if the alias is not a Url or Urn.

#### Throws

NotFoundError if the id can not be resolved.

***

### alsoKnownAsRemove() {#alsoknownasremove}

> **alsoKnownAsRemove**(`documentId`, `alias`, `controller?`): `Promise`\<`void`\>

Remove an alias from the alsoKnownAs property on the document.
If the alias is not present the operation is a no-op.

#### Parameters

##### documentId

`string`

The id of the document to update.

##### alias

`string`

The alias to remove. Must be a Url or Urn.

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the alias has been removed.

#### Throws

GeneralError if the alias is not a Url or Urn.

#### Throws

NotFoundError if the id can not be resolved.

***

### verifiableCredentialCreate() {#verifiablecredentialcreate}

> **verifiableCredentialCreate**(`verificationMethodId`, `id`, `subject`, `options?`, `controller?`): `Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredential`; `jwt`: `string`; \}\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredential`; `jwt`: `string`; \}\>

The created verifiable credential and its token.

#### Throws

NotFoundError if the id can not be resolved.

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

***

### verifiableCredentialRevoke() {#verifiablecredentialrevoke}

> **verifiableCredentialRevoke**(`issuerId`, `credentialIndex`, `controller?`): `Promise`\<`void`\>

Revoke verifiable credential.

#### Parameters

##### issuerId

`string`

The id of the document to update the revocation list for.

##### credentialIndex

`number`

The revocation bitmap index to revoke.

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credential has been revoked.

***

### verifiableCredentialUnrevoke() {#verifiablecredentialunrevoke}

> **verifiableCredentialUnrevoke**(`issuerId`, `credentialIndex`, `controller?`): `Promise`\<`void`\>

Unrevoke verifiable credential.

#### Parameters

##### issuerId

`string`

The id of the document to update the revocation list for.

##### credentialIndex

`number`

The revocation bitmap index to unrevoke.

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credential has been unrevoked.

***

### verifiablePresentationCreate() {#verifiablepresentationcreate}

> **verifiablePresentationCreate**(`verificationMethodId`, `presentationId`, `contexts`, `types`, `verifiableCredentials`, `options?`, `controller?`): `Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentation`; `jwt`: `string`; \}\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentation`; `jwt`: `string`; \}\>

The created verifiable presentation and its token.

#### Throws

NotFoundError if the id can not be resolved.

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

***

### proofCreate() {#proofcreate}

> **proofCreate**(`verificationMethodId`, `proofType`, `unsecureDocument`, `controller?`): `Promise`\<`IProof`\>

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

##### controller?

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`IProof`\>

The proof.

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
