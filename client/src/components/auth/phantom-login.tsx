import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Key, ExternalLink } from 'lucide-react';
import { usePhantomWallet } from '@/hooks/use-phantom-wallet';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface PhantomLoginProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (walletAddress: string, invitationCode?: string) => void;
}

export default function PhantomLogin({ isOpen, onClose, onSuccess }: PhantomLoginProps) {
  const [step, setStep] = useState<'wallet' | 'invitation'>('wallet');
  const [invitationCode, setInvitationCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  
  const { connect, connecting, publicKey, isPhantomInstalled } = usePhantomWallet();
  const { toast } = useToast();

  const handleWalletConnect = async () => {
    try {
      if (!isPhantomInstalled) {
        toast({
          title: "Phantom Wallet Not Found",
          description: "Please install the Phantom wallet extension to continue.",
          variant: "destructive",
        });
        return;
      }

      await connect();
      
      if (publicKey) {
        toast({
          title: "Wallet Connected!",
          description: `Connected: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`,
        });
        setStep('invitation');
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Phantom wallet",
        variant: "destructive",
      });
    }
  };

  const handleInvitationSubmit = async () => {
    if (!invitationCode.trim()) {
      toast({
        title: "Invitation Code Required",
        description: "Please enter your invitation code to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey,
          invitationCode: invitationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Validation failed');
      }

      toast({
        title: "Access Granted!",
        description: data.message || "Welcome to the XReplyGuy elite community.",
      });
      
      onSuccess?.(publicKey, invitationCode);
      onClose();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Validation Failed",
        description: error.message || "The invitation code you entered is not valid.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const resetForm = () => {
    setStep('wallet');
    setInvitationCode('');
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const installPhantom = () => {
    window.open('https://phantom.app/', '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[hsl(0,0%,10%)] border border-[hsl(263,70%,50%)]/30 rounded-2xl max-w-md">
        <DialogHeader>
          <div className="text-center">
            <motion.div 
              animate={{ rotate: step === 'invitation' ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 crypto-gradient rounded-full flex items-center justify-center mx-auto mb-6"
            >
              {step === 'wallet' ? (
                <Wallet className="text-2xl text-white" size={24} />
              ) : (
                <Key className="text-2xl text-white" size={24} />
              )}
            </motion.div>
            
            <DialogTitle className="text-2xl font-bold mb-4">
              {step === 'wallet' ? 'Connect Phantom Wallet' : 'Enter Invitation Code'}
            </DialogTitle>
            
            <p className="text-gray-400 mb-6">
              {step === 'wallet' 
                ? 'Secure your exclusive access to the world\'s most advanced Twitter automation platform.'
                : 'Access is strictly limited to invited users only. Enter your exclusive code below.'
              }
            </p>
          </div>
        </DialogHeader>

        {step === 'wallet' && (
          <div className="space-y-4">
            {!isPhantomInstalled ? (
              <>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                  <p className="text-yellow-400 text-sm mb-3">
                    Phantom wallet extension is required to continue
                  </p>
                  <Button 
                    onClick={installPhantom}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium transition-all duration-300"
                  >
                    <ExternalLink className="mr-2" size={16} />
                    Install Phantom Wallet
                  </Button>
                </div>
              </>
            ) : (
              <Button 
                onClick={handleWalletConnect}
                disabled={connecting}
                className="w-full crypto-gradient px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
              >
                <Wallet className="mr-3" size={16} />
                {connecting ? 'Connecting...' : 'Connect Phantom Wallet'}
              </Button>
            )}
            
            <Button 
              variant="ghost"
              onClick={handleClose}
              className="w-full text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </Button>
          </div>
        )}

        {step === 'invitation' && (
          <div className="space-y-4">
            {publicKey && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <p className="text-green-400 text-sm">
                  Wallet Connected: {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="invitation" className="text-gray-300">
                Invitation Code
              </Label>
              <Input 
                id="invitation"
                type="text" 
                placeholder="Enter your exclusive invitation code"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                className="w-full bg-[hsl(0,0%,18%)] border border-[hsl(263,70%,50%)]/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[hsl(263,70%,50%)] focus:outline-none"
              />
            </div>
            
            <Button 
              onClick={handleInvitationSubmit}
              disabled={isValidating}
              className="w-full crypto-gradient px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
            >
              <Key className="mr-3" size={16} />
              {isValidating ? 'Validating...' : 'Validate Code'}
            </Button>
            
            <Button 
              variant="ghost"
              onClick={() => setStep('wallet')}
              className="w-full text-gray-400 hover:text-white transition-colors"
            >
              Back to Wallet
            </Button>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500 text-center">
          <p>
            {step === 'wallet' 
              ? 'By connecting your wallet, you agree to our Terms of Service.'
              : 'Don\'t have an invitation code? Contact our team for exclusive access opportunities.'
            }
          </p>
          {step === 'invitation' && (
            <div className="mt-4 p-3 bg-[hsl(0,0%,18%)]/50 rounded-lg border border-[hsl(263,70%,50%)]/20">
              <p className="text-gray-400 text-xs mb-2">Sample Codes (for testing):</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-green-400 mb-1">Free (20/day):</p>
                  <code className="text-green-400 bg-[hsl(0,0%,25%)] px-2 py-1 rounded text-xs">FR33B1X8</code>
                </div>
                <div>
                  <p className="text-[hsl(187,100%,42%)] mb-1">Starter (250/day):</p>
                  <code className="text-[hsl(187,100%,42%)] bg-[hsl(0,0%,25%)] px-2 py-1 rounded text-xs">STRT2S4P</code>
                </div>
                <div>
                  <p className="text-[hsl(263,70%,50%)] mb-1">Pro (500/day):</p>
                  <code className="text-[hsl(263,70%,50%)] bg-[hsl(0,0%,25%)] px-2 py-1 rounded text-xs">PROX3N5L</code>
                </div>
                <div>
                  <p className="text-yellow-400 mb-1">Enterprise (1000/day):</p>
                  <code className="text-yellow-400 bg-[hsl(0,0%,25%)] px-2 py-1 rounded text-xs">ENTP5R8S</code>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}