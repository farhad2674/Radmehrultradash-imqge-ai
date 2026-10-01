export type Role = 'Admin' | 'Supervisor' | 'Manager' | 'Editor' | 'Viewer';

export type ExecutionModel =
  | 'nano-banana-2'
  | 'seedream/5-pro-image-to-image'
  | 'sedance-2.5-pro'
  | 'SDXL'
  | 'Midjourney v6';

export type TemplateVariableMode = 
  | 'object_only' 
  | 'title_only' 
  | 'both_object_and_title' 
  | 'full_custom' 
  | 'locked';

export interface TemplatePromptConfig {
  applianceObject: string;
  environmentPlace: string;
  moodLighting: string;
  colorMaterial: string;
  titleOverlay: string;
}

export interface ApplianceTemplate {
  id: string;
  name: string;
  category: string;
  model: ExecutionModel;
  description: string;
  basePrompt: string;
  variableMode?: TemplateVariableMode;
  promptConfig?: TemplatePromptConfig;
  defaultVariableValue?: string;
  defaultApplianceObject?: string;
  defaultTitleOverlay?: string;
  defaultEnvironment?: string;
  defaultMoodLighting?: string;
  defaultColorMaterial?: string;
  referenceImageUrl?: string;
  resolution?: string;
  thumbnailUrl: string;
  isPublic: boolean;
  requireApproval: boolean;
  fieldPermissions: {
    text1: boolean;
    targetAudience: boolean;
    styleReferenceImg: boolean;
    applianceObject?: boolean;
    environment?: boolean;
    lighting?: boolean;
  };
  tags: string[];
  createdAt: string;
  author: string;
}

export interface GeneratedAsset {
  ownerUserId?: string;
  id: string;
  templateId?: string;
  templateName?: string;
  prompt: string;
  model: ExecutionModel | string;
  imageUrl: string;
  aspectRatio: string;
  creator: {
    name: string;
    role: string;
    email: string;
    avatar: string;
  };
  createdAt: string;
  timeAgo: string;
  likes: number;
  bookmarked: boolean;
  unitsUsed: number;
}

export interface PersonnelUser {
  apiAccess?: boolean;
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Invited' | 'Suspended';
  avatar: string;
  initials?: string;
  department?: string;
  lastActive: string;
  generationLimit: number;
  completedGenerations: number;
  allowUnlimited?: boolean;
}

export interface AuditLogEntry {
  id: string;
  time: string;
  timestamp: string;
  user: string;
  action: string;
  type: 'Generated Image' | 'Role Changed' | 'Sync' | 'Model Update' | 'Security Block' | 'Template Saved' | 'Limit Modified' | 'Quota Reset';
  details: string;
  units?: number | string;
}

export interface GenerateParams {
  prompt: string;
  model: ExecutionModel | string;
  referenceImageUrl?: string;
  resolution?: string;
  aspectRatio?: string;
  templateId?: string;
}

export interface UseOpenRouterImageGeneratorResult {
  generateImage: (params: GenerateParams) => Promise<string | null>;
  loading: boolean;
  status: string | null;
  error: string | null;
  cancelPolling: () => void;
  taskId: string | null;
  elapsedSeconds: number;
}
