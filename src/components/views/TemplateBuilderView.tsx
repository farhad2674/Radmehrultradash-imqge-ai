import { apiFetch } from '../../services/authService';
import React, { useState, useEffect } from 'react';
import { useOpenRouterImageGenerator } from '../../hooks/useOpenRouterImageGenerator';
import {  Save, 
  Sparkles, 
  UploadCloud, 
  Sliders, 
  Lock, 
  Globe, 
  CheckCircle2, 
  Image as ImageIcon, 
  Layers, 
  RefreshCw,
  Eye,
  Check,
  ChevronDown,
  Tag,
  Box,
  Sun,
  Home,
  Palette,
  SlidersHorizontal,
  Unlock,
  Info
} from 'lucide-react';
import { ApplianceTemplate, ExecutionModel, TemplateVariableMode, TemplatePromptConfig } from '../../types';
import { compileTemplatePrompt } from '../../utils/templatePrompt';

interface TemplateBuilderViewProps {
  onSaveTemplate: (template: ApplianceTemplate) => void;
  onCancel: () => void;
  initialTemplate?: ApplianceTemplate | null;
}

export const TemplateBuilderView: React.FC<TemplateBuilderViewProps> = ({
  onSaveTemplate,
  onCancel,
  initialTemplate,
}) => {
  const openRouterGenerator = useOpenRouterImageGenerator();
  const [name, setName] = useState<string>(initialTemplate?.name || '');
  const [category, setCategory] = useState<string>(initialTemplate?.category || 'Smart Kitchen');
  const [model, setModel] = useState<ExecutionModel>(initialTemplate?.model || 'nano-banana-2');
  const [description, setDescription] = useState<string>(
    initialTemplate?.description || 'Enterprise smart appliance prompt workflow with variable UI screen overlay and swappable object bindings.'
  );

  // Modular scene inputs
  const [applianceObject, setApplianceObject] = useState<string>(
    initialTemplate?.promptConfig?.applianceObject || 
    initialTemplate?.defaultApplianceObject || 
    'four-door smart refrigerator'
  );
  const [titleOverlay, setTitleOverlay] = useState<string>(
    initialTemplate?.promptConfig?.titleOverlay || 
    initialTemplate?.defaultTitleOverlay || 
    initialTemplate?.defaultVariableValue || 
    'Smart Inverter Tech - 2026 Edition'
  );
  const [environmentPlace, setEnvironmentPlace] = useState<string>(
    initialTemplate?.promptConfig?.environmentPlace || 
    initialTemplate?.defaultEnvironment || 
    'bright modern minimalist Scandinavian kitchen with marble island'
  );
  const [moodLighting, setMoodLighting] = useState<string>(
    initialTemplate?.promptConfig?.moodLighting || 
    initialTemplate?.defaultMoodLighting || 
    'soft natural daylight streaming through floor-to-ceiling windows'
  );
  const [colorMaterial, setColorMaterial] = useState<string>(
    initialTemplate?.promptConfig?.colorMaterial || 
    initialTemplate?.defaultColorMaterial || 
    'brushed stainless steel with subtle ice-blue LED accent lines'
  );

  // Variable Customization Mode (Modes 1, 2, 3, etc.)
  const [variableMode, setVariableMode] = useState<TemplateVariableMode>(
    initialTemplate?.variableMode || 'both_object_and_title'
  );

  const [basePrompt, setBasePrompt] = useState<string>(
    initialTemplate?.basePrompt ||
      'A sleek, luxury {{OBJECT}} situated in {{ENVIRONMENT}}. The exterior finish features {{COLOR_FINISH}}. An illuminated interactive touch display clearly shows title: {{TEXT_ZONE}}. Rendered in {{LIGHTING}}, architectural photography style, 8k resolution, crisp photorealistic reflections.'
  );

  const [thumbnailUrl, setThumbnailUrl] = useState<string>(
    initialTemplate?.thumbnailUrl ||
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80'
  );
  const [isPublic, setIsPublic] = useState<boolean>(initialTemplate?.isPublic ?? true);
  const [requireApproval, setRequireApproval] = useState<boolean>(initialTemplate?.requireApproval ?? false);
  
  // Field permissions
  const [permText1, setPermText1] = useState<boolean>(initialTemplate?.fieldPermissions?.text1 ?? true);
  const [permStyleRef, setPermStyleRef] = useState<boolean>(initialTemplate?.fieldPermissions?.styleReferenceImg ?? true);
  const [permTargetAudience, setPermTargetAudience] = useState<boolean>(initialTemplate?.fieldPermissions?.targetAudience ?? false);

  // States for AI optimization & thumbnail generation
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'modular' | 'raw'>('modular');

  const isEditingExisting = !!initialTemplate?.id;

  // Synchronize state when initialTemplate changes
  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name || '');
      setCategory(initialTemplate.category || 'Smart Kitchen');
      setModel(initialTemplate.model || 'nano-banana-2');
      setDescription(
        initialTemplate.description || 'Enterprise smart appliance prompt workflow with variable UI screen overlay and swappable object bindings.'
      );
      setApplianceObject(
        initialTemplate.promptConfig?.applianceObject || 
        initialTemplate.defaultApplianceObject || 
        'four-door smart refrigerator'
      );
      setTitleOverlay(
        initialTemplate.promptConfig?.titleOverlay || 
        initialTemplate.defaultTitleOverlay || 
        initialTemplate.defaultVariableValue || 
        'Smart Inverter Tech - 2026 Edition'
      );
      setEnvironmentPlace(
        initialTemplate.promptConfig?.environmentPlace || 
        initialTemplate.defaultEnvironment || 
        'bright modern minimalist Scandinavian kitchen with marble island'
      );
      setMoodLighting(
        initialTemplate.promptConfig?.moodLighting || 
        initialTemplate.defaultMoodLighting || 
        'soft natural daylight streaming through floor-to-ceiling windows'
      );
      setColorMaterial(
        initialTemplate.promptConfig?.colorMaterial || 
        initialTemplate.defaultColorMaterial || 
        'brushed stainless steel with subtle ice-blue LED accent lines'
      );
      setVariableMode(initialTemplate.variableMode || 'both_object_and_title');
      setBasePrompt(
        initialTemplate.basePrompt ||
        'A sleek, luxury {{OBJECT}} situated in {{ENVIRONMENT}}. The exterior finish features {{COLOR_FINISH}}. An illuminated interactive touch display clearly shows title: {{TEXT_ZONE}}. Rendered in {{LIGHTING}}, architectural photography style, 8k resolution, crisp photorealistic reflections.'
      );
      setThumbnailUrl(
        initialTemplate.thumbnailUrl ||
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80'
      );
      setIsPublic(initialTemplate.isPublic ?? true);
      setRequireApproval(initialTemplate.requireApproval ?? false);
      setPermText1(initialTemplate.fieldPermissions?.text1 ?? true);
      setPermStyleRef(initialTemplate.fieldPermissions?.styleReferenceImg ?? true);
      setPermTargetAudience(initialTemplate.fieldPermissions?.targetAudience ?? false);
    }
  }, [initialTemplate]);

  // Quick preset pills for Appliance Object
  const appliancePresets = [
    'four-door smart refrigerator',
    'front-load eco-cotton washing machine',
    'barista espresso machine with digital dial',
    'built-in convection wall oven',
    'compact ultrasonic countertop dishwasher',
    'autonomous LiDAR smart vacuum robot',
    'smart HVAC holographic wall thermostat',
    'purifier & air ionizer tower'
  ];

  // Quick preset pills for Title / Text
  const titlePresets = [
    'Smart Inverter Tech - 2026 Edition',
    'Eco Silent Wash • 1200 RPM • AI Load 64%',
    'Titanium Pure Cold • Freshness 98%',
    'Precision Bake: 350°F • AI Crust Sensor',
    'RadmehrAI Living Zone • 21.5°C Active',
    '9.2 Bar Extraction • 93.5°C Barista Flow'
  ];

  // Quick presets for Environment / Place
  const placePresets = [
    'bright modern minimalist Scandinavian kitchen with marble island',
    'minimalist architectural laundry and utility suite',
    'luxury penthouse open-plan living room with oak flooring',
    'artisan terrazzo countertop cafe interior',
    'contemporary high-ceiling villa with concrete accents'
  ];

  // Quick presets for Mood & Lighting
  const lightingPresets = [
    'soft natural daylight streaming through floor-to-ceiling windows',
    'warm golden hour sunset glow with ambient rim highlights',
    'high-contrast commercial studio lighting and reflections',
    'moody cinematic twilight with cool blue accent glows'
  ];

  // Quick presets for Color & Materials
  const materialPresets = [
    'brushed stainless steel with subtle ice-blue LED accent lines',
    'matte dark titanium with smoked tempered glass panels',
    'warm champagne bronze with rift-sawn white oak trim',
    'pure ceramic white with brushed chrome accents'
  ];

  // Synchronize base prompt with modular values
  const syncBasePromptFromModular = () => {
    const compiled = `A sleek, luxury {{OBJECT}} situated in {{ENVIRONMENT}}. The exterior finish features {{COLOR_FINISH}}. An illuminated interactive touch display clearly shows title: {{TEXT_ZONE}}. Rendered in {{LIGHTING}}, architectural photography style, 8k resolution, crisp photorealistic reflections.`;
    setBasePrompt(compiled);
  };

  const insertVariable = (varName: string) => {
    setBasePrompt((prev) => `${prev} {{${varName}}}`);
  };

  const [optimizationError, setOptimizationError] = useState('');
  const handleAutoOptimizePrompt = async () => {
    setOptimizationError(''); setIsOptimizing(true);
    try {
      const res = await apiFetch('/api/gemini/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePrompt, category, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prompt optimization failed.');
      if (data.optimizedPrompt) {
        setBasePrompt(data.optimizedPrompt);
      }
    } catch (e) {
      setOptimizationError(e instanceof Error ? e.message : 'Prompt optimization failed.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setIsGeneratingThumbnail(true);
    // Use the live preview prompt to resolve variables like {{OBJECT}}, etc.
    const resolvedPrompt = compileTemplatePrompt(
      basePrompt,
      {
        applianceObject,
        titleOverlay,
        environment: environmentPlace,
        lighting: moodLighting,
        colorMaterial,
      },
      { replaceAllLegacyVariables: true },
    );

    const resultUrl = await openRouterGenerator.generateImage({
      prompt: resolvedPrompt,
      model,
      aspectRatio: '16:9',
      resolution: '1K',
    });
    
    if (resultUrl) {
      setThumbnailUrl(resultUrl);
    } else {
      alert('Failed to generate thumbnail. Please check your API configuration.');
    }
    setIsGeneratingThumbnail(false);
  };

  // Compile live preview of the resolved prompt
  const getResolvedPreviewPrompt = (): string => {
    let p = basePrompt;
    p = p.replace(/\{\{OBJECT\}\}/g, applianceObject);
    p = p.replace(/\{\{TEXT_ZONE\}\}/g, titleOverlay);
    p = p.replace(/\{\{ENVIRONMENT\}\}/g, environmentPlace);
    p = p.replace(/\{\{PLACE\}\}/g, environmentPlace);
    p = p.replace(/\{\{LIGHTING\}\}/g, moodLighting);
    p = p.replace(/\{\{MOOD\}\}/g, moodLighting);
    p = p.replace(/\{\{COLOR_FINISH\}\}/g, colorMaterial);
    p = p.replace(/\{\{input\}\}/g, titleOverlay);
    p = p.replace(/\{\{VARIABLE_NAME\}\}/g, titleOverlay);
    return p;
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a Template Name');
      return;
    }

    const promptConfig: TemplatePromptConfig = {
      applianceObject,
      environmentPlace,
      moodLighting,
      colorMaterial,
      titleOverlay,
    };

    const templateToSave: ApplianceTemplate = {
      id: initialTemplate?.id || `tmpl-${Date.now()}`,
      name,
      category,
      model,
      description,
      basePrompt,
      variableMode,
      promptConfig,
      defaultVariableValue: titleOverlay,
      defaultApplianceObject: applianceObject,
      defaultTitleOverlay: titleOverlay,
      defaultEnvironment: environmentPlace,
      defaultMoodLighting: moodLighting,
      defaultColorMaterial: colorMaterial,
      thumbnailUrl,
      isPublic,
      requireApproval,
      fieldPermissions: {
        text1: variableMode === 'title_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom',
        targetAudience: permTargetAudience,
        styleReferenceImg: permStyleRef,
        applianceObject: variableMode === 'object_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom',
        environment: variableMode === 'full_custom',
        lighting: variableMode === 'full_custom',
      },
      tags: [category.replace(/\s+/g, ''), model, variableMode],
      createdAt: initialTemplate?.createdAt || new Date().toISOString().split('T')[0],
      author: initialTemplate?.author || 'Farhad Abdollahi (Admin)',
    };

    setSaveSuccess(true);
    setTimeout(() => {
      onSaveTemplate(templateToSave);
    }, 500);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-28 md:pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191c23]">
              {isEditingExisting ? `Edit Template` : 'Template Builder'}
            </h2>
            {isEditingExisting ? (
              <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300/70 font-semibold flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                Editing: {initialTemplate?.name}
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-[#1A73E8] border border-blue-200/60 font-medium">
                Modular Prompt & Variable Engine
              </span>
            )}
          </div>
          <p className="text-sm text-[#5F6368] mt-1">
            {isEditingExisting
              ? `Update reference prompts, default object placeholders, lighting, and variable permissions for ${initialTemplate?.name}.`
              : 'Configure reference appliances, environments, lighting, title overlays, and granular user customization locks.'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full border border-[#DADCE0] bg-white text-[#414754] text-xs font-semibold hover:bg-[#F1F4F9] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="template-builder-save-btn"
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            {saveSuccess ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {saveSuccess
                ? isEditingExisting
                  ? 'Template Updated!'
                  : 'Template Saved!'
                : isEditingExisting
                ? 'Update Template'
                : 'Save Template'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Builder Grid: Left Primary Column + Right Settings Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Card 1: Execution Model & Basic Info */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1A73E8]" />
                1. General Settings & Model
              </h3>
              <span className="text-[11px] text-[#5F6368] bg-[#F1F4F9] px-2.5 py-0.5 rounded-full font-mono">
                Engine: Multi-Modal Studio
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Smart Kitchen: Swappable Appliance Template"
                  className="w-full px-4 py-2.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-sm text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:bg-white transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1.5">
                  Execution Model
                </label>
                <div className="relative">
                  <select
                    id="template-model-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value as ExecutionModel)}
                    className="w-full appearance-none px-4 py-2.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-sm font-medium text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:bg-white transition-all cursor-pointer pr-10"
                  >
                    <option value="nano-banana-2">nano-banana-2 (Gemini Flash Image Engine)</option>
                    <option value="sedance-2.5-pro">sedance-2.5-pro (High-Fidelity Photorealism)</option>
                    <option value="SDXL">SDXL 1.0 (Commercial Industrial)</option>
                    <option value="Midjourney v6">Midjourney v6 (Artisan & Barista Render)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#727785] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-sm text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="Smart Kitchen">Smart Kitchen</option>
                  <option value="Laundry AI">Laundry AI</option>
                  <option value="Climate Control">Climate Control</option>
                  <option value="Home Automation">Home Automation</option>
                  <option value="Kitchen Luxury">Kitchen Luxury</option>
                  <option value="Commercial Tech">Commercial Tech</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5F6368] mb-1.5">
                  Description Summary
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary for catalog users..."
                  className="w-full px-4 py-2.5 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-sm text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 2: CORE FEATURE - Variable Customization Modes (Options 1, 2, 3) */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#1A73E8]/30 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#1A73E8] uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  2. Variable Permission Mode (What Can Users Change in Studio?)
                </h3>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Select which parameters the end-user can customize during image generation.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1A73E8] self-start sm:self-auto">
                Required Configuration
              </span>
            </div>

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              
              {/* Option 1: Object Only (Appliance Swappable) */}
              <div
                onClick={() => setVariableMode('object_only')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  variableMode === 'object_only'
                    ? 'border-[#1A73E8] bg-[#E8F0FE]/40 shadow-xs'
                    : 'border-[#DADCE0] hover:border-gray-400 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-lg bg-blue-100/80 text-[#1A73E8]">
                      <Box className="w-4 h-4" />
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      variableMode === 'object_only' ? 'border-[#1A73E8] bg-[#1A73E8]' : 'border-[#DADCE0]'
                    }`}>
                      {variableMode === 'object_only' && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#191c23]">
                    1. Reference Object Only
                  </h4>
                  <p className="text-[11px] text-[#5F6368] mt-1 leading-relaxed">
                    User can <strong>ONLY change/swap the appliance object</strong> (e.g. switch Refrigerator to Laundry / Washer or Espresso Maker). Title, mood, place & lighting remain <strong>LOCKED</strong>.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-800">
                    Object: ✏️ Swappable
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    Title: 🔒 Fixed
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    Place & Lighting: 🔒 Fixed
                  </span>
                </div>
              </div>

              {/* Option 2: Title / Text Overlay Only */}
              <div
                onClick={() => setVariableMode('title_only')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  variableMode === 'title_only'
                    ? 'border-[#1A73E8] bg-[#E8F0FE]/40 shadow-xs'
                    : 'border-[#DADCE0] hover:border-gray-400 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-lg bg-purple-100/80 text-purple-700">
                      <Tag className="w-4 h-4" />
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      variableMode === 'title_only' ? 'border-[#1A73E8] bg-[#1A73E8]' : 'border-[#DADCE0]'
                    }`}>
                      {variableMode === 'title_only' && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#191c23]">
                    2. Title / Text Only
                  </h4>
                  <p className="text-[11px] text-[#5F6368] mt-1 leading-relaxed">
                    User can <strong>ONLY change the title / text overlay</strong> in the image. The reference appliance (Refrigerator), mood, place, lighting & colors remain <strong>LOCKED</strong>.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    Title: ✏️ Editable
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    Object: 🔒 Fixed
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    Place & Lighting: 🔒 Fixed
                  </span>
                </div>
              </div>

              {/* Option 3: Both Object & Title */}
              <div
                onClick={() => setVariableMode('both_object_and_title')}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  variableMode === 'both_object_and_title'
                    ? 'border-[#1A73E8] bg-[#E8F0FE]/40 shadow-xs'
                    : 'border-[#DADCE0] hover:border-gray-400 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-lg bg-emerald-100/80 text-emerald-700">
                      <Layers className="w-4 h-4" />
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      variableMode === 'both_object_and_title' ? 'border-[#1A73E8] bg-[#1A73E8]' : 'border-[#DADCE0]'
                    }`}>
                      {variableMode === 'both_object_and_title' && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#191c23]">
                    3. Both Object & Title
                  </h4>
                  <p className="text-[11px] text-[#5F6368] mt-1 leading-relaxed">
                    User can customize <strong>BOTH the appliance object AND title overlay</strong>. Environment place, mood, lighting & colors remain <strong>LOCKED</strong>.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-800">
                    Object: ✏️ Swappable
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    Title: ✏️ Editable
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    Place: 🔒 Fixed
                  </span>
                </div>
              </div>

            </div>

            {/* Additional Secondary Modes */}
            <div className="flex items-center gap-4 pt-1 text-xs text-[#5F6368] border-t border-gray-100">
              <span className="font-semibold text-[#191c23]">Other Presets:</span>
              <label 
                onClick={() => setVariableMode('full_custom')}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#1A73E8]"
              >
                <input 
                  type="radio" 
                  name="vmode" 
                  checked={variableMode === 'full_custom'} 
                  onChange={() => setVariableMode('full_custom')}
                  className="text-[#1A73E8]" 
                />
                <span>4. Full Customizer (Object, Title, Place, Mood & Lighting)</span>
              </label>
              <label 
                onClick={() => setVariableMode('locked')}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#1A73E8]"
              >
                <input 
                  type="radio" 
                  name="vmode" 
                  checked={variableMode === 'locked'} 
                  onChange={() => setVariableMode('locked')}
                  className="text-[#1A73E8]" 
                />
                <span>5. Fixed Standard Preset (1-Click Output)</span>
              </label>
            </div>
          </div>

          {/* Card 3: Modular Scene Parameters */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
                <Box className="w-4 h-4 text-[#1A73E8]" />
                3. Modular Scene & Parameter Definitions
              </h3>
              <button
                type="button"
                onClick={syncBasePromptFromModular}
                className="text-xs font-semibold text-[#1A73E8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync with Base Prompt
              </button>
            </div>

            <div className="space-y-4">
              
              {/* Parameter 1: Appliance Object */}
              <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#E0E2EC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#191c23] flex items-center gap-2">
                    <Box className="w-3.5 h-3.5 text-[#1A73E8]" />
                    Reference Appliance / Object (Placeholder: <code className="text-[#1A73E8] font-mono">{`{{OBJECT}}`}</code>)
                  </label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    variableMode === 'object_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {variableMode === 'object_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom'
                      ? '✏️ User Can Change'
                      : '🔒 Fixed by Template'}
                  </span>
                </div>
                <input
                  type="text"
                  value={applianceObject}
                  onChange={(e) => setApplianceObject(e.target.value)}
                  placeholder="e.g., four-door smart refrigerator, front-load washing machine, espresso maker"
                  className="w-full px-3.5 py-2 bg-white border border-[#DADCE0] rounded-lg text-xs sm:text-sm text-[#191c23] focus:ring-2 focus:ring-[#1A73E8] focus:outline-none"
                />
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#5F6368]">Quick Presets:</span>
                  {appliancePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setApplianceObject(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DADCE0] text-[#414754] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 2: Title / Text Overlay */}
              <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#E0E2EC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#191c23] flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-purple-600" />
                    Title / Text Overlay in Image (Placeholder: <code className="text-[#1A73E8] font-mono">{`{{TEXT_ZONE}}`}</code>)
                  </label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    variableMode === 'title_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {variableMode === 'title_only' || variableMode === 'both_object_and_title' || variableMode === 'full_custom'
                      ? '✏️ User Can Change'
                      : '🔒 Fixed by Template'}
                  </span>
                </div>
                <input
                  type="text"
                  value={titleOverlay}
                  onChange={(e) => setTitleOverlay(e.target.value)}
                  placeholder="e.g., Smart Inverter Tech - 2026 Edition"
                  className="w-full px-3.5 py-2 bg-white border border-[#DADCE0] rounded-lg text-xs sm:text-sm text-[#191c23] focus:ring-2 focus:ring-[#1A73E8] focus:outline-none"
                />
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#5F6368]">Quick Presets:</span>
                  {titlePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTitleOverlay(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DADCE0] text-[#414754] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 3: Environment / Place */}
              <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#E0E2EC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#191c23] flex items-center gap-2">
                    <Home className="w-3.5 h-3.5 text-blue-600" />
                    Environment & Setting Place (Placeholder: <code className="text-[#1A73E8] font-mono">{`{{ENVIRONMENT}}`}</code>)
                  </label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    variableMode === 'full_custom' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {variableMode === 'full_custom' ? '✏️ User Can Change' : '🔒 Fixed by Template'}
                  </span>
                </div>
                <input
                  type="text"
                  value={environmentPlace}
                  onChange={(e) => setEnvironmentPlace(e.target.value)}
                  placeholder="e.g., bright modern minimalist Scandinavian kitchen with marble island"
                  className="w-full px-3.5 py-2 bg-white border border-[#DADCE0] rounded-lg text-xs sm:text-sm text-[#191c23] focus:ring-2 focus:ring-[#1A73E8] focus:outline-none"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#5F6368]">Quick Presets:</span>
                  {placePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEnvironmentPlace(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DADCE0] text-[#414754] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 4: Mood & Lighting */}
              <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#E0E2EC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#191c23] flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Mood & Lighting (Placeholder: <code className="text-[#1A73E8] font-mono">{`{{LIGHTING}}`}</code>)
                  </label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    variableMode === 'full_custom' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {variableMode === 'full_custom' ? '✏️ User Can Change' : '🔒 Fixed by Template'}
                  </span>
                </div>
                <input
                  type="text"
                  value={moodLighting}
                  onChange={(e) => setMoodLighting(e.target.value)}
                  placeholder="e.g., soft natural daylight streaming through floor-to-ceiling windows"
                  className="w-full px-3.5 py-2 bg-white border border-[#DADCE0] rounded-lg text-xs sm:text-sm text-[#191c23] focus:ring-2 focus:ring-[#1A73E8] focus:outline-none"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#5F6368]">Quick Presets:</span>
                  {lightingPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMoodLighting(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DADCE0] text-[#414754] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 5: Color & Materials */}
              <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#E0E2EC] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#191c23] flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5 text-indigo-500" />
                    Color Palette & Materials (Placeholder: <code className="text-[#1A73E8] font-mono">{`{{COLOR_FINISH}}`}</code>)
                  </label>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                    🔒 Fixed by Template
                  </span>
                </div>
                <input
                  type="text"
                  value={colorMaterial}
                  onChange={(e) => setColorMaterial(e.target.value)}
                  placeholder="e.g., brushed stainless steel with subtle ice-blue LED accent lines"
                  className="w-full px-3.5 py-2 bg-white border border-[#DADCE0] rounded-lg text-xs sm:text-sm text-[#191c23] focus:ring-2 focus:ring-[#1A73E8] focus:outline-none"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-[#5F6368]">Quick Presets:</span>
                  {materialPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColorMaterial(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#DADCE0] text-[#414754] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Base System Prompt & Auto-Optimizer */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#1A73E8]" />
                4. Base System Prompt & Dynamic Variable Injection
              </label>

              {/* Insert Variables Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium text-[#5F6368]">Insert Variable:</span>
                {['OBJECT', 'TEXT_ZONE', 'ENVIRONMENT', 'LIGHTING', 'COLOR_FINISH'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#E8F0FE] text-[#1A73E8] hover:bg-blue-200 transition-colors cursor-pointer"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <textarea
                id="template-base-prompt-textarea"
                rows={5}
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                placeholder="Enter base instructions for this template... Use {{OBJECT}}, {{TEXT_ZONE}}, {{ENVIRONMENT}}, {{LIGHTING}} for injectible fields."
                className="w-full p-4 bg-[#F1F4F9] border border-[#DADCE0] rounded-xl text-xs sm:text-sm font-mono text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:bg-white transition-all leading-relaxed"
              />

              <div className="flex items-center justify-between mt-2.5">
                <button
                  type="button"
                  onClick={syncBasePromptFromModular}
                  className="text-xs font-medium text-[#1A73E8] hover:underline cursor-pointer"
                >
                  Regenerate from modular inputs
                </button>

                {/* Auto-Optimize Prompt Action Button */}
                <button
                  id="template-auto-optimize-btn"
                  type="button"
                  onClick={handleAutoOptimizePrompt}
                  disabled={isOptimizing}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-[#1A73E8] to-[#4648d4] hover:opacity-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
                  <span>{isOptimizing ? 'Optimizing with Gemini...' : '✨ Auto-Optimize Prompt'}</span>
                </button>
              </div>
            </div>

            {optimizationError && <p role="alert" className="text-red-700 text-sm">{optimizationError}</p>}
            {/* Live Resolved Prompt Preview */}
            <div className="bg-[#F8F9FD] border border-[#E0E2EC] rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#414754] flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#1A73E8]" />
                  Live Compiled Output Preview (How AI Reads It)
                </span>
                <span className="text-[10px] text-[#5F6368] font-mono">Real-Time Sync</span>
              </div>
              <p className="text-xs text-[#191c23] font-mono leading-relaxed bg-white p-3 rounded-lg border border-[#E0E2EC]/70 shadow-2xs">
                {getResolvedPreviewPrompt()}
              </p>
            </div>
          </div>

          {/* Card 5: Reference Image Assets Dropzone */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-3">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#1A73E8]" />
              5. Style Reference Image Asset (Optional)
            </h3>

            <div className="border-2 border-dashed border-[#DADCE0] hover:border-[#1A73E8] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#F8F9FD]">
              <UploadCloud className="w-10 h-10 text-[#727785] mb-2" />
              <p className="text-sm font-medium text-[#191c23]">
                Drag and drop reference appliance image here
              </p>
              <p className="text-xs text-[#5F6368] mt-0.5">
                PNG, JPG, or WebP up to 10MB (used as image-to-image style anchor)
              </p>
            </div>
          </div>

        </div>

        {/* Right Rail (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card: Active Mode Summary Badge */}
          <div className="bg-gradient-to-br from-[#1A73E8]/10 via-[#F8F9FD] to-white rounded-2xl p-5 border border-[#1A73E8]/20 shadow-soft space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1A73E8] uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Active Variable Policy</span>
            </div>
            
            <div className="bg-white p-3 rounded-xl border border-[#DADCE0] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#191c23]">Selected Mode:</span>
                <span className="text-xs font-mono font-bold text-[#1A73E8] bg-blue-50 px-2 py-0.5 rounded">
                  {variableMode === 'object_only' ? '1. Object Only' : 
                   variableMode === 'title_only' ? '2. Title Only' : 
                   variableMode === 'both_object_and_title' ? '3. Both Object & Title' :
                   variableMode === 'full_custom' ? '4. Full Custom' : '5. Fixed Preset'}
                </span>
              </div>
              <p className="text-[11px] text-[#5F6368] leading-relaxed">
                {variableMode === 'object_only' && 'Only the reference object (refrigerator, laundry, etc.) can be swapped. Mood, place & lighting remain locked.'}
                {variableMode === 'title_only' && 'Only the title overlay text can be modified. Reference appliance, mood & colors remain locked.'}
                {variableMode === 'both_object_and_title' && 'Both the appliance object and title overlay can be customized. Environment & lighting stay consistent.'}
                {variableMode === 'full_custom' && 'All modular layers (Object, Title, Place, Mood & Lighting) can be customized.'}
                {variableMode === 'locked' && 'Strict locked template for instant standardized output.'}
              </p>
            </div>
          </div>

          {/* Card: Field Permissions */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#1A73E8]" />
              Field Permissions
            </h3>

            <div className="space-y-3.5">
              {/* Field 1: TEXT_ZONE */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F8]">
                <div>
                  <p className="text-xs font-mono font-semibold text-[#191c23]">TEXT_ZONE (Title)</p>
                  <p className="text-[11px] text-[#5F6368]">Text input overlay on display</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermText1(!permText1)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    permText1 ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      permText1 ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Field 2: STYLE_REFERENCE_IMG */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F8]">
                <div>
                  <p className="text-xs font-mono font-semibold text-[#191c23]">STYLE_REF_IMG</p>
                  <p className="text-[11px] text-[#5F6368]">Appliance input image upload</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermStyleRef(!permStyleRef)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    permStyleRef ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      permStyleRef ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Field 3: TARGET_AUDIENCE */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono font-semibold text-[#191c23]">TARGET_AUDIENCE</p>
                  <p className="text-[11px] text-[#5F6368]">Demographic dropdown</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermTargetAudience(!permTargetAudience)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    permTargetAudience ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      permTargetAudience ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Card: Template Thumbnail Preview */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#1A73E8]" />
              Template Thumbnail
            </h3>

            <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-900 border border-[#DADCE0]">
              <img
                src={thumbnailUrl}
                alt="Thumbnail Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-mono">
                {model}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateThumbnail}
              disabled={isGeneratingThumbnail}
              className="w-full py-2.5 px-4 rounded-xl border border-[#DADCE0] hover:bg-[#F1F4F9] text-[#191c23] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingThumbnail ? 'animate-spin' : ''}`} />
              <span>{isGeneratingThumbnail ? 'Generating...' : 'Generate Auto-Thumbnail'}</span>
            </button>
          </div>

          {/* Card: Governance & Access Settings */}
          <div className="bg-white rounded-2xl p-6 border border-[#DADCE0] shadow-soft space-y-4">
            <h3 className="text-xs font-bold text-[#414754] uppercase tracking-wider">
              Governance & Access
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#191c23]">Public Template</p>
                  <p className="text-[11px] text-[#5F6368]">Available across entire workspace</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    isPublic ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#F0F2F8]">
                <div>
                  <p className="text-xs font-semibold text-[#191c23]">Require Approval</p>
                  <p className="text-[11px] text-[#5F6368]">Generations require supervisor sign-off</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireApproval(!requireApproval)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    requireApproval ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      requireApproval ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
