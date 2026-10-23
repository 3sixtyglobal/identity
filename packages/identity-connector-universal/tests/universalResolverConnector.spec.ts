// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthStatus } from "@3sixty/api-models";
import { UniversalResolverConnector } from "../src/universalResolverConnector.js";

describe("UniversalResolverConnector", () => {
	test("can get health status", async () => {
		const resolver = new UniversalResolverConnector({
			config: { endpoint: "http://localhost:18180" }
		});

		const health = await resolver.health();

		expect(health).toBeDefined();
		expect(health.length).toBeGreaterThan(0);
		expect(health[0].source).toEqual(UniversalResolverConnector.CLASS_NAME);
		expect(health[0].status).toEqual(HealthStatus.Ok);
	});

	test("can get health status error when resolver is unreachable", async () => {
		const resolver = new UniversalResolverConnector({
			config: { endpoint: "http://localhost:1" }
		});

		const health = await resolver.health();

		expect(health).toBeDefined();
		expect(health.length).toBeGreaterThan(0);
		expect(health[0].source).toEqual(UniversalResolverConnector.CLASS_NAME);
		expect(health[0].status).toEqual(HealthStatus.Error);
	});

	test("can construct and resolve an identity", async () => {
		const resolver = new UniversalResolverConnector({
			config: { endpoint: "http://localhost:18180" }
		});

		// We will need to create an identity to check for once the iota connector is ready
		const document = await resolver.resolveDocument(
			"did:iota:testnet:0xd5bca38bae48da76a364b1f17e0c5ccafdb3be33f94860fff2883fe56b3eb583"
		);
		expect(document.id).toEqual(
			"did:iota:testnet:0xd5bca38bae48da76a364b1f17e0c5ccafdb3be33f94860fff2883fe56b3eb583"
		);
	});
});
