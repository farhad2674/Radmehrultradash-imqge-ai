import React from 'react';
import { LayoutGrid, Wrench, Compass, User } from 'lucide-react';

interface MobileNavigationProps {
  isAdmin?: boolean;
  currentView: string;
  onNavigate: (view: string) => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ currentView, onNavigate, isAdmin = false }) => {
  const tabs = [
    { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
    { id: 'builder', label: 'Builder', icon: Wrench },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'profile', label: 'Profile', icon: User },
  ].filter(tab => isAdmin || tab.id !== 'builder');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#e0e2ec] py-2 px-4 flex items-center justify-around z-30 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            id={`mobile-tab-${tab.id}`}
            onClick={() => onNavigate(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              isActive ? 'text-[#1A73E8]' : 'text-[#727785] hover:text-[#191c23]'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-colors ${
                isActive ? 'bg-[#E8F0FE]' : ''
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[11px] mt-0.5 ${isActive ? 'font-semibold text-[#1A73E8]' : 'font-normal'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
