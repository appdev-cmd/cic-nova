import React, { useState, useEffect } from 'react';
import { createApiFetch } from '../api';
import { Plus, Search, Trash2, Edit, Save, X, RefreshCw, Layers, ClipboardList, ShieldAlert, History } from 'lucide-react';
import { useFeedback } from '../components/FeedbackProvider';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

function MaterialsModule({ apiBase, token, user }) {
  const fetch = createApiFetch(token);
  const { notify, confirmAction } = useFeedback();
  const alert = notify;
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'pricebooks'
  const [materials, setMaterials] = useState<any[]>([]);
  const [priceBooks, setPriceBooks] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [bookItems, setBookItems] = useState<any[]>([]); // Materials with custom prices for selected book
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form states
  const [newMaterial, setNewMaterial] = useState<any>({
    code: '',
    name: '',
    category: 'aluminum',
    unit: 'kg',
    default_price: 0,
    weight_per_m: 0.0
  });

  const [newBook, setNewBook] = useState({
    name: '',
    description: ''
  });

  // Inline edit state for catalog
  const [editingId, setEditingId] = useState<any>(null);
  useUnsavedChanges(Boolean(showAddModal || showAddBookModal || editingId));
  const [editValues, setEditValues] = useState<any>({
    name: '',
    category: 'aluminum',
    unit: 'kg',
    default_price: 0,
    weight_per_m: 0.0
  });

  // Edited prices state in Price Book Editor
  const [editedBookPrices, setEditedBookPrices] = useState<any>({}); // material_code -> price

  const isReadOnly = user?.role === 'viewer';

  useEffect(() => {
    fetchMaterials();
    fetchPriceBooks();
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

  const fetchPriceBooks = async () => {
    try {
      const res = await fetch(`${apiBase}/price-books`);
      const data = await res.json();
      setPriceBooks(data);
    } catch (e) {
      console.error("Error fetching price books:", e);
    }
  };

  const openPriceHistory = async (material) => {
    setHistoryMaterial(material);
    setPriceHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${apiBase}/materials/${material.id}/price-history`);
      if (!res.ok) throw new Error('Không thể tải lịch sử đơn giá.');
      const data = await res.json();
      setPriceHistory(data.history || []);
    } catch (error) {
      console.error(error);
      alert('Không thể tải lịch sử đơn giá. Vui lòng thử lại.');
      setHistoryMaterial(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatPrice = (value) => value === null || value === undefined
    ? '—'
    : `${Number(value).toLocaleString('vi-VN')} đ`;

  const getHistoryScope = (entry) => {
    if (entry.scope === 'price_book') return entry.price_book_name || 'Hệ đơn giá';
    if (entry.scope === 'project') return entry.project_name || `Dự án #${entry.project_id}`;
    return 'Giá mặc định';
  };

  const fetchPriceBookItems = async (bookId) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/price-books/${bookId}/items`);
      const data = await res.json();
      setBookItems(data);
      
      // Initialize edit cache
      const prices = {};


      data.forEach(item => {
        prices[item.code] = item.book_price !== null ? item.book_price : item.default_price;
      });
      setEditedBookPrices(prices);
    } catch (e) {
      console.error("Error fetching price book items:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newMaterial.code || !newMaterial.name) return;

    try {
      const res = await fetch(`${apiBase}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newMaterial.code.trim(),
          name: newMaterial.name.trim(),
          category: newMaterial.category,
          unit: newMaterial.unit,
          default_price: Number(newMaterial.default_price) || 0,
          weight_per_m: Number(newMaterial.weight_per_m) || 0.0
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

  const handleCreatePriceBook = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newBook.name) return;

    try {
      const res = await fetch(`${apiBase}/price-books`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newBook.name.trim(),
          description: newBook.description.trim()
        })
      });
      if (res.ok) {
        setShowAddBookModal(false);
        setNewBook({ name: '', description: '' });
        fetchPriceBooks();
      } else {
        const err = await res.json();
        alert(`Lỗi khi tạo hệ đơn giá: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePriceBookItems = async () => {
    if (isReadOnly || !selectedBook) return;

    const payload = {
      items: Object.keys(editedBookPrices).map(code => ({
        material_code: code,
        price: parseFloat(editedBookPrices[code]) || 0
      }))
    };

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/price-books/${selectedBook.id}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert(`Lưu đơn giá của hệ "${selectedBook.name}" thành công!`);
        fetchPriceBookItems(selectedBook.id);
      } else {
        alert("Lỗi khi lưu đơn giá hệ thống.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id, code) => {
    if (isReadOnly) return;
    if (!await confirmAction(`Bạn có chắc muốn xóa vật tư mã: ${code}?`)) return;
    try {
      const res = await fetch(`${apiBase}/materials/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMaterials();
    } catch (e) {
      console.error(e);
    }
  };

  const startEditCatalog = (mat: any) => {
    if (isReadOnly) return;
    setEditingId(mat.id);
    setEditValues({
      name: mat.name,
      category: mat.category,
      unit: mat.unit,
      default_price: mat.default_price,
      weight_per_m: mat.weight_per_m
    });
  };

  const handleSaveCatalog = async (id: number) => {
    if (isReadOnly) return;
    try {
      const res = await fetch(`${apiBase}/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editValues.name.trim(),
          category: editValues.category,
          unit: editValues.unit,
          default_price: Number(editValues.default_price) || 0,
          weight_per_m: Number(editValues.weight_per_m) || 0.0
        })
      });
      if (res.ok) {
        setEditingId(null);
        fetchMaterials();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookPriceChange = (code: string, val: string) => {
    setEditedBookPrices((prev: any) => ({
      ...prev,
      [code]: parseFloat(val) || 0
    }));
  };

  const handleSelectBook = (book: any) => {
    setSelectedBook(book);
    fetchPriceBookItems(book.id);
  };
  const safeMaterials = Array.isArray(materials) ? materials : [];
  const filteredMaterials = safeMaterials.filter(m => {
    const matchesCategory = filterCategory === 'all' || m.category === filterCategory;
    const matchesSearch = 
      (m.code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const safeBookItems = Array.isArray(bookItems) ? bookItems : [];
  const filteredBookItems = safeBookItems.filter(m => {
    const matchesCategory = filterCategory === 'all' || m.category === filterCategory;
    const matchesSearch = 
      (m.code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Danh mục Vật tư & Hệ đơn giá</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý danh sách vật tư dùng chung và thiết lập nhiều hệ đơn giá (Price Books) khác nhau.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => { fetchMaterials(); fetchPriceBooks(); if (selectedBook) fetchPriceBookItems(selectedBook.id); }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Tải lại
          </button>
          
          {!isReadOnly && activeTab === 'catalog' && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Thêm Vật tư
            </button>
          )}

          {!isReadOnly && activeTab === 'pricebooks' && !selectedBook && (
            <button className="btn btn-primary" onClick={() => setShowAddBookModal(true)}>
              <Plus size={16} /> Tạo Hệ đơn giá mới
            </button>
          )}
        </div>
      </div>

      {/* VIEW-MODE SUB TABS */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '24px' }}>
        <button 
          className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('catalog'); setSelectedBook(null); }}
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          <ClipboardList size={16} style={{ marginRight: '6px' }} /> Danh mục vật tư dùng chung
        </button>
        <button 
          className={`btn ${activeTab === 'pricebooks' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pricebooks')}
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          <Layers size={16} style={{ marginRight: '6px' }} /> Quản lý các Hệ đơn giá (Price Books)
        </button>
      </div>

      {/* READ-ONLY WARNING FOR VIEWERS */}
      {isReadOnly && (
        <div style={{ 
          background: 'rgba(245, 158, 11, 0.06)', 
          border: '1px solid rgba(245, 158, 11, 0.18)', 
          padding: '12px 16px', 
          borderRadius: '12px', 
          color: '#d97706', 
          fontSize: '13px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldAlert size={16} style={{ flexShrink: 0 }} />
          <span>Tài khoản của bạn có quyền <strong>Xem (Viewer)</strong>. Các tính năng thêm, sửa, xóa vật tư và cập nhật hệ đơn giá đã bị vô hiệu hóa.</span>
        </div>
      )}

      {/* CASE 1: COMMON CATALOG TAB */}
      {activeTab === 'catalog' && (
        <div>
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
                    <th style={{ width: '150px' }}>Mã vật tư</th>
                    <th>Tên vật tư</th>
                    <th style={{ width: '140px' }}>Phân loại</th>
                    <th style={{ width: '100px' }}>Đơn vị tính</th>
                    <th style={{ width: '160px', textAlign: 'right' }}>Đơn giá mặc định</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Trọng lượng (kg/m)</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Lịch sử</th>
                    {!isReadOnly && <th style={{ width: '110px', textAlign: 'center' }}>Thao tác</th>}
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
                          <button
                            className="btn btn-secondary icon-button"
                            style={{ padding: '6px' }}
                            onClick={() => openPriceHistory(mat)}
                            aria-label={`Xem lịch sử đơn giá ${mat.code}`}
                            title="Xem lịch sử đơn giá"
                          >
                            <History size={15} />
                          </button>
                        </td>
                        {!isReadOnly && (
                          <td style={{ textAlign: 'center' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button className="btn btn-primary" style={{ padding: '6px' }} onClick={() => handleSaveCatalog(mat.id)}>
                                  <Save size={14} />
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setEditingId(null)}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => startEditCatalog(mat)}>
                                  <Edit size={14} />
                                </button>
                                <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDeleteMaterial(mat.id, mat.code)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={isReadOnly ? 7 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Không tìm thấy vật tư nào khớp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CASE 2: PRICE BOOKS TAB */}
      {activeTab === 'pricebooks' && (
        <div>
          {/* Sub-view A: Price Books List */}
          {!selectedBook ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {priceBooks.map(book => (
                <div 
                  key={book.id}
                  className="glass-panel"
                  style={{ padding: '24px', transition: 'transform 0.2s' }}
                >
                  <div style={{ background: 'rgba(37, 60, 120, 0.08)', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
                    <Layers size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>{book.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5', minHeight: '36px' }}>
                    {book.description || 'Chưa có mô tả chi tiết cho hệ đơn giá này.'}
                  </p>
                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Đơn giá hệ thống riêng biệt</span>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => handleSelectBook(book)}>Mở hệ giá →</button>
                  </div>
                </div>
              ))}

              {priceBooks.length === 0 && (
                <div style={{ gridColumn: '1/-1', padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }} className="glass-panel">
                  Chưa có hệ đơn giá tùy biến nào. Nhấp nút "Tạo Hệ đơn giá mới" để thiết lập.
                </div>
              )}
            </div>
          ) : (
            /* Sub-view B: Price Book Spreadsheet Editor */
            <div>
              {/* Back navigation header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => { setSelectedBook(null); setBookItems([]); }}>
                    ← Quay lại
                  </button>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary)' }}>Cập nhật đơn giá: {selectedBook.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{selectedBook.description}</p>
                  </div>
                </div>
                
                {!isReadOnly && (
                  <button className="btn btn-primary" style={{ padding: '10px 24px' }} onClick={handleSavePriceBookItems} disabled={loading}>
                    <Save size={16} /> Lưu Hệ đơn giá
                  </button>
                )}
              </div>

              {/* Filters & Search within Price Book Editor */}
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

              {/* Spreadsheet Table */}
              <div className="glass-panel" style={{ padding: '0' }}>
                <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>
                      <tr>
                        <th style={{ width: '160px' }}>Mã vật tư</th>
                        <th>Tên vật tư</th>
                        <th style={{ width: '130px' }}>Phân loại</th>
                        <th style={{ width: '80px' }}>ĐVT</th>
                        <th style={{ width: '180px', textAlign: 'right' }}>Đơn giá mặc định (đ)</th>
                        <th style={{ width: '200px', textAlign: 'right', background: 'rgba(37, 60, 120, 0.03)' }}>
                          Đơn giá trong hệ này (đ)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookItems.map(item => (
                        <tr key={item.code}>
                          <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{item.code}</td>
                          <td>{item.name}</td>
                          <td>
                            <span className={`badge badge-${
                              item.category === 'aluminum' ? 'primary' : 
                              item.category === 'accessory' ? 'warning' : 
                              item.category === 'glass' ? 'success' : 'secondary'
                            }`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </td>
                          <td>{item.unit}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {item.default_price.toLocaleString('vi-VN')}
                          </td>
                          <td style={{ textAlign: 'right', background: 'rgba(37, 60, 120, 0.02)', fontWeight: 'bold' }}>
                            <input 
                              type="number"
                              value={editedBookPrices[item.code] !== undefined ? editedBookPrices[item.code] : ''}
                              onChange={(e) => handleBookPriceChange(item.code, e.target.value)}
                              className="form-control"
                              style={{ 
                                padding: '6px 12px', 
                                textAlign: 'right', 
                                width: '160px', 
                                marginLeft: 'auto',
                                border: '1px solid rgba(37, 60, 120, 0.15)',
                                fontWeight: '700',
                                color: 'var(--primary)'
                              }}
                              disabled={isReadOnly}
                            />
                          </td>
                        </tr>
                      ))}
                      {filteredBookItems.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            Không tìm thấy vật tư nào khớp với bộ lọc.
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

      {/* Material price history */}
      {historyMaterial && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setHistoryMaterial(null);
        }}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="price-history-title" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <div>
                <h3 id="price-history-title" style={{ fontSize: '18px', fontWeight: '700' }}>
                  Lịch sử đơn giá · {historyMaterial.code}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{historyMaterial.name}</p>
              </div>
              <button
                className="btn btn-secondary icon-button"
                style={{ padding: '6px' }}
                onClick={() => setHistoryMaterial(null)}
                aria-label="Đóng lịch sử đơn giá"
              >
                <X size={18} />
              </button>
            </div>

            <div className="table-container" style={{ maxHeight: '520px', overflowY: 'auto', marginTop: '18px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Phạm vi áp dụng</th>
                    <th style={{ textAlign: 'right' }}>Giá cũ</th>
                    <th style={{ textAlign: 'right' }}>Giá mới</th>
                    <th>Người thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map(entry => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.created_at).toLocaleString('vi-VN')}</td>
                      <td><span className="badge badge-secondary">{getHistoryScope(entry)}</span></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatPrice(entry.old_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(entry.new_price)}</td>
                      <td>{entry.changed_by_name || 'Hệ thống'}</td>
                    </tr>
                  ))}
                  {!historyLoading && priceHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Chưa có lần thay đổi đơn giá nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                  {historyLoading && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Đang tải lịch sử…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
            
            <form onSubmit={handleCreateMaterial}>
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

      {/* Add Price Book Modal */}
      {showAddBookModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Tạo hệ đơn giá tùy biến mới</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddBookModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreatePriceBook}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div>
                  <label className="form-label">Tên hệ đơn giá *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Đơn giá Bán lẻ, Đơn giá Đại lý VIP" 
                    value={newBook.name}
                    onChange={(e) => setNewBook({ ...newBook, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Mô tả hệ giá</label>
                  <textarea 
                    placeholder="Nhập ghi chú mô tả về hệ đơn giá này..." 
                    value={newBook.description}
                    onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                    className="form-control"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBookModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo hệ đơn giá
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
