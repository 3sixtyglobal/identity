// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, Is, UnprocessableError } from "@3sixty/core";
import { nameof } from "@3sixty/nameof";
import {
	DidVerificationMethodType,
	type IDidDocument,
	type IDidDocumentVerificationMethod
} from "@3sixty/standards-w3c-did";
import { DocumentHelper } from "./documentHelper.js";
import { IdentityExportKeyType } from "../models/identityExportKeyType.js";
import type { IIdentityExport } from "../models/IIdentityExport.js";
import type { IIdentityExportKey } from "../models/IIdentityExportKey.js";
import { Did } from "../types/did.js";

/**
 * Helper methods for validating identity exports.
 * Errors never carry key material, only the key id.
 */
export class IdentityExportHelper {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<IdentityExportHelper>();

	/**
	 * The current version of the export format.
	 */
	public static readonly VERSION: number = 1;

	/**
	 * The maximum number of keys in an export.
	 */
	public static readonly MAX_KEYS: number = 64;

	/**
	 * The maximum size of the serialised document in an export, in bytes.
	 */
	public static readonly MAX_DOCUMENT_SIZE: number = 65536;

	/**
	 * The format of a key id or verification method fragment, which form part of a vault key name.
	 * It must start and end with a letter or digit, so it can never be a relative path segment such
	 * as "..", or collapse onto another name in a vault which replaces or trims punctuation.
	 */
	public static readonly FRAGMENT_PATTERN: RegExp = /^[\dA-Za-z](?:[\w.~-]*[\dA-Za-z])?$/;

	/**
	 * The fragments reserved for the wallet account keys held under the same DID, which a vault that
	 * replaces punctuation would map "account_0_0_0" onto.
	 */
	public static readonly RESERVED_FRAGMENT_PATTERN: RegExp = /^account(?:[._~]|$)/;

