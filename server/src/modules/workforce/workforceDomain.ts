export type WorkerStatus = "active" | "inactive" | "suspended";
export type AvailabilityStatus = "available" | "assigned" | "time_off" | "unavailable";
export type CertificationStatus = "valid" | "expiring" | "expired" | "pending_review";

export type WorkerEntity = {
  workerId: string;
  tenantId: string;
  userId?: string;
  name: string;
  status: WorkerStatus;
  trade?: string;
};

export type WorkerAvailabilityEntity = {
  availabilityId: string;
  tenantId: string;
  workerId: string;
  date: string;
  status: AvailabilityStatus;
};

export type WorkerCertificationEntity = {
  certificationId: string;
  tenantId: string;
  workerId: string;
  name: string;
  status: CertificationStatus;
  expiresAt?: string;
};
