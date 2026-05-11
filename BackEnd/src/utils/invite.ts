// ── Invite expiry constant ───────────────────────────────────────────
// New invite codes (and regenerated ones) are valid for this window.
// Used by:
//   - Household schema default + pre-save hook (`models/household.model.ts`)
//   - `regenerateInviteCode` in `services/household.service.ts`
//   - The read-path backfill for legacy households (same service)
//   - The integration / unit tests that assert the resulting expiry window
//
// Lives in its own util module to avoid a circular import between the model
// and the service.
const ONE_DAY_MS = 86_400_000;
export const INVITE_CODE_TTL_MS = 7 * ONE_DAY_MS;
