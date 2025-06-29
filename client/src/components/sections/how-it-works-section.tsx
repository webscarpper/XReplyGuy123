import { motion } from "framer-motion";

export default function HowItWorksSection() {
  const steps = [
    {
      number: 1,
      title: "Gain Access",
      description: "Connect your Phantom wallet and enter your exclusive invitation code",
      gradient: "from-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)]",
      color: "text-[hsl(263,70%,50%)]"
    },
    {
      number: 2,
      title: "Deploy Automation",
      description: "Launch your unstoppable campaign with our advanced configuration tools",
      gradient: "from-[hsl(187,100%,42%)] to-green-400",
      color: "text-[hsl(187,100%,42%)]"
    },
    {
      number: 3,
      title: "Watch & Dominate",
      description: "Real-time control of your Twitter empire from our command center",
      gradient: "from-green-400 to-yellow-400",
      color: "text-green-400"
    },
    {
      number: 4,
      title: "Scale Infinitely",
      description: "Multiply your influence 24/7 with automated growth strategies",
      gradient: "from-yellow-400 to-[hsl(263,70%,50%)]",
      color: "text-yellow-400"
    }
  ];

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            How to <span className="text-[hsl(187,100%,42%)]">Dominate</span>
          </h2>
          <p className="text-xl text-gray-400">
            Four simple steps to Twitter supremacy
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className={`w-20 h-20 bg-gradient-to-r ${step.gradient} rounded-full flex items-center justify-center text-2xl font-bold mb-6 mx-auto`}>
                {step.number}
              </div>
              <h3 className={`text-xl font-bold mb-4 ${step.color}`}>{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
