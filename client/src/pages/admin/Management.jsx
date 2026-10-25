import { useState } from 'react';
import { Plus, Pencil, Trash2, Power, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useOptions } from '../../hooks/useOptions';
import { useToast } from '../../context/ToastContext';
import ResourceForm from '../../components/ResourceForm';
import {
  PageHeader,
  Badge,
  Table,
  Loading,
  ErrorState,
  SearchBox,
  Pagination,
  ConfirmDialog,
  queryString,
  humanize,
} from '../../components/UI';
const statusOptions = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'].map((value) => ({
  value,
  label: humanize(value),
}));
const config = {
  users: {
    title: 'User management',
    description: 'Manage access and the people responsible for facility safety.',
    singular: 'Safety Officer',
    search: 'Search name, email or employee ID…',
  },
  zones: {
    title: 'Facility zones',
    description: 'Organize monitored areas and maintain your facility zone register.',
    singular: 'zone',
    search: 'Search zone name or code…',
  },
  sensors: {
    title: 'Sensor inventory',
    description: 'Manage the sensors associated with manual demonstration readings.',
    singular: 'sensor',
    search: 'Search sensor code or type…',
  },
};
export default function Management({ kind }) {
  const c = config[kind];
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useApi('/' + kind + '?' + queryString(filters));
  const zones = useOptions('/zones');
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const zoneOptions = zones.items.map((z) => ({
    value: z._id,
    label: z.name + ' (' + z.code + ')',
  }));
  let fields =
    kind === 'users'
      ? [
          { name: 'name', label: 'Full name', required: true },
          { name: 'employeeId', label: 'Employee ID', required: true, maxLength: 50 },
          { name: 'email', label: 'Email address', type: 'email', required: true },
          { name: 'department', label: 'Department', required: true, maxLength: 120 },
          {
            name: 'assignedZone',
            label: 'Assigned zone',
            type: 'select',
            options: zoneOptions,
            placeholder: 'Unassigned',
          },
          {
            name: 'password',
            label: editing?._id ? 'New password (optional)' : 'Password',
            type: 'password',
            minLength: 12,
            required: !editing?._id,
            hint: '12+ characters, at most 72 UTF-8 bytes.',
          },
        ]
      : kind === 'zones'
        ? [
            { name: 'name', label: 'Zone name', required: true },
            { name: 'code', label: 'Zone code', required: true, maxLength: 40 },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              required: true,
              default: 'ACTIVE',
              options: statusOptions,
            },
            { name: 'description', label: 'Description', type: 'textarea', wide: true },
          ]
        : [
            { name: 'sensorCode', label: 'Sensor code', required: true, maxLength: 60 },
            { name: 'zone', label: 'Zone', type: 'select', required: true, options: zoneOptions },
            { name: 'type', label: 'Sensor type', required: true, maxLength: 80 },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              required: true,
              default: 'ACTIVE',
              options: statusOptions,
            },
            {
              name: 'installedAt',
              label: 'Installation date',
              type: 'date',
              required: true,
              max: new Date().toISOString().slice(0, 10),
              default: new Date().toISOString().slice(0, 10),
            },
          ];
  const actions = (row) => (
    <div className="row-actions">
      <button
        className="icon-button"
        title="Edit"
        aria-label={'Edit ' + (row.name || row.sensorCode)}
        onClick={() => setEditing(row)}
      >
        <Pencil size={16} />
      </button>
      {kind === 'users' && row.role !== 'ADMIN' && (
        <button
          className="icon-button"
          title={row.active ? 'Deactivate' : 'Activate'}
          aria-label={(row.active ? 'Deactivate ' : 'Activate ') + row.name}
          onClick={() => setConfirm({ type: 'status', row })}
        >
          <Power size={16} />
        </button>
      )}
      {(kind !== 'users' || row.role !== 'ADMIN') && (
        <button
          className="icon-button destructive"
          title="Delete"
          aria-label={'Delete ' + (row.name || row.sensorCode)}
          onClick={() => setConfirm({ type: 'delete', row })}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
  const columns =
    kind === 'users'
      ? [
          {
            key: 'name',
            label: 'PERSON',
            render: (r) => (
              <div className="person-cell">
                <span className="avatar small">{r.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                </div>
              </div>
            ),
          },
          { key: 'employeeId', label: 'EMPLOYEE ID' },
          { key: 'department', label: 'DEPARTMENT' },
          {
            key: 'role',
            label: 'ROLE',
            render: (r) => <span className="text-small">{humanize(r.role)}</span>,
          },
          {
            key: 'active',
            label: 'STATUS',
            render: (r) => <Badge value={r.active ? 'ACTIVE' : 'INACTIVE'} />,
          },
        ]
      : kind === 'zones'
        ? [
            {
              key: 'name',
              label: 'ZONE',
              render: (r) => (
                <div>
                  <strong>{r.name}</strong>
                  <small className="cell-sub">{r.description || 'No description'}</small>
                </div>
              ),
            },
            { key: 'code', label: 'ZONE CODE' },
            { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
          ]
        : [
            {
              key: 'sensorCode',
              label: 'SENSOR CODE',
              render: (r) => <strong className="mono">{r.sensorCode}</strong>,
            },
            { key: 'zone', label: 'ZONE', render: (r) => r.zone?.name || 'Unavailable' },
            { key: 'type', label: 'TYPE' },
            {
              key: 'installedAt',
              label: 'INSTALLED',
              render: (r) => new Date(r.installedAt).toLocaleDateString(),
            },
            { key: 'status', label: 'STATUS', render: (r) => <Badge value={r.status} /> },
          ];
  columns.push({ key: 'actions', label: 'ACTIONS', render: actions });
  async function save(values) {
    const body = { ...values };
    if (kind === 'users') {
      body.assignedZone = body.assignedZone || null;
      if (!body.password) delete body.password;
    }
    if (kind === 'sensors') body.installedAt = new Date(body.installedAt).toISOString();
    if (editing._id) await api.put('/' + kind + '/' + editing._id, body);
    else await api.post('/' + kind, body);
    setEditing(null);
    resource.refresh();
    toast(editing._id ? 'Record updated' : 'Record created');
  }
  async function execute() {
    setBusy(true);
    try {
      if (confirm.type === 'delete') await api.delete('/' + kind + '/' + confirm.row._id);
      else
        await api.patch('/users/' + confirm.row._id + '/status', { active: !confirm.row.active });
      setConfirm(null);
      resource.refresh();
      toast('Record updated');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const initial = editing
    ? {
        ...editing,
        assignedZone: editing.assignedZone?._id || '',
        zone: editing.zone?._id || '',
        installedAt: editing.installedAt?.slice(0, 10),
      }
    : {};
  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title={c.title} description={c.description}>
        <button className="btn primary" onClick={() => setEditing({})}>
          <Plus size={18} />
          Add {c.singular}
        </button>
      </PageHeader>
      {zones.error && kind !== 'zones' && <div className="error-box">{zones.error}</div>}
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder={c.search}
          />
          <div className="toolbar-right">
            {kind !== 'users' && (
              <select
                aria-label="Filter status"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <button className="icon-button" aria-label="Refresh records" onClick={resource.refresh}>
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.refresh} />
        ) : (
          <>
            <Table
              columns={columns}
              items={resource.data?.items || []}
              emptyMessage={'Add a ' + c.singular + ' or adjust your search.'}
            />
            <Pagination
              data={resource.data}
              onPage={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </section>
      {editing && (
        <ResourceForm
          title={(editing._id ? 'Edit ' : 'Add ') + c.singular}
          fields={fields}
          initial={initial}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'delete' ? 'Delete record?' : 'Change account access?'}
          message={
            confirm.type === 'delete'
              ? 'This permanently removes the record. Records referenced by facility history cannot be deleted.'
              : 'Changing account status revokes its current sessions.'
          }
          destructive={confirm.type === 'delete'}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={execute}
        />
      )}
    </>
  );
}
