#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const unknownArguments = process.argv
  .slice(2)
  .filter((arg) => arg !== "--mark-applied");
if (unknownArguments.length > 0) {
  console.error(`ERROR: Unknown argument(s): ${unknownArguments.join(", ")}`);
  process.exit(1);
}

const markExisting =
  process.env.MARK_EXISTING === "1" || process.argv.includes("--mark-applied");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const migrationsDirectory = resolve(root, "database", "migrations");
const manifestPath = resolve(migrationsDirectory, "manifest.json");
const firstA1Migration = "identity/013_identity_admin_user_columns.sql";

let defaultAppliedBy = "apply-migrations";
try {
  defaultAppliedBy = userInfo().username || defaultAppliedBy;
} catch {
  // Keep the deterministic fallback when the OS user cannot be resolved.
}
const appliedBy = process.env.APPLIED_BY || defaultAppliedBy;

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function runPsql(args, options = {}) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", ...args],
    {
      encoding: "utf8",
      ...options,
    },
  );

  if (result.error) {
    fail(
      result.error.code === "ENOENT"
        ? "psql is not available on PATH."
        : `Could not start psql: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    if (options.stdio !== "inherit") {
      process.stderr.write(result.stderr || "");
    }
    fail(`psql exited with status ${result.status}.`);
  }
  return result.stdout || "";
}

function query(sql, variables = {}) {
  const variableArgs = Object.entries(variables).flatMap(([key, value]) => [
    "-v",
    `${key}=${value}`,
  ]);
  return runPsql(["-qAt", ...variableArgs, "-f", "-"], { input: sql }).trim();
}

function execute(sql, variables = {}) {
  const variableArgs = Object.entries(variables).flatMap(([key, value]) => [
    "-v",
    `${key}=${value}`,
  ]);
  runPsql(["-q", ...variableArgs, "-f", "-"], { input: sql });
}

function checksum(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (!existsSync(manifestPath)) {
  fail(`Migration manifest not found: ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`Could not parse migration manifest: ${error.message}`);
}

if (manifest.version !== 1 || !Array.isArray(manifest.migrations)) {
  fail("Unsupported or invalid migration manifest.");
}
if (new Set(manifest.migrations).size !== manifest.migrations.length) {
  fail("Migration manifest contains duplicate paths.");
}
if (!manifest.migrations.includes(firstA1Migration)) {
  fail(`Migration manifest is missing the A1 boundary: ${firstA1Migration}`);
}

const migrations = manifest.migrations.map((filename) => {
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    isAbsolute(filename)
  ) {
    fail("Migration paths must be non-empty relative strings.");
  }

  const path = resolve(migrationsDirectory, filename);
  const pathFromDirectory = relative(migrationsDirectory, path);
  if (
    pathFromDirectory === ".." ||
    pathFromDirectory.startsWith(`..${sep}`) ||
    isAbsolute(pathFromDirectory)
  ) {
    fail(`Migration path escapes the migrations directory: ${filename}`);
  }
  if (!existsSync(path)) {
    fail(`Manifest migration not found: ${filename}`);
  }
  return { filename, path, checksum: checksum(path) };
});

console.log("Ensuring public.schema_migrations exists ...");
execute(`
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text
);
`);

const ledgerCount = Number(
  query("SELECT count(*) FROM public.schema_migrations;\n"),
);
const identityUsersExists =
  query("SELECT to_regclass('identity.users') IS NOT NULL;\n") === "t";

if (markExisting) {
  if (ledgerCount !== 0) {
    fail(
      "--mark-applied/MARK_EXISTING=1 is allowed only when schema_migrations is empty.",
    );
  }
  if (!identityUsersExists) {
    fail(
      "--mark-applied/MARK_EXISTING=1 requires an existing identity.users table.",
    );
  }

  console.log("Marking pre-A1 migrations as already applied ...");
  for (const migration of migrations) {
    if (migration.filename === firstA1Migration) {
      break;
    }
    execute(
      `
INSERT INTO public.schema_migrations (filename, checksum, applied_by)
VALUES (:'filename', :'checksum', :'applied_by');
`,
      {
        filename: migration.filename,
        checksum: migration.checksum,
        applied_by: appliedBy,
      },
    );
    console.log(`  MARK ${migration.filename}`);
  }
}

console.log(`Applying migrations from manifest as ${appliedBy} ...`);
for (const migration of migrations) {
  const recordedChecksum = query(
    `
SELECT checksum
FROM public.schema_migrations
WHERE filename = :'filename';
`,
    { filename: migration.filename },
  );

  if (recordedChecksum) {
    if (recordedChecksum === migration.checksum) {
      console.log(`  SKIP ${migration.filename}`);
      continue;
    }
    fail(
      `Checksum mismatch for ${migration.filename}.\n` +
        `  recorded: ${recordedChecksum}\n` +
        `  current:  ${migration.checksum}`,
    );
  }

  console.log(`  APPLY ${migration.filename}`);
  runPsql(["-f", migration.path], { stdio: "inherit" });
  execute(
    `
INSERT INTO public.schema_migrations (filename, checksum, applied_by)
VALUES (:'filename', :'checksum', :'applied_by');
`,
    {
      filename: migration.filename,
      checksum: migration.checksum,
      applied_by: appliedBy,
    },
  );
  console.log(`  DONE  ${migration.filename}`);
}

console.log("All manifest migrations are current.");
