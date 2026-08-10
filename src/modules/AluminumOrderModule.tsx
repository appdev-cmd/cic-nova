import React, { useState, useRef } from 'react';
import { createApiFetch } from '../api';
import { UploadCloud, FileSpreadsheet, Trash2, Loader2, CheckCircle, AlertCircle, Download, FileText, RefreshCw, Layers } from 'lucide-react';

function AluminumOrderModule({ apiBase, token, user }) {
  const fetch = createApiFetch(token);
  const [files, setFiles] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [success, setSuccess] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  
  const fileInputRef = useRef<any>(null);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const addFiles = (newFileList) => {
    const validFiles: any[] = [];
    for (let i = 0; i < newFileList.length; i++) {
      const file = newFileList[i];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'xls' || ext === 'xlsx') {
        // Avoid adding duplicate files by name
        if (!files.some(f => f.name === file.name)) {
          validFiles.push(file);
        }
      }
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setError(null);
      setSuccess(null);
    } else {
      setError("Chỉ chấp nhận các file định dạng Excel (.xls, .xlsx)");
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (files.length <= 1) {
      setPreviewData(null);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setPreviewData(null);
    setError(null);
    setSuccess(null);
  };

  // Consolidate & Preview (GET_JSON)
  const handleProcess = async (e, isDownloadOnly = false) => {
    if (e) e.preventDefault();
    if (files.length === 0) {
      setError("Vui lòng chọn ít nhất 1 file Excel tối ưu Opera.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append("files", file);
    });

    try {
      if (isDownloadOnly) {
        // Direct download
        const response = await fetch(`${apiBase}/aluminum-order/consolidate?preview=false`, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || "Gộp đơn đặt hàng thất bại.");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "TONG_HOP_DAT_HANG_NHOM.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess("Đã tải xuống file Excel đặt hàng thành công.");
      } else {
        // Get JSON Preview
        const response = await fetch(`${apiBase}/aluminum-order/consolidate?preview=true`, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || "Không thể phân tích dữ liệu gộp.");
        }

        const data = await response.json();
        setPreviewData(data);
        setSuccess(`Đã xử lý và gộp thành công ${files.length} file tối ưu Opera.`);
      }
    } catch (err) {
      console.error(err);
      setError((err as any).message || "Đã xảy ra lỗi trong quá trình xử lý gộp đặt hàng.");
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
            Tổng hợp Đặt hàng Nhôm
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Nhập nhiều file kết quả tối ưu từ Opera để gộp nhóm, cộng dồn số lượng theo mã, kích thước, màu sắc và xuất file đặt hàng tổng hợp.
          </p>
        </div>
        
        {files.length > 0 && (
          <button 
            className="btn btn-secondary" 
            onClick={clearAll}
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
          >
            <RefreshCw size={14} /> Làm mới hoàn toàn
          </button>
        )}
      </div>

      {/* Main interactive panel */}
      <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Alerts */}
        {error && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            background: 'rgba(239, 68, 68, 0.06)', 
            border: '1px solid rgba(239, 68, 68, 0.15)', 
            color: 'var(--danger)', 
            padding: '14px 20px', 
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            background: 'rgba(45, 179, 75, 0.06)', 
            border: '1px solid rgba(45, 179, 75, 0.15)', 
            color: 'var(--success)', 
            padding: '14px 20px', 
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* File Drag and Drop Zone */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          style={{
            border: dragActive ? '2px dashed var(--secondary)' : '2px dashed var(--border-color)',
            borderRadius: '16px',
            background: dragActive ? 'rgba(45, 179, 75, 0.02)' : 'rgba(37, 60, 120, 0.01)',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
          className="upload-dropzone"
        >
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept=".xls,.xlsx" 
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <div style={{ 
            background: 'rgba(37, 60, 120, 0.05)', 
            color: 'var(--primary)', 
            width: '56px', 
            height: '56px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '4px',
            transition: 'transform 0.3s ease'
          }} className="upload-icon-container">
            <UploadCloud size={28} />
          </div>
          
          <div>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>
              Kéo & thả các file tối ưu Opera tại đây
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}> hoặc </span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--secondary)', textDecoration: 'underline' }}>
              duyệt file từ máy tính
            </span>
          </div>
          
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', maxWidth: '400px', lineHeight: '1.5' }}>
            Hỗ trợ chọn nhiều file định dạng Excel tối ưu nhôm (.xls, .xlsx) xuất từ Opera.
          </p>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                Danh sách file đã chọn ({files.length})
              </h3>
              
              {files.length > 0 && !previewData && (
                <button 
                  className="btn btn-primary"
                  onClick={(e) => handleProcess(e, false)}
                  disabled={loading}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  Gộp & Xem trước kết quả
                </button>
              )}
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '12px',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '4px'
            }}>
              {files.map((file, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <FileSpreadsheet size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatBytes(file.size)}
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => removeFile(idx)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Section & Action Download */}
      {previewData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                background: 'rgba(37, 60, 120, 0.08)', 
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Số mã nhôm gộp</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>
                  {previewData.summary.total_unique_codes} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>mã độc lập</span>
                </div>
              </div>
            </div>
            
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                background: 'rgba(45, 179, 75, 0.08)', 
                color: 'var(--secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={22} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng số thanh nhôm</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>
                  {previewData.summary.total_pieces.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>thanh nguyên</span>
                </div>
              </div>
            </div>
            
            <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                background: 'rgba(245, 158, 11, 0.08)', 
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Download size={22} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng khối lượng nhôm</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>
                  {previewData.summary.total_weight.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Preview Table & Download Button */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)' }}>
                  Bảng Xem trước Đơn Đặt hàng Tổng hợp
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Dưới đây là danh sách thanh nhôm chi tiết sau khi đã gộp và sắp xếp theo mã.
                </p>
              </div>
              
              <button 
                className="btn btn-primary"
                onClick={(e) => handleProcess(e, true)}
                disabled={loading}
                style={{ padding: '10px 20px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(45, 179, 75, 0.25)' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Tải file Excel Đặt hàng chính thức
              </button>
            </div>

            {/* Preview table */}
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', textAlign: 'center', width: '50px' }}>STT</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)' }}>Mã Nhôm</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)' }}>Mô Tả Vật Tư</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', textAlign: 'right' }}>Chiều Dài (mm)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', textAlign: 'center' }}>Màu Sắc</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', textAlign: 'right' }}>Số Lượng (Thanh)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', textAlign: 'right' }}>Khối Lượng (kg)</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)' }}>Nguồn Gốc Dự Án</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.items.map((item, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: 'var(--primary)' }}>{item.code}</td>
                      <td style={{ padding: '10px 16px', color: '#334155' }}>{item.description}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>{item.length.toLocaleString('vi-VN')}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{ 
                          background: item.color === 'Tiêu chuẩn' ? '#e2e8f0' : 'rgba(37, 60, 120, 0.08)',
                          color: item.color === 'Tiêu chuẩn' ? '#475569' : 'var(--primary)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {item.color}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>{item.pieces.toLocaleString('vi-VN')}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500', color: 'var(--text-main)' }}>
                        {item.total_weight.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.4' }}>
                        {Object.entries(item.sources || {}).map(([proj, pcs]) => (
                          <div key={proj}>{proj}: <strong style={{ color: '#475569' }}>{pcs as any}</strong> thanh</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Warning alert about rounding and specs */}
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              background: 'rgba(245, 158, 11, 0.05)', 
              border: '1px solid rgba(245, 158, 11, 0.15)', 
              color: '#b45309', 
              padding: '12px 16px', 
              borderRadius: '10px',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Lưu ý đối chiếu:</strong> Khối lượng hiển thị trên đây được tính dựa trên công thức lý thuyết <code>Số lượng * Chiều dài (m) * Đơn trọng (kg/m)</code>. File Excel tải về sẽ chứa 2 sheet: <strong>TONG HOP DAT HANG</strong> (sheet tổng hợp làm sạch để gửi nhà cung cấp) và <strong>CHI TIET NGUON</strong> (sheet chi tiết nguồn gốc để thủ kho đối chiếu vật tư khi nhập kho).
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

export default AluminumOrderModule;
