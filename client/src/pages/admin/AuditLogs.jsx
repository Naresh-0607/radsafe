import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import {
  PageHeader,
  Table,
  Loading,
  ErrorState,
  SearchBox,
  Pagination,
  DateFilters,
  Modal,
  queryString,
  dateTime,
  humanize,
} from '../../components/UI';
export default function AuditLogs() {
  const [filters, setFilters] = useState({ search: '', from: '', to: '', page: 1 });
  const [detail, setDetail] = useState(null);
  const data = useApi('/audit-logs?' + queryString(filters));
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Audit logs"
        description="Review the accountable history of authentication and facility actions."
      />
      <section className="panel">
        <div className="toolbar wrap">
          <SearchBox
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search action or entity type…"
          />
          <DateFilters filters={filters} setFilter={setFilter} />
        </div>
        {data.loading ? (
          <Loading />
        ) : data.error ? (
          <ErrorState message={data.error} retry={data.refresh} />
        ) : (
          <>
            <Table
              columns={[
                { key: 'createdAt', label: 'TIMESTAMP', render: (r) => dateTime(r.createdAt) },
                {
                  key: 'user',
                  label: 'ACTOR',
                  render: (r) => (
                    <div>
                      <strong>{r.user?.name || 'Deleted account'}</strong>
                      <small className="cell-sub">
                        {r.user?.employeeId || 'Historical reference retained'}
                      </small>
                    </div>
                  ),
                },
                {
                  key: 'action',
                  label: 'ACTION',
                  render: (r) => <span className="audit-action">{humanize(r.action)}</span>,
                },
                { key: 'entityType', label: 'ENTITY' },
                {
                  key: 'details',
                  label: 'DETAILS',
                  render: (r) => (
                    <button
                      className="icon-button"
                      aria-label={'View ' + r.action + ' details'}
                      onClick={() => setDetail(r)}
                    >
                      <Eye size={16} />
                    </button>
                  ),
                },
              ]}
              items={data.data.items}
            />
            <Pagination data={data.data} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </section>
      {detail && (
        <Modal title={humanize(detail.action)} onClose={() => setDetail(null)}>
          <div className="modal-body">
            <dl className="detail-grid">
              <dt>Timestamp</dt>
              <dd>{dateTime(detail.createdAt)}</dd>
              <dt>Actor</dt>
              <dd>{detail.user?.name || 'Deleted account'}</dd>
              <dt>Entity type</dt>
              <dd>{detail.entityType}</dd>
              <dt>Entity ID</dt>
              <dd className="mono break-word">{detail.entityId}</dd>
            </dl>
            <h3>Metadata</h3>
            <pre className="metadata">{JSON.stringify(detail.metadata, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </>
  );
}
