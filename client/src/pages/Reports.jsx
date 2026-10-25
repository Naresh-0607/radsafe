import RecordDetail from '../components/RecordDetail';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileChartColumn, Activity, CheckCircle2, Layers, Eye } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useOptions } from '../hooks/useOptions';
import {
  PageHeader,
  StatCard,
  Table,
  Badge,
  Loading,
  ErrorState,
  DateFilters,
  Pagination,
  queryString,
  number,
  humanize,
} from '../components/UI';
import TrendChart from '../components/TrendChart';
const statuses = {
  radiation: ['NORMAL', 'WARNING', 'CRITICAL'],
  alerts: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
  inspections: ['PENDING', 'IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'],
  incidents: ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED'],
};
export default function Reports() {
  const [params] = useSearchParams();
  const [recordPage, setRecordPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({
    kind: statuses[params.get('kind')] ? params.get('kind') : 'radiation',
    zone: '',
    status: '',
    from: '',
    to: '',
  });
  const data = useApi('/reports?' + queryString(filters));
  const records = useApi(
    '/' +
      filters.kind +
      '?' +
      queryString({ ...filters, kind: undefined, limit: 20, page: recordPage }),
  );
  const zones = useOptions('/zones');
  const radiation = filters.kind === 'radiation';
  const setFilter = (key, value) => {
    setRecordPage(1);
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'kind' ? { status: '' } : {}) }));
  };
  return (
    <>
      <PageHeader
        eyebrow="FACILITY INTELLIGENCE"
        title="Reports & summaries"
        description="Explore database summaries by date, zone, and workflow status."
      />
      <div className="report-tabs">
        {Object.keys(statuses).map((kind) => (
          <button
            key={kind}
            className={filters.kind === kind ? 'active' : ''}
            onClick={() => setFilter('kind', kind)}
          >
            {humanize(kind)}
          </button>
        ))}
      </div>
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
            aria-label="Filter status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses[filters.kind].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <DateFilters filters={filters} setFilter={setFilter} />
          <button
            className="text-link"
            onClick={() =>
              setFilters((f) => ({ kind: f.kind, zone: '', status: '', from: '', to: '' }))
            }
          >
            Reset filters
          </button>
          <span className="filter-hint">Dates use UTC</span>
        </div>
      </section>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState message={data.error} retry={data.refresh} />
      ) : (
        <>
          <div className="stats-grid mt">
            <StatCard
              label="Matching records"
              value={data.data.totals.count}
              icon={FileChartColumn}
              note="All records matching your filters"
            />
            <StatCard
              label={radiation ? 'Average reading' : 'Completed / resolved'}
              value={
                radiation
                  ? number(data.data.totals.average)
                  : data.data.byStatus
                      .filter((s) => ['RESOLVED', 'COMPLETED'].includes(s._id))
                      .reduce((n, s) => n + s.count, 0)
              }
              icon={Activity}
              note={radiation ? 'Synthetic uSv/h' : 'Within selected filters'}
            />
            <StatCard
              label={radiation ? 'Maximum reading' : 'Other records'}
              value={
                radiation
                  ? number(data.data.totals.maximum)
                  : data.data.byStatus
                      .filter((s) => !['RESOLVED', 'COMPLETED'].includes(s._id))
                      .reduce((n, s) => n + s.count, 0)
              }
              icon={CheckCircle2}
              note={radiation ? 'Synthetic uSv/h' : 'Pending further action'}
            />
            <StatCard
              label="Zones represented"
              value={data.data.byZone.length}
              icon={Layers}
              note="Zones with matching records"
            />
          </div>
          <div className="dashboard-grid reports-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{radiation ? 'Radiation trend' : 'Daily activity'}</h2>
                  <p>
                    {radiation
                      ? 'Daily average of synthetic readings'
                      : 'Record count by creation date'}
                  </p>
                </div>
              </div>
              <TrendChart
                data={data.data.daily}
                thresholds={radiation ? data.data.thresholds : null}
                dataKey={radiation ? 'average' : 'count'}
                count={!radiation}
              />
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Status breakdown</h2>
              </div>
              <Table
                rowKey="_id"
                columns={[
                  { key: '_id', label: 'STATUS', render: (r) => <Badge value={r._id} /> },
                  { key: 'count', label: 'RECORDS' },
                ]}
                items={data.data.byStatus}
              />
            </section>
          </div>
          <section className="panel mt">
            <div className="panel-head">
              <h2>Summary by zone</h2>
            </div>
            <Table
              columns={[
                { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name || 'Unavailable zone' },
                { key: 'count', label: 'RECORDS' },
                ...(radiation
                  ? [
                      {
                        key: 'average',
                        label: 'AVERAGE (uSv/h)',
                        render: (r) => number(r.average),
                      },
                      {
                        key: 'maximum',
                        label: 'MAXIMUM (uSv/h)',
                        render: (r) => number(r.maximum),
                      },
                    ]
                  : []),
              ]}
              items={data.data.byZone}
            />
          </section>
        </>
      )}
      <section className="panel mt">
        <div className="panel-head">
          <div>
            <h2>Matching records</h2>
            <p>Browse records · Summary totals include all matches</p>
          </div>
        </div>
        {records.loading ? (
          <Loading />
        ) : records.error ? (
          <ErrorState message={records.error} retry={records.refresh} />
        ) : (
          <>
            <Table
              items={records.data.items}
              columns={[
                {
                  key: 'record',
                  label: 'RECORD',
                  render: (r) =>
                    r.alertCode || r.inspectionCode || r.incidentCode || r.sensor?.sensorCode,
                },
                { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name },
                { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
                {
                  key: 'description',
                  label: 'DETAIL',
                  render: (r) =>
                    r.title ||
                    r.message ||
                    r.remarks ||
                    (r.value == null ? '—' : number(r.value) + ' uSv/h'),
                },
                {
                  key: 'view',
                  label: 'DETAILS',
                  render: (r) => (
                    <button
                      className="icon-button"
                      aria-label="View record details"
                      onClick={() => setDetail(r)}
                    >
                      <Eye size={16} />
                    </button>
                  ),
                },
              ]}
            />
            <Pagination data={records.data} onPage={setRecordPage} />
          </>
        )}
      </section>
      <div className="data-note">
        Radiation classifications use demonstration thresholds captured when each reading was
        submitted.
      </div>
      {detail && (
        <RecordDetail record={detail} kind={filters.kind} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
