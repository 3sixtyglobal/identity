// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property } from "@3sixty/entity";
import type { IDidDocument } from "@3sixty/standards-w3c-did";

/**
 * Class describing the identity document.
 */
@entity({ version: 1 })
export class IdentityDocument {
	/**
	 * The identity of the document.
	 */
	@property({ type: "string", isPrimary: true, maxLength: 255 })
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
	@property({ type: "string", maxLength: 255 })
	public controller!: string;

	/**
	 * The date the document was created, undefined for documents stored before it was captured.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public dateCreated?: string;

	/**
	 * The date the document was last modified.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public dateModified?: string;
}
