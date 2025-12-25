import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CricbuzzScore {
  matchId: string;
  title: string;
  status: string;
  matchStarted: boolean;
  matchEnded: boolean;
  score: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
}

export const useCricbuzzScore = (cricbuzzMatchId: string | null | undefined) => {
  return useQuery({
    queryKey: ['cricbuzzScore', cricbuzzMatchId],
    queryFn: async (): Promise<CricbuzzScore | null> => {
      if (!cricbuzzMatchId) {
        return null;
      }

      const { data, error } = await supabase.functions.invoke('cricbuzz-score', {
        body: { matchId: cricbuzzMatchId },
      });

      if (error) {
        console.error('Cricbuzz score fetch error:', error);
        throw new Error('Failed to fetch Cricbuzz score');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as CricbuzzScore;
    },
    enabled: !!cricbuzzMatchId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
    retry: 2,
  });
};
