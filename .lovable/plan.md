

## Issues Identified

### Issue 1: Google Login UI not updating after success
The Auth page only calls `navigate("/")` after email/password login. After Google OAuth, the browser redirects back to the app, the session is set via `onAuthStateChange`, but the Auth page has no logic to detect that the user is now authenticated and redirect away. The Auth page needs a `useEffect` that watches `user` from `useAuth()` and navigates to `/` when a user is detected.

### Issue 2: Navbar and Profile data mismatch
Two sub-problems:

**a) Avatar mismatch:** Profile saves avatar IDs like `"avatar-calm"` to the `avatar_url` column. Navbar reads `avatar_url` and displays it directly as text (e.g. showing "avatar-calm" instead of "☁️"). The Navbar needs to map the avatar ID back to its emoji using the same `AVATARS` array.

**b) Nickname mismatch:** Profile's `handleSave` writes the nickname to `display_name` but does NOT write to the `nickname` column. Navbar reads `nickname` first (`profile?.nickname`), which is always null. Profile should also save to the `nickname` column, or Navbar should read `display_name` as fallback consistently.

---

## Plan

### Step 1: Fix Google login redirect on Auth page
- Import `useAuth` in `Auth.tsx`
- Add a `useEffect` that checks if `user` is present and calls `navigate("/")` to redirect authenticated users away from the auth page

### Step 2: Share AVATARS constant
- Extract the `AVATARS` array into a shared file (e.g. `src/lib/avatars.ts`) so both Navbar and Profile can use it

### Step 3: Fix Navbar avatar display
- Import `AVATARS` in `Navbar.tsx`
- Look up the emoji from the `avatar_url` ID (e.g. `"avatar-calm"` → `"☁️"`)
- Fallback to `"🧠"` if no match

### Step 4: Fix Profile save to sync nickname
- Update `handleSave` in `Profile.tsx` to also write the `nickname` column alongside `display_name`
- Update Navbar to read `display_name` as primary fallback if `nickname` is empty

### Files Modified
- `src/pages/Auth.tsx` — add redirect when user is authenticated
- `src/lib/avatars.ts` — new shared file for avatar constants
- `src/components/Navbar.tsx` — use AVATARS lookup for emoji, fix display name fallback
- `src/pages/Profile.tsx` — import shared AVATARS, save nickname column

