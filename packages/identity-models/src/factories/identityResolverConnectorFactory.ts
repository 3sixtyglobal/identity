// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Factory } from "@3sixty/core";
import type { IIdentityResolverConnector } from "../models/IIdentityResolverConnector.js";

/**
 * Factory for creating identity resolver connectors.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityResolverConnectorFactory = Factory.createFactory<IIdentityResolverConnector>(
	"identity-resolver-connector"
);
