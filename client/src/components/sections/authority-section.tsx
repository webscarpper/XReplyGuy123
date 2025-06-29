import { Shield, Brain, Building, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function AuthoritySection() {
  const features = [
    {
      icon: Shield,
      title: "Unbreakable Stealth",
      description: "Military-grade anti-detection technology that adapts to Twitter's algorithms in real-time.",
      gradient: "from-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)]",
      borderColor: "border-[hsl(263,70%,50%)]/20 hover:border-[hsl(263,70%,50%)]/40"
    },
    {
      icon: Brain,
      title: "Proprietary AI",
      description: "AI that thinks like humans, creating responses so natural even you'll be impressed.",
      gradient: "from-[hsl(187,100%,42%)] to-[hsl(263,70%,50%)]",
      borderColor: "border-[hsl(187,100%,42%)]/20 hover:border-[hsl(187,100%,42%)]/40"
    },
    {
      icon: Building,
      title: "Enterprise-Grade",
      description: "Infrastructure trusted by Fortune 500 companies for mission-critical automation.",
      gradient: "from-green-500 to-[hsl(263,70%,50%)]",
      borderColor: "border-green-500/20 hover:border-green-500/40"
    },
    {
      icon: TrendingUp,
      title: "Proven Results",
      description: "99.97% success rate across 50,000+ accounts with zero bans reported.",
      gradient: "from-yellow-500 to-[hsl(187,100%,42%)]",
      borderColor: "border-yellow-500/20 hover:border-yellow-500/40"
    }
  ];

  return (
    <section id="authority" className="py-20 bg-gradient-to-r from-[hsl(0,0%,10%)] via-[hsl(0,0%,4%)] to-[hsl(0,0%,10%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            The <span className="text-[hsl(263,70%,50%)]">ONLY</span> Automation That's Never Been Detected
          </h2>
        </motion.div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`bg-[hsl(0,0%,18%)]/30 backdrop-blur-sm p-8 rounded-2xl border ${feature.borderColor} transition-all duration-300`}
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center mb-6`}>
                <feature.icon className="text-2xl text-white" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
