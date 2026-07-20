const FISCAL_PROFILES = {
  US: {
    countryProfile: "US",
    taxIdLabel: "EIN / Tax ID",
    defaultCurrency: "USD",
    unitSystem: "imperial",
    taxMode: "state_local_sales_tax_configurable",
    electronicInvoicing: "not_certified_internal_document",
    requiresExternalProvider: false,
    requiredFields: ["business", "customer", "invoice_number", "date", "description", "sales_tax_if_applicable", "total"],
    complianceNote:
      "Perfil USA configurable. Sales tax depende de estado/localidad, tipo de servicio y nexus fiscal. Validar con asesor fiscal antes de usar facturacion fiscal.",
  },
  CO: {
    countryProfile: "CO",
    taxIdLabel: "NIT",
    defaultCurrency: "COP",
    unitSystem: "metric",
    taxMode: "iva_configurable",
    electronicInvoicing: "external_dian_provider_required",
    requiresExternalProvider: true,
    requiredFields: ["emisor", "cliente", "NIT", "fecha", "numero", "descripcion", "IVA", "total", "resolucion_dian_pendiente"],
    complianceNote:
      "Perfil Colombia preparado para datos operativos. Facturacion electronica fiscal requiere proveedor/validacion DIAN y configuracion legal vigente.",
  },
  ES: {
    countryProfile: "ES",
    taxIdLabel: "NIF / CIF",
    defaultCurrency: "EUR",
    unitSystem: "metric",
    taxMode: "iva_configurable",
    electronicInvoicing: "external_verifactu_or_certified_provider_required",
    requiresExternalProvider: true,
    requiredFields: ["emisor", "cliente", "NIF", "fecha", "serie_numero", "descripcion", "IVA", "total", "verifactu_pendiente"],
    complianceNote:
      "Perfil Espana preparado para datos operativos. Cumplimiento fiscal final requiere adaptar/verificar sistema de facturacion conforme AEAT/VERI*FACTU o proveedor certificado.",
  },
};

export function getFiscalProfile(countryProfile = "US") {
  return FISCAL_PROFILES[countryProfile] || FISCAL_PROFILES.US;
}

export function createFiscalSnapshot(input = {}) {
  const profile = getFiscalProfile(input.countryProfile);
  return {
    countryProfile: profile.countryProfile,
    regionCode: input.regionCode || "",
    taxIdLabel: profile.taxIdLabel,
    taxMode: input.taxMode || profile.taxMode,
    electronicInvoicing: input.electronicInvoicing || profile.electronicInvoicing,
    requiresExternalProvider: profile.requiresExternalProvider,
    externalProvider: input.externalProvider || "",
    requiredFields: profile.requiredFields,
    complianceNote: profile.complianceNote,
    reviewedAt: input.reviewedAt || null,
  };
}
