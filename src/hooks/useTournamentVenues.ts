import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TournamentVenue {
  id: string;
  tournament_id: string;
  venue_name: string;
  city: string | null;
  country: string | null;
  display_order: number;
}

export const useTournamentVenues = (tournamentId: string | undefined) => {
  const [venues, setVenues] = useState<TournamentVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setVenues([]);
      setLoading(false);
      return;
    }

    const fetchVenues = async () => {
      const { data, error } = await supabase
        .from("tournament_venues")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("display_order", { ascending: true });

      if (!error && data) {
        setVenues(data as TournamentVenue[]);
      }
      setLoading(false);
    };

    fetchVenues();
  }, [tournamentId]);

  return { venues, loading };
};
