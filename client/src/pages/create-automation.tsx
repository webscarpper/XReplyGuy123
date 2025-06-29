import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  ArrowRight, 
  Zap, 
  Target, 
  MessageSquare, 
  Settings,
  Clock,
  Shield,
  Bot,
  Save
} from "lucide-react";

interface WizardData {
  name: string;
  targetKeywords: string[];
  targetAccounts: string[];
  replyStyle: string;
  customInstructions: string;
  dailyLimit: number;
  activeHours: string;
  stealthSettings: string;
}

const steps = [
  { id: 1, title: "Automation Setup", description: "Basic configuration", icon: Zap },
  { id: 2, title: "Target Configuration", description: "Keywords and accounts", icon: Target },
  { id: 3, title: "Reply Settings", description: "Style and instructions", icon: MessageSquare },
  { id: 4, title: "Advanced Settings", description: "Limits and stealth", icon: Settings },
];

export default function CreateAutomation() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    name: "",
    targetKeywords: [],
    targetAccounts: [],
    replyStyle: "professional",
    customInstructions: "",
    dailyLimit: 50,
    activeHours: "9-17",
    stealthSettings: JSON.stringify({ delays: "human-like", useProxies: true }),
  });

  const [keywordInput, setKeywordInput] = useState("");
  const [accountInput, setAccountInput] = useState("");

  const updateWizardData = (field: keyof WizardData, value: any) => {
    setWizardData(prev => ({ ...prev, [field]: value }));
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !wizardData.targetKeywords.includes(keywordInput.trim())) {
      updateWizardData("targetKeywords", [...wizardData.targetKeywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (keyword: string) => {
    updateWizardData("targetKeywords", wizardData.targetKeywords.filter(k => k !== keyword));
  };

  const addAccount = () => {
    if (accountInput.trim() && !wizardData.targetAccounts.includes(accountInput.trim())) {
      updateWizardData("targetAccounts", [...wizardData.targetAccounts, accountInput.trim()]);
      setAccountInput("");
    }
  };

  const removeAccount = (account: string) => {
    updateWizardData("targetAccounts", wizardData.targetAccounts.filter(a => a !== account));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDeploy = async () => {
    // TODO: Implement actual deployment logic
    console.log("Deploying automation:", wizardData);
    setLocation("/dashboard/automations");
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-xl font-semibold">Create New Automation</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" disabled>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Automation Wizard</h2>
            <span className="text-sm text-gray-400">Step {currentStep} of {steps.length}</span>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
          
          {/* Steps */}
          <div className="flex justify-between">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center space-y-2">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2
                    ${isActive ? "border-[hsl(263,70%,50%)] bg-[hsl(263,70%,50%)]" : 
                      isCompleted ? "border-green-500 bg-green-500" : 
                      "border-gray-600 bg-[hsl(0,0%,8%)]"}
                  `}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-400"}`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              {(() => {
                const Icon = steps[currentStep - 1].icon;
                return <Icon className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />;
              })()}
              {steps[currentStep - 1].title}
            </CardTitle>
            <CardDescription>
              {steps[currentStep - 1].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Step 1: Automation Setup */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="automation-name">Automation Name</Label>
                  <Input
                    id="automation-name"
                    placeholder="e.g., Tech News Engagement Bot"
                    value={wizardData.name}
                    onChange={(e) => updateWizardData("name", e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a descriptive name for your automation
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Target Configuration */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label>Target Keywords</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      placeholder="Enter keyword and press Enter"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    />
                    <Button onClick={addKeyword} size="sm">Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {wizardData.targetKeywords.map((keyword) => (
                      <Badge 
                        key={keyword} 
                        variant="secondary"
                        className="bg-[hsl(263,70%,50%)]/20 text-[hsl(263,70%,50%)] cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      >
                        {keyword} ×
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Target Accounts</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      placeholder="@username or account handle"
                      value={accountInput}
                      onChange={(e) => setAccountInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAccount()}
                    />
                    <Button onClick={addAccount} size="sm">Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {wizardData.targetAccounts.map((account) => (
                      <Badge 
                        key={account} 
                        variant="secondary"
                        className="bg-[hsl(187,100%,42%)]/20 text-[hsl(187,100%,42%)] cursor-pointer"
                        onClick={() => removeAccount(account)}
                      >
                        {account} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Reply Settings */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Reply Style</Label>
                  <div className="grid grid-cols-3 gap-3 mt-1">
                    {["professional", "casual", "technical"].map((style) => (
                      <Button
                        key={style}
                        variant={wizardData.replyStyle === style ? "default" : "outline"}
                        onClick={() => updateWizardData("replyStyle", style)}
                        className="capitalize"
                      >
                        {style}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="custom-instructions">Custom Instructions</Label>
                  <Textarea
                    id="custom-instructions"
                    placeholder="Provide specific instructions for the AI..."
                    value={wizardData.customInstructions}
                    onChange={(e) => updateWizardData("customInstructions", e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Advanced Settings */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="daily-limit">Daily Action Limit</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min="1"
                    max="1000"
                    value={wizardData.dailyLimit}
                    onChange={(e) => updateWizardData("dailyLimit", parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="active-hours">Active Hours</Label>
                  <Input
                    id="active-hours"
                    placeholder="e.g., 9-17 or 24/7"
                    value={wizardData.activeHours}
                    onChange={(e) => updateWizardData("activeHours", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="p-4 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="h-5 w-5 text-green-400" />
                    <h4 className="font-medium">Stealth Configuration</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Advanced anti-detection settings are automatically configured for maximum stealth.
                  </p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < steps.length ? (
            <Button onClick={nextStep} disabled={!wizardData.name.trim()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleDeploy}
              className="bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)]"
              disabled={!wizardData.name.trim()}
            >
              <Bot className="h-4 w-4 mr-2" />
              Deploy Automation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}