// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@3sixty/entity";
import type { IDidDocument } from "@3sixty/standards-w3c-did";

/**
 * Class describing the identity document, version 0. Covers every row written before the
 * version record existed, without the created and modified dates.
 */
@entity({ version: 0 })
export class IdentityDocumentV0 {
	/**
	 * The identity of the document.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The DID document.
	 */
	@property({ type: "object" })
	public document!: IDidDocument;

	/**
	 * The signature of the document.
	 */
	@property({ type: "string" })
	public signature!: string;

	/**
	 * The controller of the document.
	 */
	@property({ type: "string" })
	public controller!: string;
}
