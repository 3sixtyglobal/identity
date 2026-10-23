// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@3sixty/entity";

/**
 * Class representing profile details for the identity, version 0. Covers every row written
 * before the version record existed, without the created and modified dates.
 */
@entity({ version: 0 })
export class IdentityProfileV0 {
	/**
	 * The id for the identity.
	 */
	@property({ type: "string", isPrimary: true })
	public identity!: string;

	/**
	 * The public profile data.
	 */
	@property({ type: "object", optional: true })
	public publicProfile?: unknown;

	/**
	 * The private profile data.
	 */
	@property({ type: "object", optional: true })
	public privateProfile?: unknown;
}
