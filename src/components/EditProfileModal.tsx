"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { Camera, Check, KeyRound, Loader2, Trash2, User, X } from "lucide-react";

interface EditProfileModalProps {
  open: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileModal({
  open,
  user,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const supabase = createClient();
  useLockBodyScroll(open);

  const [fullName, setFullName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [syncGroupNames, setSyncGroupNames] = useState(true);

  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFullName(user.name);
      setAvatarPreview(user.avatarUrl);
      setAvatarFile(null);
      setClearAvatar(false);
      setSyncGroupNames(true);
      setShowPasswordFields(false);
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setSuccessMsg(null);
    }
  }, [open, user.name, user.avatarUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Avatar image must be under 3 MB.");
      return;
    }
    setError(null);
    setAvatarFile(file);
    setClearAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cleanName = fullName.trim();
      if (!cleanName) throw new Error("Display name cannot be empty.");

      if (showPasswordFields && newPassword) {
        if (newPassword.length < 6) {
          throw new Error("New password must be at least 6 characters.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
      }

      let uploadedAvatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "png";
        const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
        uploadedAvatarUrl = urlData.publicUrl;
      }

      const { error: rpcErr } = await supabase.rpc("update_my_profile", {
        p_full_name: cleanName,
        p_avatar_url: uploadedAvatarUrl,
        p_clear_avatar: clearAvatar,
        p_sync_group_names: syncGroupNames,
      });
      if (rpcErr) throw rpcErr;

      // Also keep auth user metadata in sync (+ optional password update)
      const authUpdate: {
        data: { full_name: string; avatar_url?: string | null };
        password?: string;
      } = {
        data: {
          full_name: cleanName,
          ...(clearAvatar
            ? { avatar_url: null }
            : uploadedAvatarUrl
            ? { avatar_url: uploadedAvatarUrl }
            : {}),
        },
      };
      if (showPasswordFields && newPassword) {
        authUpdate.password = newPassword;
      }

      const { error: authErr } = await supabase.auth.updateUser(authUpdate);
      if (authErr) throw authErr;

      setSuccessMsg("Profile updated!");
      onSaved();
      setTimeout(() => onClose(), 350);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      onClick={() => !busy && onClose()}
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-800 bg-[#121621] p-6 space-y-5 shadow-2xl shadow-black/80"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/12 border border-emerald-500/30 flex items-center justify-center">
              <User className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Edit Profile</h2>
              <p className="text-[11px] text-slate-400">
                Customize your name, avatar, and password
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Picker */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80">
            <div className="relative h-14 w-14 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-semibold text-slate-200">
                  {(fullName || user.email || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition">
                  <Camera className="h-3.5 w-3.5 text-emerald-400" />
                  Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFilePick}
                  />
                </label>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setClearAvatar(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/15 text-xs text-slate-400 hover:text-rose-300 cursor-pointer transition"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">PNG, JPG, or WebP up to 3 MB</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Display Name
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email Address
            </label>
            <input
              disabled
              value={user.email}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/80 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Sync group names checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 cursor-pointer">
            <input
              type="checkbox"
              checked={syncGroupNames}
              onChange={(e) => setSyncGroupNames(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs text-slate-300 leading-snug">
              Update my display name across all Project Groups I belong to
            </span>
          </label>

          {/* Optional Change Password section */}
          <div className="pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowPasswordFields((s) => !s)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-300 transition cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {showPasswordFields ? "Cancel Password Change" : "Change Password"}
            </button>

            {showPasswordFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2 rounded-xl bg-[#161a24] border border-slate-700/70 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> {successMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
