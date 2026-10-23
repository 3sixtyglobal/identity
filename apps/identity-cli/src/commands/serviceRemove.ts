// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay, CLIOptions, CLIParam } from "@3sixty/cli-core";
import { Converter, I18n, Is, StringHelper, Urn } from "@3sixty/core";
import { DocumentHelper } from "@3sixty/identity-models";
import { VaultConnectorFactory } from "@3sixty/vault-models";
import { setupWalletConnector } from "@3sixty/wallet-cli";
import { WalletConnectorFactory } from "@3sixty/wallet-models";
import { Command, Option } from "commander";
import { setupIdentityConnector, setupVault } from "./setupCommands.js";
import { IdentityConnectorTypes } from "../models/identityConnectorTypes.js";

/**
 * Build the service remove command for the CLI.
 * @returns The command.
 */
export function buildCommandServiceRemove(): Command {
	const command = new Command();
	command
		.name("service-remove")
		.summary(I18n.formatMessage("commands.service-remove.summary"))
		.description(I18n.formatMessage("commands.service-remove.description"))
		.requiredOption(
			I18n.formatMessage("commands.service-remove.options.seed.param"),
			I18n.formatMessage("commands.service-remove.options.seed.description")
		)
		.requiredOption(
			I18n.formatMessage("commands.service-remove.options.id.param"),
			I18n.formatMessage("commands.service-remove.options.id.description")
		)
		.option(
			I18n.formatMessage("commands.service-remove.options.addressIndex.param"),
			I18n.formatMessage("commands.service-remove.options.addressIndex.description"),
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
		.action(actionCommandServiceRemove);

	return command;
}

/**
 * Action the service remove command.
 * @param opts The options for the command.
 * @param opts.seed The private key for the controller.
 * @param opts.id The id of the service to remove.
 * @param opts.connector The connector to perform the operations with.
 * @param opts.node The node URL.
 * @param opts.network The network to use for connector.
 * @param opts.explorer The explorer URL.
 * @param opts.addressIndex The address index to use for key derivation (if applicable).
 */
export async function actionCommandServiceRemove(opts: {
	seed: string;
	id: string;
	addressIndex?: string;
	connector?: IdentityConnectorTypes;
	node: string;
	network?: string;
	explorer: string;
}): Promise<void> {
	const seed: Uint8Array = CLIParam.hexBase64("seed", opts.seed);
	const id: string = CLIParam.stringValue("id", opts.id);
	const addressIndex: number = CLIParam.integer("addressIndex", opts.addressIndex ?? "0", false, 0);
	const nodeEndpoint: string = CLIParam.url("node", opts.node);
	const network: string | undefined =
		opts.connector === IdentityConnectorTypes.Iota
			? CLIParam.stringValue("network", opts.network)
			: undefined;
	const explorerEndpoint: string = CLIParam.url("explorer", opts.explorer);

	CLIDisplay.value(I18n.formatMessage("commands.service-remove.labels.serviceId"), id);
	CLIDisplay.value(I18n.formatMessage("commands.service-remove.labels.addressIndex"), addressIndex);
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.node"), nodeEndpoint);
	if (Is.stringValue(network)) {
		CLIDisplay.value(I18n.formatMessage("commands.common.labels.network"), network);
	}
	CLIDisplay.value(I18n.formatMessage("commands.common.labels.explorer"), explorerEndpoint);
	CLIDisplay.break();

	setupVault();

	const vaultSeedId = "local-seed";
	const vmParts = DocumentHelper.parseId(id);

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

	CLIDisplay.task(I18n.formatMessage("commands.service-remove.progress.removingService"));
	CLIDisplay.break();

	CLIDisplay.spinnerStart();

	await identityConnector.removeService(vmParts.id, id);

	CLIDisplay.spinnerStop();

	const did = DocumentHelper.parseId(id).id;
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
