export type HealthStatus = "ok" | "degraded" | "down";

export type HealthCheck = {
  name: string;
  status: HealthStatus;
  details?: Record<string, string>;
};

export type HealthReport = {
  status: HealthStatus;
  checks: HealthCheck[];
  generatedAt: string;
};

export function summarizeHealth(checks: HealthCheck[], generatedAt: string): HealthReport {
  const status: HealthStatus = checks.some((check) => check.status === "down")
    ? "down"
    : checks.some((check) => check.status === "degraded")
      ? "degraded"
      : "ok";

  return {
    status,
    checks,
    generatedAt,
  };
}
