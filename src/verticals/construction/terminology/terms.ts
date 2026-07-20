import type { IndustryProfile } from "../../../core/contracts/industryProfile";

export const constructionProfile: IndustryProfile = {
  id: "construction",
  label: "Construccion",
  workEntitySingular: "Obra",
  workEntityPlural: "Obras",
  workerLabel: "Trabajador",
};

export const cleaningProfileContract: IndustryProfile = {
  id: "cleaning",
  label: "Aseo",
  workEntitySingular: "Servicio",
  workEntityPlural: "Servicios",
  workerLabel: "Operario",
  readyForFutureActivation: true,
};
