"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../../../lib/hooks/useConfirm";
import { apiClient, type Vendor } from "../../../lib/services/api-client";
import { Badge, Button, Dialog, DialogContent, Field, InlineError, Input } from "../../ui";
import { generatePassword } from "../../lib/format";

/**
 * Header action on the vendor page: create / manage the vendor's CORT_VENDOR portal login.
 * The vendor then signs in on the vendor portal and sees only their own vehicles, drivers,
 * routes, trips and live tracking.
 */
export function VendorPortalAccess({ vendorId, canEdit }: { vendorId: number; canEdit: boolean }) {
  const [vendor, setVendor] = React.useState<Vendor | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getVendor(vendorId)
      .then((res) => !cancelled && setVendor(res.data))
      .catch(() => undefined); // the button simply stays hidden
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!vendor) return null;
  const login = vendor.users ?? null;
  const active = login?.status === "ACTIVE";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={!canEdit && !login}>
        <KeyRound aria-hidden="true" />
        Portal access
        {login && (
          <Badge tone={active ? "success" : "neutral"} size="sm" dot>
            {active ? "Active" : "Disabled"}
          </Badge>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          title="Vendor portal access"
          description="The vendor can sign in on the vendor portal to see their own vehicles, drivers, routes, trips and live tracking (read-only)."
        >
          {login ? (
            <ManageLogin
              key={login.id}
              vendor={vendor}
              email={login.email}
              active={active}
              canEdit={canEdit}
              onDone={(v) => setVendor(v)}
            />
          ) : (
            <CreateLogin vendor={vendor} onCancel={() => setOpen(false)} onDone={(v) => setVendor(v)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateLogin({ vendor, onCancel, onDone }: { vendor: Vendor; onCancel: () => void; onDone: (v: Vendor) => void }) {
  const [email, setEmail] = React.useState(vendor.email ?? "");
  const [password, setPassword] = React.useState(() => generatePassword());
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.createVendorPortalLogin(vendor.id, { email: email.trim(), password });
      toast.success("Portal login created. Share the email and password with the vendor.");
      onDone(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Login email" required>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field label="Initial password" hint="Copy it now and share it with the vendor securely." required>
        <Input mono required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Create login
        </Button>
      </div>
    </form>
  );
}

function ManageLogin({
  vendor,
  email,
  active,
  canEdit,
  onDone,
}: {
  vendor: Vendor;
  email: string;
  active: boolean;
  canEdit: boolean;
  onDone: (v: Vendor) => void;
}) {
  const confirm = useConfirm();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"password" | "status" | null>(null);

  const run = async (kind: "password" | "status", data: { password?: string; status?: "ACTIVE" | "INACTIVE" }, success: string) => {
    setBusy(kind);
    setError(null);
    try {
      const res = await apiClient.updateVendorPortalLogin(vendor.id, data);
      toast.success(success);
      setPassword("");
      onDone(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async () => {
    if (active) {
      const ok = await confirm({
        title: "Disable portal access?",
        message: `${vendor.name} will be signed out and can no longer open the vendor portal.`,
        consequences: ["Existing sessions end immediately", "You can enable access again later"],
        confirmLabel: "Disable access",
        destructive: true,
      });
      if (!ok) return;
    }
    await run("status", { status: active ? "INACTIVE" : "ACTIVE" }, active ? "Portal access disabled" : "Portal access enabled");
  };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-subtle p-3 text-sm">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-fg-muted">Login email</dt>
          <dd className="break-all font-medium text-fg">{email}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">Status</dt>
          <dd>
            <Badge tone={active ? "success" : "neutral"} size="sm" dot>
              {active ? "Active" : "Disabled"}
            </Badge>
          </dd>
        </div>
      </dl>

      {canEdit && (
        <>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (password.length < 8) {
                setError("Password must be at least 8 characters.");
                return;
              }
              run("password", { password }, "Password reset. The vendor must sign in again.");
            }}
          >
            <Field label="New password" className="flex-1">
              <Input mono minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </Field>
            <Button type="button" variant="ghost" onClick={() => setPassword(generatePassword())}>
              Generate
            </Button>
            <Button type="submit" variant="outline" loading={busy === "password"} disabled={!password}>
              Reset
            </Button>
          </form>
          {error && <InlineError>{error}</InlineError>}
          <div className="flex justify-end border-t border-line pt-4">
            <Button variant={active ? "danger" : "primary"} onClick={toggleStatus} loading={busy === "status"}>
              {active ? "Disable access" : "Enable access"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
