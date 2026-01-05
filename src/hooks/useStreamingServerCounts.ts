import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ServerCount {
  match_id: string;
  count: number;
}

export const useStreamingServerCounts = () => {
  return useQuery({
    queryKey: ['streaming-server-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      // Use public view for counting (only shows active servers)
      const { data, error } = await supabase
        .from('streaming_servers_public')
        .select('match_id');
      
      if (error) throw error;
      
      // Count servers per match
      const counts: Record<string, number> = {};
      data?.forEach((server) => {
        counts[server.match_id] = (counts[server.match_id] || 0) + 1;
      });
      
      return counts;
    },
  });
};
