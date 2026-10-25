import { Modal, Badge, dateTime, humanize } from './UI';
export default function RecordDetail({ record, kind, onClose }) {
  const excluded = new Set([
    '_id',
    '__v',
    'checklist',
    'demonstrationThresholds',
    'sensor',
    'zone',
    'createdBy',
    'officer',
    'relatedAlert',
    'radiationReading',
    'acknowledgedBy',
    'resolvedBy',
  ]);
  return (
    <Modal
      title={
        record.alertCode || record.inspectionCode || record.incidentCode || 'Demo radiation reading'
      }
      description="Read-only database record"
      wide
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="inline-badges">
          <Badge value={record.status} />
          {record.severity && <Badge value={record.severity} />}
        </div>
        <dl className="detail-grid">
          <dt>Zone</dt>
          <dd>{record.zone?.name || 'Unavailable'}</dd>
          {record.sensor && (
            <>
              <dt>Sensor</dt>
              <dd>{record.sensor.sensorCode}</dd>
            </>
          )}
          {['createdBy', 'officer', 'acknowledgedBy', 'resolvedBy'].map(
            (key) =>
              record[key] && (
                <div className="detail-pair" key={key}>
                  <dt>{humanize(key.replace(/([A-Z])/g, ' $1'))}</dt>
                  <dd>{record[key].name}</dd>
                </div>
              ),
          )}
          {record.relatedAlert && (
            <>
              <dt>Related alert</dt>
              <dd>{record.relatedAlert.alertCode}</dd>
            </>
          )}
          {record.radiationReading && (
            <>
              <dt>Demo reading</dt>
              <dd>{record.radiationReading.value} uSv/h</dd>
            </>
          )}
          {Object.entries(record)
            .filter(
              ([key, value]) => !excluded.has(key) && value != null && typeof value !== 'object',
            )
            .map(([key, value]) => (
              <div className="detail-pair" key={key}>
                <dt>{humanize(key.replace(/([A-Z])/g, ' $1'))}</dt>
                <dd className="preserve-text">
                  {key.endsWith('At') ? dateTime(value) : String(value) || '—'}
                </dd>
              </div>
            ))}
        </dl>
        {record.checklist && (
          <>
            <h3>Inspection checklist</h3>
            {record.checklist.map((item, i) => (
              <div className="checklist-detail" key={i}>
                <Badge
                  value={item.passed === null ? 'NOT_CHECKED' : item.passed ? 'PASSED' : 'FAILED'}
                />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.remarks || 'No remarks'}</p>
                </div>
              </div>
            ))}
          </>
        )}
        {kind === 'radiation' && (
          <div className="notice">
            Demonstration thresholds at submission: warning{' '}
            {record.demonstrationThresholds?.warning}, critical{' '}
            {record.demonstrationThresholds?.critical} uSv/h. Synthetic data only.
          </div>
        )}
      </div>
    </Modal>
  );
}
