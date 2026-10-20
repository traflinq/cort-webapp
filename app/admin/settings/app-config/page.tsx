"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { SuperAdminPage } from "../../components/SuperAdminPage";
import { apiClient } from "../../../lib/services/api-client";
import type { MobileAppConfig } from "../../../lib/services/types/app-config";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { Badge, Button, Card, CardContent, CardHeader, CardSkeleton, ErrorState, Field, FormGrid, Input, PageHeader, Switch, Textarea } from "../../ui";

const PLAY_STORE_PLACEHOLDER = "https://play.google.com/store/apps/details?id=com.corttechnologies.traflinq";
const APP_STORE_PLACEHOLDER = "https://apps.apple.com/app/idXXXXXXXX";

type FormState = {
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  iosMinVersion: string;
  androidMinVersion: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
  forceUpdateMessage: string;
};

const EMPTY_FORM: FormState = {
  maintenanceEnabled: false,
  maintenanceMessage: "",
  iosMinVersion: "",
  androidMinVersion: "",
  iosStoreUrl: "",
  androidStoreUrl: "",
  forceUpdateMessage: "",
};

function toForm(config: MobileAppConfig): FormState {
  return {
    maintenanceEnabled: config.maintenanceEnabled,
    maintenanceMessage: config.maintenanceMessage ?? "",
    iosMinVersion: config.iosMinVersion ?? "",
    androidMinVersion: config.androidMinVersion ?? "",
    iosStoreUrl: config.iosStoreUrl ?? "",
    androidStoreUrl: config.androidStoreUrl ?? "",
    forceUpdateMessage: config.forceUpdateMessage ?? "",
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export default function AppConfigPage() {
  return (
    <SuperAdminPage>
      <AppConfigContent />
    </SuperAdminPage>
  );
}

function AppConfigContent() {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getAppConfig();
        if (cancelled) return;
        const next = toForm(data);
        setForm(next);
        setSaved(next);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load app config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const fetchConfig = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (form.maintenanceEnabled && !saved.maintenanceEnabled) {
      const ok = await confirm({
        title: "Turn on maintenance mode?",
        message: "Every mobile app user will be blocked until maintenance mode is turned off again.",
        consequences: ["Drivers cannot start or end trips from the app", "Employees cannot book or check in", "Takes effect when apps next come to the foreground"],
        confirmLabel: "Turn on and save",
        destructive: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await apiClient.updateAppConfig({
        maintenanceEnabled: form.maintenanceEnabled,
        maintenanceMessage: emptyToNull(form.maintenanceMessage),
        iosMinVersion: emptyToNull(form.iosMinVersion),
        androidMinVersion: emptyToNull(form.androidMinVersion),
        iosStoreUrl: emptyToNull(form.iosStoreUrl),
        androidStoreUrl: emptyToNull(form.androidStoreUrl),
        forceUpdateMessage: emptyToNull(form.forceUpdateMessage),
      });
      const next = toForm(data);
      setForm(next);
      setSaved(next);
      toast.success("App config saved");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save app config";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="App config"
        description="Control mobile maintenance mode and the minimum iOS / Android versions. Open apps pick up changes the next time they launch or return to the foreground."
        meta={
          form.maintenanceEnabled ? (
            <Badge tone="danger" dot>
              Maintenance mode on
            </Badge>
          ) : (
            <Badge tone="success" dot>
              Apps available
            </Badge>
          )
        }
        actions={
          <>
            {dirty && (
              <Button variant="ghost" onClick={() => setForm(saved)} disabled={saving}>
                Discard
              </Button>
            )}
            <Button onClick={() => void handleSave()} loading={saving} disabled={loading || !dirty} leftIcon={<Save />}>
              Save changes
            </Button>
          </>
        }
      />

      {error && !loading && <ErrorState compact title="Couldn't load app config" message={error} onRetry={fetchConfig} />}

      {loading ? (
        <>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </>
      ) : (
        <>
          <Card>
            <CardHeader title="Maintenance mode" description="Blocks the app for every user, even on the latest version. Use this when the service is temporarily unavailable." />
            <CardContent className="space-y-4">
              <Switch
                label="Maintenance mode"
                description={form.maintenanceEnabled ? "The app is currently blocked for all users." : "The app is available to users."}
                checked={form.maintenanceEnabled}
                onCheckedChange={(checked) => patch("maintenanceEnabled", checked)}
                disabled={saving}
              />
              <Field label="Message shown in the app" hint="Up to 500 characters.">
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={form.maintenanceMessage}
                  onChange={(e) => patch("maintenanceMessage", e.target.value)}
                  placeholder="Traflinq is temporarily unavailable. Please try again shortly."
                  disabled={saving}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Force update" description="Users on a version below the platform minimum are stopped until they update from the store. Leave a version blank to disable force-update for that platform." />
            <CardContent className="space-y-4">
              <FormGrid cols={2}>
                <Field label="iOS minimum version">
                  <Input mono value={form.iosMinVersion} onChange={(e) => patch("iosMinVersion", e.target.value)} placeholder="1.3.0" disabled={saving} />
                </Field>
                <Field label="Android minimum version">
                  <Input mono value={form.androidMinVersion} onChange={(e) => patch("androidMinVersion", e.target.value)} placeholder="1.3.0" disabled={saving} />
                </Field>
                <Field label="App Store URL">
                  <Input type="url" value={form.iosStoreUrl} onChange={(e) => patch("iosStoreUrl", e.target.value)} placeholder={APP_STORE_PLACEHOLDER} disabled={saving} />
                </Field>
                <Field label="Play Store URL">
                  <Input type="url" value={form.androidStoreUrl} onChange={(e) => patch("androidStoreUrl", e.target.value)} placeholder={PLAY_STORE_PLACEHOLDER} disabled={saving} />
                </Field>
              </FormGrid>
              <Field label="Update message" hint="Up to 500 characters.">
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={form.forceUpdateMessage}
                  onChange={(e) => patch("forceUpdateMessage", e.target.value)}
                  placeholder="A new version of Traflinq is required. Please update to continue."
                  disabled={saving}
                />
              </Field>
            </CardContent>
          </Card>

          <p className="text-xs text-fg-muted">
            Already-open apps refresh this config when brought back to the foreground (not more than once a minute). This only affects iOS and Android builds that include the version-check code.
          </p>
        </>
      )}
    </div>
  );
}
