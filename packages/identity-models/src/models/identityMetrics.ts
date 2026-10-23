// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { type ITelemetryMetric, MetricType } from "@3sixty/telemetry-models";
import { IdentityMetricIds } from "./identityMetricIds.js";

/**
 * Metrics registered by the identity service.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const IdentityMetrics: ITelemetryMetric[] = [
	{
		id: IdentityMetricIds.DidsCreated,
		label: "DIDs created",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.DidsRemoved,
		label: "DIDs removed",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VcsCreated,
		label: "VCs created",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VcsVerified,
		label: "VC verifications succeeded",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VcsVerificationFailed,
		label: "VC verifications failed",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VcsRevoked,
		label: "VCs revoked",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VcsUnrevoked,
		label: "VCs unrevoked",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VpsCreated,
		label: "VPs created",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VpsVerified,
		label: "VP verifications succeeded",
		type: MetricType.Counter
	},
	{
		id: IdentityMetricIds.VpsVerificationFailed,
		label: "VP verifications failed",
		type: MetricType.Counter
	}
];
