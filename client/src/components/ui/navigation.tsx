import { Bot, Menu } from "lucide-react";
import { Button } from "./button";

interface NavigationProps {
  onWalletConnect: () => void;
  onInviteClick: () => void;
}

export default function Navigation({ onWalletConnect }: NavigationProps) {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[hsl(0,0%,4%)]/90 backdrop-blur-md border-b border-[hsl(263,70%,50%)]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 crypto-gradient rounded-lg flex items-center justify-center">
              <Bot className="text-white text-sm" size={16} />
            </div>
            <span className="text-xl font-bold">XReplyGuy</span>
            <span className="text-sm text-[hsl(187,100%,42%)] font-medium">by Trendify</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#proof" className="text-gray-300 hover:text-white transition-colors">
              Proof
            </a>
            <Button 
              onClick={onWalletConnect}
              className="crypto-gradient px-6 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              Connect Phantom
            </Button>
          </div>
          
          <button className="md:hidden text-white">
            <Menu size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
