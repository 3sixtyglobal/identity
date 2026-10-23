// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IContextIdHandler } from "@3sixty/context";
import { Converter, Is, HexHelper } from "@3sixty/core";
import { nameof } from "@3sixty/nameof";
import { Did } from "../types/did.js";

/**
 * Context ID handler that treats context identifiers as DIDs.
 */
export class DidContextIdHandler implements IContextIdHandler {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<DidContextIdHandler>();

	/**
	 * The class name of the component.
	 * @returns The class name.
	 */
	public className(): string {
		return DidContextIdHandler.CLASS_NAME;
	}

	/**
	 * Get the short form of the DID which is the last part.
	 * @param value The full context id value.
	 * @returns Short form string.
	 */
	public short(value: string): string {
		const parts = Did.parse(value);
		// If the ID part is hex, convert to base64 for a shorter representation.
		if (HexHelper.hasPrefix(parts.id) && HexHelper.isHex(parts.id, true)) {
			const bytes = Converter.hexToBytes(parts.id);
			return Converter.bytesToBase64Url(bytes);
		}
		return parts.id;
	}

	/**
	 * The long form version of the context ID, expanded from a short version.
	 * @param value The short form context ID value.
	 * @returns The long form version of the context ID.
	 */
	public long(value: string): string {
		if (Is.stringBase64Url(value)) {
			const bytes = Converter.base64UrlToBytes(value);
			const hex = Converter.bytesToHex(bytes, true);
			return `did:internal:${hex}`;
		}
		return value;
	}

	/**
	 * Guard the value ensuring it is a valid DID.
	 * @param value The value to guard.
	 * @throws GeneralError if the value is not a valid DID.
	 */
	public guard(value: string): void {
		Did.guard(DidContextIdHandler.CLASS_NAME, nameof(value), value);
	}
}
