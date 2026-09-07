"use client";
import { FieldLabel, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useActionState, useState } from "react";
import {
  updateProfileAction,
  updatePasswordAction,
  deleteAccountAction,
  type UpdateProfileState,
  type UpdatePasswordState,
  type DeleteAccountState,
} from "@/app/account/actions";
import { AvatarUploadForm } from "@/components/account/AvatarUploadForm";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

const profileInitial: UpdateProfileState = { error: null };
const passwordInitial: UpdatePasswordState = { error: null };
const deleteInitial: DeleteAccountState = { error: null };

export function SettingsPanel({
  email,
  name,
  phone,
  location,
  avatarUrl,
}: {
  email: string;
  name: string;
  phone: string;
  location: string;
  avatarUrl: string | null;
}) {
  // Display currency is a live preference, not part of the "Save changes" flow:
  // changing it applies instantly across the app (and persists) via the provider.
  // Keeping it controlled by provider state also makes it immune to React 19's
  // post-action form reset, which was reverting an uncontrolled <select>.
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, profileInitial);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePasswordAction, passwordInitial);
  const [deleteState, deleteActionFn, deletePending] = useActionState(deleteAccountAction, deleteInitial);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="form-stack">
      <section className="form-section">
        <h3 className="mb-2">Profile information</h3>
        <p className="text-ink-dim text-[13px] mb-5">
          Shown to buyers and sellers you interact with on renew.
        </p>

        <div className="mb-5 pb-5 border-b border-line">
          <AvatarUploadForm avatarUrl={avatarUrl} initials={(name || email).slice(0, 2).toUpperCase()} />
        </div>

        <form action={profileAction} className="space-y-6">
          {profileState.error && (
            <p role="alert" className="form-notice text-danger">
              {profileState.error}
            </p>
          )}
          {profileState.success && (
            <p role="status" className="form-notice text-pass">
              Saved.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input id="name" name="name" type="text" defaultValue={name}  />
            </div>
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" value={email} disabled  />
            </div>
            <div>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" name="phone" type="text" defaultValue={phone} placeholder="+63 917 555 0142"  />
            </div>
            <div>
              <FieldLabel htmlFor="location">Location</FieldLabel>
              <Input id="location" name="location" type="text" defaultValue={location} placeholder="Manila, Philippines"  />
            </div>
            <div>
              <FieldLabel htmlFor="preferredCurrency">Display currency</FieldLabel>
              <div className="relative">
                {/* form="__none__" points at no form, so despite living inside the
                    profile <form> this control has no form owner — it isn't submitted
                    or reset by "Save changes". It's a live preference driven entirely
                    by the CurrencyProvider (applies instantly). */}
                <Select
                  id="preferredCurrency"
                  form="__none__"
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className="appearance-none pr-10"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-ink-dim"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <p className="text-[11.5px] text-ink-dim mt-1">
                Applies instantly across the site. Sellers always set their own.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={profilePending}
            >
              {profilePending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      <section className="form-section">
        <h3 className="mb-2">Password &amp; security</h3>
        <p className="text-ink-dim text-[13px] mb-5">
          Use a strong password you&apos;re not using anywhere else.
        </p>

        <form
          action={passwordAction}
          className="space-y-6"
          onSubmit={(e) => {
            const form = e.currentTarget;
            if (form.newPassword.value !== form.confirmPassword.value) {
              e.preventDefault();
            }
          }}
        >
          {passwordState.error && (
            <p role="alert" className="form-notice text-danger">
              {passwordState.error}
            </p>
          )}
          {passwordState.success && (
            <p role="status" className="form-notice text-pass">
              Password updated.
            </p>
          )}
          <div>
            <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
            <Input id="currentPassword" name="currentPassword" type="password" required  />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input id="newPassword" name="newPassword" type="password" required minLength={8}  />
            </div>
            <div>
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
              <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8}  />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={passwordPending}
            >
              {passwordPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </section>

      <section className="form-section">
        <h3 className="mb-2">Delete account</h3>
        <p className="text-ink-dim text-[13px] mb-5">
          Deleting your account removes your listings, photos, and saved items permanently. This
          can&apos;t be undone.
        </p>

        {!confirmingDelete ? (
          <Button variant="danger-outline" size="small"
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete my account
          </Button>
        ) : (
          <form action={deleteActionFn} className="space-y-3 max-w-sm">
            {deleteState.error && (
              <p role="alert" className="form-notice text-danger">
                {deleteState.error}
              </p>
            )}
            <div>
              <FieldLabel htmlFor="confirmEmail">
                Type <span className="font-body text-ink">{email}</span> to confirm
              </FieldLabel>
              <Input id="confirmEmail" name="confirmEmail" type="text" required  />
            </div>
            <div className="flex gap-2">
              <Button variant="danger"
                type="submit"
                disabled={deletePending}
              >
                {deletePending ? "Deleting…" : "Permanently delete account"}
              </Button>
              <Button variant="secondary" size="small"
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deletePending}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
