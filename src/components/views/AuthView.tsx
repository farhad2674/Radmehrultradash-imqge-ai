import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { ApplianceParticleMorphCanvas } from '../ApplianceParticleMorphCanvas';
import { authService, AuthSession } from '../../services/authService';

interface AuthViewProps { onAuth: (session: AuthSession) => void; initialEmail?: string }
export const AuthView: React.FC<AuthViewProps> = ({ onAuth, initialEmail = '' }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!isLogin && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const session = isLogin ? await authService.login(email.trim(), password) : await authService.register(name.trim(), email.trim(), password);
      setPassword(''); setConfirmPassword(''); onAuth(session);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to sign in.'); }
    finally { setLoading(false); }
  };
  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500';
  return <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex items-center justify-center p-6">
    <div className="grid lg:grid-cols-2 gap-12 max-w-6xl w-full items-center">
      <div className="hidden lg:block"><ApplianceParticleMorphCanvas /></div>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full mx-auto">
        <ShieldCheck className="w-9 h-9 text-blue-400 mb-5" />
        <h1 className="text-2xl font-semibold">{isLogin ? 'Sign in to RadmehrAI' : 'Create your account'}</h1>
        <p className="text-slate-400 text-sm mt-2 mb-6">{isLogin ? 'Use your workspace email and password.' : 'An administrator can enable AI access after you join.'}</p>
        <form onSubmit={submit} className="space-y-5">
          {!isLogin && <label className="block text-sm">Full name<input autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} className={`${inputClass} mt-2`} /></label>}
          <label className="block text-sm"><span className="flex gap-2 items-center"><Mail size={16} />Email</span><input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm"><span className="flex gap-2 items-center"><Lock size={16} />Password</span><div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? undefined : 12} maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {!isLogin && <label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${inputClass} mt-2`} /><span className="text-xs text-slate-400 block mt-2">Use at least 12 characters.</span></label>}
          {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3 font-semibold">{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
        </form>
        <button type="button" disabled={loading} onClick={() => { setIsLogin(v => !v); setPassword(''); setConfirmPassword(''); setError(''); }} className="text-blue-300 text-sm mt-6">{isLogin ? 'Create an account' : 'Back to sign in'}</button>
      </div>
    </div>
  </div>;
};
