import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Settings2, ShieldCheck, ClipboardList, PenTool, LayoutGrid, List } from 'lucide-react';
import DoorIllustration from '../components/DoorIllustration';
import SlidePanel from '../components/SlidePanel';

function DoorsModule({ apiBase }) {
  const [templates, setTemplates] = useState([]);
  const [systems, setSystems] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateFormulas, setTemplateFormulas] = useState({ profiles: [], accessories: [] });
  
  // Inline edit state for formulas
  const [modifiedFormulas, setModifiedFormulas] = useState({});
  const [modifiedAccessories, setModifiedAccessories] = useState({});
  
  // Tab within the detail panel
  const [detailTab, setDetailTab] = useState('spec'); // 'spec', 'illustration', 'bom'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (Card View), 'list' (Table View)
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // New Template form states
  const [newTemplate, setNewTemplate] = useState({
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
  const [editTemplate, setEditTemplate] = useState({
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

  useEffect(() => {
    fetchTemplates();
    fetchSystems();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchTemplateFormulas(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const fetchSystems = async () => {
    try {
      const res = await fetch(`${apiBase}/systems`);
      const data = await res.json();
      setSystems(data);
      if (data.length > 0) {
        setNewTemplate(prev => ({ ...prev, system_id: data[0].id.toString() }));
      }
    } catch (e) {
      console.error("Error fetching systems:", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${apiBase}/templates`);
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id.toString());
      }
    } catch (e) {
      console.error("Error fetching templates:", e);
    }
  };

  const fetchTemplateFormulas = async (templateId) => {
    try {
      const res = await fetch(`${apiBase}/templates/${templateId}/formulas`);
      const data = await res.json();
      setTemplateFormulas(data);
      
      // Initialize modified profile formulas
      const mods = {};
      data.profiles.forEach(p => {
        mods[p.id] = {
          name: p.name,
          code: p.code,
          dimension_type: p.dimension_type,
          formula: p.formula,
          qty: p.qty,
          weight_per_m: p.weight_per_m
        };
      });
      setModifiedFormulas(mods);

      // Initialize modified accessory formulas
      const accMods = {};
      data.accessories.forEach(a => {
        accMods[a.id] = {
          name: a.name,
          code: a.code,
          qty: a.qty
        };
      });
      setModifiedAccessories(accMods);
    } catch (e) {
      console.error("Error fetching formulas:", e);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplate.system_id || !newTemplate.code || !newTemplate.name) return;

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
        alert("Tạo cửa mẫu thành công!");
        setShowAddModal(false);
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
    if (!confirm(`Bạn có chắc chắn muốn xóa cửa mẫu: ${code}? Thao tác này cũng sẽ xóa toàn bộ định mức và công thức cắt nhôm của cửa này.`)) return;
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
    if (!confirm("Xóa thanh nhôm định hình này khỏi cửa mẫu?")) return;
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
    setModifiedFormulas(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSaveProfiles = async () => {
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
    if (!confirm("Xóa dòng phụ kiện này?")) return;
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
    setModifiedAccessories(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSaveAccessories = async () => {
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

  const activeTemplate = templates.find(t => t.id.toString() === selectedTemplateId);

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
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Tạo Loại Cửa Mới
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="door-grid">
          {templates.map(tpl => (
            <div 
              key={tpl.id}
              className="door-card glass-panel"
              onClick={() => handleSelectTemplate(tpl.id)}
            >
              <div className="door-card-thumb">
                <DoorIllustration doorType={tpl.type} code={tpl.code} width="120" height="120" />
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
          {templates.length === 0 && (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chưa có cửa mẫu nào.
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
                <th style={{ width: '100px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => (
                <tr 
                  key={tpl.id} 
                  onClick={() => handleSelectTemplate(tpl.id)} 
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{tpl.code}</td>
                  <td style={{ fontWeight: '500' }}>{tpl.name}</td>
                  <td>{tpl.type}</td>
                  <td>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary)', background: 'rgba(37, 60, 120, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tpl.system_name}
                    </span>
                  </td>
                  <td>{tpl.accessory_brand || 'Draho'}</td>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="btn btn-danger" 
                      style={{ padding: '6px' }}
                      onClick={() => handleDeleteTemplate(tpl.id, tpl.code)}
                      title="Xóa cửa mẫu"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Chưa có cửa mẫu nào.
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => openEditModal(activeTemplate)}>
                  <Edit2 size={14} style={{ marginRight: '6px' }} /> Sửa thông số
                </button>
                <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => handleDeleteTemplate(activeTemplate.id, activeTemplate.code)}>
                  <Trash2 size={14} style={{ marginRight: '6px' }} /> Xóa cửa mẫu
                </button>
              </div>
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
                <PenTool size={14} style={{ marginRight: '6px' }} /> Bản vẽ kỹ thuật SVG
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

            {/* DETAIL CONTENT: TAB 2 (ILLUSTRATION DRAWING) */}
            {detailTab === 'illustration' && (
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                <div style={{ height: '320px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                  <DoorIllustration doorType={activeTemplate.type} code={activeTemplate.code} width="W" height="H" />
                </div>
                
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)' }}>Bản vẽ kỹ thuật Vector SVG</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
                    Bản vẽ biểu diễn trực quan cấu tạo của mẫu cửa {activeTemplate.code}. 
                  </p>
                  <ul style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
                    <li>Khung bao ngoài được dựng chuẩn theo hệ nhôm {activeTemplate.system_name}.</li>
                    <li>Kính được biểu diễn bằng lớp kính mờ gradient xanh cyan nhạt phản quang.</li>
                    <li>Mũi tên chỉ hướng trượt đối với hệ cửa lùa, hoặc nét đứt biểu diễn hành trình mở đối với hệ cửa mở quay.</li>
                  </ul>
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
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddProfile}>
                        + Thêm profile
                      </button>
                      <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleSaveProfiles}>
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
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => handleDeleteProfile(p.id)}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {templateFormulas.profiles.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa cấu hình công thức nhôm nào.</td>
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
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddAccessory}>
                        + Thêm phụ kiện
                      </button>
                      <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleSaveAccessories}>
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
                              <button className="btn btn-danger" style={{ padding: '4px' }} onClick={() => handleDeleteAccessory(a.id)}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {templateFormulas.accessories.length === 0 && (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)' }}>Chưa cấu hình phụ kiện định mức nào.</td>
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
    </div>
  );
}

export default DoorsModule;
