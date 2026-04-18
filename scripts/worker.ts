import { config } from 'dotenv';
import path from 'path';

// Force load .env.local for local scripts
config({ path: path.resolve(process.cwd(), '.env.local') });

import { ScraperService } from '../src/services/ScraperService';

async function main() {
  const service = ScraperService.getInstance();
  const task = process.argv[2] || 'all';

  console.log(`🚀 Starting Scraper Worker: ${task}`);

  try {
    if (task === 'scrape' || task === 'all') {
      console.log('--- Phase 1: Discovery Scrape ---');
      const res = await service.runDiscovery(2);
      console.log('Result:', res);
    }

    if (task === 'sync' || task === 'all') {
      console.log('--- Phase 2: Metadata Sync ---');
      const res = await service.syncAllMetadata();
      console.log('Result:', res);
    }

    if (task === 'validate' || task === 'all') {
      console.log('--- Phase 3: Health Check ---');
      const res = await service.validateLinks();
      console.log('Result:', res);
    }

    console.log('✅ Worker finished successfully.');
  } catch (err) {
    console.error('❌ Worker failed:', err);
    process.exit(1);
  }
}

main();
