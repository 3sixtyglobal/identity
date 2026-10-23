# 3Sixty Identity

The identity-connector-universal package provides DID resolution through the Universal Resolver ecosystem so applications can work with multiple DID methods in a consistent way. It is designed for interoperability-focused implementations that need standards-aligned identity resolution without coupling to a single network.

## Installation

```shell
npm install @3sixty/identity-connector-universal
```

## Docker

To perform testing of this component it may be necessary to launch a local instance to communicate with.

```shell
docker run -d --name 3sixty-identity-universal -p 18180:8080 -e NETWORK=testnet iotaledger/uni-resolver-driver-iota:v0.2.0-alpha
```

## Examples

Usage of the APIs is shown in the examples [docs/examples.md](docs/examples.md)

## Reference

Detailed reference documentation for the API can be found in [docs/reference/index.md](docs/reference/index.md)

## Changelog

The changes between each version can be found in [docs/changelog.md](docs/changelog.md)

## Origin

This package is derived from the original [iotaledger/twin-identity](https://github.com/iotaledger/twin-identity/tree/next/packages/identity-connector-universal) repository.
