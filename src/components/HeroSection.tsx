import heroBanner from "@/assets/hero-banner.jpg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Play, Calendar } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroBanner}
          alt="Sports Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-1.5 mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-primary">Live Matches Available</span>
          </motion.div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-wider mb-4">
            <span className="text-foreground">WATCH</span>{" "}
            <span className="text-gradient">LIVE SPORTS</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg">
            Stream your favorite cricket matches, football games, and more. 
            Anytime, anywhere. Never miss a moment.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button variant="hero" size="xl">
              <Play className="w-5 h-5" />
              Watch Now
            </Button>
            <Button variant="outline" size="xl">
              <Calendar className="w-5 h-5" />
              View Schedule
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
