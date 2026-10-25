import { createContext, useContext, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
const Context = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  function toast(message, type = 'success') {
    const id = crypto.randomUUID();
    setToasts((old) => [...old, { id, message, type }]);
    setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 6000);
  }
  return (
    <Context.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.type}`} key={t.id}>
            {t.type === 'success' ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
            <span>{t.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToasts((old) => old.filter((x) => x.id !== t.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
