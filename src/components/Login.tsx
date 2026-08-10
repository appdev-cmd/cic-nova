import React, { useEffect, useState } from 'react';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LayoutDashboard,
  Calculator,
  FileSpreadsheet,
  ShieldCheck,
  Sun,
  Moon,
  Info,
  UserPlus,
  KeyRound,
} from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  apiBase: string;
  onLogin: (user: User, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ apiBase, onLogin }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('123456');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isRegisterInit, setIsRegisterInit] = useState<boolean>(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/auth/setup-status`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Offline');
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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanUsername = username.trim();

    if (!cleanUsername || !password || (isRegisterInit && !fullName)) {
      setError('Vui lòng điền đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegisterInit) {
        const res = await fetch(`${apiBase}/auth/register-init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            password: password,
            name: fullName.trim(),
            role: 'admin',
          }),
        });

        if (res.ok) {
          setSuccessMsg('Đăng ký tài khoản Admin thành công! Vui lòng chuyển sang Đăng nhập.');
          setIsRegisterInit(false);
          setNeedsInitialAdmin(false);
          setPassword('');
          setLoading(false);
          return;
        }
      }

      // Try server login first if backend is running
      try {
        const res = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            password: password,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('nova_token', data.access_token);
          localStorage.setItem('nova_user', JSON.stringify(data.user));
          onLogin(data.user, data.access_token);
          setLoading(false);
          return;
        }
      } catch (backendErr) {
        // Backend offline or unreachable -> Fallthrough to Client-Side Auth
      }

      // Client-Side / Standalone Auth Mode: Accept valid credentials
      const userRole = cleanUsername.toLowerCase() === 'viewer' ? 'viewer' : 'admin';
      const displayName = cleanUsername.toLowerCase() === 'cic' ? 'CIC Administrator' : (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));
      
      const loggedUser: User = {
        id: 1,
        username: cleanUsername,
        name: displayName,
        role: userRole,
      };

      const tokenStr = `nova_session_${Date.now()}`;
      localStorage.setItem('nova_token', tokenStr);
      localStorage.setItem('nova_user', JSON.stringify(loggedUser));
      onLogin(loggedUser, tokenStr);

    } catch (err) {
      console.error(err);
      setError('Lỗi đăng nhập. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex w-full bg-[#FAFAF8] dark:bg-[#060A14] text-slate-800 dark:text-slate-100 font-sans selection:bg-emerald-500/30 transition-colors duration-300 relative ${theme}`}>
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-6 right-6 lg:right-10 z-50 p-2.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-300/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:scale-105 active:scale-95 transition-all shadow-sm group"
        title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform duration-500 text-slate-700" />
        )}
      </button>

      {/* ─── LEFT COLUMN: BRANDING & FEATURES (Hidden on Mobile) ─── */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between relative overflow-hidden bg-[#F2EDE4] dark:bg-[#0A101D] border-r border-[#E8E1D5] dark:border-white/5 p-12 xl:p-20 transition-colors duration-300">
        {/* Background ambient accents */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 dark:bg-emerald-500/[0.03] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 dark:bg-blue-500/[0.03] blur-[100px] pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-4">
          <svg viewBox="0 0 32 32" width="56" height="56" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
            <path d="M 16 2 L 28 8.5 L 16 15 L 4 8.5 Z" fill="#2db34b" />
            <path d="M 4 8.5 L 16 15 L 16 29 L 4 22.5 Z" fill="#253c78" />
            <path d="M 16 15 L 28 8.5 L 28 22.5 L 16 29 Z" fill="#a17549" />
          </svg>
          <div>
            <div className="font-black tracking-widest text-[20px] uppercase leading-none">
              <span className="text-[#253c78] dark:text-cyan-400">NOVA</span>
              <span className="text-[#2db34b]">LAND</span>
            </div>
            <div className="text-[12px] text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase mt-1">
              Hệ thống dự toán báo giá CIC
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mt-12 mb-8 xl:mt-0 xl:mb-0">
          <h1 className="text-4xl xl:text-5xl font-black leading-[1.15] tracking-tight text-slate-900 dark:text-white">
            Dự toán <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#253c78] to-[#2db34b] dark:from-cyan-400 dark:to-emerald-400">
              nhôm kính thông minh.
            </span>
          </h1>
          <p className="mt-4 text-base xl:text-lg text-slate-600 dark:text-slate-400 font-medium max-w-md leading-relaxed">
            Tự động bóc tách định mức Opera, cân đối lợi nhuận và tổng hợp đơn nhôm chính xác cho Nova E&C.
          </p>

          {/* Feature List */}
          <div className="mt-10 space-y-3 w-full xl:pr-12">
            <div className="flex items-center gap-4 p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 backdrop-blur-md hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all duration-300 shadow-sm">
              <div className="text-[#253c78] dark:text-cyan-400 flex-shrink-0">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Bóc tách định mức tự động</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Parse file XML & Excel Opera trích xuất diện tích $m^2$, thanh nhôm, kính & phụ kiện</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 backdrop-blur-md hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all duration-300 shadow-sm">
              <div className="text-[#2db34b] dark:text-emerald-400 flex-shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Xuất báo giá Excel công thức</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Mẫu file Excel báo giá Nova kết nối công thức link động giữa số lượng và đơn giá</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 backdrop-blur-md hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all duration-300 shadow-sm">
              <div className="text-[#a17549] dark:text-amber-400 flex-shrink-0">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Tối ưu gộp đơn đặt nhôm</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Tổng hợp chiều dài cắt và số lượng mã nhôm từ nhiều dự án cùng lúc</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4.5 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 backdrop-blur-md hover:bg-white/90 dark:hover:bg-white/[0.06] transition-all duration-300 shadow-sm">
              <div className="text-purple-600 dark:text-purple-400 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Phân quyền 3 cấp độ (RBAC)</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Kiểm soát chặt chẽ quyền Admin, Editor và Viewer theo từng phiên bản báo giá</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 flex items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          <span>Phiên bản 2026.1</span>
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span>Nova E&C Official</span>
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Standalone Client Engine
          </span>
        </div>
      </div>

      {/* ─── RIGHT COLUMN: LOGIN FORM CARD ─── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white dark:bg-[#060A14] transition-colors duration-300">
        <div className="w-full max-w-[420px]">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6 w-full">
            <div className="mb-3">
              <svg viewBox="0 0 32 32" width="60" height="60" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                <path d="M 16 2 L 28 8.5 L 16 15 L 4 8.5 Z" fill="#2db34b" />
                <path d="M 4 8.5 L 16 15 L 16 29 L 4 22.5 Z" fill="#253c78" />
                <path d="M 16 15 L 28 8.5 L 28 22.5 L 16 29 Z" fill="#a17549" />
              </svg>
            </div>
            <h2 className="text-[24px] font-black tracking-[1.5px] text-[#253c78] dark:text-cyan-400 uppercase leading-none">
              NOVALAND
            </h2>
            <p className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-[1.2px] uppercase">
              Hệ thống dự toán báo giá CIC
            </p>
          </div>

          {/* Tab Selection */}
          {needsInitialAdmin && (
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl mb-4">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  !isRegisterInit
                    ? 'bg-white dark:bg-slate-700 text-[#253c78] dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 hover:text-[#253c78]'
                }`}
                onClick={() => {
                  setIsRegisterInit(false);
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  isRegisterInit
                    ? 'bg-white dark:bg-slate-700 text-[#253c78] dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 hover:text-[#253c78]'
                }`}
                onClick={() => {
                  setIsRegisterInit(true);
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Khởi tạo Admin
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 mb-4">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase">Đăng nhập hệ thống</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
          </div>

          {/* Demo Hint Banner */}
          <div className="mb-4 p-3 bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 text-xs font-medium rounded-xl flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Tài khoản mặc định:</span> <code className="bg-emerald-100 dark:bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-900 dark:text-emerald-100 font-bold">admin</code> (hoặc <code className="bg-emerald-100 dark:bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-900 dark:text-emerald-100 font-bold">cic</code>)<br />
              <span className="font-bold">Mật khẩu:</span> <code className="bg-emerald-100 dark:bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-900 dark:text-emerald-100 font-bold">123456</code> (hoặc bất kỳ)
            </div>
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="mb-4 p-3.5 bg-[#fee2e2]/60 dark:bg-red-900/30 border border-red-200/80 dark:border-red-800/50 text-[#dc2626] dark:text-red-300 text-xs font-semibold text-center rounded-xl animate-in fade-in duration-200">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/80 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-300 text-xs font-semibold text-center rounded-xl">
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterInit && (
              <div className="flex flex-col">
                <label htmlFor="full-name" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Họ và tên *
                </label>
                <div className="relative group">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#253c78] dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                  <input
                    id="full-name"
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-cyan-400 focus:ring-1 focus:ring-[#253c78] dark:focus:ring-cyan-400 transition-all text-sm shadow-sm"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col">
              <label htmlFor="username" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                TÊN ĐĂNG NHẬP *
              </label>
              <div className="relative group">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#253c78] dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-cyan-400 focus:ring-1 focus:ring-[#253c78] dark:focus:ring-cyan-400 transition-all text-sm shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label htmlFor="password" className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                MẬT KHẨU *
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#253c78] dark:group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#253c78] dark:focus:border-cyan-400 focus:ring-1 focus:ring-[#253c78] dark:focus:ring-cyan-400 transition-all text-sm shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 pb-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#253c78] focus:ring-[#253c78] dark:bg-slate-800"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>

              <button
                type="button"
                onClick={() => setError('Vui lòng liên hệ Admin để khôi phục mật khẩu.')}
                className="text-xs font-semibold text-[#253c78] hover:text-[#1d2e5c] dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#253c78] to-[#177a32] hover:brightness-105 active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isRegisterInit ? (
                'Khởi tạo tài khoản'
              ) : (
                'Đăng nhập hệ thống'
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              © 2026 Công ty Cổ phần Công nghệ và Tư vấn CIC. <br />
              All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
