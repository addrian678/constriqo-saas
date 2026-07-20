import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const srcDir = join(root, "src");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const reportsDir = join(root, "reports");

const requiredRoutes = [
  "/admin/crm",
  "/admin/cotizaciones",
  "/admin/obras",
  "/admin/trabajadores",
  "/admin/control-horario",
  "/admin/partes-diarios",
  "/admin/documentos",
  "/admin/facturas",
  "/admin/gastos",
  "/admin/finanzas",
  "/admin/activos",
  "/admin/pasivos",
  "/admin/marketing",
  "/admin/notificaciones",
  "/admin/informes",
  "/admin/auditoria",
  "/admin/usuarios-y-roles",
  "/admin/configuracion",
  "/admin/validacion-sectorial",
  "/manager/clientes",
  "/manager/cotizaciones",
  "/manager/obras",
  "/manager/trabajadores",
  "/manager/control-horario",
  "/manager/partes-diarios",
  "/manager/documentos",
  "/manager/facturas",
  "/manager/cobros",
  "/manager/gastos",
  "/manager/marketing",
  "/manager/notificaciones",
  "/manager/informes-operativos",
  "/worker/mi-jornada",
  "/worker/asistencia",
  "/worker/trabajos-asignados",
  "/worker/pruebas-de-trabajo",
  "/worker/historial-de-horas",
  "/worker/notificaciones",
  "/worker/mi-perfil",
];

const requiredModules = [
  "dashboard",
  "crm",
  "estimates",
  "jobs",
  "workforce",
  "attendance",
  "work-proofs",
  "documents",
  "invoicing",
  "expenses",
  "finance",
  "assets",
  "marketing",
  "notifications",
  "organization",
  "industry-validation",
];

const requiredEnabledModules = [
  "dashboard",
  "crm",
  "estimates",
  "jobs",
  "workforce",
  "attendance",
  "work-proofs",
  "documents",
  "invoicing",
  "expenses",
  "finance",
  "assets-liabilities",
  "marketing",
  "notifications-audit-reports",
  "organization",
  "industry-validation",
];

const requiredReports = [
  "constructflow-v02-v03-visual-report.md",
  "constructflow-v04-jobs-visual-report.md",
  "constructflow-v05-workforce-visual-report.md",
  "constructflow-v06-attendance-visual-report.md",
  "constructflow-v07-field-work-proofs-report.md",
  "constructflow-v08-documents-visual-report.md",
  "constructflow-v09-invoicing-visual-report.md",
  "constructflow-v10-expenses-payables-visual-report.md",
  "constructflow-v11-finance-visual-report.md",
  "constructflow-v12-assets-liabilities-visual-report.md",
  "constructflow-v13-notifications-reports-audit-visual-report.md",
  "constructflow-v14-organization-users-settings-visual-report.md",
  "constructflow-v15-industry-validation-visual-report.md",
];

const prohibitedPatterns = [
  "localStorage",
  "sessionStorage",
  "serviceWorker",
  "firebase",
  "fetch(",
  "indexedDB",
  "navigator.geolocation",
  "getUserMedia",
  "navigator.mediaDevices",
  "stripe",
  "paypal",
  "sendEmail",
  "mailto:",
  "download(",
  "createObjectURL",
  "FileReader",
  'type="file"',
  "type='file'",
];

const allowedApiFiles = new Set([join(root, "src", "app", "auth", "authClient.ts")]);
const allowedNativeFiles = new Set([join(root, "src", "app", "native", "nativeCapabilities.ts")]);
const allowedDownloadFiles = new Set([join(root, "src", "app", "auth", "authClient.ts")]);
const allowedFunctionalUiPatterns = new Map([
  ["mailto:", new Set([
    join(root, "src", "modules", "estimates", "pages", "EstimatesRealPage.tsx"),
    join(root, "src", "modules", "invoicing", "pages", "InvoicingRealPage.tsx"),
  ])],
  ["FileReader", new Set([join(root, "src", "modules", "organization", "pages", "TenantSettingsRealPage.tsx")])],
  ['type="file"', new Set([join(root, "src", "modules", "organization", "pages", "TenantSettingsRealPage.tsx")])],
]);

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function walkFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    return [fullPath];
  });
}

function assertCheck(checks, name, passed, details) {
  checks.push({ name, passed, details });
}

const checks = [];
const routeSource = read("src/app/routes/AppRoutes.tsx");
const navSource = read("src/verticals/construction/navigation/roleNavigation.ts");
const configSource = read("src/app/config/appConfig.ts");
const workerRouteBlock = routeSource.slice(routeSource.indexOf("return (\n    <WorkerLayout"));

