// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the Identity Profile Service.
 */
export interface IIdentityProfileServiceConfig {
	/**
	 * The public and private profile properties which can only be added, changed or removed by callers with an admin scope.
	 * @default []
	 */
	selfUpdateDeniedProperties?: string[];

	/**
	 * The scopes which allow the denied properties to be modified, any one is sufficient.
	 * @default ["user-admin", "global-admin"]
	 */
	adminScopes?: string[];
}
