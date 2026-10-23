// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DidContexts, type IDidVerifiableCredential } from "@3sixty/standards-w3c-did";
import { VerificationHelper } from "../../src/utils/verificationHelper.js";

describe("VerificationHelper", () => {
	describe("checkValidityPeriod", () => {
		test("Can succeed when the credential has no validity dates", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv1,
				type: "VerifiableCredential"
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).not.toThrow();
		});

		test("Can succeed when the v1 credential is within its validity period", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv1,
				type: "VerifiableCredential",
				issuanceDate: new Date(Date.now() - 60000).toISOString(),
				expirationDate: new Date(Date.now() + 60000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).not.toThrow();
		});

		test("Can succeed when the v2 credential is within its validity period", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv2,
				type: "VerifiableCredential",
				validFrom: new Date(Date.now() - 60000).toISOString(),
				validUntil: new Date(Date.now() + 60000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).not.toThrow();
		});

		test("Can fail when the v1 credential has expired", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv1,
				type: "VerifiableCredential",
				issuanceDate: new Date(Date.now() - 120000).toISOString(),
				expirationDate: new Date(Date.now() - 60000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialExpired"
			);
		});

		test("Can fail when the v2 credential has expired", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv2,
				type: "VerifiableCredential",
				validFrom: new Date(Date.now() - 120000).toISOString(),
				validUntil: new Date(Date.now() - 60000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialExpired"
			);
		});

		test("Can fail when the v1 credential is not yet valid", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv1,
				type: "VerifiableCredential",
				issuanceDate: new Date(Date.now() + 60000).toISOString(),
				expirationDate: new Date(Date.now() + 120000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialNotYetValid"
			);
		});

		test("Can fail when the v2 credential is not yet valid", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv2,
				type: "VerifiableCredential",
				validFrom: new Date(Date.now() + 60000).toISOString(),
				validUntil: new Date(Date.now() + 120000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialNotYetValid"
			);
		});

		test("Can fail when the not before date is malformed", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv1,
				type: "VerifiableCredential",
				issuanceDate: "not-a-date",
				expirationDate: new Date(Date.now() + 60000).toISOString()
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialValidityDateInvalid"
			);
		});

		test("Can fail when the not after date is malformed", () => {
			const credential: IDidVerifiableCredential = {
				"@context": DidContexts.ContextVCv2,
				type: "VerifiableCredential",
				validFrom: new Date(Date.now() - 60000).toISOString(),
				validUntil: "2030-13-45T99:99:99Z"
			};

			expect(() => VerificationHelper.checkValidityPeriod(credential)).toThrowError(
				"verificationHelper.credentialValidityDateInvalid"
			);
		});
	});
});
