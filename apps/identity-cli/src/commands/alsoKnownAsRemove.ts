// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	CLIDisplay,
	CLIOptions,
	CLIParam,
	CLIUtils,
	type CliOutputOptions
} from "@3sixty/cli-core";
import { ArrayHelper, Converter, I18n, Is, StringHelper, Urn } from "@3sixty/core";
import { DocumentHelper } from "@3sixty/identity-models";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { setupWalletConnector } from "@3sixty/wallet-cli";
import { WalletConnectorFactory } from "@3sixty/wallet-models";
import { Command, Option } from "commander";
import {
	setupIdentityConnector,
	setupIdentityResolverConnector,
	setupVault
} from "./setupCommands.js";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes.js";

/**
 * Build the alsoKnownAs remove command for the CLI.
 * @returns The command.
 */
export function buildCommandAlsoKnownAsRemove(): Command {
	const command = new Command();
	command
		.name("also-known-as-remove")
		.summary(I18n.formatMessage("commands.also-known-as-remove.summary"))
		.description(I18n.formatMessage("commands.also-known-as-remove.description"))
		.requiredOption(
			I18n.formatMessage("commands.also-known-as-remove.options.seed.param"),
			I18n.formatMessage("commands.also-known-as-remove.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.also-known-as-remove.options.did.param"),
			I18n.formatMessage("commands.also-known-as-remove.options.did.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.also-known-as-remove.options.alias.param"),
			I18n.formatMessage("commands.also-known-as-remove.options.alias.description")
		)
		.option(
			I18n.formatMessage("commands.also-known-as-remove.options.addressIndex.param"),
			I18n.formatMessage("commands.also-known-as-remove.options.addressIndex.description"),
			"0"
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
		.option(
			I18n.formatMessage("commands.common.options.explorer.param"),
			I18n.formatMessage("commands.common.options.explorer.description"),
			"!EXPLORER_URL"
		)
		.action(actionCommandAlsoKnownAsRemove);

	return command;
}

/**
 * Action the alsoKnownAs remove command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.did The identity of the document to remove from.
 * @param opts.alias The alsoKnownAs value to remove.
 * @param opts.addressIndex The address index to use for key derivation (if applicable).
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for connector.
 * @param opts.explorer The explorer URL.
 */
export async function actionCommandAlsoKnownAsRemove(
	opts: {
		seed: string;
		did: string;
		alias: string;
		addressIndex?: string;
		connector?: IdentityConnectorTypes;
		node: string;
		network?: string;
		explorer: string;
	} & CliOutputOptions
): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const did: string = CLIParam.stringValue("did", opts.did);
	const alias: string = CLIParam.stringValue("alias", opts.alias);
	const addressIndex: number = CLIParam.integer("addressIndex", opts.addressIndex ?? "0", false, 0);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.common.labels.did"), did);
	CLIDisplay.value(I18n.formatMessage("commands.also-known-as-remove.labels.alias"), alias);
	CLIDisplay.value(
		I18n.formatMessage("commands.also-known-as-remove.labels.addressIndex"),
		addressIndex
	);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const vaultSeedId = "local-seed";
	const vmParts = DocumentHelper.parseId(did);

	const vaultConnector = VaultConnectorFactory.get("vault");
	await vaultConnector.setSecret(`${vmParts.id}/${vaultSeedId}`, Converter.bytesToBase64(seed));

	const walletConnector = setupWalletConnector(
		{ nodeEndpoint, vaultSeedId, network },
		opts.connector
	);
	WalletConnectorFactory.register("wallet", () => walletConnector);

	const identityConnector = setupIdentityConnector(
		{ nodeEndpoint, network, addressIndex, vaultSeedId },
		opts.connector
	);

	CLIDisplay.task(I18n.formatMessage("commands.also-known-as-remove.progress.removingAlsoKnownAs"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await identityConnector.removeAlsoKnownAs(vmParts.id, did, alias);

	const identityResolverConnector = setupIdentityResolverConnector(
		{ nodeEndpoint, network },
		opts.connector
	);

	// Retrieve the updated DID document to get the full alsoKnownAs array
	const didDocument = await identityResolverConnector.resolveDocument(did);
	const alsoKnownAs = ArrayHelper.fromObjectOrArray(didDocument.alsoKnownAs) ?? [];

	CLIDisplay.spinnerStop();

	if (Is.stringValue(opts?.json)) {
		await CLIUtils.writeJsonFile(opts.json, { alsoKnownAs }, opts.mergeJson);
	}
	if (Is.stringValue(opts?.env)) {
		await CLIUtils.writeEnvFile(
			opts.env,
			[`DID_ALSO_KNOWN_AS="${alsoKnownAs.join(",")}"`],
			opts.mergeEnv
		);
	}

	if (opts.connector === IdentityConnectorTypes.Iota) {
		const didUrn = Urn.fromValidString(did);
		const didParts = didUrn.parts();
		const objectId = didParts[didParts.length - 1];
		CLIDisplay.value(
			I18n.formatMessage("commands.common.labels.explore"),
			`${StringHelper.trimTrailingSlashes(explorerEndpoint)}/object/${objectId}?network=${network}`
		);
	}

	CLIDisplay.break();

	CLIDisplay.done();
}
