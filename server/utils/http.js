export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const ok = (res, data = {}, message = 'Operation successful', status = 200) =>
  res.status(status).json({ success: true, message, data });
export const requireFound = (doc, label = 'Record') => {
  if (!doc) throw new HttpError(404, `${label} not found`);
  return doc;
};
