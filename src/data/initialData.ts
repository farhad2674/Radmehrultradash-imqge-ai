import { ApplianceTemplate, GeneratedAsset, PersonnelUser, AuditLogEntry } from '../types';

export const INITIAL_TEMPLATES: ApplianceTemplate[] = [];

export const INITIAL_ASSETS: GeneratedAsset[] = [];

export const INITIAL_USERS: PersonnelUser[] = [
  {
    id: 'user-farhad',
    name: 'Farhad Abdollahi',
    email: 'farhad.abdollahi28@gmail.com',
    role: 'Admin',
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    department: 'Enterprise AI Governance',
    lastActive: 'Just now',
    generationLimit: 50,
    completedGenerations: 24,
    allowUnlimited: false,
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
