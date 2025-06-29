import { Shield, Monitor, Bot, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function FeaturesSection() {
  const features = [
    {
      title: "Unbreakable Stealth",
      description: "Military-grade anti-detection technology that makes your automation completely invisible to Twitter's algorithms.",
      icon: Shield,
      color: "text-[hsl(263,70%,50%)]",
      gradient: "from-[hsl(263,70%,50%)]/20 to-[hsl(187,100%,42%)]/20",
      border: "border-[hsl(263,70%,50%)]/30",
      points: [
        "Dynamic behavioral patterns that mimic human activity",
        "Real-time adaptation to platform changes",
        "Zero detection signatures across all monitored metrics"
      ]
    },
    {
      title: "Live Command Center",
      description: "Watch your Twitter empire grow in real-time with our advanced monitoring and control dashboard.",
      icon: Monitor,
      color: "text-[hsl(187,100%,42%)]",
      gradient: "from-[hsl(187,100%,42%)]/20 to-[hsl(263,70%,50%)]/20",
      border: "border-[hsl(187,100%,42%)]/30",
      points: [
        "Real-time analytics and performance metrics",
        "Instant campaign adjustments and optimizations",
        "Multi-account management from single interface"
      ]
    },
    {
      title: "AI Mastermind",
      description: "Replies so human, even you'll be impressed. Our AI understands context, tone, and engagement patterns.",
      icon: Bot,
      color: "text-green-400",
      gradient: "from-green-500/20 to-[hsl(263,70%,50%)]/20",
      border: "border-green-500/30",
      points: [
        "Contextual understanding of conversations",
        "Brand voice consistency across all interactions",
        "Emotional intelligence in response generation"
      ]
    }
  ];

  return (
    <section id="features" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Features That <span className="text-[hsl(187,100%,42%)]">Dominate</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            While competitors play catch-up, we're already three steps ahead with technology that redefines what's possible.
          </p>
        </motion.div>

        <div className="space-y-20">
          {features.map((feature, index) => (
            <div key={feature.title} className={`flex flex-col ${index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12`}>
              <motion.div 
                initial={{ opacity: 0, x: index % 2 === 1 ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="lg:w-1/2"
              >
                <div className={`bg-gradient-to-r ${feature.gradient} p-8 rounded-3xl border ${feature.border} animate-float`}>
                  <div className="aspect-video bg-[hsl(0,0%,10%)] rounded-2xl flex items-center justify-center">
                    <feature.icon className={`text-6xl ${feature.color}`} size={64} />
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: index % 2 === 1 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                className="lg:w-1/2"
              >
                <h3 className={`text-3xl md:text-4xl font-bold mb-6 ${feature.color}`}>
                  {feature.title}
                </h3>
                <p className="text-xl text-gray-300 mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-4">
                  {feature.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-center text-gray-300">
                      <CheckCircle className="text-green-400 mr-3 flex-shrink-0" size={20} />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
