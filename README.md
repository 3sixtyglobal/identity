# 3Sixty Identity

This repository brings together the core building blocks needed to design and run decentralised identity workflows across different environments. It combines shared models, storage and network connectors, service contracts, a REST client, and a command line tool so teams can implement consistent identity behaviour without rebuilding the same foundation in each project.

Taken together, the workspaces are intended to make identity integrations more predictable from local development through to production operations. The overall structure separates concerns clearly, so applications can evolve their deployment choices while still relying on a stable identity domain model and interoperable interfaces.

## Packages

- [identity-models](packages/identity-models/README.md) - Shared identity models and contracts for consistent data structures across services, connectors, and clients.
- [identity-connector-entity-storage](packages/identity-connector-entity-storage/README.md) - Entity storage connector for persisting and retrieving identity records through a consistent data layer.
- [identity-service](packages/identity-service/README.md) - Service contracts and REST endpoint definitions for exposing identity workflows through stable interfaces.
- [identity-rest-client](packages/identity-rest-client/README.md) - Client library for consuming identity REST endpoints through shared request and response contracts.
- [identity-connector-iota](packages/identity-connector-iota/README.md) - Connector for running identity and DID workflows against IOTA network infrastructure.
- [identity-connector-universal](packages/identity-connector-universal/README.md) - Connector for resolving decentralised identifiers through the Universal Resolver ecosystem.

## Apps

- [identity-cli](apps/identity-cli/README.md) - Command line tool for running identity workflows in local development and automation pipelines.

## Guides

- [How to Create a DID IOTA Identity](docs/guides/how-to-create-did-identity.md) - Step-by-step instructions for creating a decentralised identifier on the IOTA test network.
- [DLT and Identity Workflow Guide](docs/guides/how-to-dlt-identity.md) - End-to-end guide for running identity and attestation workflows with the Playground API.
- [How to Obtain a Token](docs/guides/how-to-obtain-token.md) - Instructions for authenticating and retrieving an access token for API requests.

## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)

## Origin

This repository is derived from the original [iotaledger/twin-identity](https://github.com/iotaledger/twin-identity) repository.
