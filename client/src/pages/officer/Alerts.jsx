import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, CheckCheck, Check, RefreshCw } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useOptions } from '../../hooks/useOptions';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  PageHeader,
  Table,
  Badge,
  SearchBox,
  Loading,
  ErrorState,
  Pagination,
  ConfirmDialog,
  Modal,
  queryString,
  dateTime,
  humanize,
  DateFilters,
} from '../../components/UI';
export default function Alerts() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    zone: '',
    severity: '',
    from: '',
    to: '',
    page: 1,
  });
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const data = useApi('/alerts?' + queryString(filters));
  const zones = useOptions('/zones');
  const toast = useToast();
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  async function act() {
    setBusy(true);
    try {
      await api.patch('/alerts/' + confirm.row._id + '/' + confirm.action, {});
      toast('Alert ' + (confirm.action === 'resolve' ? 'resolved' : 'acknowledged'));
      setConfirm(null);
      setDetail(null);
      data.refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const actions = (r) => (
    <div className="row-actions">
      <button
        className="icon-button"
        title="Investigate alert"
        aria-label={'Investigate ' + r.alertCode}
        onClick={() => setDetail(r)}
      >
        <Eye size={17} />
      </button>
      {r.status === 'OPEN' && (
        <button
          className="icon-button"
          title="Acknowledge"
          aria-label={'Acknowledge ' + r.alertCode}
          onClick={() => setConfirm({ row: r, action: 'acknowledge' })}
        >
          <Check size={17} />
        </button>
      )}
      {r.status === 'ACKNOWLEDGED' && (
        <button
          className="icon-button"
          title="Resolve"
          aria-label={'Resolve ' + r.alertCode}
          onClick={() => setConfirm({ row: r, action: 'resolve' })}
        >
          <CheckCheck size={17} />
        </button>
      )}
    </div>
  );
  const columns = [
    {
      key: 'alertCode',
      label: 'ALERT',
      render: (r) => <strong className="mono">{r.alertCode}</strong>,
    },
    {
      key: 'zone',
      label: 'ZONE / SENSOR',
      render: (r) => (
        <div>
          {r.zone?.name}
          <small className="cell-sub">{r.sensor?.sensorCode}</small>
        </div>
      ),
    },
    { key: 'severity', label: 'SEVERITY', render: (r) => <Badge value={r.severity} /> },
    { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
    { key: 'createdAt', label: 'CREATED', render: (r) => dateTime(r.createdAt) },
    { key: 'actions', label: 'ACTIONS', render: actions },
  ];
  return (
    <>
      <PageHeader
        eyebrow="SAFETY OPERATIONS"
        title="Alert management"
        description="Investigate, acknowledge, and resolve demonstration threshold events."
      >
        <button className="btn secondary" onClick={data.refresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </PageHeader>
      <section className="panel">
        <div className="toolbar wrap">
          <SearchBox
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search alert code or message…"
          />
          <select
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Filter severity"
            value={filters.severity}
            onChange={(e) => setFilter('severity', e.target.value)}
          >
            <option value="">All severities</option>
            <option>WARNING</option>
            <option>CRITICAL</option>
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
      <p className="data-note">
        Alert workflow: Open → Acknowledged → Resolved. Investigation details and corrective actions
        can be recorded in a linked incident.
      </p>
      {detail && (
        <Modal
          title={detail.alertCode}
          description="Synthetic threshold event"
          onClose={() => setDetail(null)}
        >
          <div className="modal-body">
            <div className="inline-badges">
              <Badge value={detail.severity} />
              <Badge value={detail.status} />
            </div>
            <p className="mt">{detail.message}</p>
            <dl className="detail-grid">
              <dt>Zone</dt>
              <dd>{detail.zone?.name}</dd>
              <dt>Sensor</dt>
              <dd>{detail.sensor?.sensorCode}</dd>
              <dt>Reading</dt>
              <dd>{detail.radiationReading?.value} uSv/h</dd>
              <dt>Acknowledged</dt>
              <dd>
                {detail.acknowledgedBy?.name || '—'} · {dateTime(detail.acknowledgedAt)}
              </dd>
              <dt>Resolved</dt>
              <dd>
                {detail.resolvedBy?.name || '—'} · {dateTime(detail.resolvedAt)}
              </dd>
            </dl>
          </div>
          <div className="modal-actions">
            <Link
              className="btn primary"
              to={'/officer/incidents?alert=' + detail._id + '&zone=' + detail.zone?._id}
            >
              Create linked incident
            </Link>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmDialog
          title={humanize(confirm.action) + ' alert?'}
          message={
            confirm.action === 'resolve'
              ? 'Confirm that investigation and any necessary corrective actions are complete. This alert cannot be reopened.'
              : 'Record that you have reviewed this demonstration alert.'
          }
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={act}
        />
      )}
    </>
  );
}
