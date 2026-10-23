#!/usr/bin/env node
// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
process.title = '3Sixty Identity';

import { CLI } from '../dist/es/index.js';

const cli = new CLI();
const result = await cli.run(process.argv);
process.exit(result);
