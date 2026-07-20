import { requestJson } from "../../../app/auth/authClient";
import type { CountryProfile, CurrencyCode, UnitSystem } from "../../organization/api/organizationClient";

export type UnitCode = "sq_ft" | "linear_ft" | "ft" | "in" | "m2" | "linear_m" | "m" | "cm" | "unit" | "hour" | "day";

export type ServiceCatalogItem = {
  serviceId: string;
  code: string;
  name: string;
  category: string;
  description: string;
  countryProfile: CountryProfile;
  unitSystem: UnitSystem;
  unitCode: UnitCode;
  currency: CurrencyCode;
  unitPrice: number;
  unitCost: number;
  defaultTaxRate: number;
  marginPercent: number;
  minimumQuantity: number;
  status: "active" | "archived";
  inclusions: string;
  exclusions: string;
  conditions: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceCatalogInput = Omit<ServiceCatalogItem, "serviceId" | "status" | "createdAt" | "updatedAt"> & {
  status?: "active" | "archived";
};

export async function listServices(token: string): Promise<ServiceCatalogItem[]> {
  const response = await requestJson<{ items: ServiceCatalogItem[] }>("/api/services/prices", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function createService(token: string, input: ServiceCatalogInput): Promise<ServiceCatalogItem> {
  const response = await requestJson<{ service: ServiceCatalogItem }>("/api/services/prices", {
    method: "POST",
    token,
    body: input,
  });
  return response.service;
}

export async function updateService(token: string, serviceId: string, input: Partial<ServiceCatalogInput>): Promise<ServiceCatalogItem> {
  const response = await requestJson<{ service: ServiceCatalogItem }>(`/api/services/prices/${serviceId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.service;
}

export async function archiveService(token: string, serviceId: string): Promise<ServiceCatalogItem> {
  const response = await requestJson<{ service: ServiceCatalogItem }>(`/api/services/prices/${serviceId}`, {
    method: "DELETE",
    token,
  });
  return response.service;
}
