import { Link } from 'react-router-dom';
import {
  Users,
  Radio,
  Bell,
  ClipboardCheck,
  TriangleAlert,
  MapPin,
  RefreshCw,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import {
  PageHeader,
  Badge,
  Loading,
  ErrorState,
  StatCard,
  Empty,
  number,
  dateTime,
  humanize,
} from '../components/UI';
import TrendChart from '../components/TrendChart';
export default function Dashboard() {
  const { user } = useAuth();
  const admin = user.role === 'ADMIN';
  const base = admin ? '/admin' : '/officer';
  const { data, loading, error, refresh } = useApi('/dashboard');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={refresh} />;
  const c = data.counts;
  const stats = admin
    ? [
        ['Total users', c.totalUsers, Users, c.totalOfficers + ' Safety Officers', 'teal'],
        ['Facility zones', c.totalZones, MapPin, 'Registered monitoring areas', 'blue'],
        [
          'Active sensors',
          c.activeSensors,
          Radio,
          c.inactiveSensors + ' inactive · ' + c.maintenanceSensors + ' maintenance',
          'teal',
        ],
        ['Active alerts', c.openAlerts, Bell, 'Open & acknowledged', 'amber'],
      ]
    : [
        ['Active alerts', c.openAlerts, Bell, 'Open & acknowledged', 'amber'],
        ['Open incidents', c.openIncidents, TriangleAlert, 'Awaiting resolution', 'orange'],
        [
          'Pending inspections',
          c.pendingInspections,
          ClipboardCheck,
          'All incomplete inspections',
          'blue',
        ],
        ['Active sensors', c.activeSensors, Radio, 'Registered demo sensors', 'teal'],
      ];
  return (
    <>
      <PageHeader
        eyebrow={admin ? 'ADMINISTRATION / OVERVIEW' : 'SAFETY OPERATIONS / OVERVIEW'}
        title={admin ? 'Facility overview' : 'Safety overview'}
        description={
          'Welcome back, ' + user.name.split(' ')[0] + '. Here’s your facility at a glance.'
        }
      >
        <button className="btn secondary" onClick={refresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
        <Link className="btn primary" to={admin ? '/admin/users' : '/officer/radiation'}>
          <Plus size={17} />
          {admin ? 'Add Safety Officer' : 'Add demo reading'}
        </Link>
      </PageHeader>
      <div className={'facility-banner status-' + data.overallStatus.toLowerCase()}>
        <div className="banner-symbol">
          <ShieldCheck size={23} />
        </div>
        <div>
          <strong>
            {data.overallStatus === 'NO_DATA'
              ? 'Ready for your first reading'
              : data.overallStatus === 'NORMAL'
                ? 'No active demonstration alerts'
                : humanize(data.overallStatus) + ' demonstration alerts need attention'}
          </strong>
          <p>
            Academic simulation · Facility status reflects synthetic readings and unresolved demo
            alerts.
          </p>
        </div>
        <span className="banner-label">
          <span /> {humanize(data.overallStatus)}
        </span>
      </div>
      <div className="stats-grid">
        {stats.map(([label, value, icon, note, tone]) => (
          <StatCard key={label} {...{ label, value, icon, note, tone }} />
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <h2>Radiation overview</h2>
              <p>Hourly average of manually entered readings · uSv/h</p>
            </div>
            <span className="period-pill">Last 7 days</span>
          </div>
          <TrendChart data={data.trend} thresholds={data.thresholds} />
          <div className="chart-legend">
            <span>
              <i className="legend-dot teal" />
              Average reading
            </span>
            <span>
              <i className="legend-line amber" />
              Demo warning: {data.thresholds.warning}
            </span>
            <span>
              <i className="legend-line red" />
              Demo critical: {data.thresholds.critical}
            </span>
          </div>
        </section>
        <section className="panel zone-panel">
          <div className="panel-head">
            <div>
              <h2>Zone status</h2>
              <p>Latest synthetic reading per zone</p>
            </div>
            <MapPin size={18} className="muted" />
          </div>
          <div className="zone-list">
            {data.zones.length ? (
              data.zones.map((zone) => (
                <div className="zone-row" key={zone._id}>
                  <span
                    className={'zone-indicator ' + (zone.latest?.status || 'NO_DATA').toLowerCase()}
                  />
                  <div>
                    <strong>{zone.name}</strong>
                    <small>
                      {zone.sensorCount} sensors · {humanize(zone.status)}
                    </small>
                  </div>
                  <div className="zone-value">
                    <strong>
                      {number(zone.latest?.value)} <small>uSv/h</small>
                    </strong>
                    <span>{zone.latest ? humanize(zone.latest.status) : 'No reading'}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="No zones registered"
                message="An administrator can add facility zones."
              />
            )}
          </div>
          <Link className="panel-link" to={admin ? '/admin/zones' : '/officer/radiation'}>
            Explore {admin ? 'zones' : 'radiation data'}
            <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent alerts</h2>
              <p>Latest demonstration threshold events</p>
            </div>
            <Link
              className="text-link"
              to={admin ? '/admin/reports?kind=alerts' : '/officer/alerts'}
            >
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="alert-list">
            {data.recentAlerts.length ? (
              data.recentAlerts.map((alert) => (
                <div className="alert-row" key={alert._id}>
                  <span className={'alert-icon ' + alert.severity.toLowerCase()}>
                    <TriangleAlert size={18} />
                  </span>
                  <div>
                    <strong>{alert.zone?.name || 'Unavailable zone'}</strong>
                    <p>{alert.message}</p>
                    <small>
                      {dateTime(alert.createdAt)} · {humanize(alert.status)}
                    </small>
                  </div>
                  <Badge value={alert.severity} />
                </div>
              ))
            ) : (
              <Empty
                title="No alerts recorded"
                message="Alerts appear when demo readings reach a demonstration threshold."
              />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{admin ? 'Recent activity' : 'Recent readings'}</h2>
              <p>
                {admin
                  ? 'An accountable record of workspace actions'
                  : 'Latest manual monitoring entries'}
              </p>
            </div>
            <Link className="text-link" to={admin ? '/admin/audit-logs' : '/officer/radiation'}>
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="activity-list">
            {admin ? (
              data.recentAudit.length ? (
                data.recentAudit.map((log) => (
                  <div className="activity-row" key={log._id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{humanize(log.action)}</strong>
                      <p>
                        {log.user?.name || 'Deleted account'} · {log.entityType}
                      </p>
                      <small>{dateTime(log.createdAt)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty />
              )
            ) : data.recentReadings.length ? (
              data.recentReadings.map((r) => (
                <div className="zone-row" key={r._id}>
                  <Activity size={18} className="muted" />
                  <div>
                    <strong>{r.sensor?.sensorCode}</strong>
                    <small>
                      {r.zone?.name} · {dateTime(r.recordedAt)}
                    </small>
                  </div>
                  <div className="zone-value">
                    <strong>
                      {number(r.value)} <small>uSv/h</small>
                    </strong>
                    <Badge value={r.status} />
                  </div>
                </div>
              ))
            ) : (
              <Empty />
            )}
          </div>
        </section>
      </div>
      {admin && (
        <div className="secondary-stats">
          <Link to="/admin/reports?kind=incidents">
            <TriangleAlert size={18} />
            <strong>{c.openIncidents}</strong> open incidents
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/admin/reports?kind=inspections">
            <ClipboardCheck size={18} />
            <strong>{c.pendingInspections}</strong> pending inspections
            <ArrowUpRight size={16} />
          </Link>
          <div>
            <Radio size={18} />
            <strong>{c.inactiveSensors}</strong> inactive sensors
          </div>
        </div>
      )}
      <div className="data-note">
        <ShieldCheck size={15} />
        <span>
          Demonstration thresholds: warning ≥ {data.thresholds.warning}, critical ≥{' '}
          {data.thresholds.critical} uSv/h. These are not regulatory safety limits.
        </span>
        <small>Updated {dateTime(data.generatedAt)}</small>
      </div>
    </>
  );
}
