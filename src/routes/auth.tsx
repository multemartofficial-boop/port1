import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Yours" }] }),
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back");
      nav({ to: "/" });
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account created — you're signed in");
      nav({ to: "/" });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email for a reset link");
      setMode("signin");
    }
  };

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password";
  const sub =
    mode === "signin"
      ? "Access your orders, wishlist and bookings."
      : mode === "signup"
        ? "Join Yours+ to get member pricing."
        : "Enter your email — we'll send you a reset link.";

  return (
    <SiteLayout>
      <div className="container-page py-14 max-w-md">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
        <form
          onSubmit={submit}
          className="mt-6 space-y-3 rounded-lg border border-border p-5 bg-card"
        >
          {mode === "signup" && (
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2.5 text-sm"
            />
          )}
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2.5 text-sm"
          />
          {mode !== "forgot" && (
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full rounded-md border border-input px-3 py-2.5 text-sm"
            />
          )}
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
          {mode === "signin" && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs text-primary font-bold hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>
        <div className="mt-4 text-sm text-center text-muted-foreground">
          {mode === "signin" && (
            <>
              New here?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-primary font-bold hover:underline"
              >
                Create an account
              </button>
            </>
          )}
          {mode === "signup" && (
            <>
              Have an account?{" "}
              <button
                onClick={() => setMode("signin")}
                className="text-primary font-bold hover:underline"
              >
                Sign in
              </button>
            </>
          )}
          {mode === "forgot" && (
            <>
              <button
                onClick={() => setMode("signin")}
                className="text-primary font-bold hover:underline"
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>
        <div className="mt-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-xs">
          <div className="font-bold uppercase tracking-widest text-primary">Demo accounts</div>
          <p className="mt-1 text-muted-foreground">
            This is a showcase build — everything runs on fictional local data. Sign in with:
          </p>
          <div className="mt-2 space-y-1 font-mono">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setEmail("admin@demo.io");
                setPassword("admin123");
              }}
              className="block w-full text-left hover:text-primary"
            >
              admin@demo.io / admin123{" "}
              <span className="text-muted-foreground">— admin dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setEmail("staff@demo.io");
                setPassword("staff123");
              }}
              className="block w-full text-left hover:text-primary"
            >
              staff@demo.io / staff123{" "}
              <span className="text-muted-foreground">— staff (cycle bookings)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setEmail("customer@demo.io");
                setPassword("demo1234");
              }}
              className="block w-full text-left hover:text-primary"
            >
              customer@demo.io / demo1234 <span className="text-muted-foreground">— customer</span>
            </button>
          </div>
        </div>
        <div className="mt-6 text-xs text-muted-foreground text-center">
          <Link to="/">← Back to shop</Link>
        </div>
      </div>
    </SiteLayout>
  );
}
