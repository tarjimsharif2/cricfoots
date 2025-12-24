import { Match, sampleMatches } from "@/types/match";
import MatchCard from "@/components/MatchCard";
import { motion } from "framer-motion";

interface MatchListProps {
  matches?: Match[];
}

const MatchList = ({ matches = sampleMatches }: MatchListProps) => {
  return (
    <section id="matches" className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl md:text-5xl tracking-wider text-gradient mb-2">
            UPCOMING MATCHES
          </h2>
          <p className="text-muted-foreground">
            Don't miss the action - check out the latest fixtures
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match, index) => (
            <MatchCard key={match.id} match={match} index={index} />
          ))}
        </div>

        {matches.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No matches scheduled yet.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default MatchList;
