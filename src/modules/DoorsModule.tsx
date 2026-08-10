import React, { useState, useEffect } from 'react';
import { createApiFetch } from '../api';
import { Plus, Trash2, Edit2, Save, X, Settings2, ShieldCheck, ClipboardList, PenTool, LayoutGrid, List, Search, Split, RotateCcw, Columns, Rows, RefreshCw, Check } from 'lucide-react';
import DoorIllustration from '../components/DoorIllustration';
import SlidePanel from '../components/SlidePanel';
import { useFeedback } from '../components/FeedbackProvider';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

// Predefined Typologies for the visual catalog selector
const TYPOLOGIES = [
  {
    code: 'CSL-50.01',
    name: 'Cửa sổ lùa 2 cánh',
    type: 'CỬA SỔ LÙA',
    layout_json: {
      id: 'root',
      direction: 'vertical',
      ratio: 1.0,
      children: [
        { id: 'pane_1', direction: 'leaf', type: 'sliding-left', ratio: 0.5 },
        { id: 'pane_2', direction: 'leaf', type: 'sliding-right', ratio: 0.5 }
      ]
    }
  },
  {
    code: 'CSL-50.02',
    name: 'Cửa sổ lùa 2 cánh có ô fix',
    type: 'CỬA SỔ LÙA',
    layout_json: {
      id: 'root',
      direction: 'horizontal',
      ratio: 1.0,
      children: [
        { id: 'top_fix', direction: 'leaf', type: 'fixed', ratio: 0.3, label: 'FIX' },
        {
          id: 'bottom_sliding',
          direction: 'vertical',
          ratio: 0.7,
          children: [
            { id: 'pane_1', direction: 'leaf', type: 'sliding-left', ratio: 0.5 },
            { id: 'pane_2', direction: 'leaf', type: 'sliding-right', ratio: 0.5 }
          ]
        }
      ]
    }
  },
  {
    code: 'CDMQ-50.01',
    name: 'Cửa đi mở quay 1 cánh',
    type: 'CỬA ĐI MỞ QUAY',
    layout_json: {
      id: 'root',
      direction: 'vertical',
      ratio: 1.0,
      children: [
        { id: 'pane_1', direction: 'leaf', type: 'swing-left', ratio: 1.0 }
      ]
    }
  },
  {
    code: 'CDMQ-50.02',
    name: 'Cửa đi mở quay 2 cánh',
    type: 'CỬA ĐI MỞ QUAY',
    layout_json: {
      id: 'root',
      direction: 'vertical',
      ratio: 1.0,
      children: [
        { id: 'pane_1', direction: 'leaf', type: 'swing-left', ratio: 0.5 },
        { id: 'pane_2', direction: 'leaf', type: 'swing-right', ratio: 0.5 }
      ]
    }
  },
  {
    code: 'CSMQ-50.01',
    name: 'Cửa sổ mở hất 1 cánh',
    type: 'CỬA SỔ MỞ QUAY',
    layout_json: {
      id: 'root',
      direction: 'vertical',
      ratio: 1.0,
      children: [
        { id: 'pane_1', direction: 'leaf', type: 'awning', ratio: 1.0 }
      ]
    }
  }
];

