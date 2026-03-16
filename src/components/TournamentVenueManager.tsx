import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";

interface Venue {
  id: string;
  tournament_id: string;
  venue_name: string;
  city: string | null;
  country: string | null;
  display_order: number;
}

interface TournamentVenueManagerProps {
  tournamentId: string;
}

const TournamentVenueManager = ({ tournamentId }: TournamentVenueManagerProps) => {
  const { toast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newVenue, setNewVenue] = useState({ venue_name: "", city: "", country: "" });

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from("tournament_venues")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order", { ascending: true });

    if (!error && data) {
      setVenues(data as Venue[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVenues();
  }, [tournamentId]);

  const handleAddVenue = async () => {
    if (!newVenue.venue_name.trim()) {
      toast({ title: "Venue name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("tournament_venues").insert({
      tournament_id: tournamentId,
      venue_name: newVenue.venue_name.trim(),
      city: newVenue.city.trim() || null,
      country: newVenue.country.trim() || null,
      display_order: venues.length,
    });

    if (error) {
      toast({ title: "Failed to add venue", variant: "destructive" });
    } else {
      toast({ title: "Venue added" });
      setNewVenue({ venue_name: "", city: "", country: "" });
      fetchVenues();
    }
    setSaving(false);
  };

  const handleDeleteVenue = async (id: string) => {
    const { error } = await supabase.from("tournament_venues").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete venue", variant: "destructive" });
    } else {
      setVenues((prev) => prev.filter((v) => v.id !== id));
      toast({ title: "Venue deleted" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-primary" />
        <h4 className="font-medium text-sm">Tournament Venues ({venues.length})</h4>
      </div>

      {/* Add new venue */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Venue Name *</Label>
          <Input
            placeholder="e.g., Sher-e-Bangla Stadium"
            value={newVenue.venue_name}
            onChange={(e) => setNewVenue({ ...newVenue, venue_name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input
            placeholder="e.g., Dhaka"
            value={newVenue.city}
            onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input
            placeholder="e.g., Bangladesh"
            value={newVenue.country}
            onChange={(e) => setNewVenue({ ...newVenue, country: e.target.value })}
          />
        </div>
        <Button onClick={handleAddVenue} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          Add
        </Button>
      </div>

      {/* Venue list */}
      {venues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No venues added yet</p>
      ) : (
        <div className="space-y-2">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-background/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{venue.venue_name}</span>
                  {(venue.city || venue.country) && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {[venue.city, venue.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteVenue(venue.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentVenueManager;
