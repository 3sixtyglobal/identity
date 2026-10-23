// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@3sixty/entity";
import { nameof } from "@3sixty/nameof";
import { IdentityDocument } from "./entities/identityDocument.js";
import { IdentityDocumentV0 } from "./entities/identityDocumentV0.js";
import { IdentityProfile } from "./entities/identityProfile.js";
import { IdentityProfileV0 } from "./entities/identityProfileV0.js";

/**
 * Initialize the schema for the identity entity storage connector.
 * @param options Options for which entities to register.
 * @param options.includeDocument Whether to include the document entity, defaults to true.
 * @param options.includeProfile Whether to include the profile entity, defaults to true.
 */
export function initSchema(options?: {
	includeDocument?: boolean;
	includeProfile?: boolean;
}): void {
	if (options?.includeDocument ?? true) {
		EntitySchemaFactory.register(nameof(IdentityDocument), () =>
			EntitySchemaHelper.getSchema(IdentityDocument)
		);
		EntitySchemaFactory.register(nameof(IdentityDocumentV0), () =>
			EntitySchemaHelper.getSchema(IdentityDocumentV0)
		);
	}
	if (options?.includeProfile ?? true) {
		EntitySchemaFactory.register(nameof<IdentityProfile>(), () =>
			EntitySchemaHelper.getSchema(IdentityProfile)
		);
		EntitySchemaFactory.register(nameof<IdentityProfileV0>(), () =>
			EntitySchemaHelper.getSchema(IdentityProfileV0)
		);
	}
}
