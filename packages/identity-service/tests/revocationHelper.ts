// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { Compression, CompressionType, Converter, Is } from "@3sixty/core";
import type { IDidDocument } from "@3sixty/standards-w3c-did";

export const REVOCATION_ENDPOINT_MATCHER = expect.stringMatching(
	/^data:application\/octet-stream;base64,/
);

/**
 * Assert the revocation service holds an empty bitstring, gzip bytes differ between runtimes so are decompressed.
 * @param document The document to check.
 */
export async function expectEmptyRevocationList(document: IDidDocument): Promise<void> {
	const serviceEndpoint = document.service?.[0]?.serviceEndpoint;
	expect(Is.string(serviceEndpoint)).toEqual(true);

	const parts = (serviceEndpoint as string).split(",");
	const bits = await Compression.decompress(
		Converter.base64UrlToBytes(parts[1]),
		CompressionType.Gzip
	);
	expect(bits).toEqual(new Uint8Array(16384));
}
