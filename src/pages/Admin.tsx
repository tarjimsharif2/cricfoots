import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Match, Team, Tournament, sampleMatches, sampleTeams, sampleTournament } from "@/types/match";
import { useState } from "react";
import { Plus, Edit2, Trash2, Calendar, Trophy, Users, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>(sampleMatches);
  const [teams, setTeams] = useState<Team[]>(sampleTeams);
  const [tournaments, setTournaments] = useState<Tournament[]>([sampleTournament]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Simple login simulation (will be replaced with Supabase auth)
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulated login - replace with actual auth
    if (loginData.email && loginData.password) {
      setIsLoggedIn(true);
      toast({
        title: "Logged in successfully",
        description: "Welcome to the admin panel.",
      });
    }
  };

  const handleDeleteMatch = (id: string) => {
    setMatches(matches.filter(m => m.id !== id));
    toast({
      title: "Match deleted",
      description: "The match has been removed.",
    });
  };

  const handleDeleteTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
    toast({
      title: "Team deleted",
      description: "The team has been removed.",
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Lock className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle className="font-display text-3xl tracking-wider text-gradient">
                  ADMIN LOGIN
                </CardTitle>
                <CardDescription>
                  Sign in to manage matches, teams, and tournaments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" variant="gradient" className="w-full">
                    Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h1 className="font-display text-4xl md:text-5xl tracking-wider text-gradient mb-2">
              ADMIN PANEL
            </h1>
            <p className="text-muted-foreground">
              Manage your matches, teams, and tournaments
            </p>
          </motion.div>

          <Tabs defaultValue="matches" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="matches" className="gap-2">
                <Calendar className="w-4 h-4" />
                Matches
              </TabsTrigger>
              <TabsTrigger value="teams" className="gap-2">
                <Users className="w-4 h-4" />
                Teams
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="gap-2">
                <Trophy className="w-4 h-4" />
                Tournaments
              </TabsTrigger>
            </TabsList>

            {/* Matches Tab */}
            <TabsContent value="matches" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Matches</h2>
                <Button variant="gradient" size="sm">
                  <Plus className="w-4 h-4" />
                  Add Match
                </Button>
              </div>

              <div className="grid gap-4">
                {matches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="sport">{match.tournament.sport}</Badge>
                              <span className="text-muted-foreground text-sm">
                                {match.tournament.name} {match.tournament.season}
                              </span>
                            </div>
                            <p className="font-semibold text-lg">
                              {match.team_a.name} vs {match.team_b.name}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {match.match_date} • {match.match_time}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={match.status === 'live' ? 'live' : match.status === 'completed' ? 'completed' : 'upcoming'}>
                              {match.status}
                            </Badge>
                            <Button variant="ghost" size="icon">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteMatch(match.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Teams</h2>
                <Button variant="gradient" size="sm">
                  <Plus className="w-4 h-4" />
                  Add Team
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teams.map((team, index) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/20">
                            <span className="font-display text-primary">
                              {team.short_name}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{team.name}</p>
                            <p className="text-muted-foreground text-sm">{team.short_name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteTeam(team.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Tournaments Tab */}
            <TabsContent value="tournaments" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Tournaments</h2>
                <Button variant="gradient" size="sm">
                  <Plus className="w-4 h-4" />
                  Add Tournament
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {tournaments.map((tournament, index) => (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-display text-2xl text-gradient tracking-wider mb-2">
                              {tournament.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="sport">{tournament.sport}</Badge>
                              <span className="text-muted-foreground text-sm">
                                Season {tournament.season}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
