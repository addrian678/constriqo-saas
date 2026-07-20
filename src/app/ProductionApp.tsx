import { Suspense, lazy, useEffect, useState } from "react";
import {
  type AuthenticatedSession,
  type LoginInput,
  type PublicTenantBranding,
  type TotpSetupResponse,
  getCurrentSession,
  getPublicTenantBranding,
  login,
  logout,
  setupTotp,
  verifyTotp,
} from "./auth/authClient";
import { LoginPage, type LoginMfaState } from "../shared/components/RoleDemoSwitcher";

const ProductionWorkspace = lazy(() => import("./ProductionWorkspace").then((module) => ({ default: module.ProductionWorkspace })));
const WorkerProductionWorkspace = lazy(() => import("./WorkerProductionWorkspace").then((module) => ({ default: module.WorkerProductionWorkspace })));
const SuperAdminWorkspace = lazy(() => import("../modules/super-admin/pages/SuperAdminWorkspace").then((module) => ({ default: module.SuperAdminWorkspace })));

type AuthStep =
  | { kind: "login" }
  | { kind: "setup-totp"; mfaSetupToken: string; setup?: TotpSetupResponse }
  | { kind: "verify-totp"; mfaChallengeToken: string };

type ProductionAppProps = {
  entry?: "tenant" | "super-admin";
};

