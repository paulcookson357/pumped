import "server-only";
import { revalidateTag } from "next/cache";
import type { SyncDomain } from "@/lib/types/domain";

export const CACHE_TAGS: Record<SyncDomain, SyncDomain> = {
  exercises: "exercises",
  routines: "routines",
  schedule: "schedule",
  workouts: "workouts",
  settings: "settings",
};

export function invalidateDomains(domains: SyncDomain[]): void {
  const unique = new Set<SyncDomain>(domains);
  for (const domain of unique) {
    revalidateTag(CACHE_TAGS[domain]);
  }
}
