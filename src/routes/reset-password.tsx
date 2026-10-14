import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Yours" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase's recovery link redirects here with a session in the URL hash;
    // the client auto-parses it. Listen for the PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — you're signed in");
    nav({ to: "/" });
  };

  return (
    <SiteLayout>
      <div className="container-page py-14 max-w-md">
        <h1 className="text-3xl font-black tracking-tight">Set a new password</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for reset link… If nothing happens, open the link in your email again, or <Link to="/auth" className="text-primary font-bold">request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border border-border p-5 bg-card">
            <input required type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
            <input required type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={6} className="w-full rounded-md border border-input px-3 py-2.5 text-sm" />
            <button disabled={busy} className="w-full rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </SiteLayout>
  );
}
