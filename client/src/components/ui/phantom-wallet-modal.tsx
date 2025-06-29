import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Wallet } from "lucide-react";

interface PhantomWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhantomWalletModal({ isOpen, onClose }: PhantomWalletModalProps) {
  const handleConnect = () => {
    // Mock wallet connection - in real implementation, this would connect to Phantom
    console.log("Connecting to Phantom wallet...");
    // You would implement actual Phantom wallet connection here
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(0,0%,10%)] border border-[hsl(263,70%,50%)]/30 rounded-2xl max-w-md">
        <DialogHeader>
          <div className="text-center">
            <div className="w-16 h-16 crypto-gradient rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="text-2xl text-white" size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold mb-4">Connect Phantom Wallet</DialogTitle>
            <p className="text-gray-400 mb-6">
              Secure your exclusive access to the world's most advanced Twitter automation platform.
            </p>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <Button 
            onClick={handleConnect}
            className="w-full crypto-gradient px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
          >
            <Wallet className="mr-3" size={16} />
            Connect Phantom Wallet
          </Button>
          <Button 
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </Button>
        </div>
        
        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>By connecting your wallet, you agree to our Terms of Service and acknowledge that you have an invitation code.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
