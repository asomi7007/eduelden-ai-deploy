import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token'));

  const login = useCallback(async (password) => {
    // 인증 검증은 헬스체크 엔드포인트 사용 (Log Analytics 의존 제거)
    const res = await fetch('/api/dashboard/admin/system/health', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': password,
      },
    });

    if (res.status === 401) {
      throw new Error('비밀번호가 올바르지 않습니다.');
    }

    if (!res.ok) {
      throw new Error('서버 오류가 발생했습니다.');
    }

    sessionStorage.setItem('admin_token', password);
    setToken(password);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('admin_token');
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
