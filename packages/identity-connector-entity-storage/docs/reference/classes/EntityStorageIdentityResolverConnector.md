# Class: EntityStorageIdentityResolverConnector

Class for performing identity operations using entity storage.

## Implements

- `IIdentityResolverConnector`

## Constructors

### Constructor

> **new EntityStorageIdentityResolverConnector**(`options?`): `EntityStorageIdentityResolverConnector`

Create a new instance of EntityStorageIdentityResolverConnector.

#### Parameters

##### options?

[`IEntityStorageIdentityResolverConnectorConstructorOptions`](../interfaces/IEntityStorageIdentityResolverConnectorConstructorOptions.md)

The options for the identity connector.

#### Returns

`EntityStorageIdentityResolverConnector`

## Properties

### NAMESPACE {#namespace}

> `readonly` `static` **NAMESPACE**: `string` = `"entity-storage"`

The namespace supported by the identity connector.

***

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

`IIdentityResolverConnector.className`

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

`IIdentityResolverConnector.stop`

***

### resolveDocument() {#resolvedocument}

> **resolveDocument**(`documentId`): `Promise`\<`IDidDocument`\>

Resolve a document from its id, cached for didResolutionCacheTtlMs
(0 disables caching and resolves fresh every call).

#### Parameters

##### documentId

`string`

The id of the document to resolve.

#### Returns

`Promise`\<`IDidDocument`\>

The resolved document.

#### Throws

NotFoundError if the id can not be resolved.

#### Implementation of

`IIdentityResolverConnector.resolveDocument`
