import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { GarminWorkout } from "./workout";

export type WatchTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null; externalUserId: string | null };

export interface WatchProvider {
  readonly name: "garmin" | "fake";
  readonly label: string;
  /** URL a la que se redirige al usuario para autorizar (OAuth 2.0 + PKCE). */
  authorizeUrl(opts: { state: string; redirectUri: string; codeChallenge: string }): string;
  exchangeCode(opts: { code: string; codeVerifier: string; redirectUri: string }): Promise<WatchTokens>;
  refresh(refreshToken: string): Promise<WatchTokens>;
  /** Crea el workout y lo agenda para la fecha. Devuelve el id del workout en el proveedor. */
  pushWorkout(accessToken: string, workout: GarminWorkout, date: string): Promise<string>;
}

export function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Garmin Connect Developer Program (Training API).
 * Requiere aprobación como partner de Garmin. Los endpoints se confirman con la documentación
 * que entrega Garmin al aprobar la cuenta; están centralizados acá para ajustarlos sin tocar el resto.
 */
export const GARMIN_ENDPOINTS = {
  authorize: process.env.GARMIN_AUTHORIZE_URL ?? "https://connect.garmin.com/oauth2Confirm",
  token: process.env.GARMIN_TOKEN_URL ?? "https://diauth.garmin.com/di-oauth2-service/oauth/token",
  workout: process.env.GARMIN_WORKOUT_URL ?? "https://apis.garmin.com/workoutportal/workout/v2",
  schedule: process.env.GARMIN_SCHEDULE_URL ?? "https://apis.garmin.com/training-api/schedule/",
  userId: process.env.GARMIN_USER_ID_URL ?? "https://apis.garmin.com/wellness-api/rest/user/id",
};

export class GarminProvider implements WatchProvider {
  readonly name = "garmin" as const;
  readonly label = "Garmin";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  authorizeUrl({ state, redirectUri, codeChallenge }: { state: string; redirectUri: string; codeChallenge: string }) {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      state,
    });
    return `${GARMIN_ENDPOINTS.authorize}?${p}`;
  }

  private async token(body: Record<string, string>): Promise<WatchTokens> {
    const res = await this.fetchImpl(GARMIN_ENDPOINTS.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...body }),
    });
    if (!res.ok) throw new Error(`Garmin token ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token ?? null,
      expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
      externalUserId: null,
    };
  }

  async exchangeCode({ code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }) {
    const tokens = await this.token({ grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri });
    try {
      const res = await this.fetchImpl(GARMIN_ENDPOINTS.userId, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (res.ok) tokens.externalUserId = ((await res.json()) as { userId?: string }).userId ?? null;
    } catch {}
    return tokens;
  }

  refresh(refreshToken: string) {
    return this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  async pushWorkout(accessToken: string, workout: GarminWorkout, date: string) {
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const res = await this.fetchImpl(GARMIN_ENDPOINTS.workout, { method: "POST", headers, body: JSON.stringify(workout) });
    if (!res.ok) throw new Error(`Garmin workout ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { workoutId } = (await res.json()) as { workoutId: number | string };
    const sch = await this.fetchImpl(GARMIN_ENDPOINTS.schedule, { method: "POST", headers, body: JSON.stringify({ workoutId, date }) });
    if (!sch.ok) throw new Error(`Garmin schedule ${sch.status}: ${(await sch.text()).slice(0, 200)}`);
    return String(workoutId);
  }
}

/** Reloj simulado para desarrollo y demos: conecta al instante y "envía" en ~1,5 s. */
export class FakeWatchProvider implements WatchProvider {
  readonly name = "fake" as const;
  readonly label = "Reloj de prueba";
  constructor(private readonly origin: string) {}
  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string; codeChallenge: string }) {
    const p = new URLSearchParams({ code: "fake-code", state });
    return `${redirectUri}?${p}`;
  }
  async exchangeCode() {
    return { accessToken: "fake-access", refreshToken: "fake-refresh", expiresAt: null, externalUserId: "fake-user" };
  }
  async refresh() {
    return this.exchangeCode();
  }
  async pushWorkout(_token: string, workout: GarminWorkout) {
    await new Promise((r) => setTimeout(r, 1500));
    if (workout.workoutName.toLowerCase().includes("falla")) throw new Error("Simulación de error");
    return `fake-${Date.now()}`;
  }
}

export function getWatchProvider(name: string, origin: string): WatchProvider | null {
  if (name === "garmin" && process.env.GARMIN_CLIENT_ID && process.env.GARMIN_CLIENT_SECRET) {
    return new GarminProvider(process.env.GARMIN_CLIENT_ID, process.env.GARMIN_CLIENT_SECRET);
  }
  if (name === "fake" && (process.env.NODE_ENV !== "production" || process.env.ALLOW_FAKE_WATCH === "1")) return new FakeWatchProvider(origin);
  return null;
}

export function availableWatchProviders(origin: string): WatchProvider[] {
  return (["garmin", "fake"] as const).map((n) => getWatchProvider(n, origin)).filter((p): p is WatchProvider => !!p);
}
