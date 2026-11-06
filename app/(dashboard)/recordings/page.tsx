"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, PhoneIncoming, PhoneOutgoing, Play } from "lucide-react";
import { Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatCallDuration } from "@/lib/calls/webrtc";
import { readList } from "@/lib/api/readList";

interface RecordingRow {
  id: string;
  sizeBytes: number;
  durationSec: number | null;
  createdAt: string;
  call: {
    id: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    fromPhone: string;
    toPhone: string;
    durationSec: number | null;
    contact: { id: string; name: string | null; phone: string } | null;
    answeredBy: { id: string; name: string | null } | null;
  };
}

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Call recordings.
 *
 * Audio is fetched through a link signed when the play button is pressed rather than one
 * stored with the row, so a recording cannot be reached by anyone who once saw its
 * address and access is decided per request.
 */
export default function RecordingsPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["call-recordings", page],
    queryFn: async () =>
      readList<RecordingRow>(
        await fetch(`/api/calls/recordings?page=${page}&limit=${PAGE_SIZE}`),
        "recordings",
        "Failed to load recordings",
      ),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const play = async (id: string) => {
    try {
      const res = await fetch(`/api/calls/recordings/${id}/url`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Could not open that recording");
      setSrc(((json?.data ?? json) as { url: string }).url);
      setPlaying(id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not open that recording", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Call recordings"
        description="Audio captured during calls, newest first."
      />

      <Card className="mb-4 border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          Calls are recorded in the agent&apos;s browser, because WhatsApp audio travels
          directly between the customer and the agent and never passes through our servers.
          A recording therefore needs the tab to stay open until the call ends — if it is
          closed mid-call, that one will be short or missing.
        </p>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        // Kept apart from the empty state: a failed request and no recordings look
        // identical otherwise, and only one of them is worth investigating.
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {(error as Error).message}
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No recordings yet"
          description="Recordings appear here once calls have been answered in the dashboard."
        />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => {
              const who = r.call.contact?.name || r.call.contact?.phone ||
                (r.call.direction === "INBOUND" ? r.call.fromPhone : r.call.toPhone);
              const seconds = r.durationSec ?? r.call.durationSec ?? 0;
              const Icon = r.call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;

              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{who}</p>
                      <p className="text-xs text-slate-500">
                        {formatWhen(r.createdAt)}
                        {seconds > 0 && <> · {formatCallDuration(seconds)}</>}
                        {r.call.answeredBy?.name && <> · {r.call.answeredBy.name}</>}
                        {" · "}{formatSize(r.sizeBytes)}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => play(r.id)}>
                      <Play className="h-4 w-4" />
                      Play
                    </Button>
                  </div>

                  {playing === r.id && src && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio src={src} controls autoPlay className="mt-3 w-full" />
                  )}
                </Card>
              );
            })}
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {page} of {pages} · {total.toLocaleString()} recording
                {total === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
