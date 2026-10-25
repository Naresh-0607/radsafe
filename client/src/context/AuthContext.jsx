import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const clear = () => {
    sessionStorage.removeItem('radsafe-token');
    setUser(null);
  };
  useEffect(() => {
    const expired = () => {
      clear();
      setMessage('Your session ended. Please sign in again.');
    };
    window.addEventListener('radsafe-session-expired', expired);
    if (sessionStorage.getItem('radsafe-token'))
      api
        .get('/auth/me')
        .then(setUser)
        .catch((error) => {
          clear();
          setMessage(error.message);
        })
        .finally(() => setLoading(false));
    else setLoading(false);
    return () => window.removeEventListener('radsafe-session-expired', expired);
  }, []);
  useEffect(() => {
    if (!user) return;
    try {
      const token = sessionStorage.getItem('radsafe-token');
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const timer = setTimeout(
        () => {
          clear();
          setMessage('Your session expired. Please sign in again.');
        },
        Math.min(Math.max(payload.exp * 1000 - Date.now(), 0), 2147483647),
      );
      return () => clearTimeout(timer);
    } catch {
      clear();
    }
  }, [user]);
  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('radsafe-token', data.token);
    setUser(data.user);
    setMessage('');
    return data.user;
  }
  async function logout() {
    await api.post('/auth/logout');
    clear();
    setMessage('You have been signed out.');
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, message }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
