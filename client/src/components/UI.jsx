import { useEffect, useRef } from 'react';
import { X, Search, Inbox, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
export const humanize = (value) =>
  (value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const dateTime = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const number = (value) =>
  value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
export function Badge({ value }) {
  return (
    <span className={'badge badge-' + (value || 'UNKNOWN').toLowerCase()}>
      <span />
      {humanize(value || 'No data')}
    </span>
  );
}
export function PageHeader({ eyebrow = 'FACILITY WORKSPACE', title, description, children }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      Loading workspace data…
    </div>
  );
}
export function Empty({
  title = 'No records yet',
  message = 'Records will appear here when they are added.',
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="error-state" role="alert">
      <strong>Unable to load data</strong>
      <p>{message}</p>
      {retry && (
        <button className="btn secondary" onClick={retry}>
          <RefreshCw size={16} />
          Try again
        </button>
      )}
    </div>
  );
}
export function Table({ columns, items, rowKey = '_id', emptyMessage }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <Empty message={emptyMessage} />}
    </div>
  );
}
export function Pagination({ data, onPage }) {
  if (!data) return null;
  return (
    <div className="pagination">
      <span>
        {data.total} record{data.total !== 1 ? 's' : ''} · Page {data.page} of {data.pages}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={data.page >= data.pages}
          onClick={() => onPage(data.page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder = 'Search records…' }) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Modal({ title, description, children, onClose, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const cancel = (event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.close();
    };
  }, []);
  return (
    <dialog className={'modal ' + (wide ? 'wide' : '')} ref={ref} aria-labelledby="modal-title">
      <div className="modal-head">
        <div>
          <h2 id="modal-title">{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({ title, message, busy, onClose, onConfirm, destructive = false }) {
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <div className="modal-body">
        <p>{message}</p>
      </div>
      <div className="modal-actions">
        <button className="btn secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className={'btn ' + (destructive ? 'danger' : 'primary')}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Please wait…' : 'Confirm'}
        </button>
      </div>
    </Modal>
  );
}
export function StatCard({ label, value, icon: Icon, note, tone = 'teal' }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={'stat-icon ' + tone}>{Icon && <Icon size={20} />}</span>
      </div>
      <strong className="stat-value">{value ?? '—'}</strong>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
export function DateFilters({ filters, setFilter }) {
  return (
    <>
      <label className="filter-label">
        From
        <input
          type="date"
          value={filters.from || ''}
          onChange={(e) => setFilter('from', e.target.value)}
        />
      </label>
      <label className="filter-label">
        To
        <input
          type="date"
          min={filters.from || undefined}
          value={filters.to || ''}
          onChange={(e) => setFilter('to', e.target.value)}
        />
      </label>
    </>
  );
}
export const queryString = (values) =>
  new URLSearchParams(
    Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null)),
  ).toString();
