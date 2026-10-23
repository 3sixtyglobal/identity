# Interface: IIdentityConnector

Interface describing an identity connector.

## Extends

- `IComponent`

## Methods

### createDocument() {#createdocument}

> **createDocument**(`controller`): `Promise`\<`IDidDocument`\>

Create a new document.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

#### Returns

`Promise`\<`IDidDocument`\>

The created document.

***

### removeDocument() {#removedocument}

> **removeDocument**(`controller`, `documentId`, `options?`): `Promise`\<`void`\>

Remove a document.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### documentId

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

A promise that resolves when the document has been removed.

***

### addVerificationMethod() {#addverificationmethod}

> **addVerificationMethod**(`controller`, `documentId`, `verificationMethodType`, `verificationMethodId?`): `Promise`\<`IDidDocumentVerificationMethod`\>

Add a verification method to the document in JSON Web key Format.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### documentId

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

***

### removeVerificationMethod() {#removeverificationmethod}

> **removeVerificationMethod**(`controller`, `verificationMethodId`, `options?`): `Promise`\<`void`\>

Remove a verification method from the document.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### verificationMethodId

`string`

The id of the verification method.

##### options?

Optional settings.

###### removeKeys?

`boolean`

Also remove any associated private key from the vault.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the verification method has been removed.

#### Throws

NotFoundError if the id can not be resolved.

#### Throws

NotSupportedError if the platform does not support multiple revocable keys.

***

### addService() {#addservice}

> **addService**(`controller`, `documentId`, `serviceId`, `serviceType`, `serviceEndpoint`): `Promise`\<`IDidService`\>

Add a service to the document.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### documentId

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

***

### removeService() {#removeservice}

> **removeService**(`controller`, `serviceId`): `Promise`\<`void`\>

Remove a service from the document.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### serviceId

`string`

The id of the service.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the service has been removed.

#### Throws

NotFoundError if the id can not be resolved.

***

### addAlsoKnownAs() {#addalsoknownas}

> **addAlsoKnownAs**(`controller`, `documentId`, `alias`): `Promise`\<`void`\>

Add an alias to the alsoKnownAs property on the document.
If the alias is already present the operation is a no-op.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

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

***

### removeAlsoKnownAs() {#removealsoknownas}

> **removeAlsoKnownAs**(`controller`, `documentId`, `alias`): `Promise`\<`void`\>

Remove an alias from the alsoKnownAs property on the document.
If the alias is not present the operation is a no-op.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

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

***

### createVerifiableCredential() {#createverifiablecredential}

> **createVerifiableCredential**(`controller`, `verificationMethodId`, `id`, `subject`, `options?`): `Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredential`; `jwt`: `string`; \}\>

Create a verifiable credential for a verification method.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

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

***

### checkVerifiableCredential() {#checkverifiablecredential}

> **checkVerifiableCredential**(`credential`): `Promise`\<\{ `revoked`: `boolean`; `verifiableCredential?`: `IDidVerifiableCredential`; \}\>

Check a verifiable credential is valid.

#### Parameters

##### credential

`string` \| `IDidVerifiableCredential`

The credential to verify.

#### Returns

`Promise`\<\{ `revoked`: `boolean`; `verifiableCredential?`: `IDidVerifiableCredential`; \}\>

The credential stored in the jwt and the revocation status.

***

### revokeVerifiableCredentials() {#revokeverifiablecredentials}

> **revokeVerifiableCredentials**(`controller`, `issuerDocumentId`, `credentialIndices`): `Promise`\<`void`\>

Revoke verifiable credential(s).

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### issuerDocumentId

`string`

The id of the document to update the revocation list for.

##### credentialIndices

`number`[]

The revocation bitmap index or indices to revoke.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credentials have been revoked.

***

### unrevokeVerifiableCredentials() {#unrevokeverifiablecredentials}

> **unrevokeVerifiableCredentials**(`controller`, `issuerDocumentId`, `credentialIndices`): `Promise`\<`void`\>

Unrevoke verifiable credential(s).

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

##### issuerDocumentId

`string`

The id of the document to update the revocation list for.

##### credentialIndices

`number`[]

The revocation bitmap index or indices to unrevoke.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credentials have been unrevoked.

***

### createVerifiablePresentation() {#createverifiablepresentation}

> **createVerifiablePresentation**(`controller`, `verificationMethodId`, `presentationId`, `contexts`, `types`, `verifiableCredentials`, `options?`): `Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentation`; `jwt`: `string`; \}\>

Create a verifiable presentation from the supplied verifiable credentials.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

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

***

### checkVerifiablePresentation() {#checkverifiablepresentation}

> **checkVerifiablePresentation**(`presentation`): `Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentation`; `issuers?`: `IDidDocument`[]; \}\>

Check a verifiable presentation is valid.

#### Parameters

##### presentation

`string` \| `IDidVerifiablePresentation`

The presentation to verify.

#### Returns

`Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentation`; `issuers?`: `IDidDocument`[]; \}\>

The presentation stored in the jwt and the revocation status.

***

### createProof() {#createproof}

> **createProof**(`controller`, `verificationMethodId`, `proofType`, `unsecureDocument`): `Promise`\<`IProof`\>

Create a proof for arbitrary data with the specified verification method.

#### Parameters

##### controller

`string`

The controller of the identity who can make changes.

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

***

### verifyProof() {#verifyproof}

> **verifyProof**(`document`, `proof`): `Promise`\<`boolean`\>

Verify proof for arbitrary data with the specified verification method.

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
