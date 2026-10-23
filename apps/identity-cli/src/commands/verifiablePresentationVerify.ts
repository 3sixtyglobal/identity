// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@3sixty/cli-core";
import { GeneralError, I18n, Is } from "@3sixty/core";
import type { IDidVerifiablePresentation } from "@3sixty/standards-w3c-did";
import { setupWalletConnector } from "@3sixty/wallet-cli";
import { WalletConnectorFactory } from "@3sixty/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands.js";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes.js";

/**
 * Build the verifiable presentation verify command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiablePresentationVerify(): Command {
	const command = new Command();
	command
		.name("verifiable-presentation-verify")
		.summary(I18n.formatMessage("commands.verifiable-presentation-verify.summary"))
		.description(I18n.formatMessage("commands.verifiable-presentation-verify.description"))
		.option(
			I18n.formatMessage("commands.verifiable-presentation-verify.options.jwt.param"),
			I18n.formatMessage("commands.verifiable-presentation-verify.options.jwt.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-presentation-verify.options.json-ld.param"),
			I18n.formatMessage("commands.verifiable-presentation-verify.options.json-ld.description")
		);
	CLIOptions.output(command, {
		noConsole: true,
		json: true,
		env: true,
		mergeJson: true,
		mergeEnv: true
	});

	command
		.addOption(
			new Option(
				I18n.formatMessage("commands.common.options.connector.param"),
				I18n.formatMessage("commands.common.options.connector.description")
			)
				.choices(Object.values(IdentityConnectorTypes))
				.default(IdentityConnectorTypes.Iota)
		)
		.option(
			I18n.formatMessage("commands.common.options.node.param"),
			I18n.formatMessage("commands.common.options.node.description"),
			"!NODE_URL"
		)
		.option(
			I18n.formatMessage("commands.common.options.network.param"),
			I18n.formatMessage("commands.common.options.network.description"),
			"!NETWORK"
		)
		.action(actionCommandVerifiablePresentationVerify);

	return command;
}

/**
 * Action the verifiable presentation verify command.
 * @param opts The options for the command.
 * @param opts.jwt The JSON web token for the verifiable presentation.
 * @param opts.jsonLd The filename of a JSON-LD verifiable presentation to verify.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network name.
 */
export async function actionCommandVerifiablePresentationVerify(
	opts: {
		jwt?: string;
		jsonLd?: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	let presentation: string | IDidVerifiablePresentation;

	if (Is.stringValue(opts.jwt)) {
		const jwt = CLIParam.stringValue("jwt", opts.jwt);
		CLIDisplay.value(I18n.formatMessage("commands.verifiable-presentation-verify.labels.jwt"), jwt);
		presentation = jwt;
	} else if (Is.stringValue(opts.jsonLd)) {
		const jsonLdPath = path.resolve(CLIParam.stringValue("json-ld", opts.jsonLd));
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-verify.labels.jsonLd"),
			jsonLdPath
		);
		const jsonData = await CLIUtils.readJsonFile<IDidVerifiablePresentation>(jsonLdPath);
		if (Is.undefined(jsonData)) {
			throw new GeneralError(
				"commands",
				"commands.verifiable-presentation-verify.jsonLdFileNotFound"
			);
		}
		presentation = jsonData;
	} else {
		throw new GeneralError(
			"commands",
			"commands.verifiable-presentation-verify.noPresentationProvided"
		);
	}

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.break();

	setupVault();

	const walletConnector = setupWalletConnector({ nodeEndpoint, network }, opts.connector);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector({ nodeEndpoint, network }, opts.connector);

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-presentation-verify.progress.verifyingPresentation")
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verification = await identityConnector.checkVerifiablePresentation(presentation);

	const isVerified = Is.notEmpty(verification.verifiablePresentation);
	const isRevoked = verification.revoked;

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-verify.labels.isVerified"),
			isVerified
		);
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-verify.labels.isRevoked"),
			isRevoked
		);
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{
				isVerified,
				isRevoked,
				verifiablePresentation: verification.verifiablePresentation
			},
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[
				`DID_VERIFIABLE_PRESENTATION_VERIFIED="${isVerified}"`,
				`DID_VERIFIABLE_PRESENTATION_REVOKED="${isRevoked}"`
			],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}
