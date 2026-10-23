// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIBase } from "@3sixty/cli-core";
import { buildCommandAddress, buildCommandMnemonic } from "@3sixty/crypto-cli";
import { buildCommandFaucet, buildCommandTransfer } from "@3sixty/wallet-cli";
import type { Command } from "commander";
import { buildCommandAlsoKnownAsAdd } from "./commands/alsoKnownAsAdd.js";
import { buildCommandAlsoKnownAsRemove } from "./commands/alsoKnownAsRemove.js";
import { buildCommandIdentityCreate } from "./commands/identityCreate.js";
import { buildCommandIdentityResolve } from "./commands/identityResolve.js";
import { buildCommandProofCreate } from "./commands/proofCreate.js";
import { buildCommandProofVerify } from "./commands/proofVerify.js";
import { buildCommandServiceAdd } from "./commands/serviceAdd.js";
import { buildCommandServiceRemove } from "./commands/serviceRemove.js";
import { buildCommandVerifiableCredentialCreate } from "./commands/verifiableCredentialCreate.js";
import { buildCommandVerifiableCredentialRevoke } from "./commands/verifiableCredentialRevoke.js";
import { buildCommandVerifiableCredentialUnrevoke } from "./commands/verifiableCredentialUnrevoke.js";
import { buildCommandVerifiableCredentialVerify } from "./commands/verifiableCredentialVerify.js";
import { buildCommandVerifiablePresentationCreate } from "./commands/verifiablePresentationCreate.js";
import { buildCommandVerifiablePresentationVerify } from "./commands/verifiablePresentationVerify.js";
import { buildCommandVerificationMethodAdd } from "./commands/verificationMethodAdd.js";
import { buildCommandVerificationMethodRemove } from "./commands/verificationMethodRemove.js";

/**
 * The main entry point for the CLI.
 */
export class CLI extends CLIBase {
	/**
	 * Run the app.
	 * @param argv The process arguments.
	 * @param localesDirectory The directory for the locales, default to relative to the script.
	 * @param options Additional options for the CLI.
	 * @param options.overrideOutputWidth The override output width.
	 * @returns The exit code.
	 */
	public async run(
		argv: string[],
		localesDirectory?: string,
		options?: { overrideOutputWidth?: number }
	): Promise<number> {
		return this.execute(
			{
				title: "3Sixty Identity",
				appName: "3sixty-identity",
				version: "0.20.0-next.0", // x-release-please-version
				icon: "🌍",
				supportsEnvFiles: true,
				overrideOutputWidth: options?.overrideOutputWidth,
				showDevToolWarning: true
			},
			localesDirectory ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../locales"),
			argv
		);
	}

	/**
	 * Get the commands for the CLI.
	 * @param program The main program to add the commands to.
	 * @returns The list of commands.
	 * @internal
	 */
	protected getCommands(program: Command): Command[] {
		return [
			buildCommandMnemonic(),
			buildCommandAddress(),
			buildCommandFaucet(),
			buildCommandTransfer(),
			buildCommandIdentityCreate(),
			buildCommandIdentityResolve(),
			buildCommandVerificationMethodAdd(),
			buildCommandVerificationMethodRemove(),
			buildCommandServiceAdd(),
			buildCommandServiceRemove(),
			buildCommandAlsoKnownAsAdd(),
			buildCommandAlsoKnownAsRemove(),
			buildCommandVerifiableCredentialCreate(),
			buildCommandVerifiablePresentationCreate(),
			buildCommandVerifiablePresentationVerify(),
			buildCommandVerifiableCredentialVerify(),
			buildCommandVerifiableCredentialRevoke(),
			buildCommandVerifiableCredentialUnrevoke(),
			buildCommandProofCreate(),
			buildCommandProofVerify()
		];
	}
}
