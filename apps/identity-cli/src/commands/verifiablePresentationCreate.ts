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
import { Coerce, GeneralError, I18n, Is } from "@3sixty/core";
import { DocumentHelper } from "@3sixty/identity-models";
import type { IDidVerifiableCredential } from "@3sixty/standards-w3c-did";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import { setupWalletConnector } from "@3sixty/wallet-cli";
import { WalletConnectorFactory } from "@3sixty/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands.js";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes.js";

/**
 * Build the verifiable presentation create command for the CLI.
 * @returns The command.
 */
export function buildCommandVerifiablePresentationCreate(): Command {
	const command = new Command();
	command
		.name("verifiable-presentation-create")
		.summary(I18n.formatMessage("commands.verifiable-presentation-create.summary"))
		.description(I18n.formatMessage("commands.verifiable-presentation-create.description"))
		.requiredOption(
			I18n.formatMessage(
				"commands.verifiable-presentation-create.options.verification-method-id.param"
			),
			I18n.formatMessage(
				"commands.verifiable-presentation-create.options.verification-method-id.description"
			)
		)
		.requiredOption(
			I18n.formatMessage("commands.verifiable-presentation-create.options.private-key.param"),
			I18n.formatMessage("commands.verifiable-presentation-create.options.private-key.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-presentation-create.options.presentation-id.param"),
			I18n.formatMessage(
				"commands.verifiable-presentation-create.options.presentation-id.description"
			)
		)
		.option(
			I18n.formatMessage("commands.verifiable-presentation-create.options.jwt.param"),
			I18n.formatMessage("commands.verifiable-presentation-create.options.jwt.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-presentation-create.options.json-ld.param"),
			I18n.formatMessage("commands.verifiable-presentation-create.options.json-ld.description")
		)
		.option(
			I18n.formatMessage("commands.verifiable-presentation-create.options.expiration-date.param"),
			I18n.formatMessage(
				"commands.verifiable-presentation-create.options.expiration-date.description"
			)
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
		.action(actionCommandVerifiablePresentationCreate);

	return command;
}

/**
 * Action the verifiable presentation create command.
 * @param opts The options for the command.
 * @param opts.verificationMethodId The id of the verification method to use.
 * @param opts.privateKey The private key for the verification method.
 * @param opts.presentationId The optional id of the presentation.
 * @param opts.jwt Comma-separated JWT credential strings to include.
 * @param opts.jsonLd Comma-separated JSON-LD filenames to include.
 * @param opts.expirationDate The expiration date for the presentation.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network name.
 */
export async function actionCommandVerifiablePresentationCreate(
	opts: {
		verificationMethodId: string;
		privateKey: string;
		presentationId?: string;
		jwt?: string;
		jsonLd?: string;
		expirationDate?: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
	} & CliOutputOptions
): Promise<void> {
	const verificationMethodId: string = CLIParam.stringValue(
		"verification-method-id",
		opts.verificationMethodId
	);
	const privateKey: Uint8Array = CLIParam.hexBase64("private-key", opts.privateKey);
	const presentationId: string | undefined = Is.stringValue(opts.presentationId)
		? CLIParam.stringValue("presentation-id", opts.presentationId)
		: undefined;
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;

	const jwtCredentials = (opts.jwt ?? "")
		.split(",")
		.map(j => j.trim())
		.filter(Boolean);
	const jsonLdFilenames = (opts.jsonLd ?? "")
		.split(",")
		.map(f => f.trim())
		.filter(Boolean);

	if (jwtCredentials.length === 0 && jsonLdFilenames.length === 0) {
		throw new GeneralError(
			"commands",
			"commands.verifiable-presentation-create.noCredentialsProvided"
		);
	}

	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-presentation-create.labels.verificationMethodId"),
		verificationMethodId
	);
	if (Is.stringValue(presentationId)) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-create.labels.presentationId"),
			presentationId
		);
	}
	if (jwtCredentials.length > 0) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-create.labels.jwt"),
			jwtCredentials.join(", ")
		);
	}
	if (jsonLdFilenames.length > 0) {
		CLIDisplay.value(
			I18n.formatMessage("commands.verifiable-presentation-create.labels.jsonLd"),
			jsonLdFilenames.join(", ")
		);
	}
	CLIDisplay.value(
		I18n.formatMessage("commands.verifiable-presentation-create.labels.expirationDate"),
		opts.expirationDate
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.break();

	setupVault();

	const vmParts = DocumentHelper.parseId(verificationMethodId);

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.addKey(
		`${vmParts.id}/${vmParts.fragment}`,
		VaultKeyType.Ed25519,
		privateKey,
		new Uint8Array()
	);

	const walletConnector = setupWalletConnector({ nodeEndpoint, network }, opts.connector);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector({ nodeEndpoint, network }, opts.connector);

	CLIDisplay.task(
		I18n.formatMessage("commands.verifiable-presentation-create.progress.loadingCredentialData")
	);
	CLIDisplay.break();

	const verifiableCredentials: (string | IDidVerifiableCredential)[] = [...jwtCredentials];

	for (const filename of jsonLdFilenames) {
		const resolvedPath = path.resolve(filename);
		const jsonData = await CLIUtils.readJsonFile<IDidVerifiableCredential>(resolvedPath);
		if (Is.undefined(jsonData)) {
			throw new GeneralError(
				"commands",
				"commands.verifiable-presentation-create.jsonLdFileNotFound"
			);
		}
		verifiableCredentials.push(jsonData);
	}

	CLIDisplay.task(
		I18n.formatMessage(
			"commands.verifiable-presentation-create.progress.creatingVerifiablePresentation"
		)
	);
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	const verifiablePresentation = await identityConnector.createVerifiablePresentation(
		vmParts.id,
		verificationMethodId,
		presentationId,
		undefined,
		undefined,
		verifiableCredentials,
		{
			expirationDate: Coerce.dateTime(opts.expirationDate)
		}
	);

	CLIDisplay.spinnerStop();

	if (opts.console) {
		CLIDisplay.section(
			I18n.formatMessage("commands.verifiable-presentation-create.labels.verifiablePresentation")
		);
		CLIDisplay.write(verifiablePresentation.jwt);
		CLIDisplay.break();
		CLIDisplay.break();
	}

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(
			opts.json,
			{
				verifiablePresentationJwt: verifiablePresentation.jwt,
				verifiablePresentation: verifiablePresentation.verifiablePresentation
			},
			opts.mergeJson
		);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[`DID_VERIFIABLE_PRESENTATION_JWT="${verifiablePresentation.jwt}"`],
			opts.mergeEnv
		);
	}

	CLIDisplay.done();
}
