# Identity REST Client Examples

Use these examples to call identity REST endpoints from applications that need document lifecycle, credential, and profile operations.

## IdentityRestClient

```typescript
import { IdentityRestClient } from '@3sixty/identity-rest-client';

const client = new IdentityRestClient({
  endpoint: 'http://localhost:8080'
});

const className = client.className();
const createdDocument = await client.identityCreate('iota');

await client.identityRemove(createdDocument.id);

console.log(className); // IdentityRestClient
console.log(createdDocument.id); // did:iota:tst:0x...
```

```typescript
import { IdentityRestClient } from '@3sixty/identity-rest-client';
import { DidVerificationMethodType, ProofTypes } from '@3sixty/standards-w3c-did';

const client = new IdentityRestClient({
  endpoint: 'http://localhost:8080'
});

const did = 'did:iota:tst:0x1234abcd';

const verificationMethod = await client.verificationMethodCreate(
  did,
  DidVerificationMethodType.VerificationMethod,
  'signing-key'
);

await client.verificationMethodRemove(verificationMethod.id);

const service = await client.serviceCreate(
  did,
  'linked-domain',
  'LinkedDomains',
  'https://example.org'
);

await client.serviceRemove(service.id);

const credentialCreateResult = await client.verifiableCredentialCreate(
  `${did}#signing-key`,
  'urn:uuid:credential-001',
  {
    id: 'did:iota:tst:0x5678efab',
    name: 'Alice'
  },
  {
    revocationIndex: 2
  }
);

const credentialVerificationResult = await client.verifiableCredentialVerify(
  credentialCreateResult.jwt
);

await client.verifiableCredentialRevoke(did, 2);
await client.verifiableCredentialUnrevoke(did, 2);

const presentationCreateResult = await client.verifiablePresentationCreate(
  `${did}#signing-key`,
  'urn:uuid:presentation-001',
  ['https://www.w3.org/2018/credentials/v1'],
  ['VerifiablePresentation'],
  [credentialCreateResult.jwt]
);

const presentationVerificationResult = await client.verifiablePresentationVerify(
  presentationCreateResult.jwt
);

const proof = await client.proofCreate(`${did}#signing-key`, ProofTypes.DataIntegrityProof, {
  id: 'urn:example:doc-1',
  name: 'Sample'
});

const proofVerified = await client.proofVerify(
  {
    id: 'urn:example:doc-1',
    name: 'Sample'
  },
  proof
);

console.log(credentialVerificationResult.revoked); // false
console.log(presentationVerificationResult.revoked); // false
console.log(proofVerified); // true
```

## IdentityProfileRestClient

```typescript
import { IdentityProfileRestClient } from '@3sixty/identity-rest-client';

interface PublicProfile {
  displayName: string;
  website: string;
}

interface PrivateProfile {
  contactEmail: string;
}

const profileClient = new IdentityProfileRestClient<PublicProfile, PrivateProfile>({
  endpoint: 'http://localhost:8080'
});

const className = profileClient.className();

await profileClient.create(
  {
    displayName: 'Alice',
    website: 'https://example.org'
  },
  {
    contactEmail: 'alice@example.org'
  }
);

const profile = await profileClient.get(['displayName'], ['contactEmail']);
const publicProfile = await profileClient.getPublic(profile.identity, ['displayName']);

await profileClient.update(
  {
    displayName: 'Alice Doe',
    website: 'https://example.org'
  },
  {
    contactEmail: 'alice.doe@example.org'
  }
);

const profileList = await profileClient.list(
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

await profileClient.remove();

console.log(className); // IdentityProfileRestClient
console.log(publicProfile.displayName); // Alice
console.log(profileList.items.length); // 1
```

## IdentityResolverRestClient

```typescript
import { IdentityResolverRestClient } from '@3sixty/identity-rest-client';

const resolverClient = new IdentityResolverRestClient({
  endpoint: 'http://localhost:8080'
});

const className = resolverClient.className();
const didDocument = await resolverClient.identityResolve('did:iota:tst:0x1234abcd');

console.log(className); // IdentityResolverRestClient
console.log(didDocument.id); // did:iota:tst:0x1234abcd
```
