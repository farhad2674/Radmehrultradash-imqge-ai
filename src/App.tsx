import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileNavigation } from './components/MobileNavigation';
import { StudioModal } from './components/StudioModal';
import { WorkspaceView } from './components/views/WorkspaceView';
import { TemplateBuilderView } from './components/views/TemplateBuilderView';
import { ExploreFeedView } from './components/views/ExploreFeedView';
import { AuthView } from './components/views/AuthView';
import { GovernanceView } from './components/views/GovernanceView';
import { ProfileView } from './components/views/ProfileView';

import { ApplianceTemplate, GeneratedAsset, PersonnelUser, AuditLogEntry, Role } from './types';
import { storageService, StorageStats } from './services/storageService';
import { authService, apiJson, clearSession, AuthSession } from './services/authService';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('workspace');
  
  // Core Application State
  const [templates, setTemplates] = useState<ApplianceTemplate[]>([]);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [users, setUsers] = useState<PersonnelUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [defaultGenerationLimit, setDefaultGenerationLimit] = useState<number>(50);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // Modal & Builder State
  const [activeStudioTemplate, setActiveStudioTemplate] = useState<ApplianceTemplate | null>(null);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState<boolean>(false);
  const [builderTemplate, setBuilderTemplate] = useState<ApplianceTemplate | null>(null);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [requestError, setRequestError] = useState('');
  const currentPersonnelUser = session?.user;
  const currentUserEmail = currentPersonnelUser?.email || '';
  const currentUserName = currentPersonnelUser?.name || '';
  const currentUserRole = currentPersonnelUser?.role || 'Viewer';
  const isAdmin = currentUserRole === 'Admin';
  const currentUserLimit = currentPersonnelUser?.generationLimit ?? 0;
  const currentUserCompleted = users.find(u => u.id === currentPersonnelUser?.id)?.completedGenerations ?? currentPersonnelUser?.completedGenerations ?? 0;
  const currentUserUnlimited = false;
  const handleAuth = (value: AuthSession) => { setSession(value); setRequestError(''); };
  const clearWorkspace = () => {
    clearSession(); setSession(null); setTemplates([]); setAssets([]); setUsers([]); setAuditLogs([]);
    setStorageStats(null); setIsStudioModalOpen(false); setBuilderTemplate(null); setCurrentView('workspace');
  };
  const handleLogout = async () => {
    try { await authService.logout(); clearWorkspace(); }
    catch (error) { setRequestError(error instanceof Error ? error.message : 'Logout failed. Please retry.'); }
  };
  useEffect(() => {
    let disposed = false;
    const expired = () => { clearWorkspace(); };
    window.addEventListener('session-expired', expired);
    authService.current().then(value => { if (!disposed) setSession(value); }).catch(() => { if (!disposed) clearWorkspace(); }).finally(() => { if (!disposed) setAuthLoading(false); });
    return () => { disposed = true; window.removeEventListener('session-expired', expired); };
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    storageService.initStorage().then(payload => {
      if (disposed) return;
      setTemplates(payload.templates); setAssets(payload.assets); setUsers(payload.users); setAuditLogs(payload.auditLogs);
      if (payload.settings) setDefaultGenerationLimit(payload.settings.defaultLimit);
      setStorageStats(payload.stats || null);
    }).catch(error => { if (!disposed) setRequestError(error.message); });
    return () => { disposed = true; };
  }, [session]);
  const refresh = async () => {
    const value = await authService.current(); setSession(value);
  };
  const perform = async (action: () => Promise<unknown>) => {
    setRequestError('');
    try { await action(); await refresh(); } catch (error) { setRequestError(error instanceof Error ? error.message : 'Request failed.'); }
  };
  const navigate = (view: string) => { if (['builder', 'governance'].includes(view) && !isAdmin) return; setCurrentView(view); };
  if (authLoading) return <div className="min-h-screen flex items-center justify-center">Checking your session…</div>;
  if (!session) return <AuthView onAuth={handleAuth} />;

  const handleSelectTemplate = (template: ApplianceTemplate) => {
    setActiveStudioTemplate(template);
    setIsStudioModalOpen(true);
  };

  // Handle creating new template
  const handleOpenNewTemplate = () => {
    setBuilderTemplate(null);
    navigate('builder');
  };

  // Handle editing existing template (Admin)
  const handleEditTemplate = (template: ApplianceTemplate) => {
    setBuilderTemplate(template);
    navigate('builder');
  };

  const handleDeleteTemplate = (id: string) => perform(() => storageService.deleteTemplate(id));
  const handleSaveTemplate = (template: ApplianceTemplate) => perform(async () => {
    await storageService.saveTemplate(template); setBuilderTemplate(null); setCurrentView('workspace');
  });
  const handleAssetGenerated = (asset: GeneratedAsset) => perform(() => storageService.saveAsset(asset));
  const handleUpdateUserLimit = (id: string, limit: number, unlimited?: boolean) => perform(async () => {
    if (unlimited) throw new Error('Set a finite monthly quota.');
    await storageService.updateUserLimit(id, limit);
  });
  const handleResetUserUsage = (id: string) => perform(() => storageService.resetUserUsage(id));
  const handleBatchResetUsage = () => perform(() => storageService.resetAllUsage());
  const handleUpdateDefaultLimit = (limit: number, applyToAll?: boolean) => perform(async () => {
    await apiJson('/api/settings', { method: 'PUT', body: JSON.stringify({ defaultLimit: limit, workspaceName: 'RadmehrAI Studio' }) });
    if (applyToAll) for (const user of users) await storageService.updateUserLimit(user.id, limit);
  });
  const handleExportBackup = () => perform(async () => {
    const backup = await storageService.exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `radmehr-content-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url);
  });
  const handleImportBackup = (backup: unknown) => perform(() => storageService.importBackup(backup));
  const handleBookmarkToggle = (id: string) => setAssets(prev => prev.map(a => a.id === id ? { ...a, bookmarked: !a.bookmarked } : a));
  const handleSelectTemplateById = (id: string) => {
    const template = templates.find(t => t.id === id); if (template) handleSelectTemplate(template);
  };
  const handleInviteUser = async (newUser: Omit<PersonnelUser, 'id' | 'lastActive'> & { password: string }) => {
    await apiJson('/api/users', { method: 'POST', body: JSON.stringify({ name: newUser.name, email: newUser.email, password: newUser.password, department: newUser.department }) });
    await refresh();
  };
  const handleUpdateUserRole = (id: string, role: Role) => perform(async () => {
    const user = users.find(u => u.id === id); if (!user) return;
    await apiJson(`/api/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ role: role === 'Admin' ? 'SUPER_ADMIN' : 'USER', status: user.status === 'Suspended' ? 'DISABLED' : 'ACTIVE', apiAccess: !!user.apiAccess }) });
  });
  const handleDeleteUser = (id: string) => perform(async () => {
    const user = users.find(u => u.id === id); if (!user) return;
    await apiJson(`/api/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ role: user.role === 'Admin' ? 'SUPER_ADMIN' : 'USER', status: 'DISABLED', apiAccess: false }) });
  });
  const handleToggleApiAccess = (id: string) => perform(async () => {
    const user = users.find(u => u.id === id); if (!user) return;
    await apiJson(`/api/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ role: user.role === 'Admin' ? 'SUPER_ADMIN' : 'USER', status: user.status === 'Suspended' ? 'DISABLED' : 'ACTIVE', apiAccess: !user.apiAccess }) });
  });

  return (
    <div className="flex min-h-screen bg-[#FDFCF6] text-[#191c23] antialiased selection:bg-[#1A73E8] selection:text-white font-sans">
      {requestError && <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-300 text-red-800 p-3 rounded-xl">{requestError}<button className="ml-4" onClick={() => setRequestError('')}>Dismiss</button></div>}
      {/* Desktop Navigation Sidebar */}
      <Sidebar
        userName={currentUserName}
        onLogout={handleLogout}
        currentView={currentView}
        onNavigate={(view) => {
          navigate(view);
          if (view !== 'builder') setBuilderTemplate(null);
        }}
        onOpenNewTemplate={handleOpenNewTemplate}
        isAdmin={isAdmin}
        userEmail={currentUserEmail}
        userRole={currentUserRole}
        completedGenerations={currentUserCompleted}
        generationLimit={currentUserLimit}
      />

      {/* Main App Workspace Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <Navbar
          currentView={currentView}
          userEmail={currentUserEmail}
          userRole={currentUserRole}
          completedGenerations={currentUserCompleted}
          generationLimit={currentUserLimit}
          allowUnlimited={false}
          isAdmin={isAdmin}
          onOpenMobileMenu={() => navigate('profile')}
          onOpenNewTemplate={handleOpenNewTemplate}
          onNavigateToGovernance={isAdmin ? () => navigate('governance') : undefined}
        />

        {/* Dynamic View Router */}
        <main className="flex-1">
          {currentView === 'workspace' && (
            <WorkspaceView
              templates={templates}
              onSelectTemplate={handleSelectTemplate}
              onCreateNewTemplate={handleOpenNewTemplate}
              isAdmin={isAdmin}
              onEditTemplate={isAdmin ? handleEditTemplate : undefined}
              onDeleteTemplate={isAdmin ? handleDeleteTemplate : undefined}
              userEmail={currentUserEmail}
              completedGenerations={currentUserCompleted}
              generationLimit={currentUserLimit}
              allowUnlimited={currentUserUnlimited}
              onNavigateToGovernance={() => navigate('governance')}
            />
          )}

          {isAdmin && currentView === 'builder' && (
            <TemplateBuilderView
              initialTemplate={builderTemplate}
              onSaveTemplate={handleSaveTemplate}
              onCancel={() => {
                setBuilderTemplate(null);
                setCurrentView('workspace');
              }}
            />
          )}

          {currentView === 'explore' && (
            <ExploreFeedView
              assets={assets}
              onSelectTemplate={handleSelectTemplateById}
              onBookmarkToggle={handleBookmarkToggle}
            />
          )}

          {isAdmin && currentView === 'governance' && (
            <GovernanceView
              users={users}
              auditLogs={auditLogs}
              defaultGenerationLimit={defaultGenerationLimit}
              storageStats={storageStats}
              onInviteUser={handleInviteUser}
              onToggleApiAccess={handleToggleApiAccess}
              onUpdateUserRole={handleUpdateUserRole}
              onUpdateUserLimit={handleUpdateUserLimit}
              onResetUserUsage={handleResetUserUsage}
              onUpdateDefaultLimit={handleUpdateDefaultLimit}
              onBatchResetUsage={handleBatchResetUsage}
              onDeleteUser={handleDeleteUser}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />
          )}

          {currentView === 'profile' && (
            <ProfileView
              user={{
                name: currentUserName,
                email: currentUserEmail,
                role: currentUserRole,
                department: currentPersonnelUser?.department || '',
                initials: currentUserName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
                status: 'Active',
                generationLimit: currentUserLimit,
                completedGenerations: currentUserCompleted,
                allowUnlimited: currentUserUnlimited,
              }}
              auditLogs={auditLogs.filter((l) => l.user === currentUserName)}
              userAssets={assets.filter((a) => a.creator.email === currentUserEmail)}
              onOpenGovernance={() => navigate('governance')}
            />
          )}
        </main>
      </div>

      {/* Generation Studio Modal Dialog */}
      <StudioModal
        template={activeStudioTemplate}
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        onAssetGenerated={handleAssetGenerated}
        onEditTemplate={isAdmin ? handleEditTemplate : undefined}
        userGenerationLimit={currentUserLimit}
        userCompletedGenerations={currentUserCompleted}
        userAllowUnlimited={currentUserUnlimited}
        onOpenGovernance={() => {
          setIsStudioModalOpen(false);
          navigate('governance');
        }}
      />

      {/* Mobile Navigation Drawer / Tab Bar */}
      <MobileNavigation
        currentView={currentView}
        onNavigate={(view) => {
          navigate(view);
          if (view !== 'builder') setBuilderTemplate(null);
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
