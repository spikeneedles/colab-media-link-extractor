# Push Protection Recovery Note (2026-03-03)

## What happened

`git push origin main` was blocked by GitHub Push Protection (`GH013`) because secrets were detected in historical commit:

- Commit: `116bc40a261f966917db9a7dd1ad2d924285d6b2`
- File: `backend/data/drive_tokens.json`

The unblock links were not usable in this session (404/no access), so history cleanup was required.

## What we did

1. Created a backup branch before rewriting history:
- `git branch backup/pre-secret-scrub-20260303`

2. Removed `backend/data/drive_tokens.json` from all commits on `main`:
- `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/data/drive_tokens.json" --prune-empty --tag-name-filter cat -- main`

3. Verified file history was removed:
- `git log --oneline -- backend/data/drive_tokens.json` (expected: no output)

4. Force-pushed cleaned history:
- `git push --force-with-lease origin main`

## Result

- Push succeeded.
- `main` moved to cleaned head.
- `backend/data/drive_tokens.json` remains available locally for runtime.
- `backend/data/drive_tokens.json` is now ignored by git via `.gitignore`.

## Related code change in that push

- Added movie streaming presets in:
- `backend/src/services/searchSourcePresets.ts`

## If this happens again

1. Check if the detected secret is in current or historical commits.
2. If unblock UI is unavailable, repeat history rewrite process above.
3. Rotate/revoke any previously exposed OAuth tokens.
4. Keep token files out of git (ignored/untracked).
