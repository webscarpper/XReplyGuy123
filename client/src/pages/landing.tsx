import Navigation from "@/components/ui/navigation";
import HeroSection from "@/components/sections/hero-section";
import AuthoritySection from "@/components/sections/authority-section";
import FeaturesSection from "@/components/sections/features-section";
import SocialProofSection from "@/components/sections/social-proof-section";
import HowItWorksSection from "@/components/sections/how-it-works-section";
import PricingSection from "@/components/sections/pricing-section";
import ExclusivitySection from "@/components/sections/exclusivity-section";
import Footer from "@/components/ui/footer";
import PhantomWalletModal from "@/components/ui/phantom-wallet-modal";
import InvitationModal from "@/components/ui/invitation-modal";
import { useState } from "react";

export default function LandingPage() {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white overflow-x-hidden">
      <Navigation 
        onWalletConnect={() => setIsWalletModalOpen(true)}
        onInviteClick={() => setIsInviteModalOpen(true)}
      />
      
      <HeroSection 
        onWalletConnect={() => setIsWalletModalOpen(true)}
        onInviteClick={() => setIsInviteModalOpen(true)}
      />
      
      <AuthoritySection />
      <FeaturesSection />
      <SocialProofSection />
      <HowItWorksSection />
      <PricingSection onWalletConnect={() => setIsWalletModalOpen(true)} />
      <ExclusivitySection onWalletConnect={() => setIsWalletModalOpen(true)} />
      
      <Footer />
      
      <PhantomWalletModal 
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
      
      <InvitationModal 
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
