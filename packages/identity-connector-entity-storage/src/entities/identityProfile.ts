// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@3sixty/entity";

/**
 * Class representing profile details for the identity.
 */
@entity({ version: 1 })
export class IdentityProfile {
	/**
	 * The id for the identity.
	 */
	@property({ type: "string", isPrimary: true, maxLength: 255 })
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

	/**
	 * The date the profile was created, undefined for profiles stored before it was captured.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public dateCreated?: string;

	/**
	 * The date the profile was last modified.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public dateModified?: string;
}
