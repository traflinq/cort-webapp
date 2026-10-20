"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { MapMarker } from "@/app/admin/ui/Map";
import { Badge, Button, Card, CardContent, CardHeader, Field, FormGrid, Input, PageHeader, Textarea } from "@/app/admin/ui";

const Map = dynamic(() => import("@/app/admin/ui/Map"), { ssr: false });

type TrakkerVehicle = {
  RegNo?: string;
  VrnMake?: string;
  VrnModle?: string;
  VehStatus?: string;
  Speed?: string;
  Location?: string;
  Lat?: string | number;
  Long?: string | number;
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function tryPickString(obj: unknown, keys: string[]): string | "" {
  if (!obj || typeof obj !== "object") return "";
  const record = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = record[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function safeJsonParse(text: string): { ok: true; value: Json } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as Json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-subtle px-1 font-mono text-[12px] text-fg">{children}</code>;
}

function JsonOut({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-subtle p-3 font-mono text-xs text-fg">
      {value ? JSON.stringify(value, null, 2) : "—"}
    </pre>
  );
}

export default function TrackerTestPage() {
  // FLAGGED (kept as-is per decision 2026-10-20): credentials are shipped to the browser.
  const HARDCODED_USERID = "Z1X5CVA";
  const HARDCODED_PASSWORD = "c1d8a6b2-9f47-4e3a-b5c1-2a7f9d0e6c44";
  const DEFAULT_PHONE = "03156618471";
  const DEFAULT_YEAR = "1992";

  const [loginBodyText, setLoginBodyText] = useState<string>(
    JSON.stringify(
      {
        // Trakker GetToken expects: { "UserID": "...", "Password": "..." }
        UserID: HARDCODED_USERID,
        Password: HARDCODED_PASSWORD,
      },
      null,
      2,
    ),
  );

  const [token, setToken] = useState("");
  const [userId, setUserId] = useState(HARDCODED_USERID);
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);

  const [loginStatus, setLoginStatus] = useState<{ status?: number; body?: unknown; error?: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState<{ status?: number; body?: unknown; error?: string } | null>(null);
  const [busy, setBusy] = useState<"login" | "location" | null>(null);

  const parsedLoginBody = useMemo(() => safeJsonParse(loginBodyText), [loginBodyText]);

  async function doLogin() {
    setBusy("login");
    setLoginStatus(null);
    try {
      const res = await fetch("/api/tracker/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ UserID: HARDCODED_USERID, Password: HARDCODED_PASSWORD }),
      });

      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep text
      }

      setLoginStatus({ status: res.status, body });

      const nextToken =
        tryPickString(body, ["Token", "token", "access_token", "accessToken"]) ||
        tryPickString((body as Record<string, unknown> | undefined)?.data, ["Token", "token", "access_token", "accessToken"]);
      const nextUserId =
        tryPickString(body, ["UserID", "userId", "userid", "UserId"]) ||
        tryPickString((body as Record<string, unknown> | undefined)?.data, ["UserID", "userId", "userid", "UserId"]);

      if (nextToken) setToken(nextToken);
      if (nextUserId) setUserId(nextUserId);
      else setUserId(HARDCODED_USERID);
    } catch (e) {
      setLoginStatus({ error: e instanceof Error ? e.message : "Login failed" });
    } finally {
      setBusy(null);
    }
  }

  async function ensureToken(): Promise<{ ok: true; userId: string; token: string } | { ok: false; error: string }> {
    if (token && userId) return { ok: true, userId, token };
    try {
      const res = await fetch("/api/tracker/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ UserID: HARDCODED_USERID, Password: HARDCODED_PASSWORD }),
      });

      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep text
      }

      setLoginStatus({ status: res.status, body });

      const nextToken =
        tryPickString(body, ["Token", "token", "access_token", "accessToken"]) ||
        tryPickString((body as Record<string, unknown> | undefined)?.data, ["Token", "token", "access_token", "accessToken"]);

      const nextUserId =
        tryPickString(body, ["UserID", "userId", "userid", "UserId"]) ||
        tryPickString((body as Record<string, unknown> | undefined)?.data, ["UserID", "userId", "userid", "UserId"]) ||
        HARDCODED_USERID;

      if (!nextToken) return { ok: false, error: "Token missing in response" };

      setToken(nextToken);
      setUserId(nextUserId);
      return { ok: true, userId: nextUserId, token: nextToken };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Login failed" };
    }
  }

  useEffect(() => {
    void (async () => {
      await ensureToken();
      // Auto-fetch location using defaults
      await doLocation(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getVehiclesFromBody(body: unknown): TrakkerVehicle[] {
    if (Array.isArray(body)) return body as TrakkerVehicle[];
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      if (Array.isArray(record.body)) return record.body as TrakkerVehicle[];
      if (Array.isArray(record.data)) return record.data as TrakkerVehicle[];
    }
    return [];
  }

  function extractMarkersFromLocationBody(body: unknown): MapMarker[] {
    const markers: MapMarker[] = [];

    for (const [index, vehicle] of getVehiclesFromBody(body).entries()) {
      const lat = Number(vehicle.Lat);
      const lng = Number(vehicle.Long);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const regNo = vehicle.RegNo || `Vehicle ${index + 1}`;
      const makeModel = [vehicle.VrnMake, vehicle.VrnModle].filter(Boolean).join(" ");
      const status = vehicle.VehStatus || "Unknown";
      const speed = vehicle.Speed ? `${vehicle.Speed} km/h` : "";
      const location = vehicle.Location || "";

      markers.push({
        id: regNo,
        position: [lat, lng],
        label: `${regNo}${makeModel ? ` · ${makeModel}` : ""}`,
        description: [status, speed, location].filter(Boolean).join(" · "),
        type: "driver",
      });
    }

    return markers;
  }

  async function doLocation(silent = false) {
    if (!silent) {
      setBusy("location");
      setLocationStatus(null);
    }
    try {
      const ensured = await ensureToken();
      if (!ensured.ok) {
        setLocationStatus({ error: ensured.error });
        return;
      }
      const qs = new URLSearchParams({ phone, year });
      const res = await fetch(`/api/tracker/location?${qs.toString()}`, {
        method: "GET",
        headers: {
          "x-tracker-userid": ensured.userId,
          "x-tracker-token": ensured.token,
        },
      });

      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // keep text
      }

      setLocationStatus({ status: res.status, body });
      setMapMarkers(extractMarkersFromLocationBody(body));
    } catch (e) {
      setLocationStatus({ error: e instanceof Error ? e.message : "Location fetch failed" });
    } finally {
      if (!silent) setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Tracker test"
        description={
          <>
            Step 1: POST login to <Code>/api/tracker/token</Code> → Step 2: use <Code>UserID</Code> + <Code>Token</Code> headers to call <Code>/api/tracker/location</Code>.
          </>
        }
        meta={
          <Badge tone="warning" dot>
            Internal test harness
          </Badge>
        }
      />

      <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden="true" />
        <div className="text-fg">
          <p className="font-semibold">Internal test harness — not a production feature.</p>
          <p className="mt-0.5 text-fg-secondary">
            This page calls the third-party tracker API with a fixed test account and is intended for developers only. Flagged for review: the test credentials are bundled into the browser.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="1) Get token"
            actions={
              <Button size="sm" onClick={doLogin} loading={busy === "login"} disabled={busy !== null}>
                Login
              </Button>
            }
          />
          <CardContent className="space-y-4">
            <Field label="Login JSON body" hint={parsedLoginBody.ok ? "Read-only" : `Invalid JSON: ${parsedLoginBody.error}`}>
              <Textarea value={loginBodyText} onChange={(e) => setLoginBodyText(e.target.value)} className="h-40 font-mono text-xs" spellCheck={false} readOnly />
            </Field>
            <FormGrid cols={2}>
              <Field label="UserID">
                <Input mono value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Will auto-fill after login" readOnly />
              </Field>
              <Field label="Token">
                <Input mono value={token} onChange={(e) => setToken(e.target.value)} placeholder="Will auto-fill after login" readOnly />
              </Field>
            </FormGrid>
            <div>
              <p className="text-[13px] font-medium text-fg-secondary">Token response</p>
              <JsonOut value={loginStatus} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="2) Get live location (GetVLL)"
            actions={
              <Button size="sm" onClick={() => doLocation(false)} loading={busy === "location"} disabled={busy !== null || !token || !userId || !phone || !year}>
                Fetch location
              </Button>
            }
          />
          <CardContent className="space-y-4">
            <FormGrid cols={2}>
              <Field label="Phone">
                <Input mono value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 03156618471" />
              </Field>
              <Field label="Year">
                <Input mono value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1992" />
              </Field>
            </FormGrid>
            <p className="text-xs text-fg-muted">
              Sends headers <Code>x-tracker-userid</Code> and <Code>x-tracker-token</Code>.
            </p>
            <div>
              <p className="text-[13px] font-medium text-fg-secondary">Location response</p>
              <JsonOut value={locationStatus} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Map"
          description={
            <>
              Vehicles from GetVLL are plotted using <Code>Lat</Code> and <Code>Long</Code>.
            </>
          }
          actions={<span className="text-xs text-fg-muted">{mapMarkers.length ? `${mapMarkers.length} marker(s)` : "No markers yet"}</span>}
        />
        <Map height="520px" markers={mapMarkers} />
      </Card>
    </div>
  );
}
