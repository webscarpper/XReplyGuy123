import { Bot } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[hsl(0,0%,10%)] py-12 border-t border-[hsl(263,70%,50%)]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-8 h-8 crypto-gradient rounded-lg flex items-center justify-center">
              <Bot className="text-white text-sm" size={16} />
            </div>
            <span className="text-xl font-bold">XReplyGuy</span>
            <span className="text-sm text-[hsl(187,100%,42%)] font-medium">by Trendify</span>
          </div>
          <div className="text-gray-400 text-sm">
            © 2024 Trendify. All rights reserved. Elite access only.
          </div>
        </div>
      </div>
    </footer>
  );
}
