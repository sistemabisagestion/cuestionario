import { endpoint, allow } from '../server/http.js';
import { database } from '../server/db.js';
import { handleIntentos } from '../server/intentos.js';

export default endpoint(async (req, res) => {
  allow(req, res, ['GET', 'POST']);
  return handleIntentos(req, database());
});
