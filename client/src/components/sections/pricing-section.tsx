import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface PricingSectionProps {
  onWalletConnect: () => void;
}

export default function PricingSection({ onWalletConnect }: PricingSectionProps) {
  const tiers = [
    {
      name: "Free",
      subtitle: "Invitation Required",
      price: "20",
      unit: "/day",
      features: ["20 actions per day", "Basic automation", "Community support"],
      buttonText: "Requires Invite",
      buttonClass: "bg-gray-600 hover:bg-gray-500",
      borderClass: "border-gray-600/30 hover:border-gray-400/40"
    },
    {
      name: "Starter",
      subtitle: "30 Days",
      price: "2",
      unit: "SOL",
      subPrice: "250 actions/day",
      features: ["250 actions per day", "Advanced AI replies", "Analytics dashboard", "Priority support"],
      buttonText: "Select Plan",
      buttonClass: "crypto-gradient hover:shadow-lg",
      borderClass: "border-[hsl(263,70%,50%)]/30 hover:border-[hsl(263,70%,50%)]/50",
      nameColor: "text-[hsl(263,70%,50%)]"
    },
    {
      name: "Pro",
      subtitle: "30 Days",
      price: "3",
      unit: "SOL",
      subPrice: "500 actions/day",
      features: ["500 actions per day", "Advanced AI + Custom", "Real-time monitoring", "Multi-account support", "VIP support"],
      buttonText: "Select Plan",
      buttonClass: "bg-gradient-to-r from-[hsl(187,100%,42%)] to-[hsl(263,70%,50%)] hover:shadow-lg",
      borderClass: "border-[hsl(187,100%,42%)]/30 hover:border-[hsl(187,100%,42%)]/50",
      nameColor: "text-[hsl(187,100%,42%)]",
      popular: true
    },
    {
      name: "Advanced",
      subtitle: "30 Days",
      price: "4",
      unit: "SOL",
      subPrice: "750 actions/day",
      features: ["750 actions per day", "All Pro features", "Advanced analytics", "Custom integrations", "Dedicated support"],
      buttonText: "Select Plan",
      buttonClass: "bg-gradient-to-r from-green-400 to-[hsl(187,100%,42%)] hover:shadow-lg",
      borderClass: "border-green-500/30 hover:border-green-500/50",
      nameColor: "text-green-400"
    },
    {
      name: "Enterprise",
      subtitle: "30 Days",
      price: "5",
      unit: "SOL",
      subPrice: "1000 actions/day",
      features: ["1000 actions per day", "Everything included", "White-label options", "API access", "24/7 phone support"],
      buttonText: "Select Plan",
      buttonClass: "bg-gradient-to-r from-yellow-400 to-[hsl(263,70%,50%)] hover:shadow-lg",
      borderClass: "border-yellow-500/30 hover:border-yellow-500/50",
      nameColor: "text-yellow-400"
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-gradient-to-r from-[hsl(0,0%,10%)] via-[hsl(0,0%,4%)] to-[hsl(0,0%,10%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Investment Tiers for <span className="text-[hsl(263,70%,50%)]">Serious Players</span>
          </h2>
          <p className="text-xl text-gray-400 mb-4">
            ROI: 500-2000% within 30 days
          </p>
          <p className="text-lg text-[hsl(187,100%,42%)]">
            What others charge $500/month for, we deliver for SOL
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`bg-[hsl(0,0%,18%)]/30 backdrop-blur-sm p-6 rounded-2xl border ${tier.borderClass} transition-all duration-300 relative`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[hsl(187,100%,42%)] to-[hsl(263,70%,50%)] px-4 py-1 rounded-full text-sm font-medium">
                  POPULAR
                </div>
              )}
              <div className="text-center">
                <h3 className={`text-xl font-bold mb-2 ${tier.nameColor || ''}`}>{tier.name}</h3>
                <div className="text-gray-400 mb-4">{tier.subtitle}</div>
                <div className="text-3xl font-bold mb-2">
                  {tier.price} <span className="text-lg">{tier.unit}</span>
                </div>
                {tier.subPrice && (
                  <div className="text-sm text-gray-400 mb-4">{tier.subPrice}</div>
                )}
                <ul className="space-y-2 text-sm text-gray-400 mb-6">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex}>• {feature}</li>
                  ))}
                </ul>
                <Button 
                  onClick={onWalletConnect}
                  className={`w-full ${tier.buttonClass} px-6 py-3 rounded-lg font-medium transition-all duration-300`}
                >
                  {tier.buttonText}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