function DoorsModule({ apiBase, token, user }: any) {
  const fetch = createApiFetch(token);
  const { notify, confirmAction } = useFeedback();
  const alert = notify;
  const isReadOnly = user?.role === 'viewer';
  const [templates, setTemplates] = useState<any[]>([]);
  // Tab within the detail panel
  const [detailTab, setDetailTab] = useState('spec'); // 'spec', 'illustration', 'bom'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (Card View), 'list' (Table View)
  const [isPanelOpen, setIsPanelOpen] = useState(false);


  // Visual Designer states
  const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null);
  const [layoutTree, setLayoutTree] = useState<any>(null);
  const [selectedTypologyCode, setSelectedTypologyCode] = useState<string | null>(null);
  const [showTypologyModal, setShowTypologyModal] = useState(false);
  useUnsavedChanges(Boolean(showAddModal || showEditTemplateModal));

  const activeTemplate = templates.find(t => t.id.toString() === selectedTemplateId);

  // Tree manipulation utility helpers
  const findNodeInTree = (node: any, targetId: string): any => {
    if (!node) return null;
    if (node.id === targetId) return node;
    if (node.children) {
      for (let child of node.children) {
        const found = findNodeInTree(child, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const getPaneType = (tree: any, paneId: string): string => {
    const node = findNodeInTree(tree, paneId);
    return node ? node.type || 'fixed' : 'fixed';
  };

  const updateNodeInTree = (node: any, targetId: string, updater: (n: any) => any): any => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child: any) => updateNodeInTree(child, targetId, updater))
      };
    }
    return node;
  };

  const findParentNode = (root: any, childId: string): any => {
    if (!root || !root.children) return null;
    if (root.children.some((c: any) => c.id === childId)) return root;
    for (let child of root.children) {
      const p = findParentNode(child, childId);
      if (p) return p;
    }
    return null;
  };

  // Dynamic CAD-to-BOM formulas generator
  const generateFormulasFromLayout = (tree: any) => {
    const profiles: any[] = [];
    const accessories: any[] = [];
    
    // 1. Add Outer Frame
    profiles.push({
      name: "Khung bao ngang",
      code: "KB-NGANG",
      dimension_type: "W",
      formula: "W",
      qty: 2,
      weight_per_m: 1.1
    });
    profiles.push({
      name: "Khung bao đứng",
      code: "KB-DUNG",
      dimension_type: "H",
      formula: "H",
      qty: 2,
      weight_per_m: 1.2
    });

    const traverse = (node: any, wExpr: string, hExpr: string) => {
      if (!node) return;
      
      const direction = node.direction || 'leaf';
      const children = node.children || [];
      
      if (direction === 'leaf') {
        const type = node.type || 'fixed';
        const leafId = (node.id || '').substring(0, 4).toUpperCase();
        
        if (type.startsWith('sliding')) {
          profiles.push({
            name: `Thanh cánh trơn (Lùa - Ô ${leafId})`,
            code: "CANH-TRON",
            dimension_type: "H",
            formula: `${hExpr} - 0.047`,
            qty: 2,
            weight_per_m: 0.95
          });
          profiles.push({
            name: `Thanh cánh móc (Lùa - Ô ${leafId})`,
            code: "CANH-MOC",
            dimension_type: "H",
            formula: `${hExpr} - 0.047`,
            qty: 1,
            weight_per_m: 1.05
          });
          profiles.push({
            name: `Thanh cánh bánh xe (Lùa - Ô ${leafId})`,
            code: "CANH-BX",
            dimension_type: "W",
            formula: `${wExpr} - 0.015`,
            qty: 2,
            weight_per_m: 0.9
          });
          
          accessories.push({
            name: `Bánh xe đúp lùa (Cánh ${leafId})`,
            code: "BX-DUP",
            qty: 2.0
          });
          accessories.push({
            name: `Khóa bán nguyệt (Cánh ${leafId})`,
            code: "K-NGUYET",
            qty: 1.0
          });
        } else if (type.startsWith('swing') || type === 'awning') {
          profiles.push({
            name: `Thanh cánh đứng (Mở - Ô ${leafId})`,
            code: "CANH-QUAY-DUNG",
            dimension_type: "H",
            formula: `${hExpr} - 0.045`,
            qty: 2,
            weight_per_m: 1.3
          });
          profiles.push({
            name: `Thanh cánh ngang (Mở - Ô ${leafId})`,
            code: "CANH-QUAY-NGANG",
            dimension_type: "W",
            formula: `${wExpr} - 0.09`,
            qty: 2,
            weight_per_m: 1.3
          });
          
          const isAwning = type === 'awning';
          accessories.push({
            name: isAwning ? `Bản lề chữ A (Cánh ${leafId})` : `Bản lề 3D (Cánh ${leafId})`,
            code: isAwning ? "BAN-LE-A" : "BAN-LE-3D",
            qty: isAwning ? 2.0 : 3.0
          });
          accessories.push({
            name: `Bộ khóa tay nắm (Cánh ${leafId})`,
            code: "KHOA-TAYNAM",
            qty: 1.0
          });
        }
        return;
      }
      
      if (direction === 'horizontal') {
        if (children.length > 1) {
          profiles.push({
            name: "Thanh đố chia ngang",
            code: "DO-NGANG",
            dimension_type: "W",
            formula: wExpr,
            qty: children.length - 1,
            weight_per_m: 1.1
          });
        }
        
        children.forEach((child: any) => {
          const r = child.ratio || (1 / children.length);
          const childHExpr = hExpr === 'H' ? `H * ${r.toFixed(2)}` : `(${hExpr}) * ${r.toFixed(2)}`;
          traverse(child, wExpr, childHExpr);
        });
      } else if (direction === 'vertical') {
        if (children.length > 1) {
          profiles.push({
            name: "Thanh đố chia đứng",
            code: "DO-DOC",
            dimension_type: "H",
            formula: hExpr,
            qty: children.length - 1,
            weight_per_m: 1.1
          });
        }
        
        children.forEach((child: any) => {
          const r = child.ratio || (1 / children.length);
          const childWExpr = wExpr === 'W' ? `W * ${r.toFixed(2)}` : `(${wExpr}) * ${r.toFixed(2)}`;
          traverse(child, childWExpr, hExpr);
        });
      }
    };

    traverse(tree, "W", "H");
    
    // Consolidate accessories
    const consolidatedAcc: any[] = [];
    accessories.forEach((acc: any) => {
      const existing = consolidatedAcc.find(a => a.code === acc.code);
      if (existing) {
        existing.qty += acc.qty;
      } else {
        consolidatedAcc.push({ ...acc });
      }
    });
    
    return { profiles, accessories: consolidatedAcc };
  };

  // New Template form states
  const [newTemplate, setNewTemplate] = useState<any>({
    system_id: '',
    code: '',
    name: '',
    type: 'CỬA SỔ LÙA',
    accessory_brand: 'Draho',
    glass_type: 'k8cl',
    percent_aluminum: 45,
    percent_glass: 10,
    percent_accessories: 20,
    percent_labor: 25
  });

  // Edit Template form states
  const [editTemplate, setEditTemplate] = useState<any>({
    id: '',
    system_id: '',
    code: '',
    name: '',
    type: 'CỬA SỔ LÙA',
    accessory_brand: 'Draho',
    glass_type: 'k8cl',
    percent_aluminum: 45,
    percent_glass: 10,
    percent_accessories: 20,
    percent_labor: 25
  });

  const fetchSystems = async () => {
    try {
      const res = await fetch(`${apiBase}/aluminum-systems`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSystems(data);
          return;
        }
      }
    } catch (e) {
      console.warn("API aluminum-systems unavailable:", e);
    }
    setSystems([
      { id: 1, name: 'Xingfa 55', manufacturer: 'Xingfa Guangdong' },
      { id: 2, name: 'Xingfa 93', manufacturer: 'Xingfa Guangdong' },
      { id: 3, name: 'Maxpro 65', manufacturer: 'Maxpro Japan' }
    ]);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${apiBase}/door-templates`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTemplates(data);
          return;
        }
      }
    } catch (e) {
      console.warn("API door-templates unavailable:", e);
    }
    setTemplates([
      { id: 1, system_id: 1, code: 'XF55-1D', name: 'Cửa đi 1 cánh Xingfa 55', type: 'CỬA ĐỊ 1 CÁNH', accessory_brand: 'Kinlong', glass_type: 'k8cl' },
      { id: 2, system_id: 1, code: 'XF55-2D', name: 'Cửa đi 2 cánh Xingfa 55', type: 'CỬA ĐỊ 2 CÁNH', accessory_brand: 'Kinlong', glass_type: 'k8cl' },
      { id: 3, system_id: 1, code: 'XF55-4D', name: 'Cửa đi 4 cánh Xingfa 55', type: 'CỬA ĐỊ 4 CÁNH', accessory_brand: 'Kinlong', glass_type: 'k8cl' },
      { id: 4, system_id: 1, code: 'XF55-2W', name: 'Cửa sổ mở quay 2 cánh', type: 'CỬA SỔ QUAY', accessory_brand: 'Kinlong', glass_type: 'k8cl' },
      { id: 5, system_id: 2, code: 'XF93-2SL', name: 'Cửa lùa 2 cánh Xingfa 93', type: 'CỬA SỔ LÙA', accessory_brand: 'Draho', glass_type: 'k8cl' }
    ]);
  };

  const fetchTemplateFormulas = async (templateId: number) => {
    try {
      const res = await fetch(`${apiBase}/door-templates/${templateId}/formulas`);
      if (res.ok) {
        const data = await res.json();
        setFormulas(data || { profiles: [], accessories: [] });
        return;
      }
    } catch (e) {
      console.warn("API formulas unavailable:", e);
    }
    setFormulas({ profiles: [], accessories: [] });
  };

  const handleSplitPane = (direction: 'horizontal' | 'vertical') => {
    if (isReadOnly) return;
    if (!selectedPaneId || !layoutTree) return;
    
    const newTree = updateNodeInTree(layoutTree, selectedPaneId, (node) => {
      const id1 = `pane_${Math.random().toString(36).substring(2, 7)}`;
      const id2 = `pane_${Math.random().toString(36).substring(2, 7)}`;
      
      const currentType = node.type || 'fixed';
      
      return {
        ...node,
        direction,
        children: [
          { id: id1, direction: 'leaf', type: currentType, ratio: 0.5 },
          { id: id2, direction: 'leaf', type: 'fixed', ratio: 0.5 }
        ]
      };
    });
    
    setLayoutTree(newTree);
    setSelectedPaneId(null);
  };

  const handleChangePaneType = (newType: string) => {
    if (isReadOnly) return;
    if (!selectedPaneId || !layoutTree) return;
    
    const newTree = updateNodeInTree(layoutTree, selectedPaneId, (node) => {
      return {
        ...node,
        type: newType,
        label: newType === 'fixed' ? 'FIX' : undefined
      };
    });
    
    setLayoutTree(newTree);
  };

  const handleAdjustRatio = (ratio: number) => {
    if (isReadOnly) return;
    if (!selectedPaneId || !layoutTree) return;
    
    const parent = findParentNode(layoutTree, selectedPaneId);
    if (!parent || !parent.children) return;
    
    const idx = parent.children.findIndex((c: any) => c.id === selectedPaneId);
    if (idx === -1) return;
    
    const newTree = updateNodeInTree(layoutTree, parent.id, (node) => {
      const newChildren = [...node.children];
      
      if (newChildren.length === 2) {
        if (idx === 0) {
          newChildren[0] = { ...newChildren[0], ratio: ratio };
          newChildren[1] = { ...newChildren[1], ratio: 1.0 - ratio };
        } else {
          newChildren[1] = { ...newChildren[1], ratio: ratio };
          newChildren[0] = { ...newChildren[0], ratio: 1.0 - ratio };
        }
      } else {
        newChildren[idx] = { ...newChildren[idx], ratio: ratio };
      }
      
      return {
        ...node,
        children: newChildren
      };
    });
    
    setLayoutTree(newTree);
  };

  const handleMergePane = () => {
    if (isReadOnly) return;
    if (!selectedPaneId || !layoutTree) return;
    
    const parent = findParentNode(layoutTree, selectedPaneId);
    if (!parent) return;
    
    const newTree = updateNodeInTree(layoutTree, parent.id, (node) => {
      return {
        id: node.id,
        direction: 'leaf',
        type: 'fixed',
        ratio: node.ratio || 1.0
      };
    });
    
    setLayoutTree(newTree);
    setSelectedPaneId(null);
  };

  const handleResetLayout = async () => {
    if (isReadOnly) return;
    if (!await confirmAction("Bạn có chắc chắn muốn xóa toàn bộ thiết kế đố cửa và quay về dạng một ô cố định phẳng ban đầu?")) return;
    setLayoutTree({ id: 'root', direction: 'leaf', type: 'fixed', ratio: 1.0 });
    setSelectedPaneId(null);
  };

  const handleSaveLayoutOnly = async () => {
    if (isReadOnly) return;
    if (!activeTemplate || !layoutTree) return;
    try {
      const updatedTemplate = {
        system_id: activeTemplate.system_id,
        code: activeTemplate.code,
        name: activeTemplate.name,
        type: activeTemplate.type,
        accessory_brand: activeTemplate.accessory_brand,
        glass_type: activeTemplate.glass_type,
        percent_aluminum: activeTemplate.percent_aluminum,
        percent_glass: activeTemplate.percent_glass,
        percent_accessories: activeTemplate.percent_accessories,
        percent_labor: activeTemplate.percent_labor,
        layout_json: JSON.stringify(layoutTree)
      };
      
      const res = await fetch(`${apiBase}/templates/${activeTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate)
      });
      
      if (res.ok) {
        alert("Đã lưu thiết kế hình học cửa thành công!");
        fetchTemplates();
      } else {
        alert("Lỗi khi lưu thiết kế.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAndGenerateFormulas = async () => {
    if (isReadOnly) return;
    if (!activeTemplate || !layoutTree) return;
    if (!await confirmAction("Hệ thống sẽ lưu thiết kế hình học đồng thời XÓA & TỰ ĐỘNG SINH MỚI toàn bộ công thức cắt nhôm, định mức phụ kiện cho cửa mẫu này dựa trên hình vẽ. Bạn có đồng ý?")) return;
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!newTemplate.system_id || !newTemplate.code || !newTemplate.name) return;
    const percentageTotal = Number(newTemplate.percent_aluminum) + Number(newTemplate.percent_glass)
      + Number(newTemplate.percent_accessories) + Number(newTemplate.percent_labor);
    if (Math.abs(percentageTotal - 100) > 0.01) {
      alert(`Tổng cơ cấu giá hiện là ${percentageTotal}%. Vui lòng điều chỉnh về đúng 100%.`);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_id: parseInt(newTemplate.system_id),
          code: newTemplate.code.trim(),
          name: newTemplate.name.trim(),
          type: newTemplate.type,
          accessory_brand: newTemplate.accessory_brand,
          glass_type: newTemplate.glass_type,
          percent_aluminum: parseFloat(newTemplate.percent_aluminum) || 0,
          percent_glass: parseFloat(newTemplate.percent_glass) || 0,
          percent_accessories: parseFloat(newTemplate.percent_accessories) || 0,
          percent_labor: parseFloat(newTemplate.percent_labor) || 0
        })
      });
      if (res.ok) {
        const data = await res.json();
        
        // Seeding standard formulas if typology is selected
        if (selectedTypologyCode) {
          try {
            await fetch(`${apiBase}/templates/${data.id}/apply-typology`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ typology_code: selectedTypologyCode })
            });
          } catch (err) {
            console.error("Failed to seed typology formulas:", err);
          }
        }
        
        alert("Tạo cửa mẫu thành công!");
        setShowAddModal(false);
        setSelectedTypologyCode(null); // Reset selection
        setNewTemplate({
          system_id: systems[0]?.id.toString() || '',
          code: '',
          name: '',
          type: 'CỬA SỔ LÙA',
          accessory_brand: 'Draho',
          glass_type: 'k8cl',
          percent_aluminum: 45,
          percent_glass: 10,
          percent_accessories: 20,
          percent_labor: 25
        });
        await fetchTemplates();
        setSelectedTemplateId(data.id.toString());
        setIsPanelOpen(true);
      } else {
        const err = await res.json();
        alert(`Lỗi khi tạo cửa mẫu: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditTemplateSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    const percentageTotal = Number(editTemplate.percent_aluminum) + Number(editTemplate.percent_glass)
      + Number(editTemplate.percent_accessories) + Number(editTemplate.percent_labor);
    if (Math.abs(percentageTotal - 100) > 0.01) {
      alert(`Tổng cơ cấu giá hiện là ${percentageTotal}%. Vui lòng điều chỉnh về đúng 100%.`);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/templates/${editTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_id: parseInt(editTemplate.system_id),
          code: editTemplate.code.trim(),
          name: editTemplate.name.trim(),
          type: editTemplate.type,
          accessory_brand: editTemplate.accessory_brand,
          glass_type: editTemplate.glass_type,
          percent_aluminum: parseFloat(editTemplate.percent_aluminum) || 0,
          percent_glass: parseFloat(editTemplate.percent_glass) || 0,
          percent_accessories: parseFloat(editTemplate.percent_accessories) || 0,
          percent_labor: parseFloat(editTemplate.percent_labor) || 0
        })
      });
      if (res.ok) {
        alert("Cập nhật thông số cửa mẫu thành công!");
        setShowEditTemplateModal(false);
        fetchTemplates();
      } else {
        alert("Lỗi khi cập nhật cửa mẫu.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTemplate = async (id, code) => {
    if (isReadOnly) return;
    if (!await confirmAction(`Bạn có chắc chắn muốn xóa cửa mẫu: ${code}? Thao tác này cũng sẽ xóa toàn bộ định mức và công thức cắt nhôm của cửa này.`)) return;
    try {
      const res = await fetch(`${apiBase}/templates/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert("Đã xóa cửa mẫu thành công!");
        setSelectedTemplateId('');
        setIsPanelOpen(false);
        setTemplateFormulas({ profiles: [], accessories: [] });
        await fetchTemplates();
      } else {
        alert("Lỗi khi xóa cửa mẫu.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Formulas profile handlers
  const handleAddProfile = async () => {
    if (isReadOnly) return;
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`${apiBase}/templates/${selectedTemplateId}/profile-formulas`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchTemplateFormulas(selectedTemplateId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (isReadOnly) return;
    if (!await confirmAction("Xóa thanh nhôm định hình này khỏi cửa mẫu?")) return;
    try {
      const res = await fetch(`${apiBase}/profile-formulas/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTemplateFormulas(selectedTemplateId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfileLocal = (id, field, value) => {
    if (isReadOnly) return;
    setModifiedFormulas(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSaveProfiles = async () => {
    if (isReadOnly) return;
    const list = Object.keys(modifiedFormulas).map(id => ({
      id: parseInt(id),
      name: modifiedFormulas[id].name,
      code: modifiedFormulas[id].code,
      dimension_type: modifiedFormulas[id].dimension_type,
      formula: modifiedFormulas[id].formula,
      qty: parseInt(modifiedFormulas[id].qty) || 1,
      weight_per_m: parseFloat(modifiedFormulas[id].weight_per_m) || 0.0
    }));

    try {
      const res = await fetch(`${apiBase}/templates/${selectedTemplateId}/profile-formulas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formulas: list })
      });
      if (res.ok) {
        alert("Đã lưu định mức nhôm thành công!");
        fetchTemplateFormulas(selectedTemplateId);
      } else {
        alert("Lỗi khi lưu định mức.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Accessories handlers
  const handleAddAccessory = async () => {
    if (isReadOnly) return;
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`${apiBase}/templates/${selectedTemplateId}/accessory-formulas`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchTemplateFormulas(selectedTemplateId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAccessory = async (id) => {
    if (isReadOnly) return;
    if (!await confirmAction("Xóa dòng phụ kiện này?")) return;
    try {
      const res = await fetch(`${apiBase}/accessory-formulas/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTemplateFormulas(selectedTemplateId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAccessoryLocal = (id, field, value) => {
    if (isReadOnly) return;
    setModifiedAccessories(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSaveAccessories = async () => {
    if (isReadOnly) return;
    const list = Object.keys(modifiedAccessories).map(id => ({
      id: parseInt(id),
      name: modifiedAccessories[id].name,
      code: modifiedAccessories[id].code,
      qty: parseFloat(modifiedAccessories[id].qty) || 1.0
    }));

    try {
      const res = await fetch(`${apiBase}/templates/${selectedTemplateId}/accessory-formulas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessories: list })
      });
      if (res.ok) {
        alert("Đã lưu định mức phụ kiện thành công!");
        fetchTemplateFormulas(selectedTemplateId);
      } else {
        alert("Lỗi khi lưu phụ kiện.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (tpl) => {
    setEditTemplate({
      id: tpl.id,
      system_id: tpl.system_id.toString(),
      code: tpl.code,
      name: tpl.name,
      type: tpl.type,
      accessory_brand: tpl.accessory_brand || 'Draho',
      glass_type: tpl.glass_type || 'k8cl',
      percent_aluminum: tpl.percent_aluminum,
      percent_glass: tpl.percent_glass,
      percent_accessories: tpl.percent_accessories,
      percent_labor: tpl.percent_labor
    });
    setShowEditTemplateModal(true);
  };

  const handleSelectTemplate = (id) => {
    setSelectedTemplateId(id.toString());
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Quản lý Cửa mẫu & Định mức</h1>
          <p style={{ color: 'var(--text-muted)' }}>Cấu hình công thức cắt nhôm, định mức phụ kiện và cơ cấu chi phí cho từng hệ cửa mẫu.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Xem dạng lưới"
            >
              <LayoutGrid size={16} /> Lưới
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Xem dạng bảng"
            >
              <List size={16} /> Bảng
            </button>
          </div>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Tạo Loại Cửa Mới
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Filter by System */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Hệ nhôm:</span>
            <select 
              value={filterSystemId} 
              onChange={(e) => setFilterSystemId(e.target.value)}
              className="form-control"
              style={{ padding: '6px 12px', fontSize: '13px', width: '160px' }}
            >
              <option value="all">Tất cả hệ nhôm</option>
              {systems.map(sys => (
                <option key={sys.id} value={sys.id}>{sys.name}</option>
              ))}
            </select>
          </div>

          {/* Filter by Door Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Phân nhóm:</span>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="form-control"
              style={{ padding: '6px 12px', fontSize: '13px', width: '160px' }}
            >
              <option value="all">Tất cả loại cửa</option>
              {uniqueTypes.filter(t => t !== 'all').map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo mã hoặc tên cửa mẫu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="door-grid">
          {filteredTemplates.map(tpl => (
            <div 
              key={tpl.id}
              className="door-card glass-panel"
              onClick={() => handleSelectTemplate(tpl.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSelectTemplate(tpl.id); } }}
              role="button"
              tabIndex={0}
              aria-label={`Mở cửa mẫu ${tpl.code}: ${tpl.name}`}
            >
              <div className="door-card-thumb">
                <DoorIllustration doorType={tpl.name} code={tpl.code} width="120" height="120" layoutJson={tpl.layout_json} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {tpl.code}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                    {tpl.name}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary)', background: 'rgba(37, 60, 120, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                    {tpl.system_name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {tpl.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Không tìm thấy cửa mẫu nào phù hợp với bộ lọc.
            </div>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Mã mẫu</th>
                <th>Tên loại cửa</th>
                <th>Phân nhóm cửa</th>
                <th>Hệ nhôm</th>
                <th>Hãng phụ kiện</th>
                {!isReadOnly && <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map(tpl => (
                <tr key={tpl.id}>
                  <td><button className="table-link" onClick={() => handleSelectTemplate(tpl.id)}>{tpl.code}</button></td>
                  <td style={{ fontWeight: '500' }}>{tpl.name}</td>
                  <td>{tpl.type}</td>
                  <td>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary)', background: 'rgba(37, 60, 120, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tpl.system_name}
                    </span>
                  </td>
                  <td>{tpl.accessory_brand || 'Draho'}</td>
                  {!isReadOnly && <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="btn btn-danger icon-button" 
                      style={{ padding: '6px' }}
                      onClick={() => handleDeleteTemplate(tpl.id, tpl.code)}
                      title="Xóa cửa mẫu"
                      aria-label={`Xóa cửa mẫu ${tpl.code}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>}
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr>
                    <td colSpan={isReadOnly ? 5 : 6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Không tìm thấy cửa mẫu nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide Panel for Detail View */}
      <SlidePanel 
        isOpen={isPanelOpen} 
        onClose={handleClosePanel} 
        title={activeTemplate ? `${activeTemplate.code} - ${activeTemplate.name}` : ''}
        subtitle={activeTemplate ? `Hệ nhôm: ${activeTemplate.system_name} | Phân nhóm: ${activeTemplate.type}` : ''}
      >
        {activeTemplate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Mã hệ thống: #{activeTemplate.id}</span>
              {!isReadOnly && <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => openEditModal(activeTemplate)}>
                  <Edit2 size={14} style={{ marginRight: '6px' }} /> Sửa thông số
                </button>
                <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => handleDeleteTemplate(activeTemplate.id, activeTemplate.code)}>
                  <Trash2 size={14} style={{ marginRight: '6px' }} /> Xóa cửa mẫu
                </button>
              </div>}
            </div>

            {/* Sub Tab buttons */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
              <button 
                className={`btn ${detailTab === 'spec' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('spec')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <Settings2 size={14} style={{ marginRight: '6px' }} /> Thông số & Giá thành %
              </button>
              <button 
                className={`btn ${detailTab === 'illustration' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('illustration')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <PenTool size={14} style={{ marginRight: '6px' }} /> 🎨 Thiết kế Đố & Bản vẽ
              </button>
              <button 
                className={`btn ${detailTab === 'bom' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('bom')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <ClipboardList size={14} style={{ marginRight: '6px' }} /> Định mức nhôm & phụ kiện
              </button>
            </div>

            {/* DETAIL CONTENT: TAB 1 (SPECIFICATIONS & PERCENTAGES) */}
            {detailTab === 'spec' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', textTransform: 'uppercase' }}>Cơ cấu giá thành (%)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>Nhôm (%):</span>
                        <span style={{ fontWeight: 'bold' }}>{activeTemplate.percent_aluminum}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${activeTemplate.percent_aluminum}%`, height: '100%', background: 'var(--primary)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>Kính (%):</span>
                        <span style={{ fontWeight: 'bold' }}>{activeTemplate.percent_glass}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${activeTemplate.percent_glass}%`, height: '100%', background: 'var(--secondary)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>Vật tư phụ & Phụ kiện (%):</span>
                        <span style={{ fontWeight: 'bold' }}>{activeTemplate.percent_accessories}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${activeTemplate.percent_accessories}%`, height: '100%', background: 'var(--warning)' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span>Nhân công & Máy (%):</span>
                        <span style={{ fontWeight: 'bold' }}>{activeTemplate.percent_labor}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${activeTemplate.percent_labor}%`, height: '100%', background: 'var(--success)' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', textTransform: 'uppercase' }}>Thông số chuẩn định mức</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Mã code mẫu:</td>
                        <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>{activeTemplate.code}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Hệ nhôm profile:</td>
                        <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>{activeTemplate.system_name}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Phân nhóm:</td>
                        <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>{activeTemplate.type}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Phụ kiện hãng:</td>
                        <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>{activeTemplate.accessory_brand || 'Draho'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Kính định mức:</td>
                        <td style={{ padding: '10px 0', fontWeight: '600', textAlign: 'right' }}>
                          {activeTemplate.glass_type === 'k8cl' ? 'Kính trắng cường lực 8mm' : activeTemplate.glass_type}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DETAIL CONTENT: TAB 2 (INTERACTIVE CAD DESIGNER) */}
            {detailTab === 'illustration' && (
              <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px' }}>
                {/* Left side: Canvas and info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '420px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', position: 'relative' }}>
                    <DoorIllustration 
                      doorType={activeTemplate.name} 
                      code={activeTemplate.code} 
                      width="W" 
                      height="H" 
                      layoutJson={layoutTree} 
                      onPaneClick={handlePaneClick} 
                      selectedPaneId={selectedPaneId || undefined} 
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: '1.4' }}>
                    <p style={{ fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>Mẹo thiết kế đố cửa:</p>
                    Nhấp trực tiếp vào bất kỳ ô kính màu xanh nào trên hình vẽ để chọn ô đó. Sau đó dùng bảng bên phải để chia đố hoặc đổi kiểu cánh mở.
                  </div>
                </div>
                
                {/* Right side: Controls */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase' }}>Bộ điều khiển chia đố</h3>
                      <button className="btn btn-danger" disabled={isReadOnly} style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleResetLayout}>
                        <RotateCcw size={11} /> Reset thiết kế
                      </button>
                    </div>

                    {selectedPaneId ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Selected info */}
                        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>Đang chọn ô:</span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#78350f', marginLeft: '6px' }}>#{selectedPaneId.substring(5) || selectedPaneId.substring(0, 5)}</span>
                          </div>
                          <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => setSelectedPaneId(null)}>Bỏ chọn</button>
                        </div>

                        {/* Split actions */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Chia đố ô cửa này:</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              disabled={isReadOnly}
                              style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                              onClick={() => handleSplitPane('horizontal')}
                            >
                              <Rows size={13} /> Chia đôi ngang
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              disabled={isReadOnly}
                              style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                              onClick={() => handleSplitPane('vertical')}
                            >
                              <Columns size={13} /> Chia đôi đứng
                            </button>
                          </div>
                        </div>

                        {/* Opening type sashes */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Kiểu hoạt động của cánh:</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            {[
                              { value: 'fixed', label: 'Cố định (Fix)' },
                              { value: 'sliding-left', label: 'Lùa trái (←)' },
                              { value: 'sliding-right', label: 'Lùa phải (→)' },
                              { value: 'swing-left', label: 'Quay trái' },
                              { value: 'swing-right', label: 'Quay phải' },
                              { value: 'awning', label: 'Mở hất' }
                            ].map(opt => {
                              const isCurrent = getPaneType(layoutTree, selectedPaneId) === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                                  disabled={isReadOnly}
                                  style={{ padding: '6px 2px', fontSize: '10px', fontWeight: isCurrent ? 'bold' : 'normal' }}
                                  onClick={() => handleChangePaneType(opt.value)}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Ratio adjuster */}
                        {(() => {
                          const parent = findParentNode(layoutTree, selectedPaneId);
                          if (!parent) return null;
                          
                          const node = findNodeInTree(layoutTree, selectedPaneId);
                          if (!node) return null;
                          const currentRatio = node.ratio || 0.5;
                          
                          return (
                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', fontWeight: '600' }}>
                                <span>Tỷ lệ phân vùng này:</span>
                                <span style={{ color: 'var(--primary)' }}>{(currentRatio * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0.1" 
                                max="0.9" 
                                step="0.05"
                                value={currentRatio}
                                disabled={isReadOnly}
                                onChange={(e) => handleAdjustRatio(parseFloat(e.target.value))}
                                style={{ width: '100%', cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                <span>10%</span>
                                <span>50%</span>
                                <span>90%</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Merge option */}
                        {findParentNode(layoutTree, selectedPaneId) && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            disabled={isReadOnly}
                            style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                            onClick={handleMergePane}
                          >
                            <Trash2 size={12} /> Gộp đố (Xóa ô này)
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', minHeight: '200px' }}>
                        <PenTool size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                        <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Chưa chọn ô thiết kế</p>
                        <p style={{ fontSize: '11px', maxWidth: '240px', lineHeight: '1.4' }}>Nhấp chuột trực tiếp vào các ô kính trên hình vẽ bên trái để kích hoạt trình chia đố.</p>
                      </div>
                    )}
                  </div>

                  {/* Save actions */}
                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '10px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      disabled={isReadOnly}
                      style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
                      onClick={handleSaveLayoutOnly}
                    >
                      <Save size={14} /> Chỉ lưu bản vẽ
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      disabled={isReadOnly}
                      style={{ flex: 1.2, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' }}
                      onClick={handleSaveAndGenerateFormulas}
                    >
                      <RefreshCw size={14} /> Lưu & Sinh Định mức (BOM)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DETAIL CONTENT: TAB 3 (BOM / FORMULAS LIST EDITOR) */}
            {detailTab === 'bom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* profiles formulas */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>Công thức cắt nhôm (Profiles)</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" disabled={isReadOnly} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddProfile}>
                        + Thêm profile
                      </button>
                      <button className="btn btn-primary" disabled={isReadOnly} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleSaveProfiles}>
                        Lưu công thức nhôm
                      </button>
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                        <tr>
                          <th>Tên thanh nhôm</th>
                          <th style={{ width: '110px' }}>Mã thanh</th>
                          <th style={{ width: '80px' }}>Hướng</th>
                          <th>Công thức (m)</th>
                          <th style={{ width: '60px' }}>SL</th>
                          <th style={{ width: '80px' }}>TL (kg/m)</th>
                          <th style={{ width: '50px', textAlign: 'center' }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templateFormulas.profiles.map(p => (
                          <tr key={p.id}>
                            <td style={{ minWidth: '120px' }}>
                              <input 
                                type="text" 
                                value={modifiedFormulas[p.id]?.name || ''} 
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'name', e.target.value)}
                                style={{ minWidth: '110px' }}
                              />
                            </td>
                            <td style={{ width: '110px' }}>
                              <input 
                                type="text" 
                                value={modifiedFormulas[p.id]?.code || ''} 
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'code', e.target.value)}
                                style={{ minWidth: '80px' }}
                              />
                            </td>
                            <td style={{ width: '80px' }}>
                              <select 
                                value={modifiedFormulas[p.id]?.dimension_type || 'H'}
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'dimension_type', e.target.value)}
                                style={{ minWidth: '70px' }}
                              >
                                <option value="W">W (Ngang)</option>
                                <option value="H">H (Cao)</option>
                                <option value="W1">W1</option>
                                <option value="H1">H1</option>
                                <option value="W2">W2</option>
                                <option value="H2">H2</option>
                              </select>
                            </td>
                            <td style={{ minWidth: '110px' }}>
                              <input 
                                type="text" 
                                value={modifiedFormulas[p.id]?.formula || ''} 
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'formula', e.target.value)}
                                style={{ minWidth: '100px', fontFamily: 'monospace' }}
                              />
                            </td>
                            <td style={{ width: '60px' }}>
                              <input 
                                type="number" 
                                value={modifiedFormulas[p.id]?.qty || 1} 
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'qty', e.target.value)}
                                style={{ minWidth: '40px', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ width: '80px' }}>
                              <input 
                                type="number" 
                                step="0.001"
                                value={modifiedFormulas[p.id]?.weight_per_m || 0} 
                                onChange={(e) => handleUpdateProfileLocal(p.id, 'weight_per_m', e.target.value)}
                                style={{ minWidth: '60px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button className="btn btn-danger" disabled={isReadOnly} style={{ padding: '4px' }} onClick={() => handleDeleteProfile(p.id)}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {templateFormulas.profiles.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa cấu hình công thức nhôm nào.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* accessories formulas */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>Phụ kiện kim khí tiêu chuẩn (Accessories)</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" disabled={isReadOnly} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddAccessory}>
                        + Thêm phụ kiện
                      </button>
                      <button className="btn btn-primary" disabled={isReadOnly} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleSaveAccessories}>
                        Lưu định mức phụ kiện
                      </button>
                    </div>
                  </div>

                  <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '13px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                        <tr>
                          <th>Tên phụ kiện</th>
                          <th style={{ width: '150px' }}>Mã phụ kiện</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Số lượng</th>
                          <th style={{ width: '50px', textAlign: 'center' }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templateFormulas.accessories.map(a => (
                          <tr key={a.id}>
                            <td style={{ minWidth: '150px' }}>
                              <input 
                                type="text" 
                                value={modifiedAccessories[a.id]?.name || ''} 
                                onChange={(e) => handleUpdateAccessoryLocal(a.id, 'name', e.target.value)}
                                style={{ minWidth: '140px' }}
                              />
                            </td>
                            <td style={{ width: '150px' }}>
                              <input 
                                type="text" 
                                value={modifiedAccessories[a.id]?.code || ''} 
                                onChange={(e) => handleUpdateAccessoryLocal(a.id, 'code', e.target.value)}
                                style={{ minWidth: '100px' }}
                              />
                            </td>
                            <td style={{ width: '100px' }}>
                              <input 
                                type="number" 
                                step="0.1"
                                value={modifiedAccessories[a.id]?.qty || 1} 
                                onChange={(e) => handleUpdateAccessoryLocal(a.id, 'qty', e.target.value)}
                                style={{ minWidth: '60px', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button className="btn btn-danger" disabled={isReadOnly} style={{ padding: '4px' }} onClick={() => handleDeleteAccessory(a.id)}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {templateFormulas.accessories.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa cấu hình phụ kiện định mức nào.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Không tìm thấy dữ liệu cửa mẫu này.
          </div>
        )}
      </SlidePanel>

      {/* Add Template Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Tạo cửa mẫu định mức mới</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTemplate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0', fontSize: '14px' }}>
                {/* Premium Banner to Select from Typology Library */}
                <div style={{ background: 'rgba(37, 60, 120, 0.05)', border: '1px dashed var(--primary)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <LayoutGrid size={20} style={{ color: 'var(--primary)' }} />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', color: 'var(--primary)' }}>Thư viện Mẫu cửa Hệ thống</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {selectedTypologyCode 
                          ? `✓ Đã chọn mẫu: ${selectedTypologyCode} (Sẽ tự điền định mức)` 
                          : 'Chọn mẫu cửa có sẵn & tự sinh định mức nhanh.'}
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: '600' }}
                    onClick={() => setShowTypologyModal(true)}
                  >
                    {selectedTypologyCode ? 'Đổi mẫu cửa' : 'Mở Thư viện'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Hệ nhôm *</label>
                    <select 
                      value={newTemplate.system_id}
                      onChange={(e) => setNewTemplate({ ...newTemplate, system_id: e.target.value })}
                      className="form-control"
                      required
                    >
                      {systems.map(sys => (
                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ký hiệu mẫu cửa *</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: CSL-50.04"
                      value={newTemplate.code}
                      onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Tên loại cửa *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Cửa lùa 3 cánh + fix"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Phân nhóm cửa</label>
                    <select 
                      value={newTemplate.type}
                      onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                      className="form-control"
                    >
                      <option value="CỬA SỔ LÙA">CỬA SỔ LÙA</option>
                      <option value="CỬA ĐI LÙA">CỬA ĐI LÙA</option>
                      <option value="CỬA SỔ MỞ QUAY">CỬA SỔ MỞ QUAY</option>
                      <option value="CỬA ĐI MỞ QUAY">CỬA ĐI MỞ QUAY</option>
                      <option value="VÁCH KÍNH CỐ ĐỊNH">VÁCH KÍNH CỐ ĐỊNH</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Hãng phụ kiện</label>
                    <input 
                      type="text" 
                      value={newTemplate.accessory_brand}
                      onChange={(e) => setNewTemplate({ ...newTemplate, accessory_brand: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Cơ cấu cấu thành giá thành (%) (Tổng phải bằng 100%)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nhôm (%)</label>
                      <input 
                        type="number" 
                        value={newTemplate.percent_aluminum}
                        onChange={(e) => setNewTemplate({ ...newTemplate, percent_aluminum: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Kính (%)</label>
                      <input 
                        type="number" 
                        value={newTemplate.percent_glass}
                        onChange={(e) => setNewTemplate({ ...newTemplate, percent_glass: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Phụ kiện (%)</label>
                      <input 
                        type="number" 
                        value={newTemplate.percent_accessories}
                        onChange={(e) => setNewTemplate({ ...newTemplate, percent_accessories: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nhân công (%)</label>
                      <input 
                        type="number" 
                        value={newTemplate.percent_labor}
                        onChange={(e) => setNewTemplate({ ...newTemplate, percent_labor: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo cửa mẫu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Template Details Modal */}
      {showEditTemplateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Cập nhật thông số cửa mẫu</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowEditTemplateModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditTemplateSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0', fontSize: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Hệ nhôm *</label>
                    <select 
                      value={editTemplate.system_id}
                      onChange={(e) => setEditTemplate({ ...editTemplate, system_id: e.target.value })}
                      className="form-control"
                      required
                    >
                      {systems.map(sys => (
                        <option key={sys.id} value={sys.id}>{sys.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Ký hiệu mẫu cửa *</label>
                    <input 
                      type="text" 
                      value={editTemplate.code}
                      onChange={(e) => setEditTemplate({ ...editTemplate, code: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Tên loại cửa *</label>
                  <input 
                    type="text" 
                    value={editTemplate.name}
                    onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Phân nhóm cửa</label>
                    <select 
                      value={editTemplate.type}
                      onChange={(e) => setEditTemplate({ ...editTemplate, type: e.target.value })}
                      className="form-control"
                    >
                      <option value="CỬA SỔ LÙA">CỬA SỔ LÙA</option>
                      <option value="CỬA ĐI LÙA">CỬA ĐI LÙA</option>
                      <option value="CỬA SỔ MỞ QUAY">CỬA SỔ MỞ QUAY</option>
                      <option value="CỬA ĐI MỞ QUAY">CỬA ĐI MỞ QUAY</option>
                      <option value="VÁCH KÍNH CỐ ĐỊNH">VÁCH KÍNH CỐ ĐỊNH</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Hãng phụ kiện</label>
                    <input 
                      type="text" 
                      value={editTemplate.accessory_brand}
                      onChange={(e) => setEditTemplate({ ...editTemplate, accessory_brand: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Cơ cấu cấu thành giá thành (%) (Tổng phải bằng 100%)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nhôm (%)</label>
                      <input 
                        type="number" 
                        value={editTemplate.percent_aluminum}
                        onChange={(e) => setEditTemplate({ ...editTemplate, percent_aluminum: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Kính (%)</label>
                      <input 
                        type="number" 
                        value={editTemplate.percent_glass}
                        onChange={(e) => setEditTemplate({ ...editTemplate, percent_glass: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Phụ kiện (%)</label>
                      <input 
                        type="number" 
                        value={editTemplate.percent_accessories}
                        onChange={(e) => setEditTemplate({ ...editTemplate, percent_accessories: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nhân công (%)</label>
                      <input 
                        type="number" 
                        value={editTemplate.percent_labor}
                        onChange={(e) => setEditTemplate({ ...editTemplate, percent_labor: parseInt(e.target.value) || 0 })}
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTemplateModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visual Typology Selector Modal */}
      {showTypologyModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Thư viện Mẫu cửa Hệ thống</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowTypologyModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                Chọn một thiết kế có sẵn từ thư viện mẫu tiêu chuẩn của Nova E&C. Hệ thống sẽ tự động điền mã bản vẽ kỹ thuật hình học (layout) và sinh đầy đủ danh mục định mức cắt nhôm, phụ kiện kim khí mặc định cho bạn.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', maxHeight: '450px', overflowY: 'auto', padding: '4px' }}>
                {TYPOLOGIES.map(typo => (
                  <div 
                    key={typo.code}
                    className="glass-panel hover-card"
                    style={{ padding: '16px', display: 'flex', flexDirection: 'column', cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: '12px', transition: 'all 0.2s ease', background: '#ffffff' }}
                    onClick={() => handleSelectTypology(typo)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSelectTypology(typo); } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Chọn thiết kế ${typo.code}: ${typo.name}`}
                  >
                    <div style={{ height: '110px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', marginBottom: '10px' }}>
                      <div style={{ width: '100px', height: '100px' }}>
                        <DoorIllustration 
                          layoutJson={typo.layout_json} 
                          width="W" 
                          height="H" 
                          doorType={typo.name} 
                          code={typo.code} 
                        />
                      </div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)', marginBottom: '4px' }}>
                      {typo.code}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '500', marginBottom: '12px', lineHeight: '1.4' }}>
                      {typo.name}
                    </div>
                    <div style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>{typo.type}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Chọn mẫu →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTypologyModal(false)}>
                Đóng thư viện
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoorsModule;
