import { endpoint, allow } from '../server/http.js';
import { configuredDatasetStore } from '../server/dataset-store.js';
import { handleDatasets } from '../server/datasets.js';

// Excel uploads arrive as base64 inside JSON (questions: up to 3 MB of file).
export default endpoint(async (req, res) => {
  allow(req, res, ['GET', 'POST']);
  return handleDatasets(req, await configuredDatasetStore());
}, { maxBodyBytes: 4300000 });
