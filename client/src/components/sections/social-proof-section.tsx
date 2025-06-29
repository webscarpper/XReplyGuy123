import { DollarSign } from "lucide-react";
import AnimatedCounter from "@/components/ui/animated-counter";
import { motion } from "framer-motion";

export default function SocialProofSection() {
  return (
    <section id="proof" className="py-20 bg-gradient-to-r from-[hsl(0,0%,10%)] via-[hsl(0,0%,4%)] to-[hsl(0,0%,10%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-[hsl(263,70%,50%)]">1000+</span> Elite Users Can't Be Wrong
          </h2>
          <p className="text-xl text-gray-400">
            Zero Bans. Zero Detection. Zero Competition.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            { target: 0, label: "Accounts Banned", subtitle: "Perfect track record", color: "text-[hsl(263,70%,50%)]", border: "border-[hsl(263,70%,50%)]/20" },
            { target: 0, label: "Detection Events", subtitle: "Completely invisible", color: "text-[hsl(187,100%,42%)]", border: "border-[hsl(187,100%,42%)]/20" },
            { target: 0, label: "Competition", subtitle: "We're in a league of our own", color: "text-green-400", border: "border-green-500/20" }
          ].map((stat, index) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`bg-[hsl(0,0%,18%)]/30 backdrop-blur-sm p-8 rounded-2xl border ${stat.border} text-center`}
            >
              <div className={`text-4xl font-bold ${stat.color} mb-2`}>
                <AnimatedCounter target={stat.target} />
              </div>
              <div className="text-lg font-medium mb-2">{stat.label}</div>
              <div className="text-gray-400">{stat.subtitle}</div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex items-center bg-gradient-to-r from-[hsl(263,70%,50%)]/20 to-[hsl(187,100%,42%)]/20 px-8 py-4 rounded-2xl border border-[hsl(263,70%,50%)]/30">
            <DollarSign className="text-2xl text-green-400 mr-4" size={32} />
            <div>
              <div className="text-2xl font-bold text-green-400">
                $<AnimatedCounter target={2.3} decimals={1} />M+ Revenue Generated
              </div>
              <div className="text-gray-400">For our elite user base</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
