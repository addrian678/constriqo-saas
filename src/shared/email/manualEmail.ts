export type ManualEmailDraft = {
  to?: string | null;
  subject: string;
  body: string;
};

export function openManualEmailDraft(draft: ManualEmailDraft) {
  const recipient = encodeURIComponent((draft.to || "").trim());
  const subject = encodeURIComponent(draft.subject.trim());
  const body = encodeURIComponent(draft.body.trim());
  const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${body}`;

  window.location.href = mailtoUrl;
}
