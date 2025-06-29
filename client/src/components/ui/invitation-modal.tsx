import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Key } from "lucide-react";
import { useState } from "react";

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InvitationModal({ isOpen, onClose }: InvitationModalProps) {
  const [inviteCode, setInviteCode] = useState("");

  const handleValidate = () => {
    // Mock invitation validation - in real implementation, this would validate the code
    console.log("Validating invitation code:", inviteCode);
    // You would implement actual invitation code validation here
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(0,0%,10%)] border border-[hsl(263,70%,50%)]/30 rounded-2xl max-w-md">
        <DialogHeader>
          <div className="text-center">
            <div className="w-16 h-16 crypto-gradient rounded-full flex items-center justify-center mx-auto mb-6">
              <Key className="text-2xl text-white" size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold mb-4">Enter Invitation Code</DialogTitle>
            <p className="text-gray-400 mb-6">
              Access is strictly limited to invited users only. Enter your exclusive invitation code below.
            </p>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input 
            type="text" 
            placeholder="Enter invitation code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full bg-[hsl(0,0%,18%)] border border-[hsl(263,70%,50%)]/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[hsl(263,70%,50%)] focus:outline-none"
          />
          <Button 
            onClick={handleValidate}
            className="w-full crypto-gradient px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-300"
          >
            <Key className="mr-3" size={16} />
            Validate Code
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
          <p>Don't have an invitation code? Contact our team for exclusive access opportunities.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
