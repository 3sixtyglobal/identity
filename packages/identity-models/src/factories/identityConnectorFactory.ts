// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@3sixty/core";
import type { IIdentityConnector } from "../models/IIdentityConnector.js";

/**
 * Factory for creating identity connectors.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityConnectorFactory =
	Factory.createFactory<IIdentityConnector>("identity-connector");
