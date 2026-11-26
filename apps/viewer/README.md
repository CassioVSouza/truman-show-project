# Public viewer

Run `pnpm --filter @truman/viewer dev` from the repo root to open the local viewer with sample data.

Set the public URLs in the production build environment.

- `VITE_SNAPSHOT_BASE` is the base URL that serves `live.json`. Each file carries a committed scene snapshot, its matching timeline, and status. The viewer refreshes about once a minute and plays movements against the current time. When a refresh fails, it shows the last verified bundle with a delay indicator. If no valid bundle has arrived, it shows the live feed as unavailable.
- `VITE_API_BASE` points to the Worker for search, causal context, Life and Lab views, and translation. Open a thought or action's causal context to see the log entry available through the Worker. Local API-only development can also use the Worker's snapshot and events endpoints.

Set these variables before running `pnpm --filter @truman/viewer build`. For separate hosts, allow the viewer's origin on the Worker API and ensure `live.json` is readable across origins. Every `VITE_` value is public.
