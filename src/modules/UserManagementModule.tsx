import React, { useState, useEffect } from 'react';
import { createApiFetch } from '../api';
import * as sb from '../services/supabaseService';
import { Plus, Search, Trash2, Edit, X, RefreshCw, Shield } from 'lucide-react';
import { User } from '../types';
import { useFeedback } from '../components/FeedbackProvider';

interface UserManagementModuleProps {
  apiBase: string;
  token: string;
  currentUser: User;
}

const UserManagementModule: React.FC<UserManagementModuleProps> = ({ apiBase, token, currentUser }) => {
  const fetch = createApiFetch(token);
  const { notify, confirmAction } = useFeedback();
  const alert = notify;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  // New user form state
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: 'viewer' as 'admin' | 'editor' | 'viewer'
  });

  // Edit user form state
  const [editUser, setEditUser] = useState({
    id: 0,
    username: '',
    name: '',
    role: 'viewer' as 'admin' | 'editor' | 'viewer',
    password: '' // Optional for reset
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await sb.getUsers();
      setUsers(data);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.name) return;
    if (newUser.username.trim().length < 3) {
      alert('Tên đăng nhập phải có ít nhất 3 ký tự.');
      return;
    }
    if (newUser.password.length < 8) {
      alert('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    try {
      await sb.createUser({
        username: newUser.username.trim(),
        password: newUser.password,
        name: newUser.name.trim(),
        role: newUser.role
      });
      alert("Đã tạo người dùng mới thành công!");
      setShowAddModal(false);
      setNewUser({ username: '', password: '', name: '', role: 'viewer' });
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      alert(`Lỗi khi tạo người dùng: ${e.message}`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editUser.name) return;
    if (editUser.password && editUser.password.length < 8) {
      alert('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    try {
      const updates: any = {
        name: editUser.name.trim(),
        role: editUser.role
      };
      if (editUser.password) updates.password = editUser.password;

      await sb.updateUser(editUser.id, updates);
      alert("Cập nhật thông tin tài khoản thành công!");
      setShowEditModal(false);
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      alert(`Lỗi khi cập nhật tài khoản: ${e.message}`);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser.id) {
      alert("Bạn không thể tự xóa tài khoản của chính mình!");
      return;
    }

    if (!await confirmAction(`Bạn có chắc chắn muốn xóa tài khoản: ${user.username} (${user.name})?`)) return;

    try {
      await sb.deleteUser(user.id);
      alert("Đã xóa tài khoản thành công!");
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      alert(`Lỗi khi xóa tài khoản: ${e.message}`);
    }
  };

  const openEditModal = (user: User) => {
    setEditUser({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      password: ''
    });
    setShowEditModal(true);
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'admin':
        return <span className="badge badge-primary"><Shield size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Admin</span>;
      case 'editor':
        return <span className="badge badge-warning">Editor</span>;
      default:
        return <span className="badge badge-secondary">Viewer</span>;
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const filteredUsers = safeUsers.filter(u => 
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px' }}>Quản lý Người dùng & Phân quyền</h1>
          <p style={{ color: 'var(--text-muted)' }}>Tạo tài khoản và cấp quyền truy cập hệ thống cho các kỹ sư, nhân viên báo giá.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Tải lại
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Thêm Người dùng
          </button>
        </div>
      </div>

      {/* Filters and search section */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc tài khoản..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: '0' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Tên tài khoản</th>
                <th>Họ và tên</th>
                <th style={{ width: '150px' }}>Vai trò quyền hạn</th>
                <th style={{ width: '180px' }}>Ngày khởi tạo</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{u.username}</td>
                  <td style={{ fontWeight: '500' }}>{u.name}</td>
                  <td>{getRoleBadge(u.role)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleString('vi-VN') : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => openEditModal(u)} title="Sửa thông tin">
                        <Edit size={14} />
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px' }} 
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentUser.id}
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Tạo tài khoản người dùng mới</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div>
                  <label className="form-label">Tên tài khoản *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: kithuat.nova" 
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Họ và tên nhân viên *</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Nguyễn Văn A" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Mật khẩu ban đầu *</label>
                  <input 
                    type="password" 
                    minLength={8}
                    placeholder="Nhập mật khẩu..." 
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Vai trò quyền hạn</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="form-control"
                  >
                    <option value="viewer">Viewer (Chỉ xem và xuất báo giá)</option>
                    <option value="editor">Editor (Thêm/sửa dự án, công thức, vật tư)</option>
                    <option value="admin">Admin (Toàn quyền quản trị hệ thống)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Cập nhật tài khoản</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div>
                  <label className="form-label">Tên tài khoản</label>
                  <input 
                    type="text" 
                    value={editUser.username}
                    className="form-control"
                    disabled
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    * Không thể thay đổi tên đăng nhập của tài khoản.
                  </span>
                </div>

                <div>
                  <label className="form-label">Họ và tên nhân viên *</label>
                  <input 
                    type="text" 
                    value={editUser.name}
                    onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Mật khẩu mới (Để trống nếu không đổi)</label>
                  <input 
                    type="password" 
                    minLength={8}
                    placeholder="Nhập mật khẩu mới..." 
                    value={editUser.password}
                    onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                    className="form-control"
                  />
                </div>

                <div>
                  <label className="form-label">Vai trò quyền hạn</label>
                  <select 
                    value={editUser.role}
                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value as any })}
                    className="form-control"
                    disabled={editUser.id === currentUser.id}
                  >
                    <option value="viewer">Viewer (Chỉ xem và xuất báo giá)</option>
                    <option value="editor">Editor (Thêm/sửa dự án, công thức, vật tư)</option>
                    <option value="admin">Admin (Toàn quyền quản trị hệ thống)</option>
                  </select>
                  {editUser.id === currentUser.id && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      * Bạn không thể tự thay đổi quyền hạn của chính mình.
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementModule;
