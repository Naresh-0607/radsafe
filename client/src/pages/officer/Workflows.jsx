import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useOptions } from '../../hooks/useOptions';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader,
  Table,
  Badge,
  Loading,
  ErrorState,
  Pagination,
  SearchBox,
  Modal,
  DateFilters,
  queryString,
  dateTime,
  humanize,
} from '../../components/UI';
const inspectionTransitions = {
  PENDING: ['PENDING', 'IN_PROGRESS'],
  IN_PROGRESS: ['IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'],
  ACTION_REQUIRED: ['ACTION_REQUIRED', 'IN_PROGRESS', 'COMPLETED'],
  COMPLETED: ['COMPLETED'],
};
const incidentTransitions = {
  OPEN: ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED'],
  INVESTIGATING: ['INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED'],
  ACTION_REQUIRED: ['ACTION_REQUIRED', 'INVESTIGATING', 'RESOLVED'],
  RESOLVED: ['RESOLVED'],
};
export default function Workflows({ kind }) {
  const inspection = kind === 'inspections';
  const [params, setParams] = useSearchParams();
  const linked = params.get('alert');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    zone: '',
    from: '',
    to: '',
    page: 1,
  });
  const [editing, setEditing] = useState(
    linked && !inspection ? { relatedAlert: linked, zone: params.get('zone') } : null,
  );
  const [detail, setDetail] = useState(null);
  const data = useApi('/' + kind + '?' + queryString(filters));
  const zones = useOptions('/zones');
  const alerts = useOptions('/alerts');
  const toast = useToast();
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const codeKey = inspection ? 'inspectionCode' : 'incidentCode';
  const statuses = inspection
    ? Object.keys(inspectionTransitions)
    : Object.keys(incidentTransitions);
  const columns = [
    {
      key: codeKey,
      label: inspection ? 'INSPECTION' : 'INCIDENT',
      render: (r) => (
        <div>
          <strong className="mono">{r[codeKey]}</strong>
          {!inspection && <small className="cell-sub">{r.title}</small>}
        </div>
      ),
    },
    { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name },
    {
      key: inspection ? 'officer' : 'severity',
      label: inspection ? 'OFFICER' : 'SEVERITY',
      render: (r) =>
        inspection ? r.officer?.name || 'Deleted account' : <Badge value={r.severity} />,
    },
    { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
    { key: 'createdAt', label: 'CREATED', render: (r) => dateTime(r.createdAt) },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (r) => (
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label={'View ' + r[codeKey]}
            onClick={() => setDetail(r)}
          >
            <Eye size={16} />
          </button>
          {!['COMPLETED', 'RESOLVED'].includes(r.status) && (
            <button
              className="icon-button"
              aria-label={'Edit ' + r[codeKey]}
              onClick={() => setEditing(r)}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];
  function close() {
    setEditing(null);
    if (linked) setParams({}, { replace: true });
  }
  async function save(body) {
    if (editing._id) await api.put('/' + kind + '/' + editing._id, body);
    else await api.post('/' + kind, body);
    close();
    data.refresh();
    toast(inspection ? 'Inspection saved' : 'Incident saved');
  }
  return (
    <>
      <PageHeader
        eyebrow="SAFETY OPERATIONS"
        title={inspection ? 'Safety inspections' : 'Incident management'}
        description={
          inspection
            ? 'Document zone inspections, checklist findings, and corrective actions.'
            : 'Track investigations and corrective actions through to resolution.'
        }
      >
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={17} />
          {inspection ? 'Create inspection' : 'Create incident'}
        </button>
      </PageHeader>
      {(zones.error || (!inspection && alerts.error)) && (
        <div className="error-box">{zones.error || alerts.error}</div>
      )}
      <section className="panel">
        <div className="toolbar wrap">
          <SearchBox
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder={
              inspection ? 'Search inspection code or remarks…' : 'Search incident code or title…'
            }
          />
          <select
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter zone"
            value={filters.zone}
            onChange={(e) => setFilter('zone', e.target.value)}
          >
            <option value="">All zones</option>
            {zones.items.map((z) => (
              <option key={z._id} value={z._id}>
                {z.name}
              </option>
            ))}
          </select>
          <DateFilters filters={filters} setFilter={setFilter} />
        </div>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState message={data.error} retry={data.refresh} />
        ) : (
          <>
            <Table columns={columns} items={data.data.items} />
            <Pagination data={data.data} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </section>
      {editing && (
        <WorkflowForm
          key={editing._id || 'new'}
          inspection={inspection}
          initial={editing}
          zones={zones.items}
          alerts={alerts.items}
          onClose={close}
          onSave={save}
        />
      )}
      {detail && (
        <Modal
          title={detail[codeKey]}
          description={inspection ? 'Inspection record' : 'Incident record'}
          wide
          onClose={() => setDetail(null)}
        >
          <div className="modal-body">
            <div className="inline-badges">
              <Badge value={detail.status} />
              {!inspection && <Badge value={detail.severity} />}
            </div>
            <dl className="detail-grid">
              <dt>Zone</dt>
              <dd>{detail.zone?.name}</dd>
              <dt>{inspection ? 'Officer' : 'Created by'}</dt>
              <dd>{(inspection ? detail.officer : detail.createdBy)?.name || 'Deleted account'}</dd>
              <dt>Created</dt>
              <dd>{dateTime(detail.createdAt)}</dd>
              <dt>{inspection ? 'Completed' : 'Resolved'}</dt>
              <dd>{dateTime(inspection ? detail.completedAt : detail.resolvedAt)}</dd>
            </dl>
            {inspection ? (
              <>
                <h3>Checklist</h3>
                {detail.checklist.map((item, i) => (
                  <div className="checklist-detail" key={i}>
                    <Badge
                      value={
                        item.passed === null ? 'NOT_CHECKED' : item.passed ? 'PASSED' : 'FAILED'
                      }
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.remarks || 'No remarks'}</p>
                    </div>
                  </div>
                ))}
                <h3 className="mt">Remarks</h3>
                <p className="preserve-text">{detail.remarks || 'No remarks'}</p>
              </>
            ) : (
              <>
                <h3>{detail.title}</h3>
                <p className="preserve-text">{detail.description}</p>
                <h3 className="mt">Related alert</h3>
                <p>{detail.relatedAlert?.alertCode || 'None'}</p>
              </>
            )}
            <h3 className="mt">Corrective action</h3>
            <p className="preserve-text">{detail.correctiveAction || 'None recorded'}</p>
            {!inspection && (
              <>
                <h3 className="mt">Resolution notes</h3>
                <p className="preserve-text">{detail.resolutionNotes || 'None recorded'}</p>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
function WorkflowForm({ inspection, initial, zones, alerts, onClose, onSave }) {
  const [form, setForm] = useState({
    zone: initial.zone?._id || initial.zone || '',
    status: initial.status || (inspection ? 'PENDING' : 'OPEN'),
    remarks: initial.remarks || '',
    correctiveAction: initial.correctiveAction || '',
    title: initial.title || '',
    description: initial.description || '',
    relatedAlert: initial.relatedAlert?._id || initial.relatedAlert || '',
    severity: initial.severity || 'WARNING',
    resolutionNotes: initial.resolutionNotes || '',
    checklist:
      initial.checklist?.map(({ label, passed, remarks }) => ({ label, passed, remarks })) ||
      [
        'Area access and signage reviewed',
        'Monitoring equipment visually checked',
        'Protective equipment reviewed',
        'Housekeeping and storage reviewed',
      ].map((label) => ({ label, passed: null, remarks: '' })),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === 'zone' ? { relatedAlert: '' } : {}) }));
  const allowed = initial._id
    ? (inspection ? inspectionTransitions : incidentTransitions)[initial.status]
    : inspection
      ? ['PENDING', 'IN_PROGRESS']
      : ['OPEN'];
  function setItem(index, key, value) {
    setForm((f) => ({
      ...f,
      checklist: f.checklist.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = inspection
      ? {
          zone: form.zone,
          status: form.status,
          remarks: form.remarks,
          correctiveAction: form.correctiveAction,
          checklist: form.checklist,
        }
      : {
          zone: form.zone,
          status: form.status,
          title: form.title,
          description: form.description,
          relatedAlert: form.relatedAlert || null,
          severity: form.severity,
          correctiveAction: form.correctiveAction,
          resolutionNotes: form.resolutionNotes,
        };
    try {
      await onSave(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={(initial._id ? 'Update ' : 'Create ') + (inspection ? 'inspection' : 'incident')}
      description={
        inspection
          ? 'Academic inspection checklist; adapt labels to your coursework.'
          : 'Document the event and its investigation.'
      }
      wide
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="modal-body form-grid">
          {error && (
            <div className="error-box span-two" role="alert">
              {error}
            </div>
          )}
          <label>
            Zone
            <select
              aria-label="Zone"
              required
              disabled={!!initial._id}
              value={form.zone}
              onChange={(e) => set('zone', e.target.value)}
            >
              <option value="">Select zone</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {allowed.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          </label>
          {inspection ? (
            <>
              <div className="span-two checklist-editor">
                <div className="section-heading">
                  <h3>Inspection checklist</h3>
                  <button
                    type="button"
                    className="text-link"
                    disabled={form.checklist.length >= 40}
                    onClick={() =>
                      set('checklist', [
                        ...form.checklist,
                        { label: '', passed: null, remarks: '' },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Add item
                  </button>
                </div>
                {form.checklist.map((item, index) => (
                  <div className="checklist-item" key={index}>
                    <div className="checklist-line">
                      <input
                        aria-label={'Checklist item ' + (index + 1)}
                        required
                        maxLength={200}
                        value={item.label}
                        onChange={(e) => setItem(index, 'label', e.target.value)}
                      />
                      <select
                        aria-label={'Result for item ' + (index + 1)}
                        value={item.passed === null ? '' : String(item.passed)}
                        onChange={(e) =>
                          setItem(
                            index,
                            'passed',
                            e.target.value === '' ? null : e.target.value === 'true',
                          )
                        }
                      >
                        <option value="">Not checked</option>
                        <option value="true">Pass</option>
                        <option value="false">Fail</option>
                      </select>
                      <button
                        className="icon-button destructive"
                        type="button"
                        disabled={form.checklist.length === 1}
                        aria-label={'Remove item ' + (index + 1)}
                        onClick={() =>
                          set(
                            'checklist',
                            form.checklist.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <input
                      aria-label={'Remarks for item ' + (index + 1)}
                      placeholder={
                        item.passed === false
                          ? 'Explain this failed item (required)'
                          : 'Item remarks (optional)'
                      }
                      required={item.passed === false}
                      maxLength={1000}
                      value={item.remarks}
                      onChange={(e) => setItem(index, 'remarks', e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <label className="span-two">
                Inspection remarks
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.remarks}
                  onChange={(e) => set('remarks', e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="span-two">
                Incident title
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </label>
              <label className="span-two">
                Description / investigation
                <textarea
                  required
                  rows={4}
                  maxLength={4000}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </label>
              <label>
                Severity
                <select
                  aria-label="Severity"
                  value={form.severity}
                  onChange={(e) => set('severity', e.target.value)}
                >
                  {['LOW', 'WARNING', 'CRITICAL'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Related alert (optional)
                <select
                  aria-label="Related alert (optional)"
                  value={form.relatedAlert}
                  onChange={(e) => set('relatedAlert', e.target.value)}
                >
                  <option value="">No linked alert</option>
                  {alerts
                    .filter((a) => a.zone?._id === form.zone)
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.alertCode} · {a.severity}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <label className="span-two">
            Corrective action
            <textarea
              rows={3}
              maxLength={2000}
              value={form.correctiveAction}
              onChange={(e) => set('correctiveAction', e.target.value)}
            />
          </label>
          {!inspection && (
            <label className="span-two">
              Resolution notes
              <textarea
                rows={3}
                maxLength={2000}
                value={form.resolutionNotes}
                onChange={(e) => set('resolutionNotes', e.target.value)}
              />
            </label>
          )}
          <p className="form-note span-two">
            {inspection
              ? 'Start a pending inspection before completing it. Assess every item and document corrective action for failures.'
              : 'Investigate an open incident before resolving it. Resolution requires corrective action and resolution notes.'}
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save ' + (inspection ? 'inspection' : 'incident')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
