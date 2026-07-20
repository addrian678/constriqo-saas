export type IndustryProfileId = "construction" | "cleaning";

export type IndustryProfile = {
  id: IndustryProfileId;
  label: string;
  workEntitySingular: string;
  workEntityPlural: string;
  workerLabel: string;
  readyForFutureActivation?: boolean;
};
