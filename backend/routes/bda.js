import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBdaStatus, getRecentEvents, simulateTrafficBatch } from '../bda/flume_collector.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HDFS_DIR = path.resolve(__dirname, '../../bda/data/hdfs/clickstream');

// GET /api/bda/status
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    data: getBdaStatus()
  });
});

// GET /api/bda/events - Live event feed
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json({
    status: 'ok',
    data: getRecentEvents(limit)
  });
});

// POST /api/bda/simulate - Trigger traffic surge for demonstration
router.post('/simulate', (req, res) => {
  const count = Math.min(parseInt(req.body.count) || 20, 100);
  const result = simulateTrafficBatch(count);
  res.json(result);
});

// GET /api/bda/analytics - Run MapReduce-style aggregation across HDFS logs
router.get('/analytics', (req, res) => {
  try {
    const movieCounts = {};
    const searchCounts = {};
    const genreCounts = {};
    let totalLogsRead = 0;

    if (fs.existsSync(HDFS_DIR)) {
      const dates = fs.readdirSync(HDFS_DIR);
      for (const d of dates) {
        const dayPath = path.join(HDFS_DIR, d);
        if (fs.statSync(dayPath).isDirectory()) {
          const files = fs.readdirSync(dayPath);
          for (const f of files) {
            const filePath = path.join(dayPath, f);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            for (const l of lines) {
              try {
                const item = JSON.parse(l);
                totalLogsRead++;
                const p = item.payload || {};

                if (p.title) {
                  movieCounts[p.title] = (movieCounts[p.title] || 0) + 1;
                }
                if (p.genre) {
                  genreCounts[p.genre] = (genreCounts[p.genre] || 0) + 1;
                }
                if (p.query) {
                  searchCounts[p.query] = (searchCounts[p.query] || 0) + 1;
                }
              } catch (parseErr) {}
            }
          }
        }
      }
    }

    const topMovies = Object.entries(movieCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topSearches = Object.entries(searchCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      status: 'ok',
      data: {
        totalLogsRead,
        topMovies,
        topGenres,
        topSearches,
        pipeline: 'HDFS Partition MapReduce Analytics'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