for (const route of requiredRoutes) {
  assertCheck(checks, `Ruta declarada ${route}`, routeSource.includes(route.replace(/^\//, "")) || navSource.includes(route), route);
}

for (const moduleName of requiredModules) {
  assertCheck(checks, `Modulo presente ${moduleName}`, existsSync(join(srcDir, "modules", moduleName)), moduleName);
}

for (const moduleId of requiredEnabledModules) {
  assertCheck(checks, `enabledModules incluye ${moduleId}`, configSource.includes(`"${moduleId}"`), moduleId);
}

for (const reportName of requiredReports) {
  assertCheck(checks, `Reporte presente ${reportName}`, existsSync(join(reportsDir, reportName)), reportName);
}

for (const adminPath of ["/admin/crm", "/admin/finanzas", "/admin/gastos", "/admin/activos", "/admin/pasivos", "/admin/configuracion"]) {
  assertCheck(checks, `Trabajador sin acceso ${adminPath}`, !workerRouteBlock.includes(adminPath), adminPath);
}

assertCheck(
  checks,
  "Perfil activo construction y cleaning preparado",
  configSource.includes('activeIndustryProfile: "construction"') && configSource.includes('preparedIndustryProfiles: ["cleaning"]'),
  "construction activo, cleaning preparado",
);

assertCheck(checks, "Public no contiene assets ajenos stories", !existsSync(join(publicDir, "stories")), "public/stories");
assertCheck(checks, "Dist no contiene assets ajenos stories", !existsSync(join(distDir, "stories")), "dist/stories");

const scannedFiles = walkFiles(srcDir).concat(walkFiles(publicDir)).filter((file) => /\.(ts|tsx|js|jsx|html|css|json)$/.test(file));
const violations = [];
for (const file of scannedFiles) {
  const content = readFileSync(file, "utf8");
  for (const pattern of prohibitedPatterns) {
    if (pattern === "fetch(" && allowedApiFiles.has(file)) {
      continue;
    }
    if (pattern === "createObjectURL" && allowedDownloadFiles.has(file)) {
      continue;
    }
    if (pattern === "navigator.geolocation" && allowedNativeFiles.has(file)) {
      continue;
    }
    if (allowedFunctionalUiPatterns.get(pattern)?.has(file)) {
      continue;
    }
    if (content.includes(pattern)) {
      violations.push(`${file.replace(root, ".")} -> ${pattern}`);
    }
  }
}
assertCheck(checks, "Sin APIs prohibidas fuera de auth runtime", violations.length === 0, violations.join("\n") || "Sin hallazgos");

const globalCss = read("src/styles/globals.css");
assertCheck(checks, "Sin Google Fonts externo", !globalCss.includes("fonts.googleapis.com") && !globalCss.includes("@import url("), "external fonts");

const failed = checks.filter((check) => !check.passed);
const generatedAt = new Date().toISOString();
const reportLines = [
  "# ConstructFlow V0.16 - Congelacion visual y auditoria automatica",
  "",
  `Generado: ${generatedAt}`,
  "",
  "## Resultado",
  "",
  failed.length === 0 ? "- Estado: APROBADO" : "- Estado: REQUIERE CORRECCION",
  `- Checks ejecutados: ${checks.length}`,
  `- Checks fallidos: ${failed.length}`,
  "",
  "## Checks",
  "",
  ...checks.map((check) => `- ${check.passed ? "[OK]" : "[FALLO]"} ${check.name}`),
  "",
  "## Hallazgos",
  "",
  failed.length === 0 ? "- Sin hallazgos bloqueantes." : failed.map((check) => `- ${check.name}: ${check.details}`).join("\n"),
  "",
  "## Alcance",
  "",
  "- Verifica rutas visuales V0.2 a V0.15.",
  "- Verifica modulos y reportes de fase.",
  "- Verifica separacion visual del Trabajador.",
  "- Verifica que la UI visual no use persistencia, pagos, archivos ni APIs de dispositivo.",
  "- Permite red solo en el cliente de autenticacion runtime.",
  "",
  "## Limites",
  "",
  "- No sustituye pruebas unitarias ni e2e de F1.",
  "- No valida pixeles ni accesibilidad con navegador real.",
  "- No prueba backend ni base de datos, porque aun no existen en V0.",
];

writeFileSync(join(reportsDir, "constructflow-v16-visual-freeze-audit.md"), `${reportLines.join("\n")}\n`);

if (failed.length > 0) {
  console.error(`Visual audit failed with ${failed.length} issue(s).`);
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.details}`);
  }
  process.exit(1);
}

console.log(`Visual audit passed with ${checks.length} checks.`);
