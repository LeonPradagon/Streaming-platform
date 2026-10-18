import { schedule } from '@netlify/functions';
import { ScraperService } from '../../src/services/ScraperService';

/**
 * Netlify Scheduled Function (Cron Job)
 * Akan dijalankan otomatis setiap 6 jam untuk menyinkronkan 
 * film terbaru dan rilis TV populer.
 */
const handler = async (event: any) => {
  const startTime = new Date().toISOString();
  console.log(`[Netlify Cron] Memulai tugas otomatisasi pada ${startTime}...`);
  
  try {
    const scraper = new ScraperService();
    
    // Menjalankan rutinitas penuh secara bertahap (Chunking)
    // Ini mencakup: Netflix Discovery, New Releases, dan Regional ID priority
    const result = await scraper.runFullRoutine();
    
    console.log("[Netlify Cron] Berhasil dijalankan:", result);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Scraper successfully executed", 
        startedAt: startTime,
        finishedAt: new Date().toISOString(),
        summary: result 
      }),
    };
  } catch (error: any) {
    console.error("[Netlify Cron] Error Kritikal:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Automation failed", 
        details: error.message 
      }),
    };
  }
};

/**
 * Konfigurasi Jadwal (Cron Syntax)
 * 0 * / 6 * * * = Setiap 6 jam
 */
export const config = {
  schedule: "0 */6 * * *"
};

export { handler };
