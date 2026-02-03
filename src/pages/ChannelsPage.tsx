import { Link } from 'react-router-dom';
import { useChannels } from '@/hooks/useChannels';
import { Tv, Radio, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const ChannelsPage = () => {
  const { data: channels, isLoading } = useChannels();

  return (
    <>
      <SEOHead 
        title="Sports Channels - Live TV"
        description="Watch all sports channels live. Stream your favorite sports channels online for free."
        keywords="sports channels, live tv, sports streaming, watch sports online"
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          {/* Back Button & Title */}
          <div className="flex items-center gap-4 mb-6">
            <Link 
              to="/" 
              className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                <Radio className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl md:text-3xl text-gradient">All Sports Channels</h1>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !channels || channels.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Tv className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No channels available</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {channels.map((channel, index) => (
                <motion.div
                  key={channel.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Link to={`/channel/${channel.slug || channel.id}`}>
                    <div className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200">
                      {/* Channel Logo */}
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border border-border/30"
                        style={{ backgroundColor: channel.logo_background_color || '#1a1a2e' }}
                      >
                        {channel.logo_url ? (
                          <img 
                            src={channel.logo_url} 
                            alt={channel.name} 
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Tv className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Channel Name & Watch */}
                      <div className="flex flex-col">
                        <span className="font-medium text-sm group-hover:text-primary transition-colors whitespace-nowrap">
                          {channel.name}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] font-medium text-red-500 animate-pulse">
                          <span className="w-1 h-1 bg-red-500 rounded-full" />
                          Watch
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ChannelsPage;