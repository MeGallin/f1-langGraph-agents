/**
 * F1 Historical Comparison Agent - Super Minimal Test Version
 */

import logger from '../utils/logger.js';

export class HistoricalComparisonAgent {
  constructor(langGraphAdapter, options = {}) {
    this.adapter = langGraphAdapter;
    logger.info('HistoricalComparisonAgent initialized');
  }

  async compareHistorical(query, options = {}) {
    try {
      logger.info('Historical comparison completed', { query });
      return { query, result: 'Basic comparison completed' };
    } catch (error) {
      logger.error('Historical comparison failed:', error);
      throw error;
    }
  }
}

export default HistoricalComparisonAgent;
