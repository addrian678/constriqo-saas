import { LockKeyhole } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { brand } from "../../branding/brand";
import type { DemoRole } from "../../core/types/roles";
import { Button } from "./Button";

export type LoginMfaState =
  | {
      kind: "setup";
      secret?: string;
      otpauthUri?: string;
      readyToVerify: boolean;
    }
  | {
      kind: "verify";
      readyToVerify: boolean;
    };

export type LoginPageProps = {
  children?: ReactNode;
  busy?: boolean;
  notice?: string | null;
  mfaState?: LoginMfaState;
  heading?: string;
  description?: string;
  tenantLabel?: string;
  tenantPlaceholder?: string;
  securityNote?: string;
  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  brandSubtitle?: string;
  clientLogoUrl?: string;
  onLogin?: (input: { tenantId: string; email: string; password: string }) => Promise<void> | void;
  onTenantIdChange?: (tenantId: string) => void;
  onTotpSetup?: (label?: string) => Promise<void> | void;
  onTotpVerify?: (code: string) => Promise<void> | void;
};

const roleLabels: Record<DemoRole, string> = {
  admin: "Administrador",
  manager: "Gestor de empresa",
  worker: "Trabajador",
  super_admin: "Super Admin",
};

export function LoginPage({
  children,
  busy = false,
  notice: controlledNotice,
  mfaState,
  heading = "Iniciar sesion",
  description = "Usa tus credenciales asignadas por el administrador de la empresa.",
  tenantLabel = "Codigo de empresa",
  tenantPlaceholder = "tenant-id asignado",
  securityNote = "Si tu usuario es administrador, el segundo factor se solicita despues de validar la contrasena.",
  heroEyebrow = "Acceso privado",
  heroTitle = "Inicia sesion para entrar a Constriqo.",
  heroDescription = "Software web y movil por roles para administrar obras, trabajadores, documentos, facturacion, asistencia y operaciones.",
  brandSubtitle = "Usuarios creados solo por administradores. Sin registro publico.",
  clientLogoUrl,
  onLogin,
  onTenantIdChange,
  onTotpSetup,
  onTotpVerify,
}: LoginPageProps) {
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const notice = controlledNotice ?? localNotice;

  function updateTenantId(value: string) {
    setTenantId(value);
    onTenantIdChange?.(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mfaState?.readyToVerify && onTotpVerify) {
      await onTotpVerify(totpCode);
      return;
    }

    if (onLogin) {
      await onLogin({
        tenantId: tenantId.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminLike = normalizedEmail.includes("admin") || normalizedEmail.includes("owner");
    setLocalNotice(
      adminLike
        ? "Credenciales pendientes de conectar. En produccion, despues de validar la contrasena, este usuario pasara por autenticacion de dos factores."
        : "Credenciales pendientes de conectar. En produccion, el backend validara usuario, rol y permisos antes de entrar.",
    );
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand-lockup">
          <span className="brand-mark">{brand.mark}</span>
          <div>
            <p className="brand-name">{brand.name}</p>
            <p className="brand-subtitle">{brand.tagline}</p>
          </div>
        </div>
        <div>
          <p className="eyebrow" style={{ color: "#f3b35a" }}>
            {heroEyebrow}
          </p>
          {clientLogoUrl ? <img className="login-client-logo" src={clientLogoUrl} alt="" /> : null}
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
        <p className="brand-subtitle">{brandSubtitle}</p>
      </section>
      <aside className="login-aside">
        <div className="login-panel">
          <h2 className="card-title">{heading}</h2>
          <p className="page-description">{description}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="form-control">
              <span>{tenantLabel}</span>
              <input
                className="input"
                type="text"
                autoComplete="organization"
                placeholder={tenantPlaceholder}
                value={tenantId}
                onChange={(event) => updateTenantId(event.target.value)}
                disabled={Boolean(mfaState) || busy}
                required={!mfaState}
              />
            </label>
            <label className="form-control">
              <span>Correo electronico</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={Boolean(mfaState) || busy}
                required={!mfaState}
              />
            </label>
            {!mfaState ? (
              <label className="form-control">
                <span>Contrasena</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  required
                />
              </label>
            ) : null}
            {mfaState?.kind === "setup" ? (
              <div className="mfa-box">
                <p className="eyebrow">Segundo factor</p>
                {mfaState.secret ? (
                  <>
                    <p className="page-description">Agrega este secreto en tu app autenticadora y confirma el codigo.</p>
                    <code className="mfa-secret">{mfaState.secret}</code>
                    <p className="login-security-note">{mfaState.otpauthUri}</p>
                  </>
                ) : (
                  <Button variant="secondary" className="button-full" type="button" onClick={() => onTotpSetup?.()} disabled={busy}>
                    Preparar autenticador
                  </Button>
                )}
              </div>
            ) : null}
            {mfaState?.readyToVerify ? (
              <label className="form-control">
                <span>Codigo de 6 digitos</span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={busy}
                  required
                />
              </label>
            ) : null}
            <Button variant="primary" className="button-full" type="submit" disabled={busy}>
              <LockKeyhole size={18} />
              {busy ? "Validando..." : mfaState?.readyToVerify ? "Verificar codigo" : "Iniciar sesion"}
            </Button>
          </form>
          {notice ? <p className="login-notice">{notice}</p> : null}
          <p className="login-security-note">{securityNote}</p>
          {children}
        </div>
      </aside>
    </main>
  );
}

export function RoleDemoSwitcher({
  activeRole,
  onRoleChange,
}: {
  activeRole: DemoRole;
  onRoleChange: (role: DemoRole | null) => void;
}) {
  return (
    <Button variant="secondary" onClick={() => onRoleChange(null)}>
      Cambiar rol: {roleLabels[activeRole]}
    </Button>
  );
}
