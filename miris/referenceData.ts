import fixtures from './fixtures.json';
import { normaliseBank } from './specimens.mjs';

export const referenceData = {
  track: 'laboratory',
  viewerKey: fixtures.viewerKey,
  specimens: normaliseBank(fixtures.stages.map(stage => ({ ...stage, status: 'live' }))),
};
