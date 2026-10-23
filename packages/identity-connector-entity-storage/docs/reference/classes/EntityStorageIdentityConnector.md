# Class: EntityStorageIdentityConnector

Class for performing identity operations using entity storage.

## Implements

- `IIdentityConnector`

## Constructors

### Constructor

> **new EntityStorageIdentityConnector**(`options?`): `EntityStorageIdentityConnector`

Create a new instance of EntityStorageIdentityConnector.

#### Parameters

##### options?

[`IEntityStorageIdentityConnectorConstructorOptions`](../interfaces/IEntityStorageIdentityConnectorConstructorOptions.md)

The options for the identity connector.

#### Returns

`EntityStorageIdentityConnector`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

***

### NAMESPACE {#namespace}

> `readonly` `static` **NAMESPACE**: `string` = `"entity-storage"`

The namespace supported by the identity connector.

## Methods

### className() {#classname}

> **className**(): `string`

Returns the class name of the component.

#### Returns

`string`

The class name of the component.

#### Implementation of

`IIdentityConnector.className`

***

### stop() {#stop}

> **stop**(`nodeLoggingComponentType?`): `Promise`\<`void`\>

Stop the service.
Destroys in-memory resources owned by this component.

#### Parameters

##### nodeLoggingComponentType?

`string`

The node logging component type.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the service has stopped.

#### Implementation of

`IIdentityConnector.stop`

***

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

#### Implementation of

`IIdentityConnector.createDocument`

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

#### Implementation of

`IIdentityConnector.removeDocument`

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

#### Implementation of

`IIdentityConnector.addVerificationMethod`

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

#### Implementation of

`IIdentityConnector.removeVerificationMethod`

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

#### Implementation of

`IIdentityConnector.addService`

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

#### Implementation of

`IIdentityConnector.removeService`

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

#### Implementation of

`IIdentityConnector.addAlsoKnownAs`

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

#### Implementation of

`IIdentityConnector.removeAlsoKnownAs`

***

### createVerifiableCredential() {#createverifiablecredential}

> **createVerifiableCredential**(`controller`, `verificationMethodId`, `id`, `subject`, `options?`): `Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredentialV1`; `jwt`: `string`; \}\>

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

Additional fields to add to the JWT header.

###### jwtPayloadFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to add to the JWT payload.

#### Returns

`Promise`\<\{ `verifiableCredential`: `IDidVerifiableCredentialV1`; `jwt`: `string`; \}\>

The created verifiable credential and its token.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityConnector.createVerifiableCredential`

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

#### Implementation of

`IIdentityConnector.checkVerifiableCredential`

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

#### Implementation of

`IIdentityConnector.revokeVerifiableCredentials`

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

The revocation bitmap index or indices to un revoke.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the credentials have been unrevoked.

#### Implementation of

`IIdentityConnector.unrevokeVerifiableCredentials`

***

### createVerifiablePresentation() {#createverifiablepresentation}

> **createVerifiablePresentation**(`controller`, `verificationMethodId`, `presentationId`, `contexts`, `types`, `verifiableCredentials`, `options?`): `Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentationV1`; `jwt`: `string`; \}\>

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

(`string` \| `IDidVerifiableCredentialV1`)[]

The credentials to use for creating the presentation in jwt format.

##### options?

Additional options for creating the verifiable presentation.

###### expirationDate?

`Date`

The date the verifiable presentation is valid until.

###### jwtHeaderFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to add to the JWT header.

###### jwtPayloadFields?

\{\[`id`: `string`\]: `string`; \}

Additional fields to add to the JWT payload.

#### Returns

`Promise`\<\{ `verifiablePresentation`: `IDidVerifiablePresentationV1`; `jwt`: `string`; \}\>

The created verifiable presentation and its token.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityConnector.createVerifiablePresentation`

***

### checkVerifiablePresentation() {#checkverifiablepresentation}

> **checkVerifiablePresentation**(`presentation`): `Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentationV1`; `issuers?`: `IDidDocument`[]; \}\>

Check a verifiable presentation is valid.

#### Parameters

##### presentation

`string` \| `IDidVerifiablePresentation`

The presentation to verify.

#### Returns

`Promise`\<\{ `revoked`: `boolean`; `verifiablePresentation?`: `IDidVerifiablePresentationV1`; `issuers?`: `IDidDocument`[]; \}\>

The presentation stored in the jwt and the revocation status.

#### Implementation of

`IIdentityConnector.checkVerifiablePresentation`

***

### createProof() {#createproof}

> **createProof**(`controller`, `verificationMethodId`, `proofType`, `unsecureDocument`): `Promise`\<`IProof`\>

Create a proof for arbitrary data with the specified verification method.
This method uses async signing to ensure the private key never leaves the vault,
with algorithm validation to ensure key type compatibility.

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

#### Throws

NotFoundError if the identity or method is not found.

#### Throws

UnauthorizedError if the caller is not the stored controller.

#### Throws

GeneralError if algorithm doesn't match key type or proof creation fails.

#### Implementation of

`IIdentityConnector.createProof`

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

#### Implementation of

`IIdentityConnector.verifyProof`
