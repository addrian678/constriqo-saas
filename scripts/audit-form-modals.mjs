import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "src/modules/services/pages/ServiceCatalogRealPage.tsx",
  "src/modules/assets/pages/AssetsLiabilitiesRealPage.tsx",
  "src/modules/documents/pages/DocumentsRealPage.tsx",
  "src/modules/marketing/pages/MarketingRealPage.tsx",
  "src/modules/crm/pages/CrmRealPage.tsx",
  "src/modules/jobs/pages/JobsRealPage.tsx",
  "src/modules/finance/pages/FinanceRealPage.tsx",
  "src/modules/invoicing/pages/InvoicingRealPage.tsx",
  "src/modules/estimates/pages/EstimatesRealPage.tsx",
  "src/modules/workforce/pages/WorkforceRealPage.tsx",
  "src/modules/organization/pages/TenantSettingsRealPage.tsx",
  "src/modules/super-admin/pages/SuperAdminWorkspace.tsx",
];

const failures = [];
const modalSource = readFileSync(resolve("src/shared/components/BasicModal.tsx"), "utf8");

if (/maqueta|demo|sin persistencia/iu.test(modalSource)) {
  failures.push("src/shared/components/BasicModal.tsx: no debe conservar texto demo/maqueta por defecto.");
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

for (const file of files) {
  const absolutePath = resolve(file);
  const source = readFileSync(absolutePath, "utf8");

  if (source.includes("action-panel-card")) {
    failures.push(`${file}: mantiene action-panel-card, indica formulario/panel heredado visible.`);
  }

  const formMatches = [...source.matchAll(/<form\b/g)];
  for (const match of formMatches) {
    const formIndex = match.index ?? 0;
    const lastModalOpen = source.lastIndexOf("<BasicModal", formIndex);
    const lastModalClose = source.lastIndexOf("</BasicModal>", formIndex);
    if (lastModalOpen === -1 || lastModalOpen < lastModalClose) {
      failures.push(`${file}:${lineOf(source, formIndex)} contiene <form> fuera de BasicModal.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Auditoria de formularios/modales fallo:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Auditoria de formularios/modales OK: formularios reales protegidos en BasicModal.");
