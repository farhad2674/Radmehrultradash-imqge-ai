import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Search, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  MoreVertical, 
  Trash2, 
  Mail, 
  UserCheck, 
  Cpu, 
  ChevronDown,
  RefreshCw,
  Gauge,
  Sliders,
  Sparkles,
  Zap,
  SlidersHorizontal,
  Info,
  X,
  Plus,
  RotateCcw,
  Check,
  HardDrive,
  Server,
  FolderGit2,
  Database,
  UploadCloud,
  FileJson,
  Layers
} from 'lucide-react';
import { PersonnelUser, AuditLogEntry, Role } from '../../types';
import { StorageStats } from '../../services/storageService';

interface GovernanceViewProps {
  users: PersonnelUser[];
  auditLogs: AuditLogEntry[];
  defaultGenerationLimit: number;
  storageStats?: StorageStats | null;
  onInviteUser: (user: Omit<PersonnelUser, 'id' | 'lastActive'> & { password: string }) => Promise<void>;
  onToggleApiAccess: (id: string) => void;
  onUpdateUserRole: (userId: string, newRole: Role) => void;
  onUpdateUserLimit: (userId: string, newLimit: number, allowUnlimited?: boolean) => void;
  onResetUserUsage: (userId: string) => void;
  onUpdateDefaultLimit: (newLimit: number, applyToAll?: boolean) => void;
  onBatchResetUsage: () => void;
  onDeleteUser: (userId: string) => void;
  onExportBackup?: () => void;
  onImportBackup?: (data: any) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  users,
  auditLogs,
  defaultGenerationLimit = 50,
  storageStats,
  onInviteUser,
  onToggleApiAccess,
  onUpdateUserRole,
  onUpdateUserLimit,
  onResetUserUsage,
  onUpdateDefaultLimit,
  onBatchResetUsage,
  onDeleteUser,
  onExportBackup,
  onImportBackup,
}) => {
  // Active governance tab
  const [activeSubTab, setActiveSubTab] = useState<'users_quotas' | 'disk_storage' | 'audit_logs'>('users_quotas');

  // Invite Form State
  const [initialPassword, setInitialPassword] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Editor');
  const [inviteLimit, setInviteLimit] = useState<number>(defaultGenerationLimit);
  const [inviteUnlimited, setInviteUnlimited] = useState<boolean>(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [quotaFilter, setQuotaFilter] = useState<'All' | 'AtLimit' | 'NearLimit' | 'Healthy'>('All');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('All Events');

  // Edit User Limit Modal State
  const [editingUser, setEditingUser] = useState<PersonnelUser | null>(null);
  const [tempLimit, setTempLimit] = useState<number>(50);
  const [tempUnlimited, setTempUnlimited] = useState<boolean>(false);

  // Global Default Limit Edit State
  const [globalLimitInput, setGlobalLimitInput] = useState<number>(defaultGenerationLimit);
  const [showGlobalLimitSuccess, setShowGlobalLimitSuccess] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Storage backup import state
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setInviteLoading(true); setInviteError('');
    try { await onInviteUser({
      password: initialPassword,
      name: fullName,
      email,
      role,
      status: 'Active',
      avatar: '',
      initials: fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      department: 'AI Operations',
      generationLimit: inviteUnlimited ? 999999 : Number(inviteLimit) || 50,
      completedGenerations: 0,
      allowUnlimited: inviteUnlimited,
    });

    setInitialPassword('');
    setFullName('');
    setEmail('');
    setRole('Editor');
    setInviteLimit(defaultGenerationLimit);
    setInviteUnlimited(false);
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 2500);
    } catch (error) { setInviteError(error instanceof Error ? error.message : 'Unable to create account.'); }
    finally { setInviteLoading(false); }
  };

  const handleOpenEditLimit = (user: PersonnelUser) => {
    setEditingUser(user);
    setTempLimit(user.generationLimit);
    setTempUnlimited(!!user.allowUnlimited);
  };

  const handleSaveEditLimit = () => {
    if (!editingUser) return;
    onUpdateUserLimit(editingUser.id, Number(tempLimit) || 50, tempUnlimited);
    setEditingUser(null);
  };

  const handleApplyGlobalLimit = (applyToAll: boolean) => {
    onUpdateDefaultLimit(Number(globalLimitInput) || 50, applyToAll);
    setShowGlobalLimitSuccess(true);
    setTimeout(() => setShowGlobalLimitSuccess(false), 2500);
  };

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,User,Type,Action,Details,Units\n';
    const rows = auditLogs
      .map(
        (log) =>
          `"${log.id}","${log.timestamp}","${log.user}","${log.type}","${log.action}","${log.details.replace(/"/g, '""')}","${log.units || ''}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `governance_audit_logs_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleFileUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (onImportBackup) {
          onImportBackup(json);
          setImportStatus('Backup restored successfully!');
          setTimeout(() => setImportStatus(null), 3000);
        }
      } catch (err) {
        setImportStatus('Invalid JSON backup file');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  // Quota Metrics Calculations
  const totalCompletedGenerations = users.reduce((acc, u) => acc + (u.completedGenerations || 0), 0);
  const totalAllocatedLimit = users.reduce((acc, u) => acc + (u.allowUnlimited ? 999 : u.generationLimit), 0);
  const usersAtLimitCount = users.filter((u) => !u.allowUnlimited && (u.completedGenerations || 0) >= u.generationLimit).length;
  const usersNearLimitCount = users.filter((u) => {
    if (u.allowUnlimited) return false;
    const pct = ((u.completedGenerations || 0) / u.generationLimit) * 100;
    return pct >= 80 && pct < 100;
  }).length;

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (quotaFilter === 'AtLimit') {
      return !u.allowUnlimited && (u.completedGenerations || 0) >= u.generationLimit;
    }
    if (quotaFilter === 'NearLimit') {
      if (u.allowUnlimited) return false;
      const pct = ((u.completedGenerations || 0) / u.generationLimit) * 100;
      return pct >= 80 && pct < 100;
    }
    if (quotaFilter === 'Healthy') {
      if (u.allowUnlimited) return true;
      const pct = ((u.completedGenerations || 0) / u.generationLimit) * 100;
      return pct < 80;
    }

    return true;
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase());

    const matchesFilter = auditFilter === 'All Events' || log.type === auditFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-28 md:pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191c23] flex items-center gap-2.5">
            Enterprise Governance & Server Storage
            <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-[#1A73E8] font-mono font-semibold border border-blue-100">
              Parspack / Self-Hosted
            </span>
          </h2>
          <p className="text-sm text-[#5F6368] mt-1">
            Manage user quotas, inspect local server disk databases, export/import backups, and audit generation activity.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {onExportBackup && (
            <button
              onClick={onExportBackup}
              className="px-3.5 py-2 bg-white hover:bg-[#F8F9FD] border border-[#DADCE0] text-[#191c23] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Download full JSON backup of templates, users, and assets"
            >
              <Download className="w-3.5 h-3.5 text-[#1A73E8]" />
              <span>Export JSON Backup</span>
            </button>
          )}

          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-[#F8F9FD] border border-[#DADCE0] text-[#414754] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Reset Completed Counts for All Users"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#1A73E8]" />
            <span>Reset All Quotas</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E0E2EC] pb-2">
        <button
          onClick={() => setActiveSubTab('users_quotas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'users_quotas'
              ? 'bg-[#1A73E8] text-white shadow-2xs'
              : 'bg-white text-[#5F6368] hover:bg-[#F1F4F9] border border-[#DADCE0]'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>User Quotas & Limits ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('disk_storage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'disk_storage'
              ? 'bg-[#1A73E8] text-white shadow-2xs'
              : 'bg-white text-[#5F6368] hover:bg-[#F1F4F9] border border-[#DADCE0]'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Server Disk Storage (Parspack PaaS)</span>
          <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-mono">
            Zero-Cost
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit_logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'audit_logs'
              ? 'bg-[#1A73E8] text-white shadow-2xs'
              : 'bg-white text-[#5F6368] hover:bg-[#F1F4F9] border border-[#DADCE0]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: USER QUOTAS & LIMITS */}
      {/* ============================================================== */}
      {activeSubTab === 'users_quotas' && (
        <div className="space-y-6">
          {/* AI Image Generation Limit Policy & Metrics Banner */}
          <div className="bg-gradient-to-br from-white to-[#F8F9FD] rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#E0E2EC]">
              
              {/* Policy Headline */}
              <div className="flex items-start gap-3.5 max-w-xl">
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-[#1A73E8] flex items-center justify-center shrink-0 shadow-xs">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#191c23]">
                      AI Image Generation Limit Policy
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-wider">
                      Enforcement Active
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6368] mt-1 leading-relaxed">
                    Control the maximum number of completed AI images each team member can generate. When a user reaches their quota (e.g. 50/50), new image requests are locked until increased or reset.
                  </p>
                </div>
              </div>

              {/* Global Default Limit Configuration */}
              <div className="bg-white p-4 rounded-xl border border-[#DADCE0] shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5F6368]">
                    Default User Limit
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={globalLimitInput}
                      onChange={(e) => setGlobalLimitInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-1.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-lg text-sm font-bold text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    />
                    <span className="text-xs text-[#5F6368] font-medium">images / user</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-[#E0E2EC] sm:pl-3">
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLimit(false)}
                    className="px-3 py-2 bg-[#F1F4F9] hover:bg-[#E0E2EC] text-[#191c23] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    title="Sets default for future invites only"
                  >
                    Set for New Users
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalLimit(true)}
                    className="px-3.5 py-2 bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                    title="Applies this limit to all existing users and future invites"
                  >
                    Apply to All ({globalLimitInput})
                  </button>
                </div>
              </div>
            </div>

            {showGlobalLimitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>Workspace default image generation limit updated to {globalLimitInput} per user!</span>
              </div>
            )}

            {/* Quota Telemetry Metrics 4-Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] text-[#5F6368] font-medium block">Total Completed Images</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono text-[#191c23]">{totalCompletedGenerations}</span>
                  <span className="text-xs text-[#5F6368] font-mono">/ {totalAllocatedLimit}</span>
                </div>
                <div className="w-full bg-[#E0E2EC] h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-[#1A73E8] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((totalCompletedGenerations / Math.max(1, totalAllocatedLimit)) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] text-[#5F6368] font-medium block">Standard Limit per User</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-bold font-mono text-[#1A73E8]">{defaultGenerationLimit}</span>
                  <span className="text-xs text-[#5F6368]">Generations</span>
                </div>
                <span className="text-[11px] text-green-600 font-medium block mt-1.5">✓ Configurable</span>
              </div>

              <div className={`p-4 bg-white rounded-xl border shadow-2xs ${usersAtLimitCount > 0 ? 'border-red-300 bg-red-50/30' : 'border-[#DADCE0]'}`}>
                <span className="text-[11px] text-[#5F6368] font-medium block">Users at Quota Limit (100%)</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className={`text-2xl font-bold font-mono ${usersAtLimitCount > 0 ? 'text-red-600' : 'text-[#191c23]'}`}>
                    {usersAtLimitCount}
                  </span>
                  <span className="text-xs text-[#5F6368]">Users Locked</span>
                </div>
                <span className="text-[11px] text-[#727785] block mt-1.5">
                  {usersAtLimitCount > 0 ? 'Requires limit boost/reset' : 'All users active'}
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] text-[#5F6368] font-medium block">Near Quota Threshold (≥80%)</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-bold font-mono text-amber-600">{usersNearLimitCount}</span>
                  <span className="text-xs text-[#5F6368]">Users</span>
                </div>
                <span className="text-[11px] text-[#727785] block mt-1.5">Approaching ceiling</span>
              </div>
            </div>
          </div>

          {/* Invite New Team Member Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#1A73E8]" />
              Create Team Member Account
            </h3>

            <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-[#5F6368] mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sara Radmehr"
                  className="w-full px-3.5 py-2 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-xs sm:text-sm text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-[#5F6368] mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sara.radmehr@company.ir"
                  className="w-full px-3.5 py-2 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-xs sm:text-sm text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                />
              </div>

              <div className="md:col-span-3"><label className="block text-xs mb-1">Initial password</label><input type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={initialPassword} onChange={e => setInitialPassword(e.target.value)} className="w-full p-2 border rounded-xl" /></div>
              <button type="submit" disabled={inviteLoading} className="md:col-span-2 p-2 bg-blue-600 text-white rounded-xl">{inviteLoading ? 'Creating…' : 'Create account'}</button>
              <p className="md:col-span-12 text-xs text-slate-600">New members start as users with no API access. Set a quota and enable API access in the table.</p>
              {inviteError && <p role="alert" className="md:col-span-12 text-red-700 text-xs">{inviteError}</p>}
            </form>

            {inviteSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>Account created. Configure API access and quota below.</span>
              </div>
            )}
          </div>

          {/* Personnel Table Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1A73E8]" />
                Team Quota Usage & Limit Controls ({filteredUsers.length})
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#727785] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search personnel..."
                    className="pl-8 pr-3 py-1.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-lg text-xs text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-[#F1F4F9] p-0.5 rounded-lg border border-[#DADCE0]">
                  {(['All', 'AtLimit', 'NearLimit', 'Healthy'] as const).map((filterVal) => (
                    <button
                      key={filterVal}
                      onClick={() => setQuotaFilter(filterVal)}
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        quotaFilter === filterVal ? 'bg-white text-[#1A73E8] shadow-2xs font-bold' : 'text-[#5F6368]'
                      }`}
                    >
                      {filterVal === 'All' ? 'All' : filterVal === 'AtLimit' ? 'At Limit 🔴' : filterVal === 'NearLimit' ? 'Near Limit 🟡' : 'Healthy 🟢'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E0E2EC] text-[11px] font-bold uppercase tracking-wider text-[#5F6368]">
                    <th className="pb-3 px-2">Member</th>
                    <th className="pb-3 px-2">Role</th>
                    <th className="pb-3 px-2">Completed Generations</th>
                    <th className="pb-3 px-2">Assigned Limit</th>
                    <th className="pb-3 px-2">Status</th>
                    <th className="pb-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F8]">
                  {filteredUsers.map((user) => {
                    const completed = user.completedGenerations || 0;
                    const limit = user.generationLimit ?? 0;
                    const isMaxed = !user.allowUnlimited && completed >= limit;
                    const pct = user.allowUnlimited ? 15 : Math.min(100, Math.round((completed / Math.max(limit, 1)) * 100));

                    return (
                      <tr key={user.id} className="hover:bg-[#F8F9FD] transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-[#1A73E8] font-bold text-xs flex items-center justify-center">
                              {user.initials || user.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#191c23]">{user.name}</p>
                              <p className="text-[11px] text-[#5F6368]">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#F1F4F9] text-[#414754] font-medium">
                            {user.role}
                          </span><button onClick={() => onUpdateUserRole(user.id, user.role === 'Admin' ? 'Viewer' : 'Admin')} className="ml-2 text-blue-700">{user.role === 'Admin' ? 'Make user' : 'Make admin'}</button>
                        </td>

                        <td className="py-3 px-2">
                          <div className="w-36 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-bold text-[#191c23]">
                                {completed} / {user.allowUnlimited ? '∞' : limit}
                              </span>
                              <span className={`font-mono text-[10px] ${isMaxed ? 'text-red-600 font-bold' : 'text-[#5F6368]'}`}>
                                {user.allowUnlimited ? 'Unlimited' : `${pct}%`}
                              </span>
                            </div>
                            <div className="w-full bg-[#E0E2EC] h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isMaxed ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[#1A73E8]'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-2">
                          <span className="font-mono text-xs font-semibold text-[#191c23]">
                            {user.allowUnlimited ? 'Unlimited (No Cap)' : `${limit} Images`}
                          </span>
                        </td>

                        <td className="py-3 px-2">
                          {isMaxed ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold flex items-center gap-1 w-max">
                              <span>🔒 Limit Reached</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold flex items-center gap-1 w-max">
                              <span>✓ Active</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5"><button onClick={() => onToggleApiAccess(user.id)} className="text-xs text-blue-700">{user.apiAccess ? 'Disable API' : 'Enable API'}</button>
                            <button
                              onClick={() => handleOpenEditLimit(user)}
                              className="px-2.5 py-1 rounded-lg bg-[#E8F0FE] hover:bg-blue-200 text-[#1A73E8] text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Edit generation quota limit"
                            >
                              Edit Limit
                            </button>
                            <button
                              onClick={() => onResetUserUsage(user.id)}
                              className="px-2 py-1 rounded-lg bg-[#F1F4F9] hover:bg-[#E0E2EC] text-[#5F6368] text-[11px] transition-colors cursor-pointer"
                              title="Reset completed count to 0"
                            >
                              Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: SERVER DISK STORAGE (PARSPACK / NODE.JS) */}
      {/* ============================================================== */}
      {activeSubTab === 'disk_storage' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Architecture Overview Card */}
          <div className="bg-gradient-to-br from-white via-[#F8F9FD] to-blue-50/40 rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-[#191c23]">
                      Parspack PaaS & Node.js Native Disk Engine
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                      100% Free & Self-Contained
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6368] mt-1 leading-relaxed max-w-2xl">
                    Tailored for autonomous deployment in Iran and restricted regions. Stores JSON databases directly on server disk (<code className="text-[#1A73E8]">./data/*.json</code>) and serves image assets locally (<code className="text-[#1A73E8]">/uploads/*</code>) without foreign cloud subscription fees or Firebase credit card barriers.
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-mono font-bold text-green-700">Storage Online</span>
              </div>
            </div>

            {/* Storage Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] font-medium text-[#5F6368] flex items-center gap-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-[#1A73E8]" /> Images on Disk
                </span>
                <p className="text-2xl font-bold font-mono text-[#191c23] mt-1">
                  {storageStats?.imagesStored ?? 14}
                </p>
                <span className="text-[10px] text-[#727785] block mt-0.5">
                  Path: <code className="font-mono">/uploads/*.png</code>
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] font-medium text-[#5F6368] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" /> Database File Size
                </span>
                <p className="text-2xl font-bold font-mono text-[#191c23] mt-1">
                  {storageStats?.databaseDiskSizeKB ?? 48} KB
                </p>
                <span className="text-[10px] text-green-600 block mt-0.5 font-medium">
                  ✓ Atomic JSON Writes
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] font-medium text-[#5F6368] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" /> Saved Templates
                </span>
                <p className="text-2xl font-bold font-mono text-purple-700 mt-1">
                  {storageStats?.templatesCount ?? 8}
                </p>
                <span className="text-[10px] text-[#727785] block mt-0.5">
                  in <code className="font-mono">templates.json</code>
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#DADCE0] shadow-2xs">
                <span className="text-[11px] font-medium text-[#5F6368] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" /> Tracked Users & Quotas
                </span>
                <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                  {storageStats?.usersCount ?? users.length}
                </p>
                <span className="text-[10px] text-[#727785] block mt-0.5">
                  in <code className="font-mono">PostgreSQL</code>
                </span>
              </div>
            </div>
          </div>

          {/* Disaster Recovery & Backup Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Export Backup Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#191c23] uppercase tracking-wider">
                <Download className="w-4 h-4 text-[#1A73E8]" />
                <span>1. Export Workspace Content</span>
              </div>
              <p className="text-xs text-[#5F6368] leading-relaxed">
                Download templates and asset metadata. Accounts, sessions, quotas, credentials, and audit records stay in PostgreSQL. Image files need a separate private filesystem backup.
              </p>

              <button
                type="button"
                onClick={onExportBackup}
                className="w-full py-3 bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <FileJson className="w-4 h-4" />
                <span>Download Backup (JSON)</span>
              </button>
            </div>

            {/* Import Backup Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#191c23] uppercase tracking-wider">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>2. Restore / Import Backup</span>
              </div>
              <p className="text-xs text-[#5F6368] leading-relaxed">
                Restore previously exported JSON data to the Parspack Node.js server disk. This replaces or updates existing templates and user quota records instantly.
              </p>

              <label className="w-full py-3 bg-[#F1F4F9] hover:bg-[#E0E2EC] text-[#191c23] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#DADCE0]">
                <UploadCloud className="w-4 h-4 text-[#5F6368]" />
                <span>Select JSON Backup File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUploadBackup}
                  className="hidden"
                />
              </label>

              {importStatus && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#1A73E8] font-medium flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: AUDIT LOGS */}
      {/* ============================================================== */}
      {activeSubTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1A73E8]" />
              Immutable Audit & Governance Trail ({filteredAuditLogs.length})
            </h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#727785] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search events..."
                  className="pl-8 pr-3 py-1.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-lg text-xs text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                />
              </div>

              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-lg text-xs text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              >
                <option value="All Events">All Events</option>
                <option value="Generated Image">Generated Image</option>
                <option value="Limit Modified">Limit Modified</option>
                <option value="Quota Reset">Quota Reset</option>
                <option value="Template Saved">Template Saved</option>
                <option value="Role Changed">Role Changed</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="p-1.5 rounded-lg border border-[#DADCE0] hover:bg-[#F1F4F9] text-[#5F6368] cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E0E2EC] text-[11px] font-bold uppercase tracking-wider text-[#5F6368]">
                  <th className="pb-3 px-2">Time</th>
                  <th className="pb-3 px-2">User</th>
                  <th className="pb-3 px-2">Action</th>
                  <th className="pb-3 px-2">Details</th>
                  <th className="pb-3 px-2 text-right">Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F8]">
                {filteredAuditLogs.map((log) => {
                  let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (log.type === 'Limit Modified' || log.type === 'Quota Reset') {
                    badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                  } else if (log.type === 'Generated Image') {
                    badgeStyle = 'bg-green-50 text-green-700 border-green-200';
                  }

                  return (
                    <tr key={log.id} className="hover:bg-[#F8F9FD] transition-colors">
                      <td className="py-3 px-2 font-mono text-[#5F6368] whitespace-nowrap">{log.time}</td>
                      <td className="py-3 px-2 font-medium text-[#191c23] whitespace-nowrap">{log.user}</td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeStyle}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-[#414754] font-mono text-[11px]">{log.details}</td>
                      <td className="py-3 px-2 text-right font-mono font-medium text-[#191c23]">{log.units || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Limit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-soft-lg border border-[#DADCE0] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E0E2EC] pb-3">
              <h3 className="text-sm font-bold text-[#191c23] flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#1A73E8]" />
                Adjust Limit for {editingUser.name}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-full text-[#727785] hover:bg-[#F1F4F9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1">
                  Completed Generations Count
                </label>
                <p className="text-sm font-mono font-bold text-[#191c23]">
                  {editingUser.completedGenerations || 0} completed
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1">
                  New Completed Generation Ceiling
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(parseInt(e.target.value) || 1)}
                  disabled={tempUnlimited}
                  className="w-full px-3.5 py-2.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-sm font-bold text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] disabled:opacity-40"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={false} disabled
                  onChange={() => setTempUnlimited(false)}
                  className="rounded text-[#1A73E8] focus:ring-[#1A73E8]"
                />
                <span className="text-xs font-semibold text-[#191c23]">Grant Unlimited Access (No limit)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0E2EC]">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl border border-[#DADCE0] text-xs font-semibold text-[#5F6368] hover:bg-[#F1F4F9] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditLimit}
                className="px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Save Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-soft-lg border border-[#DADCE0] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">Reset All Quota Usage?</h3>
                <p className="text-xs text-red-700 mt-0.5">This will reset completed counts to 0 for all {users.length} members.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0E2EC]">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-[#DADCE0] text-xs font-semibold text-[#5F6368] hover:bg-[#F1F4F9] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBatchResetUsage();
                  setShowResetConfirmModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Confirm Reset All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
