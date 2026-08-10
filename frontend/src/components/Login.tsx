import React, { useEffect, useState } from 'react';
import { KeyRound, User as UserIcon, UserPlus, Info } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  apiBase: string;
  onLogin: (user: User, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ apiBase, onLogin }) => {
  const [isRegisterInit, setIsRegisterInit] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/auth/setup-status`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể kiểm tra trạng thái khởi tạo.');
        return response.json();
      })
      .then((data) => {
        if (active) setNeedsInitialAdmin(Boolean(data.needs_initial_admin));
      })
      .catch(() => {
        if (active) setNeedsInitialAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [apiBase]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password || (isRegisterInit && !fullName)) {
      setError('Vui lòng điền đầy đủ tất cả các thông tin.');
      return;
    }
    if (isRegisterInit && username.trim().length < 3) {
      setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
      return;
    }
    if (isRegisterInit && password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegisterInit) {
        // Register initial admin
        const res = await fetch(`${apiBase}/auth/register-init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: password,
            name: fullName.trim(),
            role: 'admin'
          })
        });

        const data = await res.json();
        if (res.ok) {
          setSuccessMsg('Đăng ký tài khoản Admin thành công! Vui lòng chuyển sang tab Đăng nhập để truy cập hệ thống.');
          setIsRegisterInit(false);
          setNeedsInitialAdmin(false);
          setPassword('');
        } else {
          setError(data.detail || 'Lỗi đăng ký tài khoản Admin đầu tiên.');
        }
      } else {
        // Login
        const res = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: password
          })
        });

        const data = await res.json();
        if (res.ok) {
          // Store token and user details in localStorage
          localStorage.setItem('nova_token', data.access_token);
          localStorage.setItem('nova_user', JSON.stringify(data.user));
          onLogin(data.user, data.access_token);
        } else {
          setError(data.detail || 'Tài khoản hoặc mật khẩu không chính xác.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại dịch vụ backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_50%_0%,#edf2f9_0%,#e2e8f0_100%)]">
      <div className="glass-panel w-full max-w-[450px] p-10 flex flex-col gap-6 shadow-[0_20px_40px_rgba(37,60,120,0.12)] border border-[#253c78]/15">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <svg viewBox="0 0 32 32" width="60" height="60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M 16 2 L 28 8.5 L 16 15 L 4 8.5 Z" fill="#2db34b" />
            <path d="M 4 8.5 L 16 15 L 16 29 L 4 22.5 Z" fill="#253c78" />
            <path d="M 16 15 L 28 8.5 L 28 22.5 L 16 29 Z" fill="#a17549" />
          </svg>
          <div>
            <h2 className="text-[24px] font-[900] tracking-[1.5px] color-[var(--primary)] leading-normal">
              <span className="text-[#253c78]">NOVA</span><span className="text-[#177a32]">LAND</span>
            </h2>
            <div className="text-[11px] font-[700] text-slate-500 tracking-[1px] mt-1 uppercase">
              Hệ thống Dự toán Báo giá CIC
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        {needsInitialAdmin && <div className="flex gap-2 bg-slate-100 p-1 rounded-[10px]">
          <button 
            type="button" 
            className={`btn flex-1 py-2 text-[13px] border-none transition-all ${
              !isRegisterInit 
                ? 'bg-white text-[#253c78] shadow-[0_2px_6px_rgba(0,0,0,0.05)] font-semibold' 
                : 'bg-transparent text-slate-500 hover:text-[#253c78]'
            }`}
            onClick={() => { setIsRegisterInit(false); setError(''); setSuccessMsg(''); }}
          >
            Đăng nhập
          </button>
          <button 
            type="button" 
            className={`btn flex-1 py-2 text-[13px] border-none transition-all ${
              isRegisterInit 
                ? 'bg-white text-[#253c78] shadow-[0_2px_6px_rgba(0,0,0,0.05)] font-semibold' 
                : 'bg-transparent text-slate-500 hover:text-[#253c78]'
            }`}
            onClick={() => { setIsRegisterInit(true); setError(''); setSuccessMsg(''); }}
          >
            Khởi tạo Admin
          </button>
        </div>}

        {/* Info alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200/80 text-red-600 px-4 py-3 rounded-[10px] text-[13px] leading-relaxed">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200/80 text-green-600 px-4 py-3 rounded-[10px] text-[13px] leading-relaxed">
            {successMsg}
          </div>
        )}

        {isRegisterInit && (
          <div className="bg-[#253c78]/5 border border-[#253c78]/15 text-[#253c78] px-4 py-3 rounded-[10px] text-[12px] leading-relaxed flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>Chức năng Khởi tạo chỉ khả dụng khi cơ sở dữ liệu trống, dùng để đăng ký tài khoản quản trị Admin đầu tiên.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          
          {isRegisterInit && (
            <div className="flex flex-col">
              <label htmlFor="full-name" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Họ và tên *</label>
              <div className="relative">
                <UserPlus size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <input 
                  id="full-name"
                  type="text" 
                  placeholder="Ví dụ: Nguyễn Văn A" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-[#2db34b] focus:ring-1 focus:ring-[#253c78] dark:focus:ring-[#2db34b] transition-all text-sm shadow-sm"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <label htmlFor="username" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Tên đăng nhập *</label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input 
                id="username"
                type="text" 
                placeholder="Nhập tên tài khoản..." 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-[#2db34b] focus:ring-1 focus:ring-[#253c78] dark:focus:ring-[#2db34b] transition-all text-sm shadow-sm"
                required
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Mật khẩu *</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input 
                id="password"
                type="password" 
                placeholder="Nhập mật khẩu..." 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-[#2db34b] focus:ring-1 focus:ring-[#253c78] dark:focus:ring-[#2db34b] transition-all text-sm shadow-sm"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-3.5 mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#253c78] to-[#177a32] text-white rounded-lg font-semibold text-sm hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : (isRegisterInit ? 'Khởi tạo tài khoản' : 'Đăng nhập hệ thống')}
          </button>

        </form>
      </div>
    </main>
  );
};

export default Login;
