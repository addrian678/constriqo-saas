export type AssetStatus = "active" | "maintenance" | "retired" | "out_of_service";
export type LiabilityStatus = "active" | "due_soon" | "overdue" | "closed";

export type AssetEntity = {
  assetId: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  status: AssetStatus;
  bookValue: number;
};

export type AssetMaintenanceEntity = {
  assetMaintenanceId: string;
  tenantId: string;
  assetId: string;
  scheduledFor: string;
  status: "scheduled" | "completed" | "cancelled";
};

export type LiabilityEntity = {
  liabilityId: string;
  tenantId: string;
  reference: string;
  lender: string;
  status: LiabilityStatus;
  balanceAmount: number;
};
