// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the Identity Profile Service.
 */
export interface IIdentityProfileServiceConfig {
	/**
	 * The public and private profile properties which can only be added, changed or removed by callers with escalated privilege or permitted to execute the admin update operation.
	 * @default []
	 */
	selfUpdateDeniedProperties?: string[];

	/**
	 * The role that grants escalated privilege, callers holding it can always modify the denied properties.
	 * @default global-admin
	 */
	escalatedPrivilegeRole?: string;

	/**
	 * The authorization model ID used to check permissions.
	 * @default system
	 */
	authorizationModelId?: string;
}
