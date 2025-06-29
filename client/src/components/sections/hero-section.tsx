import { Button } from "@/components/ui/button";
import AnimatedCounter from "@/components/ui/animated-counter";
import { motion } from "framer-motion";

interface HeroSectionProps {
  onWalletConnect: () => void;
  onInviteClick: () => void;
}

export default function HeroSection({ onWalletConnect, onInviteClick }: HeroSectionProps) {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden pt-16">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(263,70%,50%)]/10 via-[hsl(0,0%,4%)] to-[hsl(187,100%,42%)]/10"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(263,70%,50%)]/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(187,100%,42%)]/20 rounded-full blur-3xl animate-pulse-slow"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          {/* Trust Badges */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center space-x-4 mb-8 flex-wrap gap-2"
          >
            <div className="bg-[hsl(0,0%,18%)]/50 backdrop-blur-sm px-4 py-2 rounded-full border border-[hsl(263,70%,50%)]/30">
              <span className="text-[hsl(263,70%,50%)] font-medium text-sm">✓ BATTLE-TESTED</span>
            </div>
            <div className="bg-[hsl(0,0%,18%)]/50 backdrop-blur-sm px-4 py-2 rounded-full border border-[hsl(187,100%,42%)]/30">
              <span className="text-[hsl(187,100%,42%)] font-medium text-sm">✓ UNDETECTED</span>
            </div>
            <div className="bg-[hsl(0,0%,18%)]/50 backdrop-blur-sm px-4 py-2 rounded-full border border-green-500/30">
              <span className="text-green-400 font-medium text-sm">✓ ELITE ONLY</span>
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)] bg-clip-text text-transparent"
          >
            The World's Most Advanced<br />
            <span className="text-[hsl(263,70%,50%)]">Twitter Automation</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-300 mb-4 max-w-4xl mx-auto"
          >
            100% Undetectable. 100% Proprietary. Extensively Battle-Tested by 1000+ Users.
          </motion.p>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-2xl md:text-3xl font-bold text-[hsl(187,100%,42%)] mb-12"
          >
            While others get banned, we dominate.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button 
              onClick={onWalletConnect}
              className="crypto-gradient px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-[hsl(263,70%,50%)]/25 transition-all duration-300 animate-glow"
            >
              Get Exclusive Access
            </Button>
            <Button 
              onClick={onInviteClick}
              variant="outline"
              className="border-2 border-[hsl(263,70%,50%)]/50 px-8 py-4 rounded-xl font-bold text-lg hover:bg-[hsl(263,70%,50%)]/10 transition-all duration-300"
            >
              Enter Invitation Code
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto"
          >
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[hsl(263,70%,50%)] mb-2">
                <AnimatedCounter target={1000} />
              </div>
              <div className="text-gray-400 text-sm">Elite Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-[hsl(187,100%,42%)] mb-2">
                <AnimatedCounter target={50000} />
              </div>
              <div className="text-gray-400 text-sm">Accounts Managed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-green-400 mb-2">
                <AnimatedCounter target={99.97} decimals={2} />%
              </div>
              <div className="text-gray-400 text-sm">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">
                $<AnimatedCounter target={2.3} decimals={1} />M+
              </div>
              <div className="text-gray-400 text-sm">Revenue Generated</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