export function ProductionApp({ entry = "tenant" }: ProductionAppProps) {
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>({ kind: "login" });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loginTenantId, setLoginTenantId] = useState("");
  const [loginBranding, setLoginBranding] = useState<PublicTenantBranding | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    setStatusMessage("Restaurando sesion segura...");
    getCurrentSession()
      .then((restored) => {
        if (!mounted) {
          return;
        }

        const guardMessage = validateEntrySession(entry, restored);
        if (guardMessage) {
          void logout(restored.sessionToken).catch(() => {});
          setStatusMessage(guardMessage);
          return;
        }

        setSession(restored);
        setStatusMessage(null);
      })
      .catch(() => {
        if (mounted) {
          setStatusMessage(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setRestoringSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [entry]);

  useEffect(() => {
    if (entry !== "tenant") {
      setLoginBranding(null);
      return;
    }

    const tenantSlug = loginTenantId.trim().toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/u.test(tenantSlug) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(tenantSlug)
    ) {
      setLoginBranding(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      getPublicTenantBranding(tenantSlug)
        .then((branding) => {
          if (active) {
            setLoginBranding(branding);
          }
        })
        .catch(() => {
          if (active) {
            setLoginBranding(null);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [entry, loginTenantId]);

  async function handleLogin(input: LoginInput) {
    setBusy(true);
    setStatusMessage(null);
    try {
      const result = await login(input);
      if ("code" in result && result.code === "MFA_SETUP_REQUIRED") {
        setAuthStep({ kind: "setup-totp", mfaSetupToken: result.mfaSetupToken });
        setStatusMessage("Configura el segundo factor para completar el primer acceso.");
        return;
      }

      if ("code" in result && result.code === "MFA_REQUIRED") {
        setAuthStep({ kind: "verify-totp", mfaChallengeToken: result.mfaChallengeToken });
        setStatusMessage("Introduce el codigo de tu autenticador.");
        return;
      }

      const guardMessage = validateEntrySession(entry, result);
      if (guardMessage) {
        await logout(result.sessionToken).catch(() => {});
        setStatusMessage(guardMessage);
        return;
      }

      setSession(result);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTotpSetup(label?: string) {
    if (authStep.kind !== "setup-totp") {
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const setup = await setupTotp({ mfaSetupToken: authStep.mfaSetupToken, label });
      setAuthStep({ ...authStep, setup });
      setStatusMessage("Escanea el codigo en tu autenticador y confirma el codigo de 6 digitos.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo preparar el segundo factor.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTotpVerify(code: string) {
    setBusy(true);
    setStatusMessage(null);
    try {
      const result = await verifyTotp({
        mfaSetupToken: authStep.kind === "setup-totp" ? authStep.mfaSetupToken : undefined,
        mfaChallengeToken: authStep.kind === "verify-totp" ? authStep.mfaChallengeToken : undefined,
        factorId: authStep.kind === "setup-totp" ? authStep.setup?.factorId : undefined,
        code,
      });
      const guardMessage = validateEntrySession(entry, result);
      if (guardMessage) {
        await logout(result.sessionToken).catch(() => {});
        setStatusMessage(guardMessage);
        return;
      }
      setSession(result);
      setAuthStep({ kind: "login" });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo verificar el codigo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!session) {
      return;
    }

    setBusy(true);
    try {
      await logout(session.sessionToken);
    } finally {
      setSession(null);
      setBusy(false);
    }
  }

  if (restoringSession) {
    return <WorkspaceLoading label="Restaurando sesion..." />;
  }

  if (session) {
    if (entry === "super-admin" && session.user.roles.includes("super_admin")) {
      return (
        <Suspense fallback={<WorkspaceLoading label="Cargando consola privada..." />}>
          <SuperAdminWorkspace session={session} busy={busy} onLogout={handleLogout} />
        </Suspense>
      );
    }

    if (entry === "super-admin") {
      return null;
    }

    const isWorkerOnly = session.user.roles.includes("worker") && !session.user.roles.some((role) => role === "admin" || role === "manager");
    if (isWorkerOnly) {
      return (
        <Suspense fallback={<WorkspaceLoading label="Cargando perfil trabajador..." />}>
          <WorkerProductionWorkspace session={session} busy={busy} onLogout={handleLogout} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<WorkspaceLoading label="Cargando modulos..." />}>
        <ProductionWorkspace session={session} busy={busy} onLogout={handleLogout} />
      </Suspense>
    );
  }

  const mfaState: LoginMfaState | undefined =
    authStep.kind === "setup-totp"
      ? {
          kind: "setup",
          secret: authStep.setup?.secret,
          otpauthUri: authStep.setup?.otpauthUri,
          readyToVerify: Boolean(authStep.setup),
        }
      : authStep.kind === "verify-totp"
        ? { kind: "verify", readyToVerify: true }
        : undefined;

  const superAdminLoginProps =
    entry === "super-admin"
      ? {
          heading: "Acceso Super Admin",
          description: "Consola privada del proveedor para licencias, clientes SaaS y seguimiento global.",
          tenantLabel: "Codigo proveedor",
          tenantPlaceholder: "codigo proveedor asignado",
          securityNote: "Este acceso exige autenticacion de dos factores y no es para usuarios de empresas cliente.",
          heroEyebrow: "Proveedor",
          heroTitle: "Consola privada Constriqo.",
          heroDescription: "Panel aislado para administrar licencias, clientes SaaS y operacion del software.",
          brandSubtitle: "Acceso exclusivo del proveedor. No compartir con clientes.",
        }
      : {};
  const tenantLoginProps =
    entry === "tenant"
      ? {
          heading: "Iniciar sesion",
          description: "Usa las credenciales asignadas por el administrador de tu empresa.",
          tenantLabel: "Codigo de empresa",
          tenantPlaceholder: "codigo-publico o tenant-id asignado",
          securityNote: "Si tu usuario es administrador, el segundo factor se solicita despues de validar la contrasena.",
          heroEyebrow: "Acceso privado",
          heroTitle: loginBranding?.companyName
            ? `Inicia sesion para entrar a ${loginBranding.companyName}.`
            : "Inicia sesion para entrar a tu empresa.",
          heroDescription: "Acceso privado para administradores, gerentes y trabajadores autorizados.",
          brandSubtitle: "Usuarios creados solo por administradores. Sin registro publico.",
          clientLogoUrl: loginBranding?.logoUrl || "",
          onTenantIdChange: setLoginTenantId,
        }
      : {};

  return (
    <LoginPage
      busy={busy}
      notice={statusMessage}
      mfaState={mfaState}
      onLogin={handleLogin}
      onTotpSetup={handleTotpSetup}
      onTotpVerify={handleTotpVerify}
      {...tenantLoginProps}
      {...superAdminLoginProps}
    />
  );
}

function validateEntrySession(entry: ProductionAppProps["entry"], session: AuthenticatedSession) {
  if (entry === "tenant" && session.user.roles.includes("super_admin")) {
    return "Este usuario pertenece a la consola privada del proveedor. Usa /super-admin.";
  }

  if (entry === "super-admin" && !session.user.roles.includes("super_admin")) {
    return "Este acceso es solo para Super Admin del proveedor. Usa el inicio de sesion normal para empresas.";
  }

  return "";
}

function WorkspaceLoading({ label }: { label: string }) {
  return (
    <main className="app-shell production-shell">
      <section className="content">
        <p className="login-notice">{label}</p>
      </section>
    </main>
  );
}
