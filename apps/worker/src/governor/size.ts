// Database size governor (doc 05): free Supabase DB is 500 MB. 80% -> run the early archive pass, 90% -> report degraded.
export const DB_LIMIT_BYTES = 500 * 1024 * 1024;
export type SizeMode = "ok" | "archive" | "degraded";

export function sizeMode(bytes: number, limit = DB_LIMIT_BYTES): SizeMode {
  const pct = bytes / limit;
  if (pct >= 0.9) return "degraded";
  if (pct >= 0.8) return "archive";
  return "ok";
}

export const sizeReport = (bytes: number, limit = DB_LIMIT_BYTES) => ({
  bytes,
  limit,
  pct: Math.round((bytes / limit) * 1000) / 10,
  mode: sizeMode(bytes, limit),
});
