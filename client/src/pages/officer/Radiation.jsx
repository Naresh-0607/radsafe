import { useState } from 'react';
import { Plus, Radio, Eye } from 'lucide-react';
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
  DateFilters,
  Modal,
  queryString,
  dateTime,
  number,
} from '../../components/UI';
import TrendChart from '../../components/TrendChart';
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export default function Radiation() {
  const [filters, setFilters] = useState({ zone: '', sensor: '', from: '', to: '', page: 1 });
  const [adding, setAdding] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [detail, setDetail] = useState(null);
  const [version, setVersion] = useState(0);
  const readings = useApi('/radiation?' + queryString(filters));
  const history = useApi('/reports?kind=radiation&' + queryString({ ...filters, page: undefined }));
  const zones = useOptions('/zones', version);
  const sensors = useOptions('/sensors', version);
  const toast = useToast();
  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'zone' ? { sensor: '' } : {}), page: 1 }));
  const columns = [
    {
      key: 'sensor',
      label: 'SENSOR',
      render: (r) => <strong className="mono">{r.sensor?.sensorCode || 'Unavailable'}</strong>,
    },
    { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name },
    {
      key: 'value',
      label: 'READING',
      render: (r) => (
        <strong>
          {number(r.value)} <span className="muted text-small">uSv/h</span>
        </strong>
      ),
    },
    { key: 'status', label: 'DEMO STATUS', render: (r) => <Badge value={r.status} /> },
    { key: 'recordedAt', label: 'RECORDED AT', render: (r) => dateTime(r.recordedAt) },
    {
      key: 'detail',
      label: 'DETAILS',
      render: (r) => (
        <button
          className="icon-button"
          aria-label={'View reading ' + r.sensor?.sensorCode}
          onClick={() => setDetail(r)}
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];
  function saved(message) {
    setAdding(false);
    readings.refresh();
    history.refresh();
    setVersion((v) => v + 1);
    toast(message);
  }
  return (
    <>
      <PageHeader
        eyebrow="SAFETY OPERATIONS"
        title="Radiation monitoring"
        description="Record and review synthetic radiation readings across your facility."
      >
        <button className="btn secondary" onClick={() => setInventory(true)}>
          <Radio size={16} />
          Zones & sensors
        </button>
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Add demo reading
        </button>
      </PageHeader>
      <div className="notice">
        <strong>Demonstration thresholds</strong> · Warning ≥{' '}
        {history.data?.thresholds.warning ?? '—'} uSv/h · Critical ≥{' '}
        {history.data?.thresholds.critical ?? '—'} uSv/h. Synthetic data only; not real safety
        limits.
      </div>
      {(zones.error || sensors.error) && (
        <div className="error-box">{zones.error || sensors.error}</div>
      )}
      <section className="panel">
        <div className="toolbar wrap">
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
          <select
            aria-label="Filter sensor"
            value={filters.sensor}
            onChange={(e) => setFilter('sensor', e.target.value)}
          >
            <option value="">All sensors</option>
            {sensors.items
              .filter((s) => !filters.zone || s.zone?._id === filters.zone)
              .map((s) => (
                <option key={s._id} value={s._id}>
                  {s.sensorCode}
                </option>
              ))}
          </select>
          <DateFilters filters={filters} setFilter={setFilter} />
          <button
            className="text-link"
            onClick={() => setFilters({ zone: '', sensor: '', from: '', to: '', page: 1 })}
          >
            Reset filters
          </button>
          <span className="filter-hint">Date filters use UTC</span>
        </div>
        <div className="panel-head">
          <div>
            <h2>Historical trend</h2>
            <p>Daily average · All matching readings</p>
          </div>
        </div>
        {history.loading ? (
          <Loading />
        ) : history.error ? (
          <ErrorState message={history.error} retry={history.refresh} />
        ) : (
          <TrendChart data={history.data.daily} thresholds={history.data.thresholds} />
        )}
      </section>
      <section className="panel mt">
        <div className="panel-head">
          <h2>Reading history</h2>
          <span className="period-pill">MANUAL / DEMO</span>
        </div>
        {readings.loading ? (
          <Loading />
        ) : readings.error ? (
          <ErrorState message={readings.error} retry={readings.refresh} />
        ) : (
          <>
            <Table columns={columns} items={readings.data.items} />
            <Pagination
              data={readings.data}
              onPage={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </section>
      {adding && (
        <ReadingForm
          zones={zones.items}
          sensors={sensors.items}
          onClose={() => setAdding(false)}
          onSaved={saved}
        />
      )}
      {inventory && (
        <Modal
          title="Zones & sensor inventory"
          description="Read-only facility reference. Administrators manage this inventory."
          wide
          onClose={() => setInventory(false)}
        >
          <div className="modal-body">
            <h3>Facility zones</h3>
            <Table
              columns={[
                { key: 'name', label: 'ZONE' },
                { key: 'code', label: 'CODE' },
                { key: 'description', label: 'DESCRIPTION' },
                { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
              ]}
              items={zones.items}
            />
            <h3 className="mt">Registered sensors</h3>
            <Table
              columns={[
                { key: 'sensorCode', label: 'SENSOR' },
                { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name },
                { key: 'type', label: 'TYPE' },
                { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
              ]}
              items={sensors.items}
            />
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title="Demo reading detail" onClose={() => setDetail(null)}>
          <div className="modal-body">
            <dl className="detail-grid">
              <dt>Reading</dt>
              <dd>{number(detail.value)} uSv/h</dd>
              <dt>Demo status</dt>
              <dd>
                <Badge value={detail.status} />
              </dd>
              <dt>Zone</dt>
              <dd>{detail.zone?.name}</dd>
              <dt>Sensor</dt>
              <dd>{detail.sensor?.sensorCode}</dd>
              <dt>Recorded at</dt>
              <dd>{dateTime(detail.recordedAt)}</dd>
              <dt>Entered by</dt>
              <dd>{detail.createdBy?.name || 'Deleted account'}</dd>
              <dt>Thresholds at submission</dt>
              <dd>
                Warning {detail.demonstrationThresholds.warning} / Critical{' '}
                {detail.demonstrationThresholds.critical} uSv/h
              </dd>
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
function ReadingForm({ zones, sensors, onClose, onSaved }) {
  const [form, setForm] = useState({ zone: '', sensor: '', value: '', recordedAt: localNow() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) =>
    setForm((f) => ({ ...f, [key]: value, ...(key === 'zone' ? { sensor: '' } : {}) }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/radiation', {
        ...form,
        value: Number(form.value),
        unit: 'uSv/h',
        recordedAt: new Date(form.recordedAt).toISOString(),
      });
      onSaved(
        result.alert
          ? 'Demo reading saved; ' + result.alert.severity.toLowerCase() + ' alert generated'
          : 'Demo reading saved',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Add demo radiation reading"
      description="Manual synthetic entry. This does not represent a live sensor measurement."
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
              value={form.zone}
              onChange={(e) => change('zone', e.target.value)}
            >
              <option value="">Select an active zone</option>
              {zones
                .filter((z) => z.status === 'ACTIVE')
                .map((z) => (
                  <option key={z._id} value={z._id}>
                    {z.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Sensor
            <select
              aria-label="Sensor"
              required
              value={form.sensor}
              onChange={(e) => change('sensor', e.target.value)}
            >
              <option value="">Select an active sensor</option>
              {sensors
                .filter((s) => s.zone?._id === form.zone && s.status === 'ACTIVE')
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sensorCode}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Synthetic value (uSv/h)
            <input
              type="number"
              required
              min="0"
              max="1000000"
              step="any"
              value={form.value}
              onChange={(e) => change('value', e.target.value)}
            />
          </label>
          <label>
            Recorded at (local time)
            <input
              type="datetime-local"
              required
              max={localNow()}
              value={form.recordedAt}
              onChange={(e) => change('recordedAt', e.target.value)}
            />
          </label>
          <p className="form-note span-two">
            The saved value is compared with the configured demonstration thresholds. Warning and
            critical readings automatically create an alert.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save demo reading'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
