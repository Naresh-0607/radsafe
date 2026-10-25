import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import {
  PageHeader,
  Table,
  Badge,
  Loading,
  ErrorState,
  Pagination,
  SearchBox,
  Modal,
  queryString,
  humanize,
  dateTime,
} from '../../components/UI';
export default function Personnel() {
  const [filters, setFilters] = useState({ search: '', department: '', page: 1 });
  const [detail, setDetail] = useState(null);
  const data = useApi('/personnel?' + queryString(filters));
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const columns = [
    {
      key: 'name',
      label: 'PERSON',
      render: (r) => (
        <div className="person-cell">
          <span className="avatar small">{r.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{r.name}</strong>
            <small>{r.employeeId}</small>
          </div>
        </div>
      ),
    },
    { key: 'department', label: 'DEPARTMENT' },
    {
      key: 'assignedZone',
      label: 'ASSIGNED ZONE',
      render: (r) => r.assignedZone?.name || 'Unassigned',
    },
    { key: 'role', label: 'ROLE', render: (r) => humanize(r.role) },
    {
      key: 'active',
      label: 'STATUS',
      render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'profile',
      label: 'PROFILE',
      render: (r) => (
        <button className="icon-button" aria-label={'View ' + r.name} onClick={() => setDetail(r)}>
          <Eye size={17} />
        </button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="SAFETY OPERATIONS"
        title="Personnel directory"
        description="View facility personnel, departments, and assigned zones."
      />
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search name, email or employee ID…"
          />
          <select
            aria-label="Filter department"
            value={filters.department}
            onChange={(e) => setFilter('department', e.target.value)}
          >
            <option value="">All departments</option>
            {data.data?.departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
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
      {detail && (
        <Modal
          title={detail.name}
          description="Personnel profile · Read only"
          onClose={() => setDetail(null)}
        >
          <div className="modal-body">
            <dl className="detail-grid">
              {[
                ['Employee ID', detail.employeeId],
                ['Email', detail.email],
                ['Department', detail.department],
                ['Role', humanize(detail.role)],
                ['Assigned zone', detail.assignedZone?.name || 'Unassigned'],
                ['Account status', detail.active ? 'Active' : 'Inactive'],
                ['Added', dateTime(detail.createdAt)],
              ].map(([k, v]) => (
                <div className="detail-pair" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Modal>
      )}
    </>
  );
}
