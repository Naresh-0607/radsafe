export function classifyReading(value, thresholds) {
  if (value >= thresholds.critical) return 'CRITICAL';
  if (value >= thresholds.warning) return 'WARNING';
  return 'NORMAL';
}
