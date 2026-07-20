import { Navigate, Route, Routes } from "react-router-dom";
import type { DemoRole } from "../../core/types/roles";
import { roleRouteScopes } from "../../core/permissions/roleVisibility";
import { AdminLayout } from "../layouts/AdminLayout";
import { ManagerLayout } from "../layouts/ManagerLayout";
import { WorkerLayout } from "../layouts/WorkerLayout";
import { ComingSoonPage } from "../../shared/components/ComingSoonPage";
import { AssetDetailPage } from "../../modules/assets/pages/AssetDetailPage";
import { AssetsPage } from "../../modules/assets/pages/AssetsPage";
import { LiabilitiesPage } from "../../modules/assets/pages/LiabilitiesPage";
import { LiabilityDetailPage } from "../../modules/assets/pages/LiabilityDetailPage";
import { AdminHome } from "../../modules/dashboard/pages/AdminHome";
import { ManagerHome } from "../../modules/dashboard/pages/ManagerHome";
import { WorkerHome } from "../../modules/dashboard/pages/WorkerHome";
import { AttendancePage } from "../../modules/attendance/pages/AttendancePage";
import { AttendanceReviewPage } from "../../modules/attendance/pages/AttendanceReviewPage";
import { WorkerHoursHistoryPage } from "../../modules/attendance/pages/WorkerHoursHistoryPage";
import { WorkerDayPage } from "../../modules/attendance/pages/WorkerDayPage";
import { FieldReportsPage } from "../../modules/work-proofs/pages/FieldReportsPage";
import { WorkProofsPage } from "../../modules/work-proofs/pages/WorkProofsPage";
import { AssignedWorkPage } from "../../modules/workforce/pages/AssignedWorkPage";
import { ClientDetailPage } from "../../modules/crm/pages/ClientDetailPage";
import { CrmPage } from "../../modules/crm/pages/CrmPage";
import { EstimateDetailPage } from "../../modules/estimates/pages/EstimateDetailPage";
import { EstimatesPage } from "../../modules/estimates/pages/EstimatesPage";
import { JobDetailPage } from "../../modules/jobs/pages/JobDetailPage";
import { JobsPage } from "../../modules/jobs/pages/JobsPage";
import { DocumentDetailPage } from "../../modules/documents/pages/DocumentDetailPage";
import { DocumentsPage } from "../../modules/documents/pages/DocumentsPage";
import { ExpenseDetailPage } from "../../modules/expenses/pages/ExpenseDetailPage";
import { ExpensesPage } from "../../modules/expenses/pages/ExpensesPage";
import { FinancePage } from "../../modules/finance/pages/FinancePage";
import { IndustryValidationPage } from "../../modules/industry-validation/pages/IndustryValidationPage";
import { InvoiceDetailPage } from "../../modules/invoicing/pages/InvoiceDetailPage";
import { InvoicesPage } from "../../modules/invoicing/pages/InvoicesPage";
import { ReceivablesPage } from "../../modules/invoicing/pages/ReceivablesPage";
import { MarketingPage } from "../../modules/marketing/pages/MarketingPage";
import { AuditPage } from "../../modules/notifications/pages/AuditPage";
import { NotificationsPage } from "../../modules/notifications/pages/NotificationsPage";
import { ReportsPage } from "../../modules/notifications/pages/ReportsPage";
import { WorkerNotificationsPage } from "../../modules/notifications/pages/WorkerNotificationsPage";
import { SettingsPage } from "../../modules/organization/pages/SettingsPage";
import { UsersRolesPage } from "../../modules/organization/pages/UsersRolesPage";
import { WorkforcePage } from "../../modules/workforce/pages/WorkforcePage";
import { WorkerDetailAdminPage } from "../../modules/workforce/pages/WorkerDetailAdminPage";
import { WorkerSelfProfilePage } from "../../modules/workforce/pages/WorkerSelfProfilePage";
import {
  adminNavigation,
  managerNavigation,
  workerNavigation,
} from "../../verticals/construction/navigation/roleNavigation";

type AppRoutesProps = {
  activeRole: DemoRole;
  onRoleChange: (role: DemoRole | null) => void;
};