	/**
	 * Validate the structure of an export for a namespace, without checking the key material.
	 * @param exported The export to validate.
	 * @param namespace The namespace the importing connector supports.
	 * @param didPattern The exact format of the DIDs the importing connector creates.
	 * @returns The DID of the exported identity.
	 * @throws UnprocessableError if the export is malformed, the version is unsupported or the namespace does not match.
	 */
	public static validate(
		exported: IIdentityExport,
		namespace: string,
		didPattern?: RegExp
	): string {
		if (!Is.object<IIdentityExport>(exported)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidExport");
		}

		if (exported.version !== IdentityExportHelper.VERSION) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "unsupportedVersion", {
				version: Is.number(exported.version) ? exported.version : undefined,
				supportedVersion: IdentityExportHelper.VERSION
			});
		}

		if (exported.namespace !== namespace) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "namespaceMismatch", {
				namespace
			});
		}

		if (!Is.boolean(exported.selfControlled)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidExport");
		}

		if (!Is.object<IDidDocument>(exported.document) || !Is.stringValue(exported.document.id)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidDocument");
		}

		const did = exported.document.id;
		Did.guard(IdentityExportHelper.CLASS_NAME, nameof(did), did);
		if (Did.parse(did).method !== namespace || DocumentHelper.parseId(did).id !== did) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "didNamespaceMismatch", {
				did,
				namespace
			});
		}
		if (!Is.undefined(didPattern) && !didPattern.test(did)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidDidFormat", {
				did,
				namespace
			});
		}

		if (
			Converter.utf8ToBytes(JSON.stringify(exported.document)).length >
			IdentityExportHelper.MAX_DOCUMENT_SIZE
		) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "documentTooLarge", {
				maxSize: IdentityExportHelper.MAX_DOCUMENT_SIZE
			});
		}
		IdentityExportHelper.validateMethodIds(exported.document);

		if (!Is.array<IIdentityExportKey>(exported.keys)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidExport");
		}
		if (exported.keys.length > IdentityExportHelper.MAX_KEYS) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "tooManyKeys", {
				maxKeys: IdentityExportHelper.MAX_KEYS
			});
		}

		const keyIds = new Set<string>();
		for (const key of exported.keys) {
			IdentityExportHelper.validateKey(key, keyIds);
		}

		if (!Is.undefined(exported.account)) {
			if (
				!Is.object(exported.account) ||
				!Is.stringValue(exported.account.mnemonic) ||
				(!Is.undefined(exported.account.seed) && !Is.stringBase64(exported.account.seed))
			) {
				throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidAccount");
			}
		}

		return did;
	}

	/**
	 * Check every key matches the public key of the verification method with the same fragment.
	 * @param document The authoritative DID document.
	 * @param keys The keys to check.
	 * @throws UnprocessableError if a key has no verification method or its public key does not match.
	 */
	public static verifyMethodKeys(document: IDidDocument, keys: IIdentityExportKey[]): void {
		const methods = IdentityExportHelper.getMethods(document);

		for (const key of keys) {
			const methodId = DocumentHelper.joinId(document.id, key.id);
			const method = methods.find(m => m.id === methodId);
			if (Is.undefined(method)) {
				throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "methodNotFound", {
					keyId: key.id
				});
			}

			const jwk = method.publicKeyJwk;
			if (
				!Is.object(jwk) ||
				jwk.kty !== "OKP" ||
				jwk.crv !== "Ed25519" ||
				!Is.stringValue(jwk.x) ||
				jwk.x !== Converter.bytesToBase64Url(Converter.base64ToBytes(key.publicKey))
			) {
				throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "methodKeyMismatch", {
					keyId: key.id
				});
			}
		}
	}

	/**
	 * Check every verification method id in a document has a fragment which can form part of a
	 * vault key name, whichever DID the method belongs to. Used on export as well as import, so a
	 * document which could not be imported fails when it is exported.
	 * @param document The DID document.
	 * @throws UnprocessableError if a verification method id is missing or has an invalid fragment.
	 */
	public static validateMethodIds(document: IDidDocument): void {
		for (const methodType of Object.values(DidVerificationMethodType)) {
			const methods = document[methodType] ?? [];
			if (!Is.array(methods)) {
				throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidDocument");
			}
			for (const method of methods) {
				const methodId = Is.object<IDidDocumentVerificationMethod>(method) ? method.id : method;
				if (!Is.stringValue(methodId)) {
					throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidDocument");
				}
				const fragment = DocumentHelper.parseId(methodId).fragment;
				if (Is.stringValue(fragment) && !IdentityExportHelper.isValidFragment(fragment)) {
					throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidMethodId", {
						methodId
					});
				}
			}
		}
	}

	/**
	 * Check there is a key for every verification method which belongs to the document.
	 * @param document The DID document.
	 * @param keyIds The ids of the keys available for the document.
	 * @throws UnprocessableError if a verification method has no key.
	 */
	public static requireMethodKeys(document: IDidDocument, keyIds: string[]): void {
		for (const fragment of IdentityExportHelper.getMethodFragments(document)) {
			if (!keyIds.includes(fragment)) {
				throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "methodKeyMissing", {
					keyId: fragment
				});
			}
		}
	}

	/**
	 * Get the fragments of all the verification methods which belong to the document.
	 * @param document The DID document.
	 * @returns The unique fragments.
	 */
	public static getMethodFragments(document: IDidDocument): string[] {
		const fragments = new Set<string>();
		for (const methodType of Object.values(DidVerificationMethodType)) {
			const methods = document[methodType];
			if (Is.arrayValue(methods)) {
				for (const method of methods) {
					const idParts = DocumentHelper.parseId(Is.string(method) ? method : method.id);
					if (idParts.id === document.id && Is.stringValue(idParts.fragment)) {
						fragments.add(idParts.fragment);
					}
				}
			}
		}
		return [...fragments];
	}

	/**
	 * Validate the structure of a single key.
	 * @param key The key to validate.
	 * @param keyIds The ids of the keys already seen, to detect duplicates.
	 * @throws UnprocessableError if the key is malformed.
	 * @internal
	 */
	private static validateKey(key: IIdentityExportKey, keyIds: Set<string>): void {
		if (
			!Is.object<IIdentityExportKey>(key) ||
			!Is.stringValue(key.id) ||
			!IdentityExportHelper.isValidFragment(key.id) ||
			keyIds.has(key.id)
		) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidKey", {
				keyId: Is.object<IIdentityExportKey>(key) && Is.string(key.id) ? key.id : undefined
			});
		}
		keyIds.add(key.id);

		if (!Object.values(IdentityExportKeyType).includes(key.type)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "unsupportedKeyType", {
				keyId: key.id
			});
		}

		if (!Is.stringBase64(key.privateKey) || !Is.stringBase64(key.publicKey)) {
			throw new UnprocessableError(IdentityExportHelper.CLASS_NAME, "invalidKey", {
				keyId: key.id
			});
		}
	}

	/**
	 * Check a key id or verification method fragment can safely form part of a vault key name.
	 * @param fragment The key id or fragment.
	 * @returns True if the fragment is valid and not reserved.
	 * @internal
	 */
	private static isValidFragment(fragment: string): boolean {
		return (
			IdentityExportHelper.FRAGMENT_PATTERN.test(fragment) &&
			!IdentityExportHelper.RESERVED_FRAGMENT_PATTERN.test(fragment)
		);
	}

	/**
	 * Get all the embedded verification methods from a document.
	 * @param document The DID document.
	 * @returns The embedded verification methods.
	 * @internal
	 */
	private static getMethods(document: IDidDocument): IDidDocumentVerificationMethod[] {
		const methods: IDidDocumentVerificationMethod[] = [];
		for (const methodType of Object.values(DidVerificationMethodType)) {
			const typeMethods = document[methodType];
			if (Is.arrayValue(typeMethods)) {
				for (const method of typeMethods) {
					if (Is.object<IDidDocumentVerificationMethod>(method)) {
						methods.push(method);
					}
				}
			}
		}
		return methods;
	}
}
