# Identity CLI Usage

Use this output to check available commands quickly before running identity workflows from your terminal.

## Running

To install and run the CLI locally use the following commands:

```shell
npm install @3sixty/identity-cli -g
3sixty-identity
```

or run directly using NPX:

```shell
npx "@3sixty/identity-cli"
```

## Help

```shell
🌍 3Sixty Identity v1.0.0

Usage: 3sixty-identity [command]

Options:
  -V, --version                             output the version number
  --lang <lang>                             The language to display the output in. (default: "en")
  --load-env [env...]                       Load the env files to initialise any environment variables.
  -h, --help                                display help for command

Commands:
  mnemonic [options]                        Create a mnemonic.
  address [options]                         Create bech32 addresses and keys from the seed.
  faucet [options]                          Request funds from the faucet.
  transfer [options]                        Transfer funds from one address to another.
  identity-create [options]                 Create a Decentralized Identifier (DID).
  identity-resolve [options]                Resolve a Decentralized Identifier (DID).
  verification-method-add [options]         Add a verification method to a DID.
  verification-method-remove [options]      Remove a verification method from a DID.
  service-add [options]                     Add a service to a DID.
  service-remove [options]                  Remove a service from a DID.
  verifiable-credential-create [options]    Create a verifiable credential.
  verifiable-credential-verify [options]    Verify a verifiable credential.
  verifiable-credential-revoke [options]    Revoke a verifiable credential.
  verifiable-credential-unrevoke [options]  Unrevoke a verifiable credential.
  proof-create [options]                    Create a proof for some data using a verification method.
  proof-verify [options]                    Verify a proof for some data using a verification method.
```

## identity-create --help

```shell
🌍 3Sixty Identity v1.0.0

Usage: 3sixty-identity identity-create [options]

Creates a Decentralized Identifier (DID).

Options:
  --seed <seed>              The seed for the controller address in hex or base64 used to create the DID, or start with ! to read environment variable.
  --address-index <index>    The address index to use for the creation. (default: "0")
  --no-console               Hides the output in the console.
  --json <filename>          Creates a JSON file containing the output.
  --merge-json               If the JSON file already exists merge the data instead of overwriting.
  --env <filename>           Creates an env file containing the output.
  --merge-env                If the env file already exists merge the data instead of overwriting.
  --node <url>               The url for the node endpoint, or an environment variable name containing the url. (default: "!NODE_URL")
  --explorer <url>           The url for the explorer endpoint, or an environment variable name containing the url. (default: "!EXPLORER_URL")
  -h, --help                 display help for command
```

## Example

```shell
3sixty-identity identity-resolve --load-env config.env identity.env --did !DID --json did-document.json
```

The commands `mnemonic`, `address`, `faucet` and `transfer` are described in more detail in the examples for `crypto-cli` and `wallet-cli`.

## Command

### identity-create

Use this command to create a new DID. The wallet address must have sufficient funds to store the identity. The seed and the funds can be generated using the `mnemonic` and `faucet` commands.

```shell
# Generate a seed and mnemonic and store it in the env file
3sixty-identity mnemonic --env wallet.env
# Generate an address and store it in the env file
3sixty-identity address --load-env wallet.env --hrp tst --seed !SEED --count 4 --env wallet.env --merge-env
```

To run this on the IOTA testnet you will need an env file with the following settings. Store the following config as config.env.

```shell
NODE_URL="https://api.devnet.iota.cafe"
FAUCET_URL="https://faucet.devnet.iota.cafe"
COIN_TYPE="4218"
NETWORK="devnet"
EXPLORER_URL="https://explorer.iota.org/"
```

To then request some funds and generate the identity you can issue the following commands:

```shell
# Fund the wallet address from the faucet loading the config and wallet env files
3sixty-identity faucet --load-env config.env wallet.env --address !ADDRESS_0
# Create an identity
3sixty-identity identity-create --load-env config.env wallet.env --seed !SEED --env identity.env
```

### identity-resolve

The identity resolve command looks up an identity by DID to check it exists and return the DID document.

```shell
3sixty-identity identity-resolve --load-env config.env identity.env --did !DID --json did-document.json
```

### verification-method-add

This command adds a verification method to a DID document.

```shell
3sixty-identity verification-method-add --load-env config.env wallet.env identity.env --seed !SEED --did !DID --type verificationMethod --env verification-method.env
```

### verification-method-remove

This command removes a verification method from a DID document.

```shell
3sixty-identity verification-method-remove --load-env config.env wallet.env identity.env verification-method.env --seed !SEED  --id !DID_VERIFICATION_METHOD_ID
```

### service-add

This command adds a service to a DID document.

```shell
3sixty-identity service-add --load-env config.env wallet.env identity.env --seed !SEED --did !DID --id linked-domain --type LinkedDomains --endpoint https://example.org --env service.env
```

### service-remove

This command removes a service from the DID document.

```shell
3sixty-identity service-remove --load-env config.env wallet.env identity.env service.env --seed !SEED --did !DID --id !DID_SERVICE_ID
```

## verifiable-credential-create

This command generates a verifiable credential using the specified verification method. You will need to supply the data as a json file.

```json
{
  "name": "Alice",
  "degreeName": "Bachelor of Science and Arts"
}
```

```shell
3sixty-identity verifiable-credential-create --load-env config.env verification-method.env --id !DID_VERIFICATION_METHOD_ID --private-key !DID_VERIFICATION_METHOD_PRIVATE_KEY --credential-id https://example.edu/credentials/3732 --types UniversityDegreeCredential --subject-json subject.json --env vc.env --revocation-index 0
```

This command outputs the verifiable credential as a JSON Web Token.

## verifiable-credential-verify

You can verify a verifiable credential stored as a JWT using this command.

```shell
3sixty-identity verifiable-credential-verify --load-env config.env vc.env --jwt !DID_VERIFIABLE_CREDENTIAL_JWT
```

## verifiable-credential-revoke

You can revoke a verifiable credential by revoking the index on the generating document.

```shell
3sixty-identity verifiable-credential-revoke --load-env config.env wallet.env identity.env --seed !SEED --did !DID --revocation-index 5
```

## verifiable-credential-unrevoke

You can unrevoke a verifiable credential by revoking the index on the generating document.

```shell
3sixty-identity verifiable-credential-unrevoke --load-env config.env wallet.env identity.env --seed !SEED --did !DID --revocation-index 5
```

## proof-create

This command generates a proof using the specified verification method.

```shell
3sixty-identity proof-create --load-env config.env verification-method.env --id !DID_VERIFICATION_METHOD_ID --private-key !DID_VERIFICATION_METHOD_PRIVATE_KEY --document-filename unsecured.json --json data-proof.json
```

## proof-verify

This command verifies a proof for a document.

```shell
3sixty-identity proof-verify --load-env config.env verification-method.env --id !DID_VERIFICATION_METHOD_ID --document-filename unsecured.json --proof-filename data-proof.json
```
