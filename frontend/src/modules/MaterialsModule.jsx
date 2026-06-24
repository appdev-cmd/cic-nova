import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit, Save, X, RefreshCw } from 'lucide-react';

function MaterialsModule({ apiBase }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    code: '',
    name: '',
    category: 'aluminum',
    unit: 'kg',
    default_price: 0,
    weight_per_m: 0.0
  });

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({
    name: '',
    category: 'aluminum',
    unit: 'kg',
    default_price: 0,
    weight_per_m: 0.0
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/materials`);
      const data = await res.json();
      setMaterials(data);
    } catch (e) {
      console.error("Error fetching materials:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newMaterial.code || !newMaterial.name) return;

    try {
      const res = await fetch(`${apiBase}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newMaterial.code.trim(),
          name: newMaterial.name.trim(),
          category: newMaterial.category,
          unit: newMaterial.unit,
          default_price: parseFloat(newMaterial.default_price) || 0,
          weight_per_m: parseFloat(newMaterial.weight_per_m) || 0.0
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewMaterial({
          code: '',
          name: '',
          category: 'aluminum',
          unit: 'kg',
          default_price: 0,
          weight_per_m: 0.0
        });
        fetchMaterials();
      } else {
        const err = await res.json();
        alert(`Lỗi khi tạo vật tư: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Bạn có chắc muốn xóa vật tư mã: ${code}?`)) return;
    try {
      const res = await fetch(`${apiBase}/materials/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchMaterials();
      } else {
        alert("Lỗi khi xóa vật tư.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (mat) => {
    setEditingId(mat.id);
    setEditValues({
      name: mat.name,
      category: mat.category,
      unit: mat.unit,
      default_price: mat.default_price,
      weight_per_m: mat.weight_per_m
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (id) => {
    try {
      const res = await fetch(`${apiBase}/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editValues.name.trim(),
          category: editValues.category,
          unit: editValues.unit,
          default_price: parseFloat(editValues.default_price) || 0,
          weight_per_m: parseFloat(editValues.weight_per_m) || 0.0
        })
      });
      if (res.ok) {
        setEditingId(null);
        fetchMaterials();
      } else {
        alert("Lỗi khi cập nhật vật tư.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to display category label in Vietnamese
  const getCategoryLabel = (cat) => {
    switch(cat) {
      case 'aluminum': return 'Profile Nhôm';
      case 'accessory': return 'Phụ kiện';
      case 'glass': return 'Kính';
      default: return 'Vật tư khác';
    }
  };

  // Filter and search materials list
  const filteredMaterials = materials.filter(m => {
    const matchesCategory = filterCategory === 'all' || m.category === filterCategory;
    const matchesSearch = 
      m.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Danh mục Vật tư dùng chung</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý danh sách profile nhôm, phụ kiện, kính và đơn giá chuẩn hệ thống.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchMaterials} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Tải lại
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Thêm Vật tư
          </button>
        </div>
      </div>

      {/* Filters and search section */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'aluminum', 'accessory', 'glass', 'other'].map(cat => (
            <button 
              key={cat}
              className={`btn ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterCategory(cat)}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              {cat === 'all' ? 'Tất cả' : getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo mã hoặc tên..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* Materials Table */}
      <div className="glass-panel" style={{ padding: '0' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Mã vật tư</th>
                <th>Tên vật tư</th>
                <th style={{ width: '140px' }}>Phân loại</th>
                <th style={{ width: '100px' }}>Đơn vị tính</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Đơn giá mặc định</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Trọng lượng (kg/m)</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map(mat => {
                const isEditing = editingId === mat.id;
                return (
                  <tr key={mat.id}>
                    <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{mat.code}</td>
                    <td>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="form-control"
                          style={{ padding: '6px' }}
                        />
                      ) : (
                        mat.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select 
                          value={editValues.category}
                          onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}
                          className="form-control"
                          style={{ padding: '6px' }}
                        >
                          <option value="aluminum">Profile Nhôm</option>
                          <option value="accessory">Phụ kiện</option>
                          <option value="glass">Kính</option>
                          <option value="other">Vật tư khác</option>
                        </select>
                      ) : (
                        <span className={`badge badge-${
                          mat.category === 'aluminum' ? 'primary' : 
                          mat.category === 'accessory' ? 'warning' : 
                          mat.category === 'glass' ? 'success' : 'secondary'
                        }`}>
                          {getCategoryLabel(mat.category)}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editValues.unit}
                          onChange={(e) => setEditValues({ ...editValues, unit: e.target.value })}
                          className="form-control"
                          style={{ padding: '6px' }}
                        />
                      ) : (
                        mat.unit
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {isEditing ? (
                        <input 
                          type="number" 
                          value={editValues.default_price}
                          onChange={(e) => setEditValues({ ...editValues, default_price: parseFloat(e.target.value) || 0 })}
                          className="form-control"
                          style={{ padding: '6px', textAlign: 'right', width: '120px', marginLeft: 'auto' }}
                        />
                      ) : (
                        `${mat.default_price.toLocaleString('vi-VN')} đ`
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="0.001"
                          value={editValues.weight_per_m}
                          onChange={(e) => setEditValues({ ...editValues, weight_per_m: parseFloat(e.target.value) || 0 })}
                          className="form-control"
                          style={{ padding: '6px', textAlign: 'right', width: '100px', marginLeft: 'auto' }}
                          disabled={editValues.category !== 'aluminum'}
                        />
                      ) : (
                        mat.category === 'aluminum' ? mat.weight_per_m.toFixed(3) : '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn btn-primary" style={{ padding: '6px' }} onClick={() => handleSave(mat.id)}>
                            <Save size={14} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={cancelEdit}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => startEdit(mat)}>
                            <Edit size={14} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDelete(mat.id, mat.code)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Không tìm thấy vật tư nào khớp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Thêm mới vật tư vào hệ thống</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div>
                  <label className="form-label">Mã vật tư *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: WSAW-5010" 
                    value={newMaterial.code}
                    onChange={(e) => setNewMaterial({ ...newMaterial, code: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Tên vật tư *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Khung bao sổ lùa" 
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Phân loại</label>
                    <select 
                      value={newMaterial.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const unit = cat === 'aluminum' ? 'kg' : cat === 'glass' ? 'm2' : 'pc';
                        setNewMaterial({ ...newMaterial, category: cat, unit });
                      }}
                      className="form-control"
                    >
                      <option value="aluminum">Profile Nhôm</option>
                      <option value="accessory">Phụ kiện</option>
                      <option value="glass">Kính</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Đơn vị tính</label>
                    <input 
                      type="text" 
                      value={newMaterial.unit}
                      onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Đơn giá hệ thống (đ)</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={newMaterial.default_price}
                      onChange={(e) => setNewMaterial({ ...newMaterial, default_price: parseFloat(e.target.value) || 0 })}
                      className="form-control"
                    />
                  </div>

                  <div>
                    <label className="form-label">Trọng lượng (kg/m)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      placeholder="0.0"
                      value={newMaterial.weight_per_m}
                      onChange={(e) => setNewMaterial({ ...newMaterial, weight_per_m: parseFloat(e.target.value) || 0.0 })}
                      className="form-control"
                      disabled={newMaterial.category !== 'aluminum'}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Thêm mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialsModule;
