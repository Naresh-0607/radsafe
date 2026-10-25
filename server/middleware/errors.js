import { ZodError } from 'zod';
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  if (err instanceof ZodError) {
    status = 400;
    message = err.issues.map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`).join('; ');
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    status = 400;
    message =
      err.name === 'CastError'
        ? 'Invalid record identifier or value'
        : Object.values(err.errors)
            .map((e) => e.message)
            .join('; ');
  }
  if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyPattern || {})[0] || 'Value'} already exists`;
  }
  if (err.name === 'VersionError') {
    status = 409;
    message = 'This record changed. Refresh and try again.';
  }
  if (status >= 500) {
    console.error('Request failed:', err.name, err.code || '');
    message = 'The server could not complete the request. Please try again.';
  }
  res.status(status).json({ success: false, message });
}
