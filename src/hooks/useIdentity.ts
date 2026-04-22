import { useQuery } from "@tanstack/react-query";
import { useIdentityStore, type IdentityRecord } from "../store/identities";
import { searchIdentities } from "../api/client";

export function useIdentity(userId: string): { data: IdentityRecord | null; isLoading: boolean } {
  const cached = useIdentityStore((s) => s.records[userId]);
  const isStale = useIdentityStore((s) => s.isStale(userId));
  const upsert = useIdentityStore((s) => s.upsert);

  const { isLoading } = useQuery({
    queryKey: ["identity", userId],
    queryFn: async () => {
      const results = await searchIdentities(userId);
      const match = results.find((r) => r.id === userId) ?? results[0];
      if (match) {
        upsert(match);
        return match;
      }
      return null;
    },
    enabled: isStale && userId.length > 0,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  return { data: cached ?? null, isLoading: isLoading && !cached };
}
