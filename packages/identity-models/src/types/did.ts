// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError, Urn } from "@3sixty/core";
import { nameof } from "@3sixty/nameof";

/**
 * Helper methods for parsing and validating DID identifiers.
 */
export class Did {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<Did>();

	/**
	 * Parse an id into its constituent parts.
	 * @param id The id to parse.
	 * @returns The parsed id.
	 * @throws GeneralError if the id is not valid.
	 */
	public static parse(id: string): {
		method: string;
		network?: string | undefined;
		id: string;
	} {
		Did.guard(Did.CLASS_NAME, nameof(id), id);

		const didUrn = Urn.fromValidString(id);
		const didParts = didUrn.parts();

		if (didParts.length === 3) {
			return {
				method: didParts[1],
				id: didParts[2]
			};
		}
		return {
			method: didParts[1],
			network: didParts[2],
			id: didParts[didParts.length - 1]
		};
	}

	/**
	 * Guard a string as a DID.
	 * @param source The source of the error.
	 * @param property The name of the property.
	 * @param value The value to assert as a valid DID.
	 * @throws GuardError If the value does not match the assertion.
	 */
	public static guard(source: string, property: string, value: unknown): asserts value is string {
		Urn.guard(Did.CLASS_NAME, nameof(value), value);
		const urn = Urn.fromValidString(value);
		const parts = urn.parts();

		if (parts.length < 3) {
			throw new GuardError(Did.CLASS_NAME, "guard.didPartsTooFew", nameof(value), value);
		}

		if (parts[0] !== "did") {
			throw new GuardError(Did.CLASS_NAME, "guard.didInvalidStart", nameof(value), value);
		}
	}
}