export function AppRoutes({ activeRole, onRoleChange }: AppRoutesProps) {
  if (activeRole === "admin") {
    return (
      <AdminLayout onRoleChange={onRoleChange}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/inicio" replace />} />
          <Route path="admin" element={<Navigate to="/admin/inicio" replace />} />
          <Route path="admin/inicio" element={<AdminHome />} />
          <Route path="admin/crm" element={<CrmPage basePath="/admin/crm" roleLabel="Administrador" />} />
          <Route
            path="admin/crm/clientes/:clientId"
            element={<ClientDetailPage basePath="/admin/crm" roleLabel="Administrador" />}
          />
          <Route
            path="admin/cotizaciones"
            element={<EstimatesPage basePath="/admin/cotizaciones" roleLabel="Administrador" />}
          />
          <Route
            path="admin/cotizaciones/:estimateId"
            element={<EstimateDetailPage basePath="/admin/cotizaciones" roleLabel="Administrador" />}
          />
          <Route path="admin/obras" element={<JobsPage basePath="/admin/obras" roleLabel="Administrador" />} />
          <Route
            path="admin/obras/:jobId"
            element={<JobDetailPage basePath="/admin/obras" roleLabel="Administrador" />}
          />
          <Route
            path="admin/trabajadores"
            element={<WorkforcePage basePath="/admin/trabajadores" roleLabel="Administrador" />}
          />
          <Route
            path="admin/trabajadores/:workerId"
            element={<WorkerDetailAdminPage basePath="/admin/trabajadores" roleLabel="Administrador" />}
          />
          <Route path="admin/control-horario" element={<AttendanceReviewPage roleLabel="Administrador" />} />
          <Route path="admin/partes-diarios" element={<FieldReportsPage roleLabel="Administrador" />} />
          <Route path="admin/documentos" element={<DocumentsPage basePath="/admin/documentos" roleLabel="Administrador" />} />
          <Route
            path="admin/documentos/:documentId"
            element={<DocumentDetailPage basePath="/admin/documentos" roleLabel="Administrador" />}
          />
          <Route path="admin/facturas" element={<InvoicesPage basePath="/admin/facturas" roleLabel="Administrador" />} />
          <Route
            path="admin/facturas/:invoiceId"
            element={<InvoiceDetailPage basePath="/admin/facturas" roleLabel="Administrador" />}
          />
          <Route path="admin/gastos" element={<ExpensesPage basePath="/admin/gastos" roleLabel="Administrador" />} />
          <Route
            path="admin/gastos/:expenseId"
            element={<ExpenseDetailPage basePath="/admin/gastos" roleLabel="Administrador" />}
          />
          <Route path="admin/finanzas" element={<FinancePage roleLabel="Administrador" />} />
          <Route path="admin/activos" element={<AssetsPage basePath="/admin/activos" roleLabel="Administrador" />} />
          <Route
            path="admin/activos/:assetId"
            element={<AssetDetailPage basePath="/admin/activos" roleLabel="Administrador" />}
          />
          <Route path="admin/pasivos" element={<LiabilitiesPage basePath="/admin/pasivos" roleLabel="Administrador" />} />
          <Route
            path="admin/pasivos/:liabilityId"
            element={<LiabilityDetailPage basePath="/admin/pasivos" roleLabel="Administrador" />}
          />
          <Route path="admin/notificaciones" element={<NotificationsPage role="admin" roleLabel="Administrador" />} />
          <Route path="admin/marketing" element={<MarketingPage roleLabel="Administrador" />} />
          <Route path="admin/informes" element={<ReportsPage />} />
          <Route path="admin/auditoria" element={<AuditPage />} />
          <Route path="admin/usuarios-y-roles" element={<UsersRolesPage />} />
          <Route path="admin/configuracion" element={<SettingsPage />} />
          <Route path="admin/validacion-sectorial" element={<IndustryValidationPage />} />
          {adminNavigation
            .filter(
              (item) =>
                ![
                  "/admin/inicio",
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
                ].includes(item.path),
            )
            .map((item) => (
              <Route
                key={item.path}
                path={item.path.replace(/^\//, "")}
                element={<ComingSoonPage moduleName={item.label} roleLabel="Administrador" />}
              />
            ))}
          <Route path="*" element={<Navigate to={roleRouteScopes.admin + "/inicio"} replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  if (activeRole === "manager") {
    return (
      <ManagerLayout onRoleChange={onRoleChange}>
        <Routes>
          <Route path="/" element={<Navigate to="/manager/inicio" replace />} />
          <Route path="manager" element={<Navigate to="/manager/inicio" replace />} />
          <Route path="manager/inicio" element={<ManagerHome />} />
          <Route path="manager/clientes" element={<CrmPage basePath="/manager/clientes" roleLabel="Gestor de empresa" />} />
          <Route
            path="manager/clientes/:clientId"
            element={<ClientDetailPage basePath="/manager/clientes" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/cotizaciones"
            element={<EstimatesPage basePath="/manager/cotizaciones" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/cotizaciones/:estimateId"
            element={<EstimateDetailPage basePath="/manager/cotizaciones" roleLabel="Gestor de empresa" />}
          />
          <Route path="manager/obras" element={<JobsPage basePath="/manager/obras" roleLabel="Gestor de empresa" />} />
          <Route
            path="manager/obras/:jobId"
            element={<JobDetailPage basePath="/manager/obras" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/trabajadores"
            element={<WorkforcePage basePath="/manager/trabajadores" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/trabajadores/:workerId"
            element={<WorkerDetailAdminPage basePath="/manager/trabajadores" roleLabel="Gestor de empresa" />}
          />
          <Route path="manager/control-horario" element={<AttendanceReviewPage roleLabel="Gestor de empresa" />} />
          <Route path="manager/partes-diarios" element={<FieldReportsPage roleLabel="Gestor de empresa" />} />
          <Route
            path="manager/documentos"
            element={<DocumentsPage basePath="/manager/documentos" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/documentos/:documentId"
            element={<DocumentDetailPage basePath="/manager/documentos" roleLabel="Gestor de empresa" />}
          />
          <Route path="manager/facturas" element={<InvoicesPage basePath="/manager/facturas" roleLabel="Gestor de empresa" />} />
          <Route
            path="manager/facturas/:invoiceId"
            element={<InvoiceDetailPage basePath="/manager/facturas" roleLabel="Gestor de empresa" />}
          />
          <Route path="manager/cobros" element={<ReceivablesPage roleLabel="Gestor de empresa" />} />
          <Route path="manager/gastos" element={<ExpensesPage basePath="/manager/gastos" roleLabel="Gestor de empresa" />} />
          <Route
            path="manager/gastos/:expenseId"
            element={<ExpenseDetailPage basePath="/manager/gastos" roleLabel="Gestor de empresa" />}
          />
          <Route
            path="manager/informes-operativos"
            element={<FinancePage roleLabel="Gestor de empresa" mode="operational" />}
          />
          <Route path="manager/marketing" element={<MarketingPage roleLabel="Gestor de empresa" />} />
          <Route path="manager/notificaciones" element={<NotificationsPage role="manager" roleLabel="Gestor de empresa" />} />
          {managerNavigation
            .filter(
              (item) =>
                ![
                  "/manager/inicio",
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
                ].includes(item.path),
            )
            .map((item) => (
              <Route
                key={item.path}
                path={item.path.replace(/^\//, "")}
                element={<ComingSoonPage moduleName={item.label} roleLabel="Gestor de empresa" />}
              />
            ))}
          <Route path="*" element={<Navigate to={roleRouteScopes.manager + "/inicio"} replace />} />
        </Routes>
      </ManagerLayout>
    );
  }

  return (
    <WorkerLayout onRoleChange={onRoleChange}>
      <Routes>
        <Route path="/" element={<Navigate to="/worker/inicio" replace />} />
        <Route path="worker" element={<Navigate to="/worker/inicio" replace />} />
        <Route path="worker/inicio" element={<WorkerHome />} />
        <Route path="worker/mi-jornada" element={<WorkerDayPage />} />
        <Route path="worker/asistencia" element={<AttendancePage />} />
        <Route path="worker/trabajos-asignados" element={<AssignedWorkPage />} />
        <Route path="worker/pruebas-de-trabajo" element={<WorkProofsPage />} />
        <Route path="worker/historial-de-horas" element={<WorkerHoursHistoryPage />} />
        <Route path="worker/notificaciones" element={<WorkerNotificationsPage />} />
        <Route path="worker/mi-perfil" element={<WorkerSelfProfilePage />} />
        {workerNavigation
          .filter(
            (item) =>
              ![
                "/worker/inicio",
                "/worker/mi-jornada",
                "/worker/asistencia",
                "/worker/trabajos-asignados",
                "/worker/pruebas-de-trabajo",
                "/worker/historial-de-horas",
                "/worker/notificaciones",
                "/worker/mi-perfil",
              ].includes(item.path),
          )
          .map((item) => (
            <Route
              key={item.path}
              path={item.path.replace(/^\//, "")}
              element={<ComingSoonPage moduleName={item.label} roleLabel="Trabajador" />}
            />
          ))}
        <Route path="*" element={<Navigate to={roleRouteScopes.worker + "/inicio"} replace />} />
      </Routes>
    </WorkerLayout>
  );
}
