import axios from 'axios';
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('radsafe-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login'))
      window.dispatchEvent(new Event('radsafe-session-expired'));
    return Promise.reject(
      new Error(
        error.response?.data?.message ||
          (error.code === 'ECONNABORTED'
            ? 'The request timed out. Please try again.'
            : 'Cannot reach the API. Check that the server is running.'),
      ),
    );
  },
);
