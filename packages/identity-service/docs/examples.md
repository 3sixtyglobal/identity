# Identity Service Examples

These examples show how to orchestrate identity operations through service-level abstractions for connectors, resolvers, and profile storage.

## IdentityService

```typescript
import { IdentityService } from '@3sixty/identity-service';

const identityService = new IdentityService({
  config: {
    defaultNamespace: 'iota'
  }
});

const className = identityService.className();
const didDocument = await identityService.identityCreate('iota', 'controller-1');

await identityService.identityRemove(didDocument.id, 'controller-1');

console.log(className); // IdentityService
console.log(didDocument.id); // did:iota:tst:0x...
```

```typescript
import { IdentityService } from '@3sixty/identity-service';
import { DidVerificationMethodType, ProofTypes } from '@3sixty/standards-w3c-did';

const identityService = new IdentityService({
  config: {
    defaultNamespace: 'iota'
  }
});

const identity = 'did:iota:tst:0x1234abcd';

const verificationMethod = await identityService.verificationMethodCreate(
  identity,
  DidVerificationMethodType.VerificationMethod,
  'signing-key',
  'controller-1'
);

await identityService.verificationMethodRemove(verificationMethod.id, 'controller-1');

const service = await identityService.serviceCreate(
  identity,
  'linked-domain',
  'LinkedDomains',
  'https://example.org',
  'controller-1'
);

await identityService.serviceRemove(service.id, 'controller-1');

const createdCredential = await identityService.verifiableCredentialCreate(
  `${identity}#signing-key`,
  'urn:uuid:credential-001',
  {
    id: 'did:iota:tst:0x5678efab',
    role: 'Engineer'
  },
  {
    revocationIndex: 7
  },
  'controller-1'
);

const verifiedCredential = await identityService.verifiableCredentialVerify(createdCredential.jwt);

await identityService.verifiableCredentialRevoke(identity, 7, 'controller-1');
await identityService.verifiableCredentialUnrevoke(identity, 7, 'controller-1');

const createdPresentation = await identityService.verifiablePresentationCreate(
  `${identity}#signing-key`,
  'urn:uuid:presentation-001',
  ['https://www.w3.org/2018/credentials/v1'],
  ['VerifiablePresentation'],
  [createdCredential.jwt],
  {
    expirationDate: new Date('2027-01-01T00:00:00.000Z')
  },
  'controller-1'
);

const verifiedPresentation = await identityService.verifiablePresentationVerify(
  createdPresentation.jwt
);

const proof = await identityService.proofCreate(
  `${identity}#signing-key`,
  ProofTypes.DataIntegrityProof,
  {
    id: 'urn:example:document-1',
    value: 'hello'
  },
  'controller-1'
);

const proofIsValid = await identityService.proofVerify(
  {
    id: 'urn:example:document-1',
    value: 'hello'
  },
  proof
);

console.log(verifiedCredential.revoked); // false
console.log(verifiedPresentation.revoked); // false
console.log(proofIsValid); // true
```

## IdentityProfileService

```typescript
import { IdentityProfileService } from '@3sixty/identity-service';

interface PublicProfile {
  displayName: string;
  location: string;
}

interface PrivateProfile {
  email: string;
}

const profileService = new IdentityProfileService<PublicProfile, PrivateProfile>({
  profileEntityConnectorType: 'identity-profile'
});

const className = profileService.className();
const identity = 'did:iota:tst:0x1234abcd';

await profileService.create(
  {
    displayName: 'Alice',
    location: 'London'
  },
  {
    email: 'alice@example.org'
  },
  identity
);

const profile = await profileService.get(['displayName'], ['email'], identity);
const publicProfile = await profileService.getPublic(identity, ['displayName']);

await profileService.update(
  {
    displayName: 'Alice Doe',
    location: 'London'
  },
  {
    email: 'alice.doe@example.org'
  },
  identity
);

const profiles = await profileService.list(
  [
    {
      propertyName: 'displayName',
      propertyValue: 'Alice Doe'
    }
  ],
  ['displayName'],
  undefined,
  10
);

await profileService.remove(identity);

console.log(className); // IdentityService
console.log(profile.identity); // did:iota:tst:0x1234abcd
console.log(publicProfile.displayName); // Alice
console.log(profiles.items.length); // 1
```

## IdentityResolverService

```typescript
import { IdentityResolverService } from '@3sixty/identity-service';

const resolverService = new IdentityResolverService({
  config: {
    defaultNamespace: 'iota'
  },
  fallbackResolverConnectorType: 'universal'
});

const className = resolverService.className();
const didDocument = await resolverService.identityResolve('did:iota:tst:0x1234abcd');

console.log(className); // IdentityService
console.log(didDocument.id); // did:iota:tst:0x1234abcd
```
