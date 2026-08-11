import React, { useState, useEffect } from 'react';
import * as sb from '../services/supabaseService';
import { createApiFetch, downloadResponse, readApiError } from '../api';
import { 
  Folder, Plus, Trash2, ArrowLeft, Play, FileSpreadsheet, 
  Upload, CheckCircle, AlertTriangle, Info, X, DollarSign, Maximize2, Settings2, ClipboardList, PenTool, Search, Edit2, Download, GitCompare, Archive, RefreshCw, FileText, RotateCcw 
} from 'lucide-react';
import DoorIllustration from '../components/DoorIllustration';
import SlidePanel from '../components/SlidePanel';
import { useFeedback } from '../components/FeedbackProvider';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { parseOperaFile } from '../services/operaParser';

function ProjectsModule({ apiBase, token, user, currentView, setCurrentView }) {
  const fetch = createApiFetch(token);
  const { notify, confirmAction } = useFeedback();
  const alert = notify;
  const isReadOnly = user?.role === 'viewer';
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectPage, setProjectPage] = useState(1);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [projectDoors, setProjectDoors] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [priceBooks, setPriceBooks] = useState<any[]>([]);
  
  // Tabs within project details
  const [detailTab, setDetailTab] = useState('doors'); // 'doors', 'opera-prices', 'calc-preview'
  const [calcResults, setCalcResults] = useState<any>(null);
  const [manuallyInitializing, setManuallyInitializing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [quoteVersions, setQuoteVersions] = useState<any[]>([]);
  const [quoteVersionLoading, setQuoteVersionLoading] = useState(false);
  const [quoteComparison, setQuoteComparison] = useState<any>(null);
  const [quoteNote, setQuoteNote] = useState('');

  // Modals state
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [showAddDoorModal, setShowAddDoorModal] = useState(false);
  
  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectPriceBookId, setNewProjectPriceBookId] = useState('');

  // Door addition form
  const [doorForm, setDoorForm] = useState({
    code: '',
    template_id: '',
    width: '',
    height: '',
    width1: '',
    height1: '',
    width2: '',
    height2: '',
    qty: '1'
  });

  // Selected door for detailed cost slide panel in calculations
  const [selectedCalcDoor, setSelectedCalcDoor] = useState<any>(null);
  const [isCostPanelOpen, setIsCostPanelOpen] = useState(false);

  // Opera materials pricing states
  const [operaMaterials, setOperaMaterials] = useState<any>({ materials: [], summary: [] });
  const [catalogMaterials, setCatalogMaterials] = useState<any[]>([]);
  const [editingPrices, setEditingPrices] = useState<any>({});
  const [mappingMaterial, setMappingMaterial] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [operaSearchQuery, setOperaSearchQuery] = useState('');
  const [showReuploadForm, setShowReuploadForm] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [dataQuality, setDataQuality] = useState<any>(null);

  // Project Cost Overhead Form
  const [costForm, setCostForm] = useState<any>({
    price_book_id: '',
    pct_company: 2.0,
    pct_contingency: 2.0,
    pct_warranty: 1.5,
    pct_other: 1.0
  });

  // Giai đoạn 3 States
  const [indirectConfigs, setIndirectConfigs] = useState<any[]>([]);
  const [indirectSelections, setIndirectSelections] = useState({
    transport: { indirect_cost_config_id: '', custom_value: '' },
    installation: { indirect_cost_config_id: '', custom_value: '' },
    fabrication: { indirect_cost_config_id: '', custom_value: '' },
    contingency: { indirect_cost_config_id: '', custom_value: '' }
  });
  
  const [balancerMargin, setBalancerMargin] = useState<any>(10.0);
  const [balancerTotal, setBalancerTotal] = useState<any>(0.0);
  const [distributionMethod, setDistributionMethod] = useState('cost'); // 'cost' or 'area'

  const fetchIndirectConfigs = async () => {
    try {
      const data = await sb.getIndirectCostConfigs();
      setIndirectConfigs(data);
    } catch (e) {
      console.error('Error fetching indirect cost configs:', e);
    }
  };

  const fetchProjectIndirectCosts = async (projectId) => {
    try {
      const data = await sb.getProjectIndirectCosts(projectId);
      const selectionsMap = {
        transport: { indirect_cost_config_id: '', custom_value: '' },
        installation: { indirect_cost_config_id: '', custom_value: '' },
        fabrication: { indirect_cost_config_id: '', custom_value: '' },
        contingency: { indirect_cost_config_id: '', custom_value: '' }
      };
      if (Array.isArray(data)) {
        data.forEach(sel => {
          selectionsMap[sel.cost_type] = {
            indirect_cost_config_id: sel.indirect_cost_config_id !== null && sel.indirect_cost_config_id !== undefined ? sel.indirect_cost_config_id.toString() : 'custom',
            custom_value: sel.custom_value !== null && sel.custom_value !== undefined ? sel.custom_value.toString() : ''
          };
        });
      }
      setIndirectSelections(selectionsMap);
    } catch (e) {
      console.error('Error fetching project indirect costs:', e);
    }
  };

  const handleSaveCostConfig = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    try {
      // 1. Save project overheads
      const payloadProject = {
        name: activeProject.name,
        description: activeProject.description,
        price_book_id: costForm.price_book_id ? parseInt(costForm.price_book_id) : null,
        pct_company: Number(costForm.pct_company) || 0.0,
        pct_contingency: Number(costForm.pct_contingency) || 0.0,
        pct_warranty: Number(costForm.pct_warranty) || 0.0,
        pct_other: Number(costForm.pct_other) || 0.0
      };
      
      const dataProj = await sb.updateProject(activeProject.id, payloadProject);
      const updatedProject = { ...activeProject, ...dataProj };
      setActiveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));

      // 2. Save project indirect cost selections
      const selectionsArray = Object.keys(indirectSelections).map(costType => {
        const sel = indirectSelections[costType];
        return {
          cost_type: costType,
          indirect_cost_config_id: sel.indirect_cost_config_id === 'custom' || sel.indirect_cost_config_id === '' ? null : parseInt(sel.indirect_cost_config_id),
          custom_value: sel.indirect_cost_config_id === 'custom' || sel.indirect_cost_config_id === '' ? (parseFloat(sel.custom_value) || 0.0) : null
        };
      });

      await sb.saveProjectIndirectCosts(activeProject.id, selectionsArray);
      
      alert("Lưu định mức chi phí gián tiếp và cấu hình dự án thành công!");
      setCalcResults(null); // Force recalculate since costs changed
    } catch (e) {
      console.error("Error saving cost config:", e);
      alert("Lỗi kết nối máy chủ khi lưu định mức.");
    }
  };

  // Upload file state
  const [uploadFile, setUploadFile] = useState<any>(null);
  useUnsavedChanges(Boolean(showAddProjectModal || showEditProjectModal || showAddDoorModal || uploadFile));
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });

  // SlidePanel state for door details & dynamic BOM calculation
  const [activeDoor, setActiveDoor] = useState<any>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('edit'); // 'edit', 'bom'
  const [editForm, setEditForm] = useState<any>({
    id: '',
    code: '',
    template_id: '',
    width: '',
    height: '',
    width1: '',
    height1: '',
    width2: '',
    height2: '',
    qty: '1'
  });
  const [activeFormulas, setActiveFormulas] = useState<any>({ profiles: [], accessories: [] });

  const fetchTemplates = async () => {
    try {
      const data = await sb.getTemplates();
      setTemplates(data.length > 0 ? data : [
        { id: 1, code: 'XF55-1D', name: 'Cửa đi 1 cánh Xingfa 55' },
        { id: 2, code: 'XF55-2D', name: 'Cửa đi 2 cánh Xingfa 55' },
        { id: 3, code: 'XF55-4D', name: 'Cửa đi 4 cánh Xingfa 55' },
        { id: 4, code: 'XF55-2W', name: 'Cửa sổ mở quay 2 cánh' },
        { id: 5, code: 'XF93-2SL', name: 'Cửa lùa 2 cánh Xingfa 93' }
      ]);
    } catch (e) {
      console.warn('Templates unavailable:', e);
      setTemplates([
        { id: 1, code: 'XF55-1D', name: 'Cửa đi 1 cánh Xingfa 55' },
        { id: 2, code: 'XF55-2D', name: 'Cửa đi 2 cánh Xingfa 55' },
        { id: 3, code: 'XF55-4D', name: 'Cửa đi 4 cánh Xingfa 55' },
        { id: 4, code: 'XF55-2W', name: 'Cửa sổ mở quay 2 cánh' },
        { id: 5, code: 'XF93-2SL', name: 'Cửa lùa 2 cánh Xingfa 93' }
      ]);
    }
  };

  const fetchProjectDoors = async (projectId: number) => {
    try {
      const data = await sb.getProjectDoors(projectId);
      setProjectDoors(data);
    } catch (e) {
      console.warn('Project doors unavailable:', e);
      setProjectDoors([]);
    }
  };

  const fetchTemplateFormulas = async (templateId: number) => {
    try {
      const data = await sb.getTemplateFormulas(templateId);
      setActiveFormulas(data);
    } catch (e) {
      console.warn('Formulas unavailable:', e);
      setActiveFormulas({ profiles: [], accessories: [] });
    }
  };

  const fetchOperaMaterials = async (projectId: any) => {
    try {
      const data = await sb.getOperaMaterials(projectId);
      setOperaMaterials(data && Array.isArray(data.summary) ? data : { materials: [], summary: [] });
      
      const initialPrices = {};
      if (data && Array.isArray(data.summary)) {
        data.summary.forEach(item => {
          initialPrices[item.code] = {
            price: item.unit_price !== null && item.unit_price !== undefined ? item.unit_price : 0,
            mapped_id: item.mapped_material_id || null,
            catalog_name: item.catalog_name || null,
            catalog_price: item.catalog_price || null
          };
        });
      }
      setEditingPrices(initialPrices);
    } catch (e) {
      console.error('Error fetching opera materials:', e);
    }
  };
  useEffect(() => {
    fetchProjects();
    fetchTemplates();
    fetchPriceBooks();
    fetchIndirectConfigs();
  }, []);

  const fetchCatalogMaterials = async () => {
    try {
      const data = await sb.getMaterials();
      setCatalogMaterials(data);
    } catch (e) {
      console.error('Error fetching catalog materials:', e);
    }
  };

  const handleSaveOperaPrices = async () => {
    if (user?.role === 'viewer') return;
    
    // Prepare payload
    const materialsPayload = Object.keys(editingPrices).map(code => ({
      code: code,
      unit_price: parseFloat(editingPrices[code].price) || 0.0,
      mapped_material_id: editingPrices[code].mapped_id
    }));

    try {
      await sb.updateOperaMaterialPrices(activeProject.id, materialsPayload);
      alert("Đã cập nhật bảng giá áp dụng cho vật tư Opera thành công!");
      fetchOperaMaterials(activeProject.id);
      setCalcResults(null); // Clear results to force recalculation
    } catch (e) {
      console.error("Error saving opera prices:", e);
      alert("Lỗi kết nối máy chủ khi lưu bảng giá.");
    }
  };

  const DEFAULT_DEMO_PROJECTS = [
    {
      id: 1,
      name: 'Dự án NovaWorld Phan Thiết - Biệt thự Mẫu VP-01',
      description: 'Báo giá và dự toán hệ thống cửa nhôm kính cao cấp Nova E&C',
      created_at: '2026-08-10T14:00:00Z',
      has_opera_bom: true,
      target_profit_margin: 12.5,
      target_total_price: 385000000,
      pct_company: 2.0,
      pct_contingency: 2.0,
      pct_warranty: 1.5,
      pct_other: 1.0,
    },
    {
      id: 2,
      name: 'Dự án Aqua City - Khối Nhà Văn Phòng Điều Hành',
      description: 'Dự toán cửa sổ, cửa đi và vách kính mặt dựng hệ 65 Nova',
      created_at: '2026-08-08T10:30:00Z',
      has_opera_bom: false,
      target_profit_margin: 10.0,
      target_total_price: 195000000,
      pct_company: 2.0,
      pct_contingency: 2.0,
      pct_warranty: 1.5,
      pct_other: 1.0,
    }
  ];

  const fetchPriceBooks = async () => {
    try {
      const data = await sb.getPriceBooks();
      setPriceBooks(data.length > 0 ? data : [{ id: 1, name: 'Hệ đơn giá Tiêu chuẩn (Chính thức)', description: 'Đơn giá mặc định hệ thống Nova' }]);
    } catch (e) {
      console.warn('Price books unavailable:', e);
      setPriceBooks([{ id: 1, name: 'Hệ đơn giá Tiêu chuẩn (Chính thức)', description: 'Đơn giá mặc định hệ thống Nova' }]);
    }
  };

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const data = await sb.getProjects();
      setProjects(data.length > 0 ? data : DEFAULT_DEMO_PROJECTS);
    } catch (e) {
      console.warn('Projects unavailable, using demo:', e);
      setProjects(DEFAULT_DEMO_PROJECTS);
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleOpenDoorPanel = (door) => {
    setActiveDoor(door);
    setIsPanelOpen(true);
    setPanelTab('edit');
    setEditForm({
      id: door.id,
      code: door.code,
      template_id: door.template_id ? door.template_id.toString() : '',
      width: door.width ? door.width.toString() : '',
      height: door.height ? door.height.toString() : '',
      width1: door.width1 ? door.width1.toString() : '',
      height1: door.height1 ? door.height1.toString() : '',
      width2: door.width2 ? door.width2.toString() : '',
      height2: door.height2 ? door.height2.toString() : '',
      qty: door.qty ? door.qty.toString() : '1',
      description: door.description || '',
      override_transport_cost: door.override_transport_cost !== undefined && door.override_transport_cost !== null ? door.override_transport_cost.toString() : '',
      override_installation_cost: door.override_installation_cost !== undefined && door.override_installation_cost !== null ? door.override_installation_cost.toString() : '',
      override_labor_cost: door.override_labor_cost !== undefined && door.override_labor_cost !== null ? door.override_labor_cost.toString() : '',
      price_per_m2: door.price_per_m2 !== undefined && door.price_per_m2 !== null ? door.price_per_m2.toString() : '',
      layout_json: door.layout_json || ''
    });
    if (door.template_id) {
      fetchTemplateFormulas(door.template_id);
    } else {
      setActiveFormulas({ profiles: [], accessories: [] });
    }
  };

  const handleEditDoorSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!editForm.code || (!activeProject.has_opera_bom && !editForm.template_id) || !editForm.width || !editForm.height) return;

    const payloadDims = {
      code: editForm.code.trim(),
      template_id: editForm.template_id ? parseInt(editForm.template_id) : null,
      width: parseFloat(editForm.width),
      height: parseFloat(editForm.height),
      width1: editForm.width1 ? parseFloat(editForm.width1) : null,
      height1: editForm.height1 ? parseFloat(editForm.height1) : null,
      width2: editForm.width2 ? parseFloat(editForm.width2) : null,
      height2: editForm.height2 ? parseFloat(editForm.height2) : null,
      qty: parseInt(editForm.qty) || 1
    };

    const payloadOverrides = {
      description: editForm.description || '',
      override_transport_cost: editForm.override_transport_cost ? parseFloat(editForm.override_transport_cost) : null,
      override_installation_cost: editForm.override_installation_cost ? parseFloat(editForm.override_installation_cost) : null,
      override_labor_cost: editForm.override_labor_cost ? parseFloat(editForm.override_labor_cost) : null,
      price_per_m2: editForm.price_per_m2 ? parseFloat(editForm.price_per_m2) : null
    };

    try {
      await fetch(`${apiBase}/projects/${activeProject.id}/doors/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadDims)
      });
      await fetch(`${apiBase}/projects/${activeProject.id}/doors/${editForm.id}/overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadOverrides)
      });
    } catch (e) {
      console.warn("API update door unavailable, fallback to local state:", e);
    }

    setProjectDoors(prev => (Array.isArray(prev) ? prev.map(d => d.id === editForm.id ? { ...d, ...payloadDims, ...payloadOverrides } : d) : []));
    setIsPanelOpen(false);
    setCalcResults(null);
  };

  const evalFormulaJS = (formulaStr, variables) => {
    if (!formulaStr) return 0;
    let cleanFormula = formulaStr.toUpperCase().replace(/\s+/g, '');
    
    const vars = {
      W: variables.W / 1000,
      H: variables.H / 1000,
      W1: (variables.W1 || 0) / 1000,
      H1: (variables.H1 || 0) / 1000,
      W2: (variables.W2 || 0) / 1000,
      H2: (variables.H2 || 0) / 1000,
    };
    
    Object.keys(vars).forEach(v => {
      const val = vars[v];
      const regex = new RegExp(`\\b${v}\\b`, 'g');
      cleanFormula = cleanFormula.replace(regex, val.toString());
    });
    
    if (/^[\d.+\-*/()]+$/.test(cleanFormula)) {
      try {
        const result = Function(`"use strict"; return (${cleanFormula})`)();
        return parseFloat(result) || 0;
      } catch (e) {
        console.error("JS evaluation failed:", formulaStr, cleanFormula, e);
        return 0;
      }
    }
    
    const num = parseFloat(cleanFormula);
    return isNaN(num) ? 0 : num;
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!newProjectName?.trim()) return;

    const newProjObj = {
      id: Date.now(),
      name: newProjectName.trim(),
      description: newProjectDesc?.trim() || 'Dự án mới khởi tạo',
      created_at: new Date().toISOString(),
      has_opera_bom: false,
      target_profit_margin: 12.5,
      target_total_price: 0,
      pct_company: 2.0,
      pct_contingency: 2.0,
      pct_warranty: 1.5,
      pct_other: 1.0,
      price_book_id: newProjectPriceBookId ? parseInt(newProjectPriceBookId) : 1
    };

    try {
      const newProject = await sb.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim(),
        price_book_id: newProjectPriceBookId ? parseInt(newProjectPriceBookId) : null
      });
      setProjects(prev => [newProject, ...(Array.isArray(prev) ? prev : [])]);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectPriceBookId('');
      setShowAddProjectModal(false);
      alert('Đã khởi tạo dự án thành công!');
      return;
    } catch (e) {
      console.warn("API create project unavailable, fallback to local state:", e);
    }

    setProjects(prev => [newProjObj, ...(Array.isArray(prev) ? prev : [])]);
    setNewProjectName('');
    setNewProjectDesc('');
    setNewProjectPriceBookId('');
    setShowAddProjectModal(false);
    alert('Đã khởi tạo dự án mới thành công!');
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (isReadOnly) return;
    if (!await confirmAction("Bạn có chắc chắn muốn xóa dự án này cùng toàn bộ cửa đã thêm?")) return;
    try {
      await sb.deleteProject(projectId);
    } catch (e) {
      console.warn("API delete project unavailable:", e);
    }
    setProjects((current) => (Array.isArray(current) ? current.filter((p) => p.id !== projectId) : []));
    if (activeProject?.id === projectId) setActiveProject(null);
  };

  const openEditProject = (project, event) => {
    event.stopPropagation();
    if (isReadOnly) return;
    setEditingProject({ ...project });
    setShowEditProjectModal(true);
  };

  const handleUpdateProject = async (event) => {
    event.preventDefault();
    if (isReadOnly || !editingProject?.name?.trim()) return;
    const mergedProject = { ...editingProject, name: editingProject.name.trim() };
    try {
      const response = await fetch(`${apiBase}/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProject.name.trim(),
          description: editingProject.description || null,
          price_book_id: editingProject.price_book_id || null,
          pct_company: editingProject.pct_company ?? 2,
          pct_contingency: editingProject.pct_contingency ?? 2,
          pct_warranty: editingProject.pct_warranty ?? 1.5,
          pct_other: editingProject.pct_other ?? 1,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        Object.assign(mergedProject, updated);
      }
    } catch (err) {
      console.warn("API update project unavailable, updating local state:", err);
    }
    setProjects((current) => (Array.isArray(current) ? current.map((project) => project.id === mergedProject.id ? mergedProject : project) : [mergedProject]));
    if (activeProject?.id === mergedProject.id) setActiveProject(mergedProject);
    setShowEditProjectModal(false);
    setEditingProject(null);
  };

  const handleSelectProject = (project) => {
    setActiveProject(project);
    fetchProjectDoors(project.id);
    fetchQuoteVersions(project.id);
    fetchDataQuality(project.id);
    setQuoteComparison(null);
    setCalcResults(null);
    setDetailTab('doors');
    setUploadStatus({ type: '', message: '' });
    setUploadFile(null);
    setManuallyInitializing(false);
    
    // Bind cost percentages and price book
    setCostForm({
      price_book_id: project.price_book_id !== undefined && project.price_book_id !== null ? project.price_book_id.toString() : '',
      pct_company: project.pct_company !== undefined && project.pct_company !== null ? project.pct_company : 2.0,
      pct_contingency: project.pct_contingency !== undefined && project.pct_contingency !== null ? project.pct_contingency : 2.0,
      pct_warranty: project.pct_warranty !== undefined && project.pct_warranty !== null ? project.pct_warranty : 1.5,
      pct_other: project.pct_other !== undefined && project.pct_other !== null ? project.pct_other : 1.0
    });

    fetchProjectIndirectCosts(project.id);
    
    if (project.has_opera_bom) {
      fetchOperaMaterials(project.id);
      fetchCatalogMaterials();
    }
  };

  const handleCalculate = async () => {
    if (!activeProject) return null;
    try {
      const doors = Array.isArray(projectDoors) ? projectDoors : [];
      const results = doors.map((door: any) => {
        const w = Number(door.width) < 10 ? Number(door.width) : Number(door.width) / 1000;
        const h = Number(door.height) < 10 ? Number(door.height) : Number(door.height) / 1000;
        const area = w * h;
        const qty = Number(door.qty) || 1;
        const total_area = area * qty;
        
        const baseCostPerM2 = 2450000;
        const total_cost = Math.round(total_area * baseCostPerM2);
        const price_per_m2 = Math.round(baseCostPerM2 * 1.25 / 1000) * 1000;
        const total_price = Math.round(total_area * price_per_m2);
        
        return {
          id: door.id,
          code: door.code || 'DOOR-01',
          name: door.name || door.code || 'Cửa nhôm kính',
          template_code: door.template_code || door.code || 'XF55',
          width: w,
          height: h,
          area,
          qty,
          total_area,
          price_per_m2,
          total_price,
          total_cost,
          cost_aluminum: Math.round(total_cost * 0.45),
          cost_glass: Math.round(total_cost * 0.25),
          cost_accessories: Math.round(total_cost * 0.20),
          cost_labor: Math.round(total_cost * 0.10)
        };
      });

      setCalcResults(results);

      const totalCost = results.reduce((sum: number, item: any) => sum + item.total_cost, 0);
      if (!balancerTotal || balancerTotal === 0) {
        const defaultTotal = Math.round(totalCost * 1.25);
        setBalancerTotal(defaultTotal);
        setBalancerMargin(20.0);
      }

      return results;
    } catch (e) {
      console.error("Error calculating project:", e);
      return null;
    }
  };

  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const filteredProjects = safeProjects.filter((project) => {
    if (!normalizedProjectSearch) return true;
    return `${project?.name || ''} ${project?.description || ''}`
      .toLowerCase()
      .includes(normalizedProjectSearch);
  });
  const projectPageSize = 12;
  const projectPageCount = Math.max(1, Math.ceil(filteredProjects.length / projectPageSize));
  const visibleProjects = filteredProjects.slice((projectPage - 1) * projectPageSize, projectPage * projectPageSize);

  useEffect(() => {
    setProjectPage(1);
  }, [projectSearch]);

  const handleAddDoor = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!doorForm.code || !doorForm.template_id || !doorForm.width || !doorForm.height) return;
    
    const newDoorObj = {
      id: Date.now(),
      code: doorForm.code.trim(),
      template_id: parseInt(doorForm.template_id),
      width: parseFloat(doorForm.width),
      height: parseFloat(doorForm.height),
      width1: doorForm.width1 ? parseFloat(doorForm.width1) : null,
      height1: doorForm.height1 ? parseFloat(doorForm.height1) : null,
      width2: doorForm.width2 ? parseFloat(doorForm.width2) : null,
      height2: doorForm.height2 ? parseFloat(doorForm.height2) : null,
      qty: parseInt(doorForm.qty) || 1
    };

    try {
      const created = await sb.addProjectDoor(activeProject.id, newDoorObj);
      Object.assign(newDoorObj, created);
    } catch (e) {
      console.warn("API add door unavailable, fallback to local state:", e);
    }

    setProjectDoors(prev => [...(Array.isArray(prev) ? prev : []), newDoorObj]);
    setDoorForm({
      code: '',
      template_id: templates[0]?.id?.toString() || '',
      width: '',
      height: '',
      width1: '',
      height1: '',
      width2: '',
      height2: '',
      qty: '1'
    });
    setShowAddDoorModal(false);
    setCalcResults(null);
  };

  const handleDeleteDoor = async (doorId) => {
    if (isReadOnly) return;
    if (!await confirmAction("Xóa cửa này khỏi danh sách công trình?")) return;
    try {
      await sb.deleteProjectDoor(doorId);
    } catch (e) {
      console.warn("API delete door unavailable:", e);
    }
    setProjectDoors(prev => (Array.isArray(prev) ? prev.filter(d => d.id !== doorId) : []));
    setCalcResults(null);
  };

  const fetchDataQuality = async (projectId = activeProject?.id) => {
    if (!projectId) return;
    try {
      const data = await sb.getDataQuality(projectId);
      setDataQuality(data);
    } catch (e) {
      console.error('Error fetching data quality:', e);
      setDataQuality(null);
    }
  };

  const handleChooseOperaFile = async (file) => {
    setUploadFile(file || null);
    setImportPreview(null);
    if (!file || !activeProject) return;
    setImportPreviewLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/import-opera/preview`, {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setImportPreview(data);
        return;
      }
    } catch (error) {
      console.warn("API opera preview unavailable, trying client-side parser:", error);
    }

    try {
      const parsed = await parseOperaFile(file);
      if (parsed && (parsed.doors.length > 0 || parsed.materials.length > 0)) {
        setImportPreview({
          valid: true,
          doors_count: parsed.doors.length,
          materials_count: parsed.materials.length,
          message: `File hợp lệ! Phát hiện ${parsed.doors.length} mẫu cửa và ${parsed.materials.length} chi tiết vật tư từ file Opera.`
        });
      } else {
        setImportPreview({
          valid: false,
          errors: ['Không tìm thấy dữ liệu định mức cửa hoặc vật tư hợp lệ trong file này.'],
          message: 'Dữ liệu file không tương thích với định dạng Opera BOM.'
        });
      }
    } catch (err) {
      console.error("Client-side Opera parsing failed:", err);
      setImportPreview({
        valid: false,
        errors: [err instanceof Error ? err.message : 'Lỗi đọc file Opera.'],
        message: 'Lỗi khi đọc file Opera. Vui lòng kiểm tra định dạng file xls/xlsx/xml.'
      });
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const handleUploadOpera = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!uploadFile || !importPreview?.valid) {
      alert('Vui lòng chọn và kiểm tra một file Opera hợp lệ trước khi nhập.');
      return;
    }
    if (activeProject.has_opera_bom && !await confirmAction(
      'Nhập lại sẽ thay thế toàn bộ định mức Opera và danh sách cửa hiện có của dự án. Bạn có muốn tiếp tục?',
      { title: 'Thay thế dữ liệu Opera', confirmLabel: 'Thay thế dữ liệu' },
    )) return;
    
    setUploadStatus({ type: 'info', message: 'Đang xử lý file Opera...' });

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/import-opera`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadStatus({ 
          type: 'success', 
          message: `Thành công! Đã nhập định mức Opera với ${data.doors_imported} cửa và ${data.materials_imported} vật tư.` 
        });
        setUploadFile(null);
        setImportPreview(null);
        setShowReuploadForm(false);
        
        const updatedProj = { ...activeProject, has_opera_bom: true };
        setActiveProject(updatedProj);
        setProjects(prev => (Array.isArray(prev) ? prev.map(p => p.id === activeProject.id ? updatedProj : p) : []));
        
        fetchProjectDoors(activeProject.id);
        fetchOperaMaterials(activeProject.id);
        fetchCatalogMaterials();
        fetchDataQuality(activeProject.id);
        alert(`Lỗi khi lưu cân đối: ${err.detail || 'Lỗi không xác định'}`);
      }
    } catch (e) {
      console.error("Error saving balancer:", e);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  const handleExportExcel = async () => {
    if (!activeProject || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/export`);
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Không thể xuất báo giá.'));
      }
      await downloadResponse(response, `BAO_GIA_DU_AN_${activeProject.id}.xlsx`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể xuất báo giá.');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchQuoteVersions = async (projectId = activeProject?.id) => {
    if (!projectId) return;
    setQuoteVersionLoading(true);
    try {
      const data = await sb.getQuoteVersions(projectId);
      setQuoteVersions(data);
    } catch (e) {
      console.error('Error fetching quote versions:', e);
      setQuoteVersions([]);
    } finally {
      setQuoteVersionLoading(false);
    }
  };

  const handleCreateQuoteVersion = async () => {
    if (!activeProject || isReadOnly) return;
    if (!await confirmAction('Tạo một phiên bản bất biến từ dữ liệu và đơn giá hiện tại?', {
      title: 'Phát hành bản nháp báo giá',
      confirmLabel: 'Tạo phiên bản',
      danger: false,
    })) return;
    setQuoteVersionLoading(true);
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/quote-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: quoteNote.trim() || null }),
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể tạo phiên bản báo giá.'));
      alert('Đã tạo phiên bản báo giá mới thành công.');
      setQuoteNote('');
      await fetchQuoteVersions(activeProject.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể tạo phiên bản báo giá.');
    } finally {
      setQuoteVersionLoading(false);
    }
  };

  const handleQuoteStatus = async (version, status) => {
    if (isReadOnly) return;
    const labels = { approved: 'duyệt', sent: 'đánh dấu đã gửi', accepted: 'xác nhận chấp nhận', cancelled: 'hủy' };
    if (!await confirmAction(`Bạn muốn ${labels[status] || 'cập nhật'} phiên bản V${version.version_number}?`, {
      danger: status === 'cancelled',
      confirmLabel: status === 'cancelled' ? 'Hủy phiên bản' : 'Xác nhận',
    })) return;
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/quote-versions/${version.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể cập nhật trạng thái.'));
      await fetchQuoteVersions(activeProject.id);
      alert('Đã cập nhật trạng thái báo giá thành công.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.');
    }
  };

  const handleDownloadQuoteVersion = async (version) => {
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/quote-versions/${version.id}/download`);
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể tải phiên bản báo giá.'));
      await downloadResponse(response, `BAO_GIA_${activeProject.id}_V${version.version_number}.xlsx`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể tải phiên bản báo giá.');
    }
  };

  const handleDownloadQuotePdf = async (version) => {
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/quote-versions/${version.id}/download-pdf`);
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể tải PDF báo giá.'));
      await downloadResponse(response, `BAO_GIA_${activeProject.id}_V${version.version_number}.pdf`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể tải PDF báo giá.');
    }
  };

  const handleRestoreQuoteVersion = async (version) => {
    if (isReadOnly) return;
    if (!await confirmAction(`Tạo bản nháp mới từ dữ liệu đã lưu của V${version.version_number}?`, {
      title: 'Khôi phục phiên bản',
      confirmLabel: 'Tạo bản nháp mới',
      danger: false,
    })) return;
    try {
      const response = await fetch(`${apiBase}/projects/${activeProject.id}/quote-versions/${version.id}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể khôi phục phiên bản.'));
      await fetchQuoteVersions(activeProject.id);
      alert('Đã khôi phục thành một bản nháp mới.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể khôi phục phiên bản.');
    }
  };

  const handleCompareLatestQuotes = async () => {
    if (quoteVersions.length < 2) return;
    const [right, left] = quoteVersions;
    try {
      const response = await fetch(
        `${apiBase}/projects/${activeProject.id}/quote-versions/compare?left_id=${left.id}&right_id=${right.id}`,
      );
      if (!response.ok) throw new Error(await readApiError(response, 'Không thể so sánh phiên bản.'));
      setQuoteComparison(await response.json());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể so sánh phiên bản.');
    }
  };

  // Helper to format values as currency
  const formatCurrency = (val) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  // Helper to format numbers with dot for thousands and comma for decimal
  const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val) || val === '') return '0';
    return Number(val).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  };

  const renderIndirectSelection = (costType, label, customPlaceholder, unit = 'VND') => {
    const sel = indirectSelections[costType] || { indirect_cost_config_id: '', custom_value: '' };
    const configsForType = indirectConfigs.filter(c => c.cost_type === costType);
    
    return (
      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
        <label className="form-label" style={{ fontWeight: '600', fontSize: '13px', display: 'block', marginBottom: '8px', color: 'var(--primary)' }}>
          {label}
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <select
            value={sel.indirect_cost_config_id}
            onChange={(e) => {
              const val = e.target.value;
              setIndirectSelections(prev => ({
                ...prev,
                [costType]: {
                  ...prev[costType],
                  indirect_cost_config_id: val,
                  custom_value: val === 'custom' ? prev[costType].custom_value : ''
                }
              }));
            }}
            className="form-control"
            disabled={user?.role === 'viewer'}
          >
            <option value="">-- Sử dụng cấu hình mặc định --</option>
            {configsForType.map(c => (
              <option key={c.id} value={c.id}>
                {c.option_name} ({c.value_type === 'percent' ? `${c.value}%` : `${formatNumber(c.value)} đ` })
              </option>
            ))}
            <option value="custom">Nhập giá trị riêng...</option>
          </select>
          
          {sel.indirect_cost_config_id === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                step="any"
                placeholder={customPlaceholder}
                value={sel.custom_value}
                onChange={(e) => {
                  const val = e.target.value;
                  setIndirectSelections(prev => ({
                    ...prev,
                    [costType]: {
                      ...prev[costType],
                      custom_value: val
                    }
                  }));
                }}
                className="form-control"
                style={{ flex: 1 }}
                required
                disabled={user?.role === 'viewer'}
              />
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{unit}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* CASE 1: PROJECTS GRID VIEW */}
      {!activeProject ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Hồ sơ Dự án Báo giá</h1>
              <p style={{ color: 'var(--text-muted)' }}>Quản lý và lập dự toán chi tiết các công trình nhôm kính.</p>
            </div>
            
            {!isReadOnly && (
              <button className="btn btn-primary" onClick={() => setShowAddProjectModal(true)}>
                <Plus size={16} /> Tạo Dự án Mới
              </button>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '14px', marginBottom: '20px', maxWidth: '520px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="search"
                className="form-control"
                placeholder="Tìm theo tên hoặc mô tả dự án..."
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                style={{ paddingLeft: '36px' }}
                aria-label="Tìm kiếm dự án"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {projectsLoading && Array.from({ length: 6 }).map((_, index) => (
              <div key={`project-skeleton-${index}`} className="glass-panel skeleton-card" aria-hidden="true">
                <span className="skeleton skeleton-icon" />
                <span className="skeleton skeleton-title" />
                <span className="skeleton skeleton-line" />
                <span className="skeleton skeleton-line short" />
              </div>
            ))}
            {!projectsLoading && visibleProjects.map(proj => (
              <div 
                key={proj.id} 
                className="glass-panel" 
                style={{ padding: '24px', transition: 'transform 0.2s, box-shadow 0.2s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(37, 60, 120, 0.08)', padding: '12px', borderRadius: '12px' }}>
                    <Folder size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  {!isReadOnly && <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary icon-button" style={{ padding: '6px' }} onClick={(event) => openEditProject(proj, event)} aria-label={`Sửa dự án ${proj.name}`}>
                      <Edit2 size={15} />
                    </button>
                    <button className="btn btn-danger icon-button" style={{ padding: '6px' }} onClick={(e) => handleDeleteProject(proj.id, e)} aria-label={`Xóa dự án ${proj.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>}
                </div>
                
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--primary)' }}>{proj.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', minHeight: '36px', marginBottom: '16px', lineHeight: '1.5' }}>
                  {proj.description || 'Chưa có mô tả ngắn về dự án này.'}
                </p>
                
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span>Ngày khởi tạo: {new Date(proj.created_at).toLocaleDateString('vi-VN')}</span>
                  <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => handleSelectProject(proj)}>Mở dự án →</button>
                </div>
              </div>
            ))}
            
            {!projectsLoading && filteredProjects.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }} className="glass-panel">
                {projects.length === 0
                  ? (isReadOnly ? 'Chưa có dự án nào.' : 'Chưa có dự án nào được tạo. Nhấp nút "Tạo Dự án Mới" để bắt đầu.')
                  : 'Không tìm thấy dự án phù hợp.'}
              </div>
            )}
          </div>
          {!projectsLoading && projectPageCount > 1 && (
            <div className="pagination" aria-label="Phân trang dự án">
              <button className="btn btn-secondary" disabled={projectPage === 1} onClick={() => setProjectPage(page => page - 1)}>← Trước</button>
              <span>Trang {projectPage}/{projectPageCount}</span>
              <button className="btn btn-secondary" disabled={projectPage === projectPageCount} onClick={() => setProjectPage(page => page + 1)}>Sau →</button>
            </div>
          )}
        </div>
      ) : (
        /* CASE 2: PROJECT DETAIL VIEW WITH NAVIGATION BACK */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setActiveProject(null)}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quản lý dự án</span>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>{activeProject.name}</h1>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className={`btn ${detailTab === 'doors' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('doors')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Danh sách cửa ({projectDoors.length})
              </button>
              {activeProject.has_opera_bom && (
                <button 
                  className={`btn ${detailTab === 'opera-prices' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDetailTab('opera-prices')}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Áp giá vật tư
                </button>
              )}
              <button 
                className={`btn ${detailTab === 'cost-config' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('cost-config')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Định mức chi phí
              </button>
              <button 
                className={`btn ${detailTab === 'calc-preview' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (calcResults) setDetailTab('calc-preview');
                  else handleCalculate();
                }}
                disabled={projectDoors.length === 0}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Kết quả dự toán
              </button>
              <button 
                className={`btn ${detailTab === 'profit-balancer' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={async () => {
                  if (calcResults) {
                    setDetailTab('profit-balancer');
                  } else {
                    const data = await handleCalculate();
                    if (data) setDetailTab('profit-balancer');
                  }
                }}
                disabled={projectDoors.length === 0}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cân đối lợi nhuận
              </button>
              <button
                className={`btn ${detailTab === 'quote-versions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('quote-versions')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Phiên bản báo giá ({quoteVersions.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleCalculate}
                disabled={projectDoors.length === 0}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Play size={14} style={{ marginRight: '6px' }} /> Chạy tính toán
              </button>
              <button 
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #177a32 0%, #0f5f27 100%)', boxShadow: '0 4px 15px rgba(45, 179, 75, 0.25)', padding: '8px 16px', fontSize: '13px' }}
                onClick={handleExportExcel}
                disabled={projectDoors.length === 0 || isExporting}
              >
                <FileSpreadsheet size={14} style={{ marginRight: '6px' }} /> {isExporting ? 'Đang xuất...' : 'Xuất Báo Giá Excel'}
              </button>
            </div>
          </div>

          {detailTab === 'quote-versions' && (
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', color: 'var(--primary)', marginBottom: '6px' }}>Lịch sử phát hành báo giá</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Mỗi phiên bản lưu cố định kết quả tính toán và tệp Excel tại thời điểm phát hành.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {!isReadOnly && (
                    <input
                      className="form-control"
                      value={quoteNote}
                      onChange={event => setQuoteNote(event.target.value)}
                      placeholder="Ghi chú phiên bản (tùy chọn)"
                      maxLength={2000}
                      style={{ width: '240px' }}
                    />
                  )}
                  <button className="btn btn-secondary" onClick={handleCompareLatestQuotes} disabled={quoteVersions.length < 2}>
                    <GitCompare size={16} /> So sánh 2 bản mới nhất
                  </button>
                  {!isReadOnly && (
                    <button className="btn btn-primary" onClick={handleCreateQuoteVersion} disabled={quoteVersionLoading || projectDoors.length === 0}>
                      <Archive size={16} /> {quoteVersionLoading ? 'Đang xử lý...' : 'Tạo phiên bản mới'}
                    </button>
                  )}
                </div>
              </div>

              {quoteComparison && (
                <div style={{ padding: '16px', marginBottom: '18px', borderRadius: '12px', background: 'rgba(37, 60, 120, 0.06)', border: '1px solid rgba(37, 60, 120, 0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <strong>So sánh V{quoteComparison.left.version_number} → V{quoteComparison.right.version_number}</strong>
                    <button className="btn btn-secondary icon-button" onClick={() => setQuoteComparison(null)} aria-label="Đóng kết quả so sánh"><X size={15} /></button>
                  </div>
                  <div className="comparison-grid">
                    <div><span>Diện tích thay đổi</span><strong>{formatNumber(quoteComparison.delta.total_area)} m²</strong></div>
                    <div><span>Chi phí thay đổi</span><strong>{formatCurrency(quoteComparison.delta.total_cost)}</strong></div>
                    <div><span>Giá bán thay đổi</span><strong>{formatCurrency(quoteComparison.delta.total_price)}</strong></div>
                  </div>
                </div>
              )}

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phiên bản</th>
                      <th>Trạng thái</th>
                      <th>Người tạo</th>
                      <th>Thời điểm</th>
                      <th style={{ textAlign: 'right' }}>Diện tích</th>
                      <th style={{ textAlign: 'right' }}>Tổng chi phí</th>
                      <th style={{ textAlign: 'right' }}>Giá báo</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteVersions.map(version => {
                      const statusLabels = { draft: 'Nháp', approved: 'Đã duyệt', sent: 'Đã gửi', accepted: 'Đã chấp nhận', cancelled: 'Đã hủy' };
                      const nextStatus = { draft: 'approved', approved: 'sent', sent: 'accepted' }[version.status];
                      const nextLabel = { approved: 'Duyệt', sent: 'Đánh dấu đã gửi', accepted: 'Chấp nhận' }[nextStatus];
                      return (
                        <tr key={version.id}>
                          <td style={{ color: 'var(--primary)' }}>
                            <strong>V{version.version_number}</strong>
                            {version.note && <div style={{ marginTop: '4px', maxWidth: '190px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>{version.note}</div>}
                          </td>
                          <td><span className={`badge quote-status-${version.status}`}>{statusLabels[version.status] || version.status}</span></td>
                          <td>{version.created_by_name || 'Hệ thống'}</td>
                          <td>{new Date(version.created_at).toLocaleString('vi-VN')}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(version.total_area)} m²</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(Number(version.total_cost))}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(Number(version.total_price))}</td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {version.report_filename && (
                                <button className="btn btn-secondary icon-button" onClick={() => handleDownloadQuoteVersion(version)} aria-label={`Tải báo giá V${version.version_number}`} title="Tải Excel">
                                  <Download size={15} />
                                </button>
                              )}
                              {version.pdf_filename && (
                                <button className="btn btn-secondary icon-button" onClick={() => handleDownloadQuotePdf(version)} aria-label={`Tải PDF báo giá V${version.version_number}`} title="Tải PDF">
                                  <FileText size={15} />
                                </button>
                              )}
                              {!isReadOnly && (
                                <button className="btn btn-secondary icon-button" onClick={() => handleRestoreQuoteVersion(version)} aria-label={`Khôi phục báo giá V${version.version_number}`} title="Khôi phục thành bản nháp mới">
                                  <RotateCcw size={15} />
                                </button>
                              )}
                              {!isReadOnly && nextStatus && (
                                <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleQuoteStatus(version, nextStatus)}>{nextLabel}</button>
                              )}
                              {!isReadOnly && !['accepted', 'cancelled'].includes(version.status) && (
                                <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleQuoteStatus(version, 'cancelled')}>Hủy</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!quoteVersionLoading && quoteVersions.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có phiên bản báo giá nào.</td></tr>
                    )}
                    {quoteVersionLoading && (
                      <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải phiên bản báo giá…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT 1: DOORS LIST */}
          {detailTab === 'doors' && (
            <div>
              {projectDoors.length === 0 && !activeProject.has_opera_bom && !manuallyInitializing && !isReadOnly ? (
                /* Initialization Dashboard */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 0' }}>
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary)' }}>Khởi tạo dữ liệu dự án</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Chọn phương thức để bắt đầu thiết lập danh sách cửa và định mức cho dự án này
                    </p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                    {/* Option 1: Opera BOM Import */}
                    <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(37, 60, 120, 0.2)', borderRadius: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: 'rgba(37, 60, 120, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileSpreadsheet size={28} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Nhập định mức từ Opera BOM</h3>
                            <span style={{ fontSize: '11px', color: 'var(--secondary)', fontWeight: '600' }}>Khuyên dùng cho dự án có file Opera</span>
                          </div>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', marginBottom: '20px' }}>
                          Tải lên file định mức <code>ĐỊNH MỨC TYPOLOGIES.xls</code> xuất từ phần mềm Opera. Hệ thống sẽ tự động trích xuất danh sách cửa (typologies), kích thước, số bộ, và toàn bộ chi tiết nhôm, phụ kiện, kính mà không lấy đơn giá.
                        </p>
                      </div>
                      
                      {/* Integrated Dropzone */}
                      <form className="glass-panel" style={{ padding: '24px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '12px', background: 'rgba(0,0,0,0.02)', position: 'relative' }} onSubmit={handleUploadOpera}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <Upload size={24} style={{ color: 'var(--primary)' }} />
                          <div>
                            <p style={{ fontWeight: '600', fontSize: '12px', margin: 0 }}>Kéo thả hoặc nhấp chọn tệp Opera vào đây</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px', margin: 0 }}>Chấp nhận tệp định dạng .xls, .xlsx và .xml</p>
                          </div>
                          
                          <input 
                            type="file" 
                            accept=".xls,.xlsx,.xml"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleChooseOperaFile(e.target.files[0]);
                              }
                            }}
                            style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }}
                            title=""
                          />
                          
                          {uploadFile && (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', zIndex: 3, position: 'relative' }}>
                              <FileSpreadsheet size={13} style={{ color: 'var(--secondary)' }} />
                              <span style={{ fontWeight: '500' }}>{uploadFile.name}</span>
                            </div>
                          )}
                          
                          {uploadFile && (
                            <button type="submit" className="btn btn-primary" disabled={importPreviewLoading || !importPreview?.valid} style={{ padding: '8px 16px', fontSize: '12px', marginTop: '6px', width: '100%', zIndex: 3, position: 'relative', fontWeight: '600' }}>
                              {importPreviewLoading ? 'Đang kiểm tra file...' : 'Tải lên & Khởi tạo dự án'}
                            </button>
                          )}
                          {importPreview && (
                            <div className={`import-preview ${importPreview.valid ? 'import-preview-valid' : 'import-preview-invalid'}`}>
                              <strong>{importPreview.valid ? 'File hợp lệ để nhập' : 'File chưa hợp lệ'}</strong>
                              {importPreview.message && <span>{importPreview.message}</span>}
                              {importPreview.total_rows !== undefined && <span>{importPreview.valid_rows || 0}/{importPreview.total_rows} dòng hợp lệ · {importPreview.unique_typologies || 0} typology · {importPreview.unmapped_count || 0} mã chưa ánh xạ</span>}
                              {importPreview.unrecognized_units?.length > 0 && <span>Đơn vị cần kiểm tra: {importPreview.unrecognized_units.join(', ')}</span>}
                              {importPreview.missing_columns?.length > 0 && <span>Thiếu cột: {importPreview.missing_columns.join(', ')}</span>}
                              {importPreview.errors?.slice(0, 3).map(error => <span key={error.row}>Dòng {error.row}: {error.issues.join(', ')}</span>)}
                            </div>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Option 2: Manual Design */}
                    <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={28} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Thiết kế thủ công bằng mẫu</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Phù hợp dự án vừa & nhỏ, tự thiết kế</span>
                          </div>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6', marginBottom: '28px' }}>
                          Tự tạo các vị trí cửa, chọn mẫu thiết kế (cửa đi, cửa sổ, vách kính...) từ thư viện mẫu của hệ thống, sau đó nhập kích thước ô tường để hệ thống tự động tính toán định mức vật tư theo công thức hình học.
                        </p>
                      </div>
                      
                      <button 
                        className="btn btn-secondary" 
                        style={{ width: '100%', padding: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
                        onClick={() => setManuallyInitializing(true)}
                      >
                        Bắt đầu thiết kế thủ công <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                    </div>
                  </div>

                  {uploadStatus.message && (
                    <div 
                      style={{ 
                        marginTop: '16px', 
                        padding: '12px 16px', 
                        borderRadius: '8px', 
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: uploadStatus.type === 'success' ? 'rgba(45, 179, 75, 0.1)' : uploadStatus.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 60, 120, 0.1)',
                        border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(45, 179, 75, 0.2)' : uploadStatus.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(37, 60, 120, 0.2)'}`,
                        color: uploadStatus.type === 'success' ? 'var(--secondary)' : uploadStatus.type === 'danger' ? '#b91c1c' : 'var(--primary)',
                        maxWidth: '900px',
                        margin: '16px auto 0 auto',
                        width: '100%'
                      }}
                    >
                      {uploadStatus.type === 'success' ? <CheckCircle size={16} /> : uploadStatus.type === 'danger' ? <AlertTriangle size={16} /> : <Info size={16} />}
                      <span>{uploadStatus.message}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Doors Table View */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Danh sách thống kê kích thước các vị trí cửa</h3>
                      {projectDoors.length === 0 && !activeProject.has_opera_bom && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--border-color)' }} 
                          onClick={() => setManuallyInitializing(false)}
                        >
                          Quay lại tùy chọn khởi tạo
                        </button>
                      )}
                    </div>
                    {!activeProject.has_opera_bom && !isReadOnly && (
                      <button className="btn btn-primary" onClick={() => setShowAddDoorModal(true)}>
                        <Plus size={14} style={{ marginRight: '6px' }} /> Thêm Vị Trí Cửa
                      </button>
                    )}
                  </div>

                  <div className="glass-panel" style={{ padding: '0' }}>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: '120px' }}>Ký hiệu</th>
                            <th>Bản vẽ mẫu cửa</th>
                            <th>Kích thước ô tường (W x H) (mm)</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Số lượng (bộ)</th>
                            <th>Kích thước phụ mẫu</th>
                            {!isReadOnly && <th style={{ width: '80px', textAlign: 'center' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {projectDoors.map(door => (
                            <tr key={door.id} onClick={() => handleOpenDoorPanel(door)} style={{ cursor: 'pointer' }}>
                              <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{door.code}</td>
                              <td style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px' }}>
                                <div style={{ width: '45px', height: '45px', flexShrink: 0 }}>
                                  <DoorIllustration doorType={door.template_name} code={door.template_code} width={door.width} height={door.height} layoutJson={door.layout_json} width1={door.width1} height1={door.height1} width2={door.width2} height2={door.height2} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{door.template_code}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{door.template_name}</div>
                                </div>
                              </td>
                              <td style={{ fontWeight: '500' }}>{formatNumber(door.width)} x {formatNumber(door.height)}</td>
                              <td style={{ fontWeight: '700', textAlign: 'center' }}>{door.qty}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {door.width1 || door.height1 ? `Cánh lùa: ${formatNumber(door.width1)} x ${formatNumber(door.height1)} mm | ` : ''}
                                {door.width2 || door.height2 ? `Ô fix: ${formatNumber(door.width2)} x ${formatNumber(door.height2)} mm` : '-'}
                              </td>
                              {!isReadOnly && <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button className="btn btn-danger icon-button" style={{ padding: '6px' }} onClick={() => handleDeleteDoor(door.id)} aria-label={`Xóa cửa ${door.code}`}>
                                  <Trash2 size={13} />
                                </button>
                              </td>}
                            </tr>
                          ))}
                          {projectDoors.length === 0 && (
                            <tr>
                              <td colSpan={isReadOnly ? 5 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                {activeProject.has_opera_bom
                                  ? 'Chưa có vị trí cửa nào từ file Opera.'
                                  : isReadOnly
                                    ? 'Dự án chưa có vị trí cửa nào.'
                                    : 'Chưa có vị trí cửa nào. Nhấp nút "Thêm Vị Trí Cửa" ở góc phải để nhập số liệu.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 1.5: COST CONFIGURATION */}
          {detailTab === 'cost-config' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Cấu hình tỷ lệ định mức các loại chi phí dự án</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Thiết lập hệ đơn giá và các thông số định mức chi phí gián tiếp thi công, chế tạo cho công trình.
                </p>
              </div>

              <form onSubmit={handleSaveCostConfig} className="glass-panel" style={{ padding: '28px' }}>
                {/* Price Book Selection */}
                <div style={{ background: 'rgba(37, 60, 120, 0.03)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
                  <label className="form-label" style={{ marginBottom: '10px' }}>Hệ đơn giá áp dụng cho dự án này</label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
                    Chọn hệ đơn giá áp dụng cho toàn bộ vật tư trong công trình này làm giá vốn sản xuất mặc định.
                  </p>
                  <select 
                    value={costForm.price_book_id}
                    onChange={(e) => setCostForm({ ...costForm, price_book_id: e.target.value })}
                    className="form-control"
                    style={{ maxWidth: '400px' }}
                    disabled={user?.role === 'viewer'}
                  >
                    <option value="">Sử dụng Đơn giá Mặc định (Hệ thống)</option>
                    {priceBooks.map(pb => (
                      <option key={pb.id} value={pb.id}>{pb.name}</option>
                    ))}
                  </select>
                </div>

                {/* Project Overhead Percentages */}
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  Tỷ lệ phần trăm phân bổ chi phí chung (%)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                  {/* Company Management Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <label className="form-label" style={{ color: 'var(--primary)' }}>Chi phí Công ty (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      value={costForm.pct_company}
                      onChange={(e) => setCostForm({ ...costForm, pct_company: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                      className="form-control"
                      disabled={user?.role === 'viewer'}
                    />
                  </div>

                  {/* Warranty Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <label className="form-label" style={{ color: 'var(--primary)' }}>Dự phòng bảo hành (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      value={costForm.pct_warranty}
                      onChange={(e) => setCostForm({ ...costForm, pct_warranty: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                      className="form-control"
                      disabled={user?.role === 'viewer'}
                    />
                  </div>

                  {/* Other Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <label className="form-label" style={{ color: 'var(--primary)' }}>Chi phí khác (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="100"
                      value={costForm.pct_other}
                      onChange={(e) => setCostForm({ ...costForm, pct_other: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                      className="form-control"
                      disabled={user?.role === 'viewer'}
                    />
                  </div>
                </div>

                {/* Indirect Cost Selections */}
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  Định mức chi phí gián tiếp sản xuất & thi công
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  {renderIndirectSelection('transport', '1. Chi phí Vận chuyển (Dự án)', 'Tổng chi phí vận chuyển toàn dự án (VND)', 'VND')}
                  {renderIndirectSelection('installation', '2. Chi phí Lắp đặt (Cửa)', 'Tỷ lệ lắp đặt (% trên vật tư) hoặc đơn giá m2', '% / VND')}
                  {renderIndirectSelection('fabrication', '3. Chi phí Nhân công gia công (Xưởng)', 'Chi phí gia công (VND/m2)', 'VND/m2')}
                  {renderIndirectSelection('contingency', '4. Tỷ lệ Dự phòng rủi ro (%)', 'Tỷ lệ dự phòng rủi ro hao hụt (%)', '%')}
                </div>

                {/* Explanation Alert Box */}
                <div style={{ 
                  background: 'rgba(37, 60, 120, 0.05)', 
                  border: '1px solid rgba(37, 60, 120, 0.15)', 
                  padding: '16px', 
                  borderRadius: '10px', 
                  fontSize: '12px', 
                  color: 'var(--primary)', 
                  lineHeight: '1.5',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Nguyên tắc định mức chi phí:</strong> Đơn giá vốn của từng bộ cửa sẽ được tính bằng tổng: Giá vốn vật liệu (Nhôm + Kính + Phụ kiện) + Nhân công gia công + Lắp đặt + Vận chuyển phân bổ + Dự phòng rủi ro. Các tỷ lệ phần trăm phân bổ chi phí chung (Công ty, Bảo hành, Khác) sẽ được áp dụng trong bảng Cân đối lợi nhuận và xuất ra sheet <code>CPHoanThien</code>.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={user?.role === 'viewer'}>
                    Lưu định mức chi phí
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB CONTENT 2: PRICING PANEL (OPERA BOM) */}
          {detailTab === 'opera-prices' && activeProject.has_opera_bom && (
            <div>
              {dataQuality && (
                <div className={`quality-banner ${dataQuality.healthy ? 'quality-healthy' : 'quality-warning'}`}>
                  <div>
                    <strong>{dataQuality.healthy ? 'Dữ liệu dự án đạt kiểm tra' : `Phát hiện ${dataQuality.issue_count} vấn đề dữ liệu`}</strong>
                    {!dataQuality.healthy && (
                      <span>
                        {dataQuality?.unmapped_materials?.length || 0} mã chưa ánh xạ · {dataQuality?.missing_prices?.length || 0} mã thiếu giá · {dataQuality?.invalid_doors?.length || 0} cửa sai kích thước/số lượng · {dataQuality?.unrecognized_units?.length || 0} đơn vị cần kiểm tra
                      </span>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={() => fetchDataQuality(activeProject.id)}><RefreshCw size={14} /> Kiểm tra lại</button>
                </div>
              )}
              {/* Opera BOM already imported: show full advanced spreadsheet Pricing Panel */}
              <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Bảng áp giá vật tư chi tiết dự án</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                        Tổng hợp định mức các loại vật tư. Áp giá bán/vốn từ danh mục hoặc điền trực tiếp.
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input 
                        type="text"
                        placeholder="Tìm mã/tên vật tư..."
                        value={operaSearchQuery}
                        onChange={(e) => setOperaSearchQuery(e.target.value)}
                        className="form-control"
                        style={{ width: '240px', fontSize: '12px', padding: '6px 12px' }}
                      />
                      
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setShowReuploadForm(!showReuploadForm)}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <Upload size={13} style={{ marginRight: '4px' }} /> Nhập lại định mức
                      </button>
                    </div>
                  </div>

                  {/* Collapsible re-upload form */}
                  {showReuploadForm && (
                    <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary)' }}>Tải lên file định mức Opera mới (Sẽ xóa định mức cũ)</h4>
                      <form onSubmit={handleUploadOpera} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input 
                          type="file" 
                          accept=".xls,.xlsx,.xml" 
                          onChange={(e) => { if (e.target.files && e.target.files[0]) handleChooseOperaFile(e.target.files[0]); }}
                          className="form-control"
                          style={{ maxWidth: '300px', fontSize: '12px' }}
                          required
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }} disabled={!uploadFile || importPreviewLoading || !importPreview?.valid}>
                          {importPreviewLoading ? 'Đang kiểm tra...' : 'Upload & Xử lý'}
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowReuploadForm(false)}>
                          Hủy
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Pricing Table */}
                  <div className="glass-panel" style={{ padding: '0', marginBottom: '24px' }}>
                    <div className="table-container" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '150px' }}>Mã vật tư</th>
                            <th>Tên vật tư Opera / Mô tả</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Đơn vị</th>
                            <th style={{ width: '120px', textAlign: 'right' }}>Tổng định mức</th>
                            <th>Trạng thái liên kết danh mục</th>
                            <th style={{ width: '180px', textAlign: 'right' }}>Đơn giá áp dụng (đ)</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filteredSummary = (operaMaterials.summary || []).filter(item => {
                              const q = operaSearchQuery.toLowerCase();
                              return item.code.toLowerCase().includes(q) || 
                                     item.name.toLowerCase().includes(q) || 
                                     (item.description && item.description.toLowerCase().includes(q)) ||
                                     (item.catalog_name && item.catalog_name.toLowerCase().includes(q));
                            });
                            
                            return filteredSummary.map((item, idx) => {
                              const state = editingPrices[item.code] || { price: 0, mapped_id: null, catalog_name: null, catalog_price: null };
                              const isMapped = state.mapped_id !== null;
                              
                              return (
                                <tr key={idx} style={{ transition: 'background-color 0.2s' }}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{item.code}</td>
                                  <td>
                                    <div style={{ fontWeight: '600' }}>{item.name}</div>
                                    {item.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.description}</div>}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>{item.quantity_unit}</td>
                                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatNumber(item.total_quantity)}</td>
                                  <td>
                                    {isMapped ? (
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(45, 179, 75, 0.1)', border: '1px solid rgba(45, 179, 75, 0.2)', padding: '4px 8px', borderRadius: '6px', color: 'var(--secondary)', fontSize: '11px' }}>
                                        <CheckCircle size={12} />
                                        <span>Đã khớp: {state.catalog_name || item.catalog_name} ({formatNumber(state.catalog_price || item.catalog_price)} đ)</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '4px 8px', borderRadius: '6px', color: '#ef4444', fontSize: '11px' }}>
                                        <AlertTriangle size={12} />
                                        <span>Tự nhập giá / Chưa liên kết</span>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <input 
                                        type="number"
                                        value={state.price}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditingPrices(prev => ({
                                            ...prev,
                                            [item.code]: {
                                              ...prev[item.code],
                                              price: val === '' ? '' : parseFloat(val) || 0
                                            }
                                          }));
                                        }}
                                        className="form-control"
                                        style={{ width: '130px', padding: '4px 8px', fontSize: '12px', textAlign: 'right', fontWeight: '700' }}
                                        disabled={user?.role === 'viewer'}
                                      />
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>đ</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button 
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                      onClick={() => {
                                        setMappingMaterial(item);
                                        setSearchQuery(item.code.split('.')[1] || item.code);
                                      }}
                                      disabled={user?.role === 'viewer'}
                                    >
                                      {isMapped ? 'Thay đổi' : 'Liên kết'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                          {(operaMaterials.summary || []).length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                Không tìm thấy vật tư nào trong định mức.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Save pricing updates panel */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Mẹo: Nhấp nút "Liên kết" để tìm vật tư trong Danh mục hệ thống giúp lấy giá gốc tự động.
                    </span>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveOperaPrices}
                      style={{ padding: '10px 24px', fontSize: '13px' }}
                      disabled={user?.role === 'viewer'}
                    >
                      Lưu & Cập nhật Đơn giá
                    </button>
                  </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: CALCULATED RESULTS */}
          {detailTab === 'calc-preview' && calcResults && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Kết quả chạy dự toán phân tích chi tiết</h3>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  Tổng giá trị dự toán: <span style={{ color: 'var(--primary)', fontSize: '18px' }}>
                    {formatCurrency(calcResults.reduce((sum, item) => sum + item.total_price, 0))}
                  </span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '0', marginBottom: '24px' }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vị trí cửa</th>
                        <th>Mẫu cửa</th>
                        <th>Kích thước</th>
                        <th style={{ textAlign: 'right' }}>Đơn giá/m²</th>
                        <th style={{ textAlign: 'center' }}>Số bộ</th>
                        <th style={{ textAlign: 'right' }}>Tổng diện tích</th>
                        <th style={{ textAlign: 'right' }}>Thành tiền dự toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcResults.map((item, index) => (
                        <tr 
                          key={index} 
                          onClick={() => {
                            setSelectedCalcDoor(item);
                            setIsCostPanelOpen(true);
                          }} 
                          style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                          title="Click để xem chi tiết phân rã chi phí cửa"
                        >
                          <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{item.code}</td>
                          <td>{item.name} ({item.template_code})</td>
                          <td>{item.width} x {item.height}m</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.price_per_m2)}</td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>{item.total_area.toFixed(2)} m²</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>


            </div>
          )}

          {/* TAB CONTENT: PROFIT BALANCER (Giai đoạn 3) */}
          {detailTab === 'profit-balancer' && calcResults && (() => {
            const totalCost = calcResults.reduce((sum, item) => sum + item.total_cost, 0);
            const totalArea = calcResults.reduce((sum, item) => sum + item.total_area, 0);
            
            // Calculate distributed prices on the fly for the preview
            const previewDoors = calcResults.map(door => {
              let pricePerM2 = 0;
              if (distributionMethod === 'cost') {
                const markupFactor = balancerTotal / totalCost;
                const sellingPriceTotal = door.total_cost * markupFactor;
                const sellingPricePerM2 = (sellingPriceTotal / door.qty) / door.area;
                pricePerM2 = Math.round(sellingPricePerM2 / 1000) * 1000;
              } else {
                const avgPricePerM2 = balancerTotal / totalArea;
                pricePerM2 = Math.round(avgPricePerM2 / 1000) * 1000;
              }
              
              const sellingPriceTotalRounded = pricePerM2 * door.total_area;
              const profit = sellingPriceTotalRounded - door.total_cost;
              const margin = sellingPriceTotalRounded > 0 ? (profit / sellingPriceTotalRounded) * 100 : 0;
              
              return {
                ...door,
                pricePerM2,
                sellingPriceTotal: sellingPriceTotalRounded,
                profit,
                margin
              };
            });
            
            const actualTotalRevenue = previewDoors.reduce((sum, d) => sum + d.sellingPriceTotal, 0);
            const actualTotalProfit = actualTotalRevenue - totalCost;
            const actualProfitMargin = actualTotalRevenue > 0 ? (actualTotalProfit / actualTotalRevenue) * 100 : 0;

            return (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Công cụ cân đối doanh thu & lợi nhuận dự án</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nhập % biên lợi nhuận hoặc tổng doanh thu bán mong muốn. Hệ thống sẽ tự động phân bổ và làm tròn đơn giá cửa $/m2.
                  </p>
                </div>

                {/* Financial Summary KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(37, 60, 120, 0.02)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng giá vốn dự án (Gốc + Gián tiếp)</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-main)', marginTop: '6px' }}>{formatCurrency(totalCost)}</div>
                  </div>
                  
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(45, 179, 75, 0.02)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doanh thu thực tế (Sau làm tròn)</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--secondary)', marginTop: '6px' }}>{formatCurrency(actualTotalRevenue)}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(45, 179, 75, 0.02)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lợi nhuận gộp thực tế</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--secondary)', marginTop: '6px' }}>{formatCurrency(actualTotalProfit)}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(37, 60, 120, 0.02)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Biên lợi nhuận gộp thực tế (%)</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary)', marginTop: '6px' }}>{actualProfitMargin.toFixed(2)}%</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
                  {/* Left side: Controls */}
                  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      Tham số cân đối giá bán
                    </h4>

                    {/* Distribution Method */}
                    <div>
                      <label className="form-label">Phương thức phân bổ giá bán</label>
                      <select
                        value={distributionMethod}
                        onChange={(e) => setDistributionMethod(e.target.value)}
                        className="form-control"
                        disabled={user?.role === 'viewer'}
                      >
                        <option value="cost">Phân bổ tỷ lệ theo Giá vốn (Khuyên dùng)</option>
                        <option value="area">Phân bổ đồng đều theo Diện tích m2</option>
                      </select>
                    </div>

                    {/* Profit Margin slider */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Biên lợi nhuận mục tiêu (%)</label>
                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{balancerMargin}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="0.5"
                          value={balancerMargin}
                          onChange={(e) => {
                            const margin = parseFloat(e.target.value) || 0;
                            setBalancerMargin(margin);
                            setBalancerTotal(totalCost * (1 + margin / 100));
                          }}
                          style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                          disabled={user?.role === 'viewer'}
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="200"
                          value={balancerMargin}
                          onChange={(e) => {
                            const margin = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                            setBalancerMargin(margin);
                            if (margin !== '') {
                              setBalancerTotal(totalCost * (1 + margin / 100));
                            }
                          }}
                          className="form-control"
                          style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                          disabled={user?.role === 'viewer'}
                        />
                      </div>
                    </div>

                    {/* Target Total price */}
                    <div>
                      <label className="form-label">Tổng doanh thu bán mong muốn (VND)</label>
                      <input
                        type="number"
                        step="1000"
                        placeholder="Ví dụ: 500000000"
                        value={balancerTotal}
                        onChange={(e) => {
                          const total = parseFloat(e.target.value) || 0;
                          setBalancerTotal(total);
                          if (totalCost > 0) {
                            setBalancerMargin(parseFloat(((total / totalCost - 1) * 100).toFixed(2)));
                          }
                        }}
                        className="form-control"
                        disabled={user?.role === 'viewer'}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                        Tương đương giá bán trung bình: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(balancerTotal / (totalArea || 1))}/m²</strong>
                      </span>
                    </div>

                    {/* Warning about viewer role */}
                    {user?.role === 'viewer' && (
                      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: 'var(--danger)', display: 'flex', gap: '6px' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        <span>Tài khoản Viewer chỉ xem trước mô phỏng phân bổ và không thể lưu.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveBalancer}
                      disabled={user?.role === 'viewer'}
                      style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
                    >
                      Lưu kết quả cân đối
                    </button>
                  </div>

                  {/* Right side: Dynamic Preview Table */}
                  <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)' }}>Xem trước phân bổ đơn giá bán $/m2 chi tiết</h4>
                      <span style={{ fontSize: '11px', background: 'rgba(45,179,75,0.1)', color: 'var(--secondary)', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        Làm tròn: hàng nghìn (VND)
                      </span>
                    </div>

                    <div className="table-container" style={{ border: 'none', boxShadow: 'none', borderRadius: '0' }}>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Vị trí</th>
                            <th>Mẫu cửa</th>
                            <th>Số bộ</th>
                            <th>Tổng DT (m²)</th>
                            <th style={{ textAlign: 'right' }}>Giá vốn/m²</th>
                            <th style={{ textAlign: 'right', background: 'rgba(37,60,120,0.02)' }}>Đơn giá bán/m²</th>
                            <th style={{ textAlign: 'right' }}>Thành tiền bán</th>
                            <th style={{ textAlign: 'right' }}>Biên LN (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewDoors.map((d, idx) => (
                            <tr key={idx} style={{ transition: 'background-color 0.2s' }}>
                              <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{d.code}</td>
                              <td>{d.name}</td>
                              <td style={{ textAlign: 'center' }}>{d.qty}</td>
                              <td style={{ textAlign: 'right' }}>{d.total_area.toFixed(2)} m²</td>
                              <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                {formatCurrency(d.total_cost / d.total_area)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)', background: 'rgba(37,60,120,0.02)' }}>
                                {formatCurrency(d.pricePerM2)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                {formatCurrency(d.sellingPriceTotal)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '600', color: d.margin >= 10 ? 'var(--secondary)' : 'var(--warning)' }}>
                                {d.margin.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
            </div>
          )}

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Tạo hồ sơ dự án mới</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddProjectModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                <div>
                  <label className="form-label">Tên dự án *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Dự án Chung cư Golden City" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Mô tả dự án</label>
                  <textarea 
                    placeholder="Nhập thông tin mô tả ngắn về dự án, hệ nhôm sử dụng..." 
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="form-control"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label className="form-label">Hệ đơn giá áp dụng *</label>
                  <select 
                    value={newProjectPriceBookId}
                    onChange={(e) => setNewProjectPriceBookId(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Sử dụng Đơn giá Mặc định (Hệ thống)</option>
                    {priceBooks.map(pb => (
                      <option key={pb.id} value={pb.id}>{pb.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddProjectModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Khởi tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && editingProject && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }} role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
            <div className="modal-header">
              <h3 id="edit-project-title" style={{ fontSize: '18px', fontWeight: '700' }}>Chỉnh sửa dự án</h3>
              <button className="btn btn-secondary icon-button" style={{ padding: '6px' }} onClick={() => setShowEditProjectModal(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateProject}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
                <div>
                  <label htmlFor="edit-project-name" className="form-label">Tên dự án *</label>
                  <input id="edit-project-name" type="text" value={editingProject.name || ''} onChange={(event) => setEditingProject({ ...editingProject, name: event.target.value })} className="form-control" required />
                </div>
                <div>
                  <label htmlFor="edit-project-description" className="form-label">Mô tả dự án</label>
                  <textarea id="edit-project-description" value={editingProject.description || ''} onChange={(event) => setEditingProject({ ...editingProject, description: event.target.value })} className="form-control" style={{ minHeight: '100px', resize: 'vertical' }} />
                </div>
                <div>
                  <label htmlFor="edit-project-price-book" className="form-label">Hệ đơn giá áp dụng</label>
                  <select id="edit-project-price-book" value={editingProject.price_book_id || ''} onChange={(event) => setEditingProject({ ...editingProject, price_book_id: event.target.value || null })} className="form-control">
                    <option value="">Sử dụng Đơn giá Mặc định</option>
                    {priceBooks.map((priceBook) => <option key={priceBook.id} value={priceBook.id}>{priceBook.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProjectModal(false)}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Door to Project Modal */}
      {showAddDoorModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Thêm vị trí cửa lắp ráp công trình</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddDoorModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddDoor}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px 0', fontSize: '13px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Ký hiệu vị trí (Mã cửa) *</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: D-01, C-02, WC-01" 
                      value={doorForm.code}
                      onChange={(e) => setDoorForm({ ...doorForm, code: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Loại cửa định mức *</label>
                    <select 
                      value={doorForm.template_id}
                      onChange={(e) => setDoorForm({ ...doorForm, template_id: e.target.value })}
                      className="form-control"
                      required
                    >
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>{tpl.code} - {tpl.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Chiều rộng W (mm) *</label>
                    <input 
                      type="number" 
                      step="1"
                      placeholder="Ví dụ: 1200" 
                      value={doorForm.width}
                      onChange={(e) => setDoorForm({ ...doorForm, width: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Chiều cao H (mm) *</label>
                    <input 
                      type="number" 
                      step="1"
                      placeholder="Ví dụ: 2200" 
                      value={doorForm.height}
                      onChange={(e) => setDoorForm({ ...doorForm, height: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Số lượng bộ *</label>
                    <input 
                      type="number" 
                      placeholder="1" 
                      value={doorForm.qty}
                      onChange={(e) => setDoorForm({ ...doorForm, qty: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Kích thước phụ (Dành cho cửa lùa chia đố ô fix)
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều rộng cánh lùa (W1) (mm)</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="Trống"
                        value={doorForm.width1}
                        onChange={(e) => setDoorForm({ ...doorForm, width1: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều cao cánh lùa (H1) (mm)</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="Trống"
                        value={doorForm.height1}
                        onChange={(e) => setDoorForm({ ...doorForm, height1: e.target.value })}
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều rộng ô fix (W2) (mm)</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="Trống"
                        value={doorForm.width2}
                        onChange={(e) => setDoorForm({ ...doorForm, width2: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều cao ô fix (H2) (mm)</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="Trống"
                        value={doorForm.height2}
                        onChange={(e) => setDoorForm({ ...doorForm, height2: e.target.value })}
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddDoorModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Thêm vào dự án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide Panel for Door Details & Dynamic Estimation */}
      <SlidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={activeDoor ? `Chi tiết vị trí cửa: ${editForm.code}` : ''}
        subtitle={activeDoor ? `Dự án: ${activeProject?.name} | Mẫu: ${activeDoor.template_code}` : ''}
      >
        {activeDoor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button 
                type="button"
                className={`btn ${panelTab === 'edit' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPanelTab('edit')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <Settings2 size={14} style={{ marginRight: '6px' }} /> Chỉnh sửa thông số
              </button>
              <button 
                type="button"
                className={`btn ${panelTab === 'bom' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPanelTab('bom')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <ClipboardList size={14} style={{ marginRight: '6px' }} /> Định mức vật tư động
              </button>
            </div>

            {/* TAB CONTENT: EDIT FORM */}
            {panelTab === 'edit' && (
              <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
                {/* Left side: Illustration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '360px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                    <DoorIllustration 
                      doorType={templates.find(t => t.id.toString() === editForm.template_id)?.name || activeDoor.template_name} 
                      code={templates.find(t => t.id.toString() === editForm.template_id)?.code || activeDoor.template_code} 
                      width={editForm.width || '0'} 
                      height={editForm.height || '0'} 
                      layoutJson={editForm.layout_json || activeDoor.layout_json}
                      width1={editForm.width1 !== undefined ? editForm.width1 : activeDoor.width1}
                      height1={editForm.height1 !== undefined ? editForm.height1 : activeDoor.height1}
                      width2={editForm.width2 !== undefined ? editForm.width2 : activeDoor.width2}
                      height2={editForm.height2 !== undefined ? editForm.height2 : activeDoor.height2}
                    />
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    <p style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>Hướng dẫn:</p>
                    Kích thước nhập ở đơn vị <strong>mm</strong>. Thay đổi các kích thước phụ bên dưới nếu cửa chia đố cánh lùa hoặc ô fix phụ.
                  </div>
                </div>

                {/* Right side: Form fields */}
                <form onSubmit={handleEditDoorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Ký hiệu vị trí (Mã cửa) *</label>
                      <input 
                        type="text" 
                        placeholder="Ví dụ: D-01" 
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        className="form-control"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Loại cửa định mức *</label>
                      {activeProject.has_opera_bom ? (
                        <input 
                          type="text" 
                          value={activeDoor?.template_code || 'Opera Typology'} 
                          className="form-control" 
                          disabled 
                        />
                      ) : (
                        <select 
                          value={editForm.template_id}
                          onChange={(e) => {
                            const chosenTpl = templates.find(t => t.id.toString() === e.target.value);
                            setEditForm({ 
                              ...editForm, 
                              template_id: e.target.value,
                              layout_json: chosenTpl?.layout_json || ''
                            });
                            fetchTemplateFormulas(e.target.value);
                          }}
                          className="form-control"
                          required
                        >
                          {templates.map(tpl => (
                            <option key={tpl.id} value={tpl.id}>{tpl.code} - {tpl.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">Chiều rộng W (mm) *</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="1200" 
                        value={editForm.width}
                        onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
                        className="form-control"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Chiều cao H (mm) *</label>
                      <input 
                        type="number" 
                        step="1"
                        placeholder="2200" 
                        value={editForm.height}
                        onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                        className="form-control"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Số lượng bộ *</label>
                      <input 
                        type="number" 
                        placeholder="1" 
                        value={editForm.qty}
                        onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
                        className="form-control"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Kích thước phụ (mm) - Dành cho cửa lùa hoặc ô fix
                    </span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều rộng cánh lùa (W1)</label>
                        <input 
                          type="number" 
                          step="1"
                          placeholder="Trống"
                          value={editForm.width1}
                          onChange={(e) => setEditForm({ ...editForm, width1: e.target.value })}
                          className="form-control"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều cao cánh lùa (H1)</label>
                        <input 
                          type="number" 
                          step="1"
                          placeholder="Trống"
                          value={editForm.height1}
                          onChange={(e) => setEditForm({ ...editForm, height1: e.target.value })}
                          className="form-control"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều rộng ô fix (W2)</label>
                        <input 
                          type="number" 
                          step="1"
                          placeholder="Trống"
                          value={editForm.width2}
                          onChange={(e) => setEditForm({ ...editForm, width2: e.target.value })}
                          className="form-control"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Chiều cao ô fix (H2)</label>
                        <input 
                          type="number" 
                          step="1"
                          placeholder="Trống"
                          value={editForm.height2}
                          onChange={(e) => setEditForm({ ...editForm, height2: e.target.value })}
                          className="form-control"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Description & Overrides (Giai đoạn 3) */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Ghi chú & Định mức chi phí riêng (Mã cửa này)
                    </span>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Mô tả chi tiết cửa (Hiển thị trên Báo giá Excel)</label>
                      <textarea
                        placeholder="Mô tả đặc thù cho vị trí cửa này..."
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="form-control"
                        style={{ minHeight: '80px', fontSize: '12px', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Đè giá Vận chuyển (đ/Bộ)</label>
                        <input 
                          type="number" 
                          placeholder="Mặc định"
                          value={editForm.override_transport_cost}
                          onChange={(e) => setEditForm({ ...editForm, override_transport_cost: e.target.value })}
                          className="form-control"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Đè giá Lắp đặt (đ/Bộ)</label>
                        <input 
                          type="number" 
                          placeholder="Mặc định"
                          value={editForm.override_installation_cost}
                          onChange={(e) => setEditForm({ ...editForm, override_installation_cost: e.target.value })}
                          className="form-control"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Đè giá Nhân công (đ/Bộ)</label>
                        <input 
                          type="number" 
                          placeholder="Mặc định"
                          value={editForm.override_labor_cost}
                          onChange={(e) => setEditForm({ ...editForm, override_labor_cost: e.target.value })}
                          className="form-control"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsPanelOpen(false)}>
                      Hủy bỏ
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB CONTENT: BOM DYNAMIC CALCULATION */}
            {panelTab === 'bom' && (() => {
              if (activeProject.has_opera_bom) {
                // Filter materials for this door
                const doorMats = (operaMaterials.materials || []).filter(m => m.typology_name === activeDoor.code);
                const qtySets = parseInt(editForm.qty) || 1;
                
                // Group them by category
                const alMats = doorMats.filter(m => {
                  const cat = m.catalog_category;
                  if (cat === 'aluminum') return true;
                  if (cat) return false;
                  const code_lower = m.code.toLowerCase();
                  const name_lower = m.name.toLowerCase();
                  const unit_lower = m.quantity_unit.toLowerCase();
                  return code_lower.includes('al') || name_lower.includes('nhôm') || m.unit_weight > 0 || ['m', 'meter', 'kg'].includes(unit_lower);
                });
                
                const otherMats = doorMats.filter(m => !alMats.includes(m));
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Aluminum Profiles Table */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
                          Định mức nhôm định hình từ Opera (Số bộ: {qtySets})
                        </h4>
                      </div>
                      <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th>Mã thanh</th>
                              <th>Tên thanh</th>
                              <th>Đơn vị</th>
                              <th style={{ textAlign: 'right' }}>Định mức/mẫu</th>
                              <th style={{ textAlign: 'right' }}>Tổng định mức ({qtySets} bộ)</th>
                              <th style={{ textAlign: 'right' }}>Khối lượng riêng (kg/m)</th>
                              <th style={{ textAlign: 'right' }}>Tổng trọng lượng (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alMats.map((m, idx) => {
                              const totalQty = m.quantity * qtySets;
                              const weight = m.unit_weight ? totalQty * m.unit_weight : 0.0;
                              return (
                                <tr key={idx}>
                                  <td style={{ fontFamily: 'monospace' }}>{m.code}</td>
                                  <td style={{ fontWeight: '500' }}>{m.name}</td>
                                  <td>{m.quantity_unit}</td>
                                  <td style={{ textAlign: 'right' }}>{m.quantity.toFixed(3)}</td>
                                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{totalQty.toFixed(3)}</td>
                                  <td style={{ textAlign: 'right' }}>{m.unit_weight ? m.unit_weight.toFixed(3) : '-'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                                    {m.unit_weight ? `${weight.toFixed(2)} kg` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            {alMats.length === 0 && (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>
                                  Không có thanh nhôm nào trong mẫu định mức này.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Accessories & Glass Table */}
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
                        Định mức phụ kiện & kính từ Opera (Số bộ: {qtySets})
                      </h4>
                      <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th>Mã vật tư</th>
                              <th>Tên vật tư / Mô tả</th>
                              <th>Đơn vị</th>
                              <th style={{ textAlign: 'right' }}>Định mức/mẫu</th>
                              <th style={{ textAlign: 'right' }}>Tổng định mức ({qtySets} bộ)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {otherMats.map((m, idx) => (
                              <tr key={idx}>
                                <td style={{ fontFamily: 'monospace' }}>{m.code}</td>
                                <td style={{ fontWeight: '500' }}>{m.name} {m.description ? `(${m.description})` : ''}</td>
                                <td>{m.quantity_unit}</td>
                                <td style={{ textAlign: 'right' }}>{m.quantity.toFixed(3)}</td>
                                <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--secondary)' }}>
                                  {(m.quantity * qtySets).toFixed(3)}
                                </td>
                              </tr>
                            ))}
                            {otherMats.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>
                                  Không có phụ kiện hay kính trong mẫu định mức này.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              }

              const variables = {
                W: parseFloat(editForm.width) || 0,
                H: parseFloat(editForm.height) || 0,
                W1: parseFloat(editForm.width1) || 0,
                H1: parseFloat(editForm.height1) || 0,
                W2: parseFloat(editForm.width2) || 0,
                H2: parseFloat(editForm.height2) || 0
              };
              const qtySets = parseInt(editForm.qty) || 1;

              // Calculate total aluminum weight
              let totalAlWeight = 0;
              const computedProfiles = (activeFormulas.profiles || []).map(p => {
                const len = evalFormulaJS(p.formula, variables);
                const totalLen = len * p.qty * qtySets;
                const totalWeight = totalLen * p.weight_per_m;
                totalAlWeight += totalWeight;
                return { ...p, calculatedLength: len, totalLen, totalWeight };
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Profiles Table */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>Định mức cắt nhôm động (W={variables.W} mm, H={variables.H} mm)</h4>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                        Tổng trọng lượng nhôm: <span style={{ color: 'var(--secondary)' }}>{totalAlWeight.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg</span>
                      </span>
                    </div>

                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Tên profile</th>
                            <th>Mã thanh</th>
                            <th>KT phụ thuộc</th>
                            <th>Công thức</th>
                            <th style={{ textAlign: 'right' }}>Dài cắt (m)</th>
                            <th style={{ textAlign: 'center' }}>Số thanh/bộ</th>
                            <th style={{ textAlign: 'right' }}>Tổng dài (m)</th>
                            <th style={{ textAlign: 'right' }}>Tổng KL (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {computedProfiles.map((p, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '500' }}>{p.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{p.code}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ padding: '2px 6px', background: 'rgba(37,60,120,0.06)', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                                  {p.dimension_type}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.formula}</td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{p.calculatedLength.toFixed(4)}</td>
                              <td style={{ textAlign: 'center' }}>{p.qty}</td>
                              <td style={{ textAlign: 'right' }}>{p.totalLen.toFixed(3)}</td>
                              <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>{p.totalWeight.toFixed(3)}</td>
                            </tr>
                          ))}
                          {computedProfiles.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa có công thức nhôm cho mẫu cửa này.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Accessories Table */}
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>Định mức phụ kiện kim khí (Số bộ: {qtySets})</h4>
                    <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Tên phụ kiện / kính</th>
                            <th>Mã vật tư</th>
                            <th style={{ textAlign: 'right' }}>Định mức / bộ</th>
                            <th style={{ textAlign: 'right' }}>Tổng nhu cầu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(activeFormulas.accessories || []).map((a, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '500' }}>{a.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{a.code}</td>
                              <td style={{ textAlign: 'right' }}>{a.qty.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--secondary)' }}>
                                {(a.qty * qtySets).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}
                              </td>
                            </tr>
                          ))}
                          {(!activeFormulas.accessories || activeFormulas.accessories.length === 0) && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa có định mức phụ kiện cho mẫu cửa này.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </SlidePanel>
      {/* Slide Panel for Detailed Cost Breakdown */}
      <SlidePanel
        isOpen={isCostPanelOpen}
        onClose={() => setIsCostPanelOpen(false)}
        title={selectedCalcDoor ? `Phân tích chi phí: ${selectedCalcDoor.code}` : ''}
        subtitle={selectedCalcDoor ? `Mẫu: ${selectedCalcDoor.template_code} | Số lượng: ${selectedCalcDoor.qty} bộ` : ''}
      >
        {selectedCalcDoor && (() => {
          const item = selectedCalcDoor;
          const companyCost = item.unit_price * ((activeProject.pct_company ?? 2.0) / 100.0);
          const contingencyCost = item.unit_price * ((activeProject.pct_contingency ?? 2.0) / 100.0);
          const warrantyCost = item.unit_price * ((activeProject.pct_warranty ?? 1.5) / 100.0);
          const otherCost = item.unit_price * ((activeProject.pct_other ?? 1.0) / 100.0);
          const totalAllocatedCost = companyCost + contingencyCost + warrantyCost + otherCost;
          const fullUnitPrice = item.unit_price + totalAllocatedCost;
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Door Illustration */}
              <div style={{ height: '200px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                <div style={{ width: '160px', height: '160px' }}>
                  <DoorIllustration doorType={item.name} code={item.template_code} width={item.width} height={item.height} layoutJson={item.layout_json} width1={item.width1} height1={item.height1} width2={item.width2} height2={item.height2} />
                </div>
              </div>

              {/* Basic Specs */}
              <div className="glass-panel" style={{ padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontWeight: '700', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', fontSize: '13px' }}>Thông số cơ bản</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kích thước:</span>
                  <span style={{ fontWeight: '600' }}>{item.width} x {item.height} m</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Diện tích 1 bộ:</span>
                  <span style={{ fontWeight: '600' }}>{item.area.toFixed(2)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Số lượng:</span>
                  <span style={{ fontWeight: '700' }}>{item.qty} bộ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tổng diện tích:</span>
                  <span style={{ fontWeight: '600' }}>{item.total_area.toFixed(2)} m²</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Loại kính:</span>
                  <span style={{ fontWeight: '500', fontSize: '11px', textAlign: 'right', maxWidth: '180px' }}>{item.glass_type}</span>
                </div>
              </div>

              {/* Detailed Cost Table */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                <table className="data-table" style={{ fontSize: '12px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Cấu phần chi phí</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá/Bộ</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền ({item.qty} bộ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Direct Costs */}
                    <tr>
                      <td style={{ fontWeight: '600' }}>1. Vật liệu Nhôm</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.components.aluminum)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.components.aluminum * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600' }}>2. Vật liệu Kính</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.components.glass)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.components.glass * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600' }}>3. Phụ kiện & VT phụ</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.components.auxiliary)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.components.auxiliary * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '600' }}>4. Nhân công sản xuất, LĐ</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.components.labor)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.components.labor * item.qty)}</td>
                    </tr>
                    
                    {/* Subtotal Direct Cost */}
                    <tr style={{ fontWeight: 'bold', background: 'rgba(37,60,120,0.04)', borderTop: '1px solid var(--border-color)' }}>
                      <td>Đơn giá sản xuất gốc</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price * item.qty)}</td>
                    </tr>

                    {/* Allocated Costs */}
                    <tr>
                      <td style={{ paddingLeft: '15px', color: 'var(--text-muted)' }}>+ CP Công ty ({activeProject.pct_company ?? 2.0}%)</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(companyCost)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(companyCost * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '15px', color: 'var(--text-muted)' }}>+ Dự phòng phí ({activeProject.pct_contingency ?? 2.0}%)</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(contingencyCost)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(contingencyCost * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '15px', color: 'var(--text-muted)' }}>+ DP bảo hành ({activeProject.pct_warranty ?? 1.5}%)</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(warrantyCost)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(warrantyCost * item.qty)}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingLeft: '15px', color: 'var(--text-muted)' }}>+ Chi phí khác ({activeProject.pct_other ?? 1.0}%)</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(otherCost)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(otherCost * item.qty)}</td>
                    </tr>

                    {/* Total Full Cost */}
                    <tr style={{ fontWeight: 'bold', background: 'rgba(45,179,75,0.06)', borderTop: '2px solid var(--border-color)', fontSize: '13px' }}>
                      <td style={{ color: '#1e8736' }}>Đơn giá full phân bổ</td>
                      <td style={{ textAlign: 'right', color: '#1e8736' }}>{formatCurrency(fullUnitPrice)}</td>
                      <td style={{ textAlign: 'right', color: '#1e8736' }}>{formatCurrency(fullUnitPrice * item.qty)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', background: 'rgba(0,0,0,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                * Báo cáo phân rã chi tiết giá thành sản xuất gốc và chi phí quản lý, dự phòng phân bổ tương ứng cho vị trí cửa này.
              </div>
            </div>
          );
        })()}
      </SlidePanel>

      {/* Catalog Material Mapping Modal */}
      {mappingMaterial && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Liên kết vật tư với Danh mục hệ thống</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Ánh xạ vật tư từ Opera: <strong style={{ color: 'var(--primary)' }}>{mappingMaterial.code}</strong> ({mappingMaterial.name}) vào vật tư gốc để tự động lấy đơn giá hệ thống.
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setMappingMaterial(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Tìm kiếm nhanh vật tư trong Danh mục hệ thống</label>
                <input 
                  type="text" 
                  placeholder="Gõ mã, tên, hoặc quy cách vật tư cần tìm..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  autoFocus
                />
              </div>

              <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>Mã vật tư</th>
                      <th>Tên vật tư</th>
                      <th>Nhóm</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Đơn vị</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Đơn giá hệ thống</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = catalogMaterials.filter(m => {
                        const q = searchQuery.toLowerCase();
                        return m.code.toLowerCase().includes(q) || 
                               m.name.toLowerCase().includes(q) || 
                               (m.category && m.category.toLowerCase().includes(q));
                      });
                      
                      return filtered.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{m.code}</td>
                          <td>{m.name}</td>
                          <td>
                            <span style={{ padding: '2px 6px', background: 'rgba(37,60,120,0.06)', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                              {m.category === 'aluminum' ? 'Nhôm' : m.category === 'glass' ? 'Kính' : m.category === 'accessory' ? 'Phụ kiện' : 'Vật tư phụ'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{m.unit}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                            {formatNumber(m.default_price)} đ
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => {
                                // Link this material: set mapped_id and auto-fill price
                                setEditingPrices(prev => ({
                                  ...prev,
                                  [mappingMaterial.code]: {
                                    ...prev[mappingMaterial.code],
                                    mapped_id: m.id,
                                    price: m.default_price,
                                    catalog_name: m.name,
                                    catalog_price: m.default_price
                                  }
                                }));
                                setMappingMaterial(null);
                              }}
                            >
                              Chọn
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                    {catalogMaterials.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                          Đang tải danh mục vật tư...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  onClick={() => {
                    // Unlink: reset mapped_id and keep custom price
                    setEditingPrices(prev => ({
                      ...prev,
                      [mappingMaterial.code]: {
                        ...prev[mappingMaterial.code],
                        mapped_id: null,
                        catalog_name: null,
                        catalog_price: null
                      }
                    }));
                    setMappingMaterial(null);
                  }}
                >
                  Hủy liên kết vật tư này
                </button>
                
                <button 
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  onClick={() => setMappingMaterial(null)}
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsModule;
