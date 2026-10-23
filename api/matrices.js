import { endpoint, allow } from '../server/http.js';
import { configuredDatasetStore } from '../server/dataset-store.js';
import { handleMatrices } from '../server/matrices.js';

// Read-only assignments for the evaluation flows. Changes are published through /api/datos.
export default endpoint(async (req, res) => {
  allow(req, res, ['GET']);
  return handleMatrices(req, await configuredDatasetStore());
});
