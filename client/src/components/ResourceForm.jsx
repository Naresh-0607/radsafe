import { useState } from 'react';
import { Modal } from './UI';
export default function ResourceForm({ title, fields, initial = {}, onSave, onClose }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? f.default ?? ''])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <form onSubmit={submit}>
        <div className="modal-body form-grid">
          {error && (
            <div className="error-box span-two" role="alert">
              {error}
            </div>
          )}
          {fields.map((field) => (
            <label key={field.name} className={field.wide ? 'span-two' : ''}>
              {field.label}
              {field.required && <span className="required"> *</span>}
              {field.type === 'select' ? (
                <select
                  aria-label={field.label}
                  required={field.required}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                >
                  <option value="">{field.placeholder || 'Select an option'}</option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  maxLength={field.maxLength || 2000}
                  rows={3}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  maxLength={field.maxLength || 200}
                  minLength={field.minLength}
                  autoComplete={field.type === 'password' ? 'new-password' : undefined}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                />
              )}
              {field.hint && <small>{field.hint}</small>}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
