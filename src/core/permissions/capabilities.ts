export const capabilities = {
  clientsRead: "clients.read",
  clientsCreate: "clients.create",
  clientsUpdate: "clients.update",
  estimatesRead: "estimates.read",
  estimatesCreate: "estimates.create",
  estimatesUpdate: "estimates.update",
  estimatesApprove: "estimates.approve",
} as const;

export type Capability = (typeof capabilities)[keyof typeof capabilities];
