import React, { useState, useEffect } from 'react';
import { 
  Folder, Plus, Trash2, ArrowLeft, Play, FileSpreadsheet, 
  Upload, CheckCircle, AlertTriangle, Info, X, DollarSign, Maximize2, Settings2, ClipboardList, PenTool 
} from 'lucide-react';
import DoorIllustration from '../components/DoorIllustration';
import SlidePanel from '../components/SlidePanel';

function ProjectsModule({ apiBase, currentView, setCurrentView }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [projectDoors, setProjectDoors] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  // Tabs within project details
  const [detailTab, setDetailTab] = useState('doors'); // 'doors', 'opera-prices', 'calc-preview'
  const [calcResults, setCalcResults] = useState(null);

  // Modals state
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddDoorModal, setShowAddDoorModal] = useState(false);
  
  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

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
  const [selectedCalcDoor, setSelectedCalcDoor] = useState(null);
  const [isCostPanelOpen, setIsCostPanelOpen] = useState(false);

  // Project Cost Overhead Form
  const [costForm, setCostForm] = useState({
    pct_company: 2.0,
    pct_contingency: 2.0,
    pct_warranty: 1.5,
    pct_other: 1.0
  });

  const handleSaveCostConfig = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: activeProject.name,
        description: activeProject.description,
        pct_company: parseFloat(costForm.pct_company) || 0.0,
        pct_contingency: parseFloat(costForm.pct_contingency) || 0.0,
        pct_warranty: parseFloat(costForm.pct_warranty) || 0.0,
        pct_other: parseFloat(costForm.pct_other) || 0.0
      };
      
      const res = await fetch(`${apiBase}/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        // Update activeProject locally
        const updatedProject = { ...activeProject, ...data };
        setActiveProject(updatedProject);
        // Update projects list
        setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));
        alert("Lưu định mức chi phí dự án thành công!");
      } else {
        const err = await res.json();
        alert(`Lỗi khi lưu định mức: ${err.detail || 'Lỗi không xác định'}`);
      }
    } catch (e) {
      console.error("Error saving cost config:", e);
      alert("Lỗi kết nối máy chủ khi lưu định mức.");
    }
  };

  // Upload file state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });

  // SlidePanel state for door details & dynamic BOM calculation
  const [activeDoor, setActiveDoor] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('edit'); // 'edit', 'bom'
  const [editForm, setEditForm] = useState({
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
  const [activeFormulas, setActiveFormulas] = useState({ profiles: [], accessories: [] });

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${apiBase}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error("Error fetching projects:", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${apiBase}/templates`);
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0) {
        setDoorForm(prev => ({ ...prev, template_id: data[0].id.toString() }));
      }
    } catch (e) {
      console.error("Error fetching templates:", e);
    }
  };

  const fetchProjectDoors = async (projectId) => {
    try {
      const res = await fetch(`${apiBase}/projects/${projectId}/doors`);
      const data = await res.json();
      setProjectDoors(data);
    } catch (e) {
      console.error("Error fetching project doors:", e);
    }
  };

  const fetchTemplateFormulas = async (templateId) => {
    if (!templateId) return;
    try {
      const res = await fetch(`${apiBase}/templates/${templateId}/formulas`);
      const data = await res.json();
      setActiveFormulas(data);
    } catch (e) {
      console.error("Error fetching active door formulas:", e);
    }
  };

  const handleOpenDoorPanel = (door) => {
    setActiveDoor(door);
    setIsPanelOpen(true);
    setPanelTab('edit');
    setEditForm({
      id: door.id,
      code: door.code,
      template_id: door.template_id.toString(),
      width: door.width ? door.width.toString() : '',
      height: door.height ? door.height.toString() : '',
      width1: door.width1 ? door.width1.toString() : '',
      height1: door.height1 ? door.height1.toString() : '',
      width2: door.width2 ? door.width2.toString() : '',
      height2: door.height2 ? door.height2.toString() : '',
      qty: door.qty ? door.qty.toString() : '1'
    });
    fetchTemplateFormulas(door.template_id);
  };

  const handleEditDoorSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.code || !editForm.template_id || !editForm.width || !editForm.height) return;

    const payload = {
      code: editForm.code.trim(),
      template_id: parseInt(editForm.template_id),
      width: parseFloat(editForm.width),
      height: parseFloat(editForm.height),
      width1: editForm.width1 ? parseFloat(editForm.width1) : null,
      height1: editForm.height1 ? parseFloat(editForm.height1) : null,
      width2: editForm.width2 ? parseFloat(editForm.width2) : null,
      height2: editForm.height2 ? parseFloat(editForm.height2) : null,
      qty: parseInt(editForm.qty) || 1
    };

    try {
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/doors/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Cập nhật thông tin cửa thành công!");
        setIsPanelOpen(false);
        fetchProjectDoors(activeProject.id);
        setCalcResults(null);
      } else {
        const err = await res.json();
        alert(`Lỗi khi cập nhật cửa: ${err.detail || 'Lỗi không xác định'}`);
      }
    } catch (e) {
      console.error("Error updating door:", e);
    }
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
    if (!newProjectName) return;
    try {
      const res = await fetch(`${apiBase}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() })
      });
      if (res.ok) {
        setNewProjectName('');
        setNewProjectDesc('');
        setShowAddProjectModal(false);
        fetchProjects();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa dự án này cùng toàn bộ cửa đã thêm?")) return;
    try {
      const res = await fetch(`${apiBase}/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) fetchProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectProject = (project) => {
    setActiveProject(project);
    fetchProjectDoors(project.id);
    setCalcResults(null);
    setDetailTab('doors');
    setUploadStatus({ type: '', message: '' });
    setUploadFile(null);
    
    // Bind cost percentages
    setCostForm({
      pct_company: project.pct_company !== undefined && project.pct_company !== null ? project.pct_company : 2.0,
      pct_contingency: project.pct_contingency !== undefined && project.pct_contingency !== null ? project.pct_contingency : 2.0,
      pct_warranty: project.pct_warranty !== undefined && project.pct_warranty !== null ? project.pct_warranty : 1.5,
      pct_other: project.pct_other !== undefined && project.pct_other !== null ? project.pct_other : 1.0
    });
  };

  const handleAddDoor = async (e) => {
    e.preventDefault();
    if (!doorForm.code || !doorForm.template_id || !doorForm.width || !doorForm.height) return;
    
    const payload = {
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
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/doors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDoorForm({
          code: '',
          template_id: templates[0]?.id.toString() || '',
          width: '',
          height: '',
          width1: '',
          height1: '',
          width2: '',
          height2: '',
          qty: '1'
        });
        setShowAddDoorModal(false);
        fetchProjectDoors(activeProject.id);
        setCalcResults(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDoor = async (doorId) => {
    if (!confirm("Xóa cửa này khỏi danh sách công trình?")) return;
    try {
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/doors/${doorId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProjectDoors(activeProject.id);
        setCalcResults(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadOpera = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setUploadStatus({ type: 'info', message: 'Đang tải lên và xử lý file Opera...' });
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/import-opera`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus({ 
          type: 'success', 
          message: `Thành công! Đã cập nhật ${data.records_imported} đơn giá vật tư chi tiết từ file Opera.` 
        });
        setUploadFile(null);
        fetchProjectDoors(activeProject.id);
      } else {
        setUploadStatus({ type: 'danger', message: data.detail || 'Lỗi khi nhập file.' });
      }
    } catch (e) {
      setUploadStatus({ type: 'danger', message: 'Lỗi kết nối máy chủ.' });
      console.error(e);
    }
  };

  const handleCalculate = async () => {
    try {
      const res = await fetch(`${apiBase}/projects/${activeProject.id}/calculate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCalcResults(data);
        setDetailTab('calc-preview');
      } else {
        const err = await res.json();
        alert(`Lỗi tính toán: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = () => {
    window.open(`${apiBase}/projects/${activeProject.id}/export`, '_blank');
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
            
            <button className="btn btn-primary" onClick={() => setShowAddProjectModal(true)}>
              <Plus size={16} /> Tạo Dự án Mới
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {projects.map(proj => (
              <div 
                key={proj.id} 
                className="glass-panel" 
                style={{ padding: '24px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => handleSelectProject(proj)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(37, 60, 120, 0.08)', padding: '12px', borderRadius: '12px' }}>
                    <Folder size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '6px' }}
                    onClick={(e) => handleDeleteProject(proj.id, e)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--primary)' }}>{proj.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', minHeight: '36px', marginBottom: '16px', lineHeight: '1.5' }}>
                  {proj.description || 'Chưa có mô tả ngắn về dự án này.'}
                </p>
                
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span>Ngày khởi tạo: {new Date(proj.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ))}
            
            {projects.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }} className="glass-panel">
                Chưa có dự án nào được tạo. Nhấp nút "Tạo Dự án Mới" ở góc phải để bắt đầu.
              </div>
            )}
          </div>
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
                Vị trí lắp cửa ({projectDoors.length})
              </button>
              <button 
                className={`btn ${detailTab === 'cost-config' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('cost-config')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Định mức chi phí
              </button>
              <button 
                className={`btn ${detailTab === 'opera-prices' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDetailTab('opera-prices')}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Nhập bảng giá Opera
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
                style={{ background: 'linear-gradient(135deg, #2db34b 0%, #1e8736 100%)', boxShadow: '0 4px 15px rgba(45, 179, 75, 0.25)', padding: '8px 16px', fontSize: '13px' }}
                onClick={handleExportExcel}
                disabled={projectDoors.length === 0}
              >
                <FileSpreadsheet size={14} style={{ marginRight: '6px' }} /> Xuất Báo Giá Excel
              </button>
            </div>
          </div>

          {/* TAB CONTENT 1: DOORS LIST */}
          {detailTab === 'doors' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Danh sách thống kê kích thước các vị trí cửa</h3>
                <button className="btn btn-primary" onClick={() => setShowAddDoorModal(true)}>
                  <Plus size={14} style={{ marginRight: '6px' }} /> Thêm Vị Trí Cửa
                </button>
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
                        <th style={{ width: '80px', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectDoors.map(door => (
                        <tr key={door.id} onClick={() => handleOpenDoorPanel(door)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{door.code}</td>
                          <td style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px' }}>
                            <div style={{ width: '45px', height: '45px', flexShrink: 0 }}>
                              <DoorIllustration doorType={door.template_name} code={door.template_code} width={door.width} height={door.height} />
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
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteDoor(door.id)}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {projectDoors.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            Chưa có vị trí cửa nào. Nhấp nút "Thêm Vị Trí Cửa" ở góc phải để nhập số liệu.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT 1.5: COST CONFIGURATION */}
          {detailTab === 'cost-config' && (
            <div style={{ maxWidth: '800px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Cấu hình tỷ lệ định mức các loại chi phí dự án</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Thiết lập tỷ lệ % định mức chi phí quản lý doanh nghiệp và dự phòng rủi ro áp dụng riêng cho dự án này.
                </p>
              </div>

              <form onSubmit={handleSaveCostConfig} className="glass-panel" style={{ padding: '28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  
                  {/* Company Management Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: 'rgba(37, 60, 120, 0.06)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Settings2 size={16} style={{ color: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>Chi phí Công ty</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>{costForm.pct_company}%</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
                      Chi phí vận hành, quản lý gián tiếp của văn phòng công ty phân bổ cho dự án.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="0.1"
                        value={costForm.pct_company}
                        onChange={(e) => setCostForm({ ...costForm, pct_company: parseFloat(e.target.value) || 0 })}
                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={costForm.pct_company}
                        onChange={(e) => setCostForm({ ...costForm, pct_company: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  {/* Contingency Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: 'rgba(37, 60, 120, 0.06)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle size={16} style={{ color: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>Dự phòng phí</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>{costForm.pct_contingency}%</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
                      Dự phòng cho các rủi ro biến động giá nguyên vật liệu, nhân công hoặc phát sinh khối lượng.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="0.1"
                        value={costForm.pct_contingency}
                        onChange={(e) => setCostForm({ ...costForm, pct_contingency: parseFloat(e.target.value) || 0 })}
                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={costForm.pct_contingency}
                        onChange={(e) => setCostForm({ ...costForm, pct_contingency: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  {/* Warranty Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: 'rgba(37, 60, 120, 0.06)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={16} style={{ color: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>Dự phòng bảo hành</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>{costForm.pct_warranty}%</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
                      Chi phí dự phòng cho công tác bảo trì, sửa chữa bảo hành công trình sau nghiệm thu.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="0.1"
                        value={costForm.pct_warranty}
                        onChange={(e) => setCostForm({ ...costForm, pct_warranty: parseFloat(e.target.value) || 0 })}
                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={costForm.pct_warranty}
                        onChange={(e) => setCostForm({ ...costForm, pct_warranty: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                      />
                    </div>
                  </div>

                  {/* Other Cost */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: 'rgba(37, 60, 120, 0.06)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={16} style={{ color: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>Chi phí khác</span>
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>{costForm.pct_other}%</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '12px', lineHeight: '1.4' }}>
                      Chi phí hành chính công trường, chi phí chung gián tiếp khác phục vụ thi công.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="0.1"
                        value={costForm.pct_other}
                        onChange={(e) => setCostForm({ ...costForm, pct_other: parseFloat(e.target.value) || 0 })}
                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={costForm.pct_other}
                        onChange={(e) => setCostForm({ ...costForm, pct_other: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="form-control"
                        style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                      />
                    </div>
                  </div>

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
                    <strong>Nguyên tắc tính toán trên file Excel:</strong> Các tỷ lệ phần trăm cấu hình ở trên sẽ được tự động điền vào cột F (định mức %) của sheet <code>CPHoanThien</code> khi xuất báo giá Excel. Excel sẽ tự động nhân tỷ lệ % này với Tổng doanh thu trước VAT ở dòng 129 để tính ra số tiền chi phí tương ứng ở cột G, đảm bảo báo giá chính xác và đồng bộ.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                    Lưu định mức chi phí
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB CONTENT 2: IMPORT OPERA */}
          {detailTab === 'opera-prices' && (
            <div style={{ maxWidth: '650px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Import đơn giá từ file kết quả của Opera</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
                Hệ thống hỗ trợ đọc file kết quả vật tư xuất ra từ Opera (.xls) để tự động cập nhật đơn giá thực tế của nhôm, phụ kiện, kính vào dự toán. Nếu không import, hệ thống sẽ sử dụng đơn giá mặc định trong **Danh mục Vật tư**.
              </p>

              <form className="glass-panel" style={{ padding: '32px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '14px' }} onSubmit={handleUploadOpera}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(37, 60, 120, 0.08)', padding: '16px', borderRadius: '50%' }}>
                    <Upload size={32} style={{ color: 'var(--primary)' }} />
                  </div>
                  
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '14px' }}>Nhấp chọn hoặc kéo thả tệp Opera .xls vào đây</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>Chấp nhận tệp định dạng .xls và .xlsx</p>
                  </div>

                  <input 
                    type="file" 
                    accept=".xls,.xlsx" 
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    style={{ opacity: 0, position: 'absolute', width: '250px', height: '120px', cursor: 'pointer' }}
                  />
                  
                  {uploadFile && (
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileSpreadsheet size={15} style={{ color: 'var(--secondary)' }} />
                      <span style={{ fontWeight: '500' }}>{uploadFile.name}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={!uploadFile}
                    style={{ marginTop: '8px', padding: '8px 24px', fontSize: '13px' }}
                  >
                    Bắt đầu Xử lý File
                  </button>
                </div>
              </form>

              {uploadStatus.message && (
                <div 
                  style={{ 
                    marginTop: '20px', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: uploadStatus.type === 'success' ? 'rgba(45, 179, 75, 0.1)' : uploadStatus.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 60, 120, 0.1)',
                    border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(45, 179, 75, 0.2)' : uploadStatus.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(37, 60, 120, 0.2)'}`,
                    color: uploadStatus.type === 'success' ? '#2db34b' : uploadStatus.type === 'danger' ? '#ef4444' : 'var(--primary)'
                  }}
                >
                  {uploadStatus.type === 'success' ? <CheckCircle size={16} /> : uploadStatus.type === 'danger' ? <AlertTriangle size={16} /> : <Info size={16} />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}
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
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                {/* Left side: Illustration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '280px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                    <DoorIllustration 
                      doorType={templates.find(t => t.id.toString() === editForm.template_id)?.type || activeDoor.template_name} 
                      code={templates.find(t => t.id.toString() === editForm.template_id)?.code || activeDoor.template_code} 
                      width={editForm.width || '0'} 
                      height={editForm.height || '0'} 
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
                      <select 
                        value={editForm.template_id}
                        onChange={(e) => {
                          setEditForm({ ...editForm, template_id: e.target.value });
                          fetchTemplateFormulas(e.target.value);
                        }}
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
                              <td colSpan="8" style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa có công thức nhôm cho mẫu cửa này.</td>
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
                              <td colSpan="4" style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa có định mức phụ kiện cho mẫu cửa này.</td>
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
                  <DoorIllustration doorType={item.type} code={item.template_code} width={item.width} height={item.height} />
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
    </div>
  );
}

export default ProjectsModule;
