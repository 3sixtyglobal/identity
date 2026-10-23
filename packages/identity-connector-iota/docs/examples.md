# Identity Connector IOTA Examples

Use these examples when you want to create, update, verify, and resolve DID documents directly against IOTA network connectors.

## IotaIdentityConnector

```typescript
import { IotaIdentityConnector } from '@3sixty/identity-connector-iota';

const connector = new IotaIdentityConnector({
  config: {
    clientOptions: {
      nodes: ['https://api.testnet.iota.org']
    },
    network: 'testnet',
    coinType: 4218,
    faucetEndpoint: 'https://faucet.testnet.iota.org'
  }
});

const className = connector.className();
const createdDocument = await connector.createDocument('controller-1');

await connector.removeDocument('controller-1', createdDocument.id);

console.log(className); // IotaIdentityConnector
console.log(createdDocument.id); // did:iota:tst:0x...
```

```typescript
import { IotaIdentityConnector } from '@3sixty/identity-connector-iota';
import { DidVerificationMethodType, ProofTypes } from '@3sixty/standards-w3c-did';

const connector = new IotaIdentityConnector({
  config: {
    clientOptions: {
      nodes: ['https://api.testnet.iota.org']
    },
    network: 'testnet',
    coinType: 4218,
    faucetEndpoint: 'https://faucet.testnet.iota.org'
  }
});

const identity = 'did:iota:tst:0x1234abcd';

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

const credentialResult = await connector.createVerifiableCredential(
  'controller-1',
  `${identity}#signing-key`,
  'urn:uuid:credential-001',
  {
    id: 'did:iota:tst:0x5678efab',
    name: 'Alice'
  },
  {
    revocationIndex: 4
  }
);

const credentialCheck = await connector.checkVerifiableCredential(credentialResult.jwt);

await connector.revokeVerifiableCredentials('controller-1', identity, [4]);
await connector.unrevokeVerifiableCredentials('controller-1', identity, [4]);

const presentationResult = await connector.createVerifiablePresentation(
  'controller-1',
  `${identity}#signing-key`,
  'urn:uuid:presentation-001',
  ['https://www.w3.org/2018/credentials/v1'],
  ['VerifiablePresentation'],
  [credentialResult.jwt]
);

const presentationCheck = await connector.checkVerifiablePresentation(presentationResult.jwt);

const proof = await connector.createProof(
  'controller-1',
  `${identity}#signing-key`,
  ProofTypes.DataIntegrityProof,
  {
    id: 'urn:example:document-1',
    title: 'Identity Payload'
  }
);

const proofValid = await connector.verifyProof(
  {
    id: 'urn:example:document-1',
    title: 'Identity Payload'
  },
  proof
);

console.log(credentialCheck.revoked); // false
console.log(presentationCheck.revoked); // false
console.log(proofValid); // true
```

## IotaIdentityResolverConnector

```typescript
import { IotaIdentityResolverConnector } from '@3sixty/identity-connector-iota';

const resolver = new IotaIdentityResolverConnector({
  config: {
    clientOptions: {
      nodes: ['https://api.testnet.iota.org']
    },
    network: 'testnet',
    coinType: 4218,
    faucetEndpoint: 'https://faucet.testnet.iota.org'
  }
});

const className = resolver.className();
const didDocument = await resolver.resolveDocument('did:iota:tst:0x1234abcd');

console.log(className); // IotaIdentityResolverConnector
console.log(didDocument.id); // did:iota:tst:0x1234abcd
```
