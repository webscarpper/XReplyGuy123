import { Button } from "@/components/ui/button";
import AnimatedCounter from "@/components/ui/animated-counter";
import { motion } from "framer-motion";

interface ExclusivitySectionProps {
  onWalletConnect: () => void;
}

export default function ExclusivitySection({ onWalletConnect }: ExclusivitySectionProps) {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Join the <span className="text-[hsl(263,70%,50%)]">Underground Elite</span>
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Invitation-Only Access • Limited to 5000 Users Worldwide
          </p>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-[hsl(263,70%,50%)]/20 to-[hsl(187,100%,42%)]/20 p-8 rounded-3xl border border-[hsl(263,70%,50%)]/30 max-w-4xl mx-auto"
          >
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-[hsl(263,70%,50%)] mb-2">
                  <AnimatedCounter target={4247} />
                </div>
                <div className="text-gray-400">Spots Taken</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[hsl(187,100%,42%)] mb-2">
                  <AnimatedCounter target={753} />
                </div>
                <div className="text-gray-400">Spots Remaining</div>
              </div>
              <div className="text-center">
                <Button 
                  onClick={onWalletConnect}
                  className="crypto-gradient px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-[hsl(263,70%,50%)]/25 transition-all duration-300"
                >
                  Secure Your Spot
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
