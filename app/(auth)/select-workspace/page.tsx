"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, Check, ChevronRight, Loader2, LogIn, ShieldCheck, Users } from "lucide-react";

interface Workspace {
  tenantSlug:  string;
  tenantName:  string;
  accountType: string;
  role:        string;
}

interface StoredData {
  email:      string;
  password:   string;
  workspaces: Workspace[];
}

const ROLE_LABEL: Record<string, string> = {
  TENANT_OWNER:  "Owner",
  TENANT_ADMIN:  "Admin",
  TENANT_MEMBER: "Member",
  AGENT:         "Agent",
  RESELLER:      "Reseller",
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLIENT:   "Workspace",
  RESELLER: "Reseller account",
  PLATFORM: "Platform admin",
};

export default function SelectWorkspacePage() {
  const router = useRouter();
  const [data, setData] = useState<StoredData | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("wa_ws_select");
      if (!raw) { router.replace("/login"); return; }
      const parsed = JSON.parse(raw) as StoredData;
      if (!parsed.workspaces?.length) { router.replace("/login"); return; }
      setData(parsed);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  async function select(ws: Workspace) {
    if (!data || selecting) return;
    setSelecting(ws.tenantSlug);
    setError("");

    const result = await signIn("credentials", {
      email:      data.email,
      password:   data.password,
      tenantSlug: ws.tenantSlug,
      redirect:   false,
    });

    if (result?.error) {
      setError("Could not sign in to this workspace. Please try again.");
      setSelecting(null);
      return;
    }

    // Clear stored credentials immediately after successful sign-in
    try { sessionStorage.removeItem("wa_ws_select"); } catch { /* ignore */ }

    router.push(ws.accountType === "PLATFORM" ? "/dashboard" : "/inbox");
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-200">
          <Building2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Select a workspace</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Your account <span className="font-medium text-slate-700">{data.email}</span> has access to {data.workspaces.length} workspaces.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <ul className="space-y-2.5">
        {data.workspaces.map((ws) => {
          const isLoading = selecting === ws.tenantSlug;
          const isDisabled = !!selecting && !isLoading;

          return (
            <li key={ws.tenantSlug}>
              <button
                type="button"
                onClick={() => select(ws)}
                disabled={isDisabled}
                className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                {/* Icon */}
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-inset ring-emerald-200 transition group-hover:bg-emerald-600 group-hover:ring-emerald-600">
                  {ws.accountType === "PLATFORM"
                    ? <ShieldCheck className="h-5 w-5 text-emerald-600 transition group-hover:text-white" />
                    : ws.accountType === "RESELLER"
                    ? <Users className="h-5 w-5 text-emerald-600 transition group-hover:text-white" />
                    : <Building2 className="h-5 w-5 text-emerald-600 transition group-hover:text-white" />
                  }
                </span>

                {/* Labels */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{ws.tenantName}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{ACCOUNT_TYPE_LABEL[ws.accountType] ?? ws.accountType}</span>
                    <span aria-hidden className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {ROLE_LABEL[ws.role] ?? ws.role}
                    </span>
                  </span>
                </span>

                {/* Arrow / spinner */}
                <span className="shrink-0 text-slate-400 transition group-hover:text-emerald-600">
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  }
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Sign in with a different account */}
      <p className="mt-8 text-center text-sm text-slate-500">
        Not your account?{" "}
        <button
          type="button"
          className="font-medium text-emerald-600 transition hover:text-emerald-700 hover:underline"
          onClick={() => {
            try { sessionStorage.removeItem("wa_ws_select"); } catch { /* ignore */ }
            router.push("/login");
          }}
        >
          Sign in with a different account
        </button>
      </p>

      {/* Sign-in icon at bottom for context */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <LogIn className="h-3.5 w-3.5" />
        <span>Signed in as {data.email}</span>
      </div>
    </div>
  );
}
