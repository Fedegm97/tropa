export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const KNOWN_ERRORS: Record<string, string> = {
  plan_limit_runners: "Tu club llegó al límite de corredores del plan. Pedile al coach que mejore el plan.",
  plan_limit_staff: "Llegaste al límite de coaches de tu plan. Mejorá el plan para sumar más.",
  slug_unavailable: "Esa dirección ya está en uso. Probá con otra.",
  invalid_invite_code: "El link de invitación no es válido o fue regenerado.",
  invalid_invitation: "La invitación venció o ya fue usada.",
  invitation_email_mismatch: "Esta invitación es para otro email. Ingresá con el email invitado.",
  dates_must_be_mondays: "Elegí semanas que empiecen en lunes.",
};

export function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  const msg = e?.message ?? "";
  for (const [key, text] of Object.entries(KNOWN_ERRORS)) if (msg.includes(key)) return text;
  if (e?.code === "42501" || msg.includes("forbidden") || msg.includes("row-level security"))
    return "No tenés permiso para hacer esto.";
  if (e?.code === "23505") return "Ya existe un registro igual.";
  console.error("[action error]", error);
  return "Algo salió mal. Probá de nuevo en un rato.";
}

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
