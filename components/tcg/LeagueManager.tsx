"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserLeagues, type LeagueDoc } from "@/lib/firestore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type DialogKind = "create" | "join" | null;

interface LeagueManagerProps {
  selectedLeagueId: string | null;
  onSelectLeague: (league: LeagueDoc) => void;
  onClearSelection: () => void;
}

export function LeagueManager({
  selectedLeagueId,
  onSelectLeague,
  onClearSelection,
}: LeagueManagerProps) {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<LeagueDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setLeagues([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getUserLeagues(user.uid);
      setLeagues(list);
    } catch (err) {
      console.error("Failed to load leagues:", err);
      setError("Couldn't load your leagues. Check Firestore rules + indexes.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const post = async (path: string, body: Record<string, unknown>) => {
    if (!user) throw new Error("not signed in");
    const token = await user.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return json as Record<string, unknown>;
  };

  const handleCreate = async (name: string) => {
    setSubmitting(true);
    try {
      await post("/api/tcg/leagues/create", { name });
      toast.success(`Created "${name}"`);
      setDialog(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create league");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (inviteCode: string) => {
    setSubmitting(true);
    try {
      const result = await post("/api/tcg/leagues/join", { inviteCode });
      if (result.alreadyMember) {
        toast("You're already in that league.", { icon: "ℹ️" });
      } else {
        toast.success("Joined!");
      }
      setDialog(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join league");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async (league: LeagueDoc) => {
    const ok = window.confirm(`Leave "${league.name}"?`);
    if (!ok) return;
    setSubmitting(true);
    try {
      await post("/api/tcg/leagues/leave", { leagueId: league.id });
      toast.success(`Left "${league.name}"`);
      if (selectedLeagueId === league.id) onClearSelection();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to leave league");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
        <p className="font-mono text-sm text-[#5a5a64]">
          Sign in to join or create leagues.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setDialog("create")}
        >
          Create League
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDialog("join")}
        >
          Join with Code
        </Button>
      </div>

      {error ? (
        <div className="text-center py-8 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
          <p className="font-mono text-sm text-red-400">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-[#0e0e16] border border-[#1e1e2a] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : leagues.length === 0 ? (
        <div className="text-center py-12 bg-[#0e0e16] border border-[#1e1e2a] rounded-xl">
          <p className="font-mono text-sm text-[#5a5a64] mb-2">
            You&rsquo;re not in any leagues yet.
          </p>
          <p className="font-mono text-xs text-[#5a5a64]">
            Create one, or paste an invite code to join.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leagues.map((league) => {
            const selected = selectedLeagueId === league.id;
            const isOwner = league.ownerUid === user.uid;
            return (
              <div
                key={league.id}
                className={`rounded-lg border transition-colors ${
                  selected
                    ? "border-[#fbbf24] bg-[#fbbf24]/5"
                    : "border-[#1e1e2a] bg-[#0e0e16] hover:bg-[#111118]"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => onSelectLeague(league)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#e8e6e3] text-sm truncate">
                        {league.name}
                      </span>
                      {isOwner && (
                        <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#fbbf24]/10 text-[#fbbf24]">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-[#5a5a64] mt-0.5">
                      {league.memberCount}{" "}
                      {league.memberCount === 1 ? "member" : "members"}
                    </div>
                  </button>
                  <button
                    onClick={() => handleCopy(league.inviteCode)}
                    className="flex-shrink-0 px-2 py-1 font-mono text-[10px] uppercase tracking-widest rounded border border-[#1e1e2a] text-[#8a8a94] hover:text-[#e8e6e3] hover:border-[#3a3a44] transition-colors"
                    title="Copy invite code"
                  >
                    {league.inviteCode}
                  </button>
                  <button
                    onClick={() => handleLeave(league)}
                    disabled={submitting}
                    className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#5a5a64] hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    Leave
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateDialog
        open={dialog === "create"}
        submitting={submitting}
        onClose={() => setDialog(null)}
        onSubmit={handleCreate}
      />
      <JoinDialog
        open={dialog === "join"}
        submitting={submitting}
        onClose={() => setDialog(null)}
        onSubmit={handleJoin}
      />
    </div>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────

function CreateDialog({
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!open) setName("");
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Create a league" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name);
        }}
        className="flex flex-col gap-4"
      >
        <Input
          label="League name"
          placeholder="The Group Chat"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          autoFocus
        />
        <p className="font-mono text-[10px] text-[#5a5a64]">
          You&rsquo;ll get an invite code to share with up to 19 friends.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function JoinDialog({
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  useEffect(() => {
    if (!open) setCode("");
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Join a league" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(code);
        }}
        className="flex flex-col gap-4"
      >
        <Input
          label="Invite code"
          placeholder="QRFK-7VXM"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          autoFocus
          maxLength={12}
        />
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={submitting}>
            Join
          </Button>
        </div>
      </form>
    </Modal>
  );
}
