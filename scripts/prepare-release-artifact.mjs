import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "release", "manifest.json"), "utf8"));
const policy = JSON.parse(readFileSync(join(root, "release", "artifact-policy.json"), "utf8"));
const artifactRoot = join(root, "tmp", "release-artifacts", `constructflow-${manifest.version}`);
const included = [];
const missing = [];
const forbiddenInDist = [join(root, "dist", "stories")];

if (!policy.clientMustNotReceiveRepository) {
  console.error("Artifact policy must prohibit repository delivery to clients.");
  process.exit(1);
}

for (const forbiddenPath of forbiddenInDist) {
  if (existsSync(forbiddenPath)) {
    console.error(`Forbidden non-ConstructFlow asset found in dist: ${forbiddenPath}`);
    process.exit(1);
  }
}

rmSync(artifactRoot, { recursive: true, force: true });
mkdirSync(artifactRoot, { recursive: true });

for (const relativePath of policy.include) {
  const source = join(root, relativePath);
  const target = join(artifactRoot, relativePath);

  if (!existsSync(source)) {
    missing.push(relativePath);
    continue;
  }

  mkdirSync(join(target, ".."), { recursive: true });
  cpSync(source, target, { recursive: true });
  included.push(relativePath);
}

const artifactManifest = {
  product: manifest.product,
  version: manifest.version,
  artifactType: policy.artifactType,
  recommendedDelivery: policy.recommendedDelivery,
  included,
  missing,
  excludeAlways: policy.excludeAlways,
  generatedAt: new Date().toISOString(),
};

writeFileSync(join(artifactRoot, "artifact-manifest.json"), `${JSON.stringify(artifactManifest, null, 2)}\n`);

if (missing.length > 0) {
  console.warn(`Artifact prepared with missing optional paths: ${missing.join(", ")}`);
}

console.log(`Release artifact staged at ${artifactRoot}`);
