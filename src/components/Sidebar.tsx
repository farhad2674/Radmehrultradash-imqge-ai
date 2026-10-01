import React from 'react';
import { 
  LayoutGrid, 
  Wrench, 
  Compass, 
  User, 
  Users, 
  Plus, 
  HelpCircle, 
  LogOut, 
  Sparkles,
  ChevronRight,
  Gauge
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
  userName?: string;
  onLogout?: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenNewTemplate: () => void;
  userEmail?: string;
  userRole?: string;
  completedGenerations?: number;
  generationLimit?: number;
  allowUnlimited?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isAdmin = false,
  userName = 'Workspace member',
  onLogout,
  currentView,
  onNavigate,
  onOpenNewTemplate,
  userEmail = '',
  userRole = 'Viewer',
  completedGenerations = 0,
  generationLimit = 0,
  allowUnlimited = false,
}) => {
  const navItems = [
    { id: 'workspace', label: 'Studio Workspace', icon: LayoutGrid },
    { id: 'builder', label: 'Template Builder', icon: Wrench },
    { id: 'explore', label: 'Explore Feed', icon: Compass },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'governance', label: 'User Management', icon: Users },
  ].filter(item => isAdmin || !['builder', 'governance'].includes(item.id));

  const percentage = allowUnlimited ? 0 : Math.min(100, Math.round((completedGenerations / Math.max(generationLimit, 1)) * 100));
  const isAtLimit = !allowUnlimited && completedGenerations >= generationLimit;

  return (
    <aside className="w-64 bg-white border-r border-[#e0e2ec] flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-20">
      {/* Brand Header */}
      <div>
        <div className="p-5 pb-4 border-b border-[#f0f2f8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#005bbf] to-[#4648d4] flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-[#191c23] leading-none">
                RadmehrAI Studio
              </h1>
              <p className="text-xs text-[#5F6368] font-medium mt-1">
                {userRole}
              </p>
            </div>
          </div>

          {/* Create New Template Primary Action Button */}
          {isAdmin && <button
            id="sidebar-create-template-btn"
            onClick={onOpenNewTemplate}
            className="mt-5 w-full bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white font-medium py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-sm transition-all duration-150 group cursor-pointer"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
            <span className="text-sm font-medium">Create New Template</span>
          </button>}
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#E8F0FE] text-[#1A73E8] font-semibold'
                    : 'text-[#414754] hover:bg-[#F1F4F9] hover:text-[#191c23]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#1A73E8]' : 'text-[#727785]'}`} />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1A73E8]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation */}
      <div className="p-3 border-t border-[#f0f2f8] space-y-2">
        
        {/* User Quota Status in Sidebar */}
        <div 
          onClick={() => onNavigate('governance')}
          className="p-2.5 bg-[#F8F9FD] border border-[#E0E2EC] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-[#5F6368]">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[#1A73E8]" /> Quota
            </span>
            <span className={`font-mono font-bold ${isAtLimit ? 'text-red-600' : 'text-[#191c23]'}`}>
              {allowUnlimited ? 'Unlimited' : `${completedGenerations}/${generationLimit}`}
            </span>
          </div>
          {!allowUnlimited && (
            <div className="w-full bg-[#E0E2EC] h-1.5 rounded-full overflow-hidden mt-1.5">
              <div 
                className={`h-full rounded-full transition-all ${isAtLimit ? 'bg-red-500' : 'bg-[#1A73E8]'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>

        <button
          id="nav-link-help"
          onClick={() => alert('RadmehrAI Studio — aimaxmode development\nDocumentation & Support\n- AI Generation Limit Management (Default 50/user)\n- Direct OpenRouter Job Creation API & Polling System\n- Gemini Flash Image Engine\n- Enterprise Governance & RBAC')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2 rounded-xl text-xs font-medium text-[#414754] hover:bg-[#F1F4F9] hover:text-[#191c23] transition-colors cursor-pointer text-left"
        >
          <HelpCircle className="w-4 h-4 text-[#727785]" />
          <span>Help & Docs</span>
        </button>

        <button
          id="nav-link-signout"
          onClick={() => onLogout ? onLogout() : alert('Signed out of Enterprise AI Admin session.')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2 rounded-xl text-xs font-medium text-[#ba1a1a] hover:bg-red-50 transition-colors cursor-pointer text-left"
        >
          <LogOut className="w-4 h-4 text-[#ba1a1a]" />
          <span>Sign Out</span>
        </button>

        {/* User Mini Card */}
        <div className="mt-2 pt-2 border-t border-[#f0f2f8] px-1 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#191c23] truncate">{userName}</p>
            <p className="text-[11px] text-[#727785] truncate">{userEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
