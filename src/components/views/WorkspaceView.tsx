import React, { useState } from 'react';
import { 
  Plus, 
  ArrowRight, 
  Search, 
  Sparkles, 
  SlidersHorizontal,
  Image as ImageIcon,
  Cpu,
  Layers,
  Edit3,
  Trash2,
  Copy,
  Sliders,
  MoreVertical,
  Check
} from 'lucide-react';
import { ApplianceTemplate } from '../../types';

interface WorkspaceViewProps {
  isAdmin?: boolean;
  templates: ApplianceTemplate[];
  onSelectTemplate: (template: ApplianceTemplate) => void;
  onCreateNewTemplate: () => void;
  onEditTemplate?: (template: ApplianceTemplate) => void;
  onDeleteTemplate?: (templateId: string) => void;
  userEmail?: string;
  completedGenerations?: number;
  generationLimit?: number;
  allowUnlimited?: boolean;
  onNavigateToGovernance?: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  isAdmin = false,
  templates,
  onSelectTemplate,
  onCreateNewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  userEmail = '',
  completedGenerations = 0,
  generationLimit = 0,
  allowUnlimited = false,
  onNavigateToGovernance,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const categories = ['All', 'Smart Kitchen', 'Climate Control', 'Home Automation', 'Laundry AI', 'Kitchen Luxury'];

  const isAtLimit = !allowUnlimited && completedGenerations >= generationLimit;

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleDelete = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    if (onDeleteTemplate) {
      onDeleteTemplate(templateId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#191c23]">
              Available Templates
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1A73E8] border border-blue-200/60 font-semibold">
              {templates.length} Active Presets
            </span>
          </div>
          <p className="text-sm text-[#5F6368] mt-1">
            Start building with pre-configured models, or customize reference prompts and locks as Admin.
          </p>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {/* Quota Limit Badge */}
          <button
            onClick={onNavigateToGovernance}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-xs text-xs font-medium cursor-pointer transition-all ${
              isAtLimit 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-white border-[#DADCE0] text-[#414754] hover:bg-[#F8F9FD]'
            }`}
            title="Click to view and adjust limits in Governance"
          >
            <span className="text-[#5F6368]">Quota:</span>
            <span className={`font-mono font-bold ${isAtLimit ? 'text-red-600' : 'text-[#1A73E8]'}`}>
              {allowUnlimited ? 'Unlimited' : `${completedGenerations} / ${generationLimit} Images`}
            </span>
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DADCE0] shadow-xs text-xs font-medium text-[#414754]">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono text-[#191c23]">{userEmail}</span>
            <span className="text-[#1A73E8] font-semibold">({isAdmin ? 'Admin' : 'User'})</span>
          </div>

          {isAdmin && <button
            id="workspace-new-template-btn"
            onClick={onCreateNewTemplate}
            className="flex items-center gap-1.5 bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.98] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Create New Template"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Template</span>
          </button>}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#1A73E8] text-white shadow-xs'
                  : 'bg-white text-[#5F6368] border border-[#DADCE0] hover:bg-[#F1F4F9] hover:text-[#191c23]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-[#727785] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates & models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-[#DADCE0] rounded-full text-xs text-[#191c23] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] transition-all"
          />
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            id={`template-card-${template.id}`}
            className="bg-white rounded-2xl border border-[#DADCE0] overflow-hidden shadow-soft hover:shadow-soft-lg transition-all duration-200 flex flex-col group relative"
          >
            {/* Thumbnail Box */}
            <div className="relative aspect-[16/10] bg-[#F1F4F9] overflow-hidden">
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              
              {/* Model Tag Pill */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-white text-[11px] font-mono font-medium flex items-center gap-1 shadow-sm">
                <Cpu className="w-3 h-3 text-blue-300" />
                {template.model}
              </div>

              {/* Admin Quick Action Floating Buttons in top-right */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <div className="bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[#1A73E8] text-[10px] font-semibold">
                  {template.category}
                </div>

                {onEditTemplate && (
                  <button
                    id={`quick-edit-template-${template.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTemplate(template);
                    }}
                    title="Edit Saved Template (Admin)"
                    className="p-1.5 rounded-full bg-white/95 hover:bg-white text-[#191c23] hover:text-[#1A73E8] shadow-md transition-all cursor-pointer hover:scale-105"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Details */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-[#191c23] group-hover:text-[#1A73E8] transition-colors line-clamp-1">
                    {template.name}
                  </h3>
                </div>
                <p className="text-xs text-[#5F6368] mt-1.5 line-clamp-2 leading-relaxed">
                  {template.description}
                </p>
              </div>

              {/* Tag Badges & Variable Mode Indicator */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {template.variableMode === 'object_only' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1A73E8] border border-blue-200/60 font-semibold flex items-center gap-1">
                      <span>🧺 Mode 1: Object Swappable</span>
                    </span>
                  )}
                  {template.variableMode === 'title_only' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold flex items-center gap-1">
                      <span>🏷️ Mode 2: Title Only</span>
                    </span>
                  )}
                  {template.variableMode === 'both_object_and_title' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold flex items-center gap-1">
                      <span>⚡ Mode 3: Object + Title</span>
                    </span>
                  )}
                  {template.variableMode === 'full_custom' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold">
                      🎛️ Full Customizer
                    </span>
                  )}
                  {template.variableMode === 'locked' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 font-semibold">
                      🔒 Fixed Preset
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F4F9] text-[#5F6368] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Use Template + Admin Edit Template */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  id={`use-template-btn-${template.id}`}
                  onClick={() => onSelectTemplate(template)}
                  className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white font-medium py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer text-sm"
                >
                  <span>Use Template</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                {onEditTemplate && (
                  <button
                    id={`edit-template-btn-${template.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTemplate(template);
                    }}
                    title="Edit Template Configuration"
                    className="p-2.5 rounded-full border border-[#DADCE0] bg-white text-[#414754] hover:text-[#1A73E8] hover:border-[#1A73E8] hover:bg-[#F8F9FD] active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                {onDeleteTemplate && (
                  deleteConfirmId === template.id ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <button
                        onClick={(e) => handleDelete(e, template.id)}
                        className="p-2.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer text-xs font-semibold"
                        title="Confirm Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="p-2.5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all cursor-pointer text-xs"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(template.id);
                      }}
                      title="Delete Template"
                      className="p-2.5 rounded-full border border-transparent hover:border-red-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {/* "Start Blank" Card */}
        <div
          id="template-card-start-blank"
          onClick={onCreateNewTemplate}
          className="border-2 border-dashed border-[#DADCE0] hover:border-[#1A73E8] bg-white/60 hover:bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[300px] group shadow-soft"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#F1F4F9] group-hover:bg-[#E8F0FE] text-[#727785] group-hover:text-[#1A73E8] flex items-center justify-center transition-colors mb-4">
            <ImageIcon className="w-8 h-8 transition-transform group-hover:scale-110" />
          </div>
          <h3 className="font-semibold text-base text-[#191c23] group-hover:text-[#1A73E8] transition-colors">
            Start Blank
          </h3>
          <p className="text-xs text-[#5F6368] max-w-xs mt-1.5 leading-relaxed">
            Create an enterprise template from scratch with custom variables, prompt constraints, and supervisor permission controls.
          </p>
          <span className="mt-4 text-xs font-semibold text-[#1A73E8] flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Launch Builder
          </span>
        </div>
      </div>
    </div>
  );
};
