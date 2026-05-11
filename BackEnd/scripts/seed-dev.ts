import 'dotenv/config';
import mongoose from 'mongoose';

import { seedDevDatabase } from './seed-dev-data';

const ALLOWED_DB_NAMES = ['housemate_dev', 'housemate_seed', 'housemate_test'];
const DEFAULT_URI = 'mongodb://localhost:27017/housemate_dev';

/**
 * Extracts the database name from a MongoDB URI path segment.
 *
 * Limitation: this script is intended for local developer use only and assumes
 * the database is encoded in the URI path (e.g. `mongodb://host:27017/dbname`).
 * Atlas SRV URIs that encode the database in a `?db=` query parameter are not
 * supported — those would return an empty string here and trigger the "Could
 * not parse database name" guard. Pass `--force` is not a workaround; the
 * empty-name check runs before the allowlist check by design.
 */
function extractDbName(uri: string): string {
  // mongodb://host:port/dbname?query → 'dbname'
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const pathStart = afterScheme.indexOf('/');
  if (pathStart === -1) return '';
  const path = afterScheme.slice(pathStart + 1);
  return path.split('?')[0].replace(/\/$/, '');
}

async function main(): Promise<void> {
  const uri = process.env.SEED_MONGODB_URI ?? DEFAULT_URI;
  const force = process.argv.includes('--force');
  const dbName = extractDbName(uri);

  if (!dbName) {
    console.error(`Could not parse database name from URI: ${uri}`);
    process.exit(1);
  }

  if (!ALLOWED_DB_NAMES.includes(dbName) && !force) {
    console.error(
      `Refusing to seed database "${dbName}". Allowed: ${ALLOWED_DB_NAMES.join(', ')}.\n` +
        `Pass --force to override.`
    );
    process.exit(1);
  }

  console.log(`Connecting to ${uri}…`);
  await mongoose.connect(uri);
  console.log(`Dropping database "${dbName}"…`);
  await mongoose.connection.dropDatabase();

  const result = await seedDevDatabase();
  console.log(`\nInserted ${Object.keys(result.userIds).length} users and ${Object.keys(result.householdIds).length} households.\n`);
  console.table(result.credentials);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  void mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
