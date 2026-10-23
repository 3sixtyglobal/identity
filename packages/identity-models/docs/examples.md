# Identity Models Examples

These examples focus on building and validating DID identifiers, extracting data from DID documents, and verifying signed materials.

## DocumentHelper

```typescript
import { DocumentHelper } from '@3sixty/identity-models';

const parsed = DocumentHelper.parseId('did:iota:tst:0x1234abcd#key-1');

console.log(parsed.id); // did:iota:tst:0x1234abcd
console.log(parsed.fragment); // key-1
```

```typescript
import { DocumentHelper } from '@3sixty/identity-models';
import { DidVerificationMethodType, type IDidDocument } from '@3sixty/standards-w3c-did';

const didDocument: IDidDocument = {
  id: 'did:iota:tst:0x1234abcd',
  verificationMethod: [
    {
      id: 'did:iota:tst:0x1234abcd#key-1',
      controller: 'did:iota:tst:0x1234abcd',
      type: 'JsonWebKey',
      publicKeyJwk: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: 'S4e4WQ9Hj1et0eS2e0_ExampleBase64Url'
      }
    }
  ]
};

const fullVerificationMethodId = DocumentHelper.joinId(didDocument.id, 'key-1');
const verificationMethod = DocumentHelper.getVerificationMethod(
  didDocument,
  fullVerificationMethodId,
  DidVerificationMethodType.VerificationMethod
);
const publicJwk = DocumentHelper.getJwk(
  didDocument,
  fullVerificationMethodId,
  DidVerificationMethodType.VerificationMethod
);

console.log(verificationMethod.id); // did:iota:tst:0x1234abcd#key-1
console.log(publicJwk.crv); // Ed25519
```

## DidContextIdHandler

```typescript
import { DidContextIdHandler } from '@3sixty/identity-models';

const contextIdHandler = new DidContextIdHandler();

const className = contextIdHandler.className();
const shortened = contextIdHandler.short('did:iota:tst:0x8f2f0d7a5c4b3a2f1e0d9c8b7a6f5e4d');
contextIdHandler.guard('did:iota:tst:0x8f2f0d7a5c4b3a2f1e0d9c8b7a6f5e4d');

console.log(className); // DidContextIdHandler
console.log(shortened); // jy8NelxLOi8eDZyLem9eTQ
```

## Did

```typescript
import { Did } from '@3sixty/identity-models';

const parsedDid = Did.parse('did:iota:tst:0x1234abcd');
Did.guard('ExampleWorkflow', 'issuerDid', 'did:iota:tst:0x1234abcd');

console.log(parsedDid.method); // iota
console.log(parsedDid.network); // tst
console.log(parsedDid.id); // 0x1234abcd
```

## VerificationHelper

```typescript
import { VerificationHelper, type IIdentityResolverComponent } from '@3sixty/identity-models';

const resolver: IIdentityResolverComponent = {
  className: () => 'IdentityResolverService',
  identityResolve: async (identity: string) => ({
    id: identity,
    verificationMethod: [
      {
        id: `${identity}#signing-key`,
        controller: identity,
        type: 'JsonWebKey',
        publicKeyJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'S4e4WQ9Hj1et0eS2e0_ExampleBase64Url'
        }
      }
    ]
  })
};

const jwt =
  'eyJraWQiOiJkaWQ6aW90YTp0c3Q6MHgxMjM0YWJjZCNzaWduaW5nLWtleSIsImlzcyI6ImRpZDppb3RhOnRzdDoweDEyMzRhYmNkIiwiYWxnIjoiRWREU0EiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiJhbGljZSJ9.Q2hhbmdlTWVXaXRoUmVhbFNpZ25hdHVyZQ';

const jwtVerification = await VerificationHelper.verifyJwt(resolver, jwt);

console.log(typeof jwtVerification.payload.sub); // string
```

```typescript
import { VerificationHelper, type IIdentityResolverComponent } from '@3sixty/identity-models';
import type { IJsonLdNodeObject } from '@3sixty/data-json-ld';

const resolver: IIdentityResolverComponent = {
  className: () => 'IdentityResolverService',
  identityResolve: async (identity: string) => ({
    id: identity,
    verificationMethod: [
      {
        id: `${identity}#signing-key`,
        controller: identity,
        type: 'JsonWebKey',
        publicKeyJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'S4e4WQ9Hj1et0eS2e0_ExampleBase64Url'
        }
      }
    ]
  })
};

const verifiableCredential: IJsonLdNodeObject = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  issuer: 'did:iota:tst:0x1234abcd',
  issuanceDate: '2026-03-10T00:00:00.000Z',
  credentialSubject: {
    id: 'did:iota:tst:0x5678efab',
    role: 'Developer'
  },
  proof: {
    type: 'DataIntegrityProof',
    verificationMethod: 'did:iota:tst:0x1234abcd#signing-key',
    cryptosuite: 'eddsa-jcs-2022',
    created: '2026-03-10T00:00:00.000Z',
    proofPurpose: 'assertionMethod',
    proofValue: 'z4ExampleProofValue'
  }
};

const verified = await VerificationHelper.verifyProof(resolver, verifiableCredential);

console.log(verified); // true
```
