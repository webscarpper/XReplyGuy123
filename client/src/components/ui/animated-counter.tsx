import { useAnimatedCounter } from "@/hooks/use-animated-counter";

interface AnimatedCounterProps {
  target: number;
  decimals?: number;
  duration?: number;
}

export default function AnimatedCounter({ target, decimals = 0, duration = 2000 }: AnimatedCounterProps) {
  const count = useAnimatedCounter(target, duration);
  
  return <>{count.toFixed(decimals)}</>;
}
