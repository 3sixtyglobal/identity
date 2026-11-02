# Class: DocumentHelper

Helper methods for documents.

## Constructors

### Constructor

> **new DocumentHelper**(): `DocumentHelper`

#### Returns

`DocumentHelper`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### parseId() {#parseid}

> `static` **parseId**(`documentId`): `object`

Parse the document id into its parts.

#### Parameters

##### documentId

`string`

The full document id.

#### Returns

`object`

The parsed document id.

##### id

> **id**: `string`

##### fragment

> **fragment**: `string` \| `undefined`

***

### credentialTypes() {#credentialtypes}

> `static` **credentialTypes**(`types?`): `string` \| `string`[]

Get the types of a verifiable credential, VerifiableCredential first then the types given, so a
credential can say what it is for, such as OrganizationMembershipCredential.

#### Parameters

##### types?

`string`[]

The types after VerifiableCredential.

#### Returns

`string` \| `string`[]

VerifiableCredential alone when no other type is given, otherwise every type once.

#### Throws

GuardError when a type is not a string with a value.

***

### joinId() {#joinid}

> `static` **joinId**(`documentId`, `fragment?`): `string`

Join the document id parts.

#### Parameters

##### documentId

`string`

The document id.

##### fragment?

`string`

The fragment part for the identifier.

#### Returns

`string`

The full id.

***

### getVerificationMethod() {#getverificationmethod}

> `static` **getVerificationMethod**(`didDocument`, `methodName`, `methodType?`): `IDidDocumentVerificationMethod`

Get a verification method from a DID document.

#### Parameters

##### didDocument

`IDidDocument`

The DID Document to get the method from.

##### methodName

`string`

The name of the method to get the JWK from.

##### methodType?

`DidVerificationMethodType`

The type of the method, defaults to verificationMethod.

#### Returns

`IDidDocumentVerificationMethod`

The verification method if found.

#### Throws

Error if the method is not found.

***

### getJwk() {#getjwk}

> `static` **getJwk**(`didDocument`, `methodName`, `methodType?`): `JWK`

Gets a JWK from a DID document verification method.

#### Parameters

##### didDocument

`IDidDocument`

The DID Document to get the method from.

##### methodName

`string`

The name of the method to get the JWK from.

##### methodType?

`DidVerificationMethodType`

The type of the method, defaults to verificationMethod.

#### Returns

`JWK`

The JWK if found.

#### Throws

Error if the method is not found.
