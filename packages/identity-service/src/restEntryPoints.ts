// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@3sixty/api-models";
import { generateRestRoutesIdentityProfile, tagsIdentityProfile } from "./identityProfileRoutes.js";
import {
	generateRestRoutesIdentityResolver,
	tagsIdentityResolver
} from "./identityResolverRoutes.js";
import { generateRestRoutesIdentity, tagsIdentity } from "./identityRoutes.js";

/**
 * REST entry points for the identity, identity resolver, and identity profile services.
 */
export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "identityResolver",
		defaultBaseRoute: "identity",
		tags: tagsIdentityResolver,
		generateRoutes: generateRestRoutesIdentityResolver
	},
	{
		name: "identity",
		defaultBaseRoute: "identity",
		tags: tagsIdentity,
		generateRoutes: generateRestRoutesIdentity
	},
	{
		name: "identityProfile",
		defaultBaseRoute: "identity/profile",
		tags: tagsIdentityProfile,
		generateRoutes: generateRestRoutesIdentityProfile
	}
];
