import React from 'react';
import { 
  Menu, 
  Search, 
  Bell, 
  Sparkles, 
  ShieldCheck, 
  ExternalLink,
  Plus,
  Gauge
} from 'lucide-react';

interface NavbarProps {
  isAdmin?: boolean;
  currentView: string;
  onOpenMobileMenu: () => void;
  onOpenNewTemplate: () => void;
  onNavigateToGovernance?: () => void;
  userEmail?: string;
  userRole?: string;
  completedGenerations?: number;
  generationLimit?: number;
  allowUnlimited?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin = false,
  currentView,
  onOpenMobileMenu,
  onOpenNewTemplate,
  onNavigateToGovernance,
  userEmail = '',
  userRole = 'Viewer',
  completedGenerations = 0,
  generationLimit = 0,
  allowUnlimited = false,
}) => {
  const getTitle = () => {
    switch (currentView) {
      case 'workspace':
        return 'Studio Workspace';
      case 'builder':
        return 'Template Builder';
      case 'explore':
        return 'Explore Feed';
      case 'governance':
        return 'Team & Governance';
      case 'profile':
        return 'My Profile';
      default:
        return 'RadmehrAI Studio';
    }
  };

  const isAtLimit = !allowUnlimited && completedGenerations >= generationLimit;
  const isNearLimit = !allowUnlimited && !isAtLimit && (completedGenerations / generationLimit) >= 0.8;

  return (
    <header className="h-16 bg-white border-b border-[#E0E2EC] px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 select-none">
      {/* Mobile Menu & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-[#414754] hover:bg-[#F1F4F9] transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm md:text-base font-bold text-[#191c23] tracking-tight">
            {getTitle()}
          </span>
          <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-[#DADCE0]" />
          <span className="hidden md:inline-block text-xs font-mono text-[#5F6368]">
            aimaxmode · development
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        
        {/* User Quota Limit Badge */}
        <div 
          onClick={onNavigateToGovernance}
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium cursor-pointer transition-all ${
            isAtLimit 
              ? 'bg-red-50 border-red-200 text-red-700' 
              : isNearLimit 
              ? 'bg-amber-50 border-amber-200 text-amber-800' 
              : 'bg-[#F8F9FD] border-[#DADCE0] text-[#414754] hover:bg-gray-100'
          }`}
          title="AI Image Generation Limit & Usage - Click to manage in Governance"
        >
          <Gauge className={`w-3.5 h-3.5 ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-[#1A73E8]'}`} />
          <span className="hidden sm:inline text-[#5F6368]">Quota:</span>
          <span className="font-mono font-bold">
            {allowUnlimited ? 'Unlimited' : `${completedGenerations} / ${generationLimit}`}
          </span>
        </div>

        {/* User Account Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8F9FD] border border-[#DADCE0] text-xs font-medium text-[#414754]">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-[#191c23]">{userEmail}</span>
          <span className="text-[#1A73E8] font-semibold">({userRole})</span>
        </div>

        {/* Quick Launch Template Button */}
        {isAdmin && <button
          onClick={onOpenNewTemplate}
          className="bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Template</span>
        </button>}

        {/* Notifications Icon */}
        <button
          onClick={() => alert('RadmehrAI Studio Notifications:\n- Real-time OpenRouter polling engine active\n- Quota limit policy enforced (50 images/user)\n- 0 security policy breaches in last 24h')}
          className="p-2 rounded-xl text-[#727785] hover:text-[#191c23] hover:bg-[#F1F4F9] transition-colors relative cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
        </button>
      </div>
    </header>
  );
};
