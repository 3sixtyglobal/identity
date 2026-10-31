# Identity Connector Entity Storage Examples

These snippets demonstrate document, profile, and resolution workflows using entity storage connectors and model entities.

## EntityStorageIdentityConnector

```typescript
import { EntityStorageIdentityConnector } from '@3sixty/identity-connector-entity-storage';

const connector = new EntityStorageIdentityConnector({
  didDocumentEntityStorageType: 'identity-document',
  vaultConnectorType: 'vault'
});

const className = connector.className();
const createdDocument = await connector.createDocument('controller-1');
const vaultKey = EntityStorageIdentityConnector.buildVaultKey(createdDocument.id, 'did');

await connector.removeDocument('controller-1', createdDocument.id);

console.log(className); // EntityStorageIdentityConnector
console.log(vaultKey); // did:entity-storage:.../did
```

```typescript
import { EntityStorageIdentityConnector } from '@3sixty/identity-connector-entity-storage';

const connector = new EntityStorageIdentityConnector();

const createdDocument = await connector.createDocument('controller-1');

// The export holds private keys, protect it like any other secret
const exported = await connector.exportDocument('controller-1', createdDocument.id);

await connector.removeDocument('controller-1', createdDocument.id, {
  removeKeys: true,
  removeDocumentKey: true
});

// The keys must match the document and its signature, every verification method needs its key,
// and neither the DID nor any of its keys may already exist. The DID is not derived from its keys,
// so the namespace is trust on first import: the first node to import a DID owns it there.
const importedDocument = await connector.importDocument('controller-1', exported);

console.log(exported.keys.map(key => key.id)); // ['did']
console.log(importedDocument.id === createdDocument.id); // true
```

```typescript
import { EntityStorageIdentityConnector } from '@3sixty/identity-connector-entity-storage';
import { DidVerificationMethodType, ProofTypes } from '@3sixty/standards-w3c-did';

const connector = new EntityStorageIdentityConnector({
  didDocumentEntityStorageType: 'identity-document',
  vaultConnectorType: 'vault'
});

const identity = 'did:entity-storage:0x1234abcd';

const verificationMethod = await connector.addVerificationMethod(
  'controller-1',
  identity,
  DidVerificationMethodType.VerificationMethod,
  'signing-key'
);

await connector.removeVerificationMethod('controller-1', verificationMethod.id);

const service = await connector.addService(
  'controller-1',
  identity,
  'linked-domain',
  'LinkedDomains',
  'https://example.org'
);

await connector.removeService('controller-1', service.id);

const createdCredential = await connector.createVerifiableCredential(
  'controller-1',
  `${identity}#signing-key`,
  'urn:uuid:credential-001',
  {
    id: 'did:entity-storage:0x5678efab',
    role: 'Engineer'
  },
  {
    revocationIndex: 3
  }
);

const verifiedCredential = await connector.checkVerifiableCredential(createdCredential.jwt);

await connector.revokeVerifiableCredentials('controller-1', identity, [3]);
await connector.unrevokeVerifiableCredentials('controller-1', identity, [3]);

const createdPresentation = await connector.createVerifiablePresentation(
  'controller-1',
  `${identity}#signing-key`,
  'urn:uuid:presentation-001',
  ['https://www.w3.org/2018/credentials/v1'],
  ['VerifiablePresentation'],
  [createdCredential.jwt]
);

const verifiedPresentation = await connector.checkVerifiablePresentation(createdPresentation.jwt);

const proof = await connector.createProof(
  'controller-1',
  `${identity}#signing-key`,
  ProofTypes.DataIntegrityProof,
  {
    id: 'urn:example:document-1',
    status: 'active'
  }
);

const proofVerified = await connector.verifyProof(
  {
    id: 'urn:example:document-1',
    status: 'active'
  },
  proof
);

console.log(verifiedCredential.revoked); // false
console.log(verifiedPresentation.revoked); // false
console.log(proofVerified); // true
```

## EntityStorageIdentityProfileConnector

```typescript
import { EntityStorageIdentityProfileConnector } from '@3sixty/identity-connector-entity-storage';

interface PublicProfile {
  displayName: string;
  region: string;
}

interface PrivateProfile {
  email: string;
}

const profileConnector = new EntityStorageIdentityProfileConnector<PublicProfile, PrivateProfile>({
  profileEntityStorageType: 'identity-profile'
});

const className = profileConnector.className();
const identity = 'did:entity-storage:0x1234abcd';

await profileConnector.create(
  identity,
  {
    displayName: 'Alice',
    region: 'Manchester'
  },
  {
    email: 'alice@example.org'
  }
);

const profile = await profileConnector.get(identity, ['displayName'], ['email']);

await profileConnector.update(
  identity,
  {
    displayName: 'Alice Doe',
    region: 'Manchester'
  },
  {
    email: 'alice.doe@example.org'
  }
);

const profileList = await profileConnector.list(
  [
    {
      propertyName: 'displayName',
      propertyValue: 'Alice Doe'
    }
  ],
  undefined,
  ['displayName'],
  ['email'],
  undefined,
  10
);

await profileConnector.remove(identity);

console.log(className); // EntityStorageIdentityProfileConnector
console.log(profile.publicProfile.displayName); // Alice
console.log(profileList.items.length); // 1
```

## EntityStorageIdentityResolverConnector

```typescript
import { EntityStorageIdentityResolverConnector } from '@3sixty/identity-connector-entity-storage';

const resolverConnector = new EntityStorageIdentityResolverConnector({
  didDocumentEntityStorageType: 'identity-document',
  vaultConnectorType: 'vault'
});

const className = resolverConnector.className();
const didDocument = await resolverConnector.resolveDocument('did:entity-storage:0x1234abcd');

console.log(className); // EntityStorageIdentityResolverConnector
console.log(didDocument.id); // did:entity-storage:0x1234abcd
```

## IdentityDocument

```typescript
import { IdentityDocument } from '@3sixty/identity-connector-entity-storage';

const identityDocument = new IdentityDocument();
identityDocument.id = 'did:entity-storage:0x1234abcd';
identityDocument.document = {
  id: 'did:entity-storage:0x1234abcd'
};
identityDocument.signature = 'MEYCIQCyExampleSignature';
identityDocument.controller = 'controller-1';

console.log(identityDocument.id); // did:entity-storage:0x1234abcd
```

## IdentityProfile

```typescript
import { IdentityProfile } from '@3sixty/identity-connector-entity-storage';

const identityProfile = new IdentityProfile();
identityProfile.identity = 'did:entity-storage:0x1234abcd';
identityProfile.publicProfile = {
  displayName: 'Alice'
};
identityProfile.privateProfile = {
  email: 'alice@example.org'
};

console.log(identityProfile.identity); // did:entity-storage:0x1234abcd
```
