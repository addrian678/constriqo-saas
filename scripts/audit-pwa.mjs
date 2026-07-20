import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "public/manifest.json",
  "public/icon.svg",
  "public/icon-maskable.svg",
  "docs/runbooks/pwa-android-readiness.md",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const packagePath = join(root, "package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  check("Package script audit:pwa", Boolean(pkg.scripts?.["audit:pwa"]), "audit:pwa");
  check("Verify incluye audit:pwa", String(pkg.scripts?.verify).includes("audit:pwa"), "verify");
}

const indexPath = join(root, "index.html");
if (existsSync(indexPath)) {
  const index = readFileSync(indexPath, "utf8");
  check("Index enlaza manifest", index.includes('rel="manifest" href="/manifest.json"'), "manifest link");
  check("Index declara theme-color", index.includes('name="theme-color"'), "theme-color");
  check("Index declara apple title", index.includes("apple-mobile-web-app-title"), "apple title");
}

const manifestPath = join(root, "public/manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  check("Manifest name Constriqo", manifest.name === "Constriqo", manifest.name);
  check("Manifest display standalone", manifest.display === "standalone", manifest.display);
  check("Manifest scope root", manifest.scope === "/", manifest.scope);
  check("Manifest tiene icono any", manifest.icons?.some((icon) => icon.purpose === "any"), "any icon");
  check("Manifest tiene icono maskable", manifest.icons?.some((icon) => icon.purpose === "maskable"), "maskable icon");
  check("Manifest no declara shortcuts sensibles", !manifest.shortcuts, "shortcuts");
}

const operationsPolicyPath = join(root, "server/src/operations/operationsPolicy.ts");
if (existsSync(operationsPolicyPath)) {
  const policy = readFileSync(operationsPolicyPath, "utf8");
  check("Service worker sigue bloqueado", policy.includes('serviceWorker: "disabled-until-qa"'), "service worker");
  check("Offline writes siguen bloqueadas", policy.includes('offlineWrites: "disabled-until-conflict-policy"'), "offline writes");
}

const nativeCapabilitiesPath = join(root, "src/app/native/nativeCapabilities.ts");
if (existsSync(nativeCapabilitiesPath)) {
  const nativeCapabilities = readFileSync(nativeCapabilitiesPath, "utf8");
  check("Native runtime info centralizado", nativeCapabilities.includes("getNativeRuntimeInfo") && nativeCapabilities.includes("android-wrapper-ready"), "runtime info");
  check("Notificaciones preparadas con consentimiento", nativeCapabilities.includes("requestNotificationConsent") && nativeCapabilities.includes("userConfirmed"), "notification consent");
  check("Documentos usan salida native-ready", nativeCapabilities.includes("saveDocumentToCurrentDevice") && nativeCapabilities.includes("sanitizeDeviceFilename"), "document device save");
  check("Cola sync no persiste offline", nativeCapabilities.includes("createEphemeralSyncQueue") && nativeCapabilities.includes("memory-only-no-offline-writes"), "ephemeral queue");
}

const settingsPagePath = join(root, "src/modules/organization/pages/TenantSettingsRealPage.tsx");
if (existsSync(settingsPagePath)) {
  const settingsPage = readFileSync(settingsPagePath, "utf8");
  check("Ajustes muestra estado PWA Android", settingsPage.includes("PWA y Android") && settingsPage.includes("getNativeRuntimeInfo"), "settings native status");
  check("Ajustes no solicita notificaciones sin click", settingsPage.includes("Revisar permiso de notificaciones") && settingsPage.includes("handleNotificationConsent"), "notification action");
}

check("No existe public/sw.js", !existsSync(join(root, "public/sw.js")), "public/sw.js");

const runbookPath = join(root, "docs/runbooks/pwa-android-readiness.md");
if (existsSync(runbookPath)) {
  const runbook = readFileSync(runbookPath, "utf8");
  check("Runbook indica Android native-ready", runbook.includes("preparado desde ahora para Android nativo/hibrido"), "Android native-ready");
  check("Runbook prohibe push sin consentimiento", runbook.includes("No activar push sin consentimiento"), "push consent");
  check("Runbook prohibe cache offline actual", runbook.includes("No activar cache offline"), "offline cache");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`PWA audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`PWA audit passed with ${checks.length} checks.`);
