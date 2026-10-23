// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@3sixty/core";
import type { IDidDocument } from "@3sixty/standards-w3c-did";

/**
 * Interface describing a contract which provides identity operations.
 */
export interface IIdentityResolverComponent extends IComponent {
	/**
	 * Resolve an identity.
	 * @param identity The id of the document to resolve.
	 * @returns The resolved document.
	 */
	identityResolve(identity: string): Promise<IDidDocument>;
}
