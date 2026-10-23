# Identity Connector Universal Examples

Use these snippets when you need to resolve DIDs through a universal resolver endpoint in application code or service handlers.

## UniversalResolverConnector

```typescript
import { UniversalResolverConnector } from '@3sixty/identity-connector-universal';

const resolver = new UniversalResolverConnector({
  config: {
    endpoint: 'https://uniresolver.io'
  }
});

const className = resolver.className();
console.log(className); // UniversalResolverConnector
```

```typescript
import { UniversalResolverConnector } from '@3sixty/identity-connector-universal';

const resolver = new UniversalResolverConnector({
  config: {
    endpoint: 'https://uniresolver.io'
  }
});

const didDocument = await resolver.resolveDocument('did:web:example.com:user:123');

console.log(didDocument.id); // did:web:example.com:user:123
```
