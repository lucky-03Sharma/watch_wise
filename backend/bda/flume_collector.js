import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BDA Paths
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const BDA_DIR = path.join(PROJECT_ROOT, 'bda');
const FLUME_LOGS_DIR = path.join(BDA_DIR, 'logs', 'flume_source');
const FLUME_LOG_FILE = path.join(FLUME_LOGS_DIR, 'user_activity.log');
const HDFS_SIMULATED_DIR = path.join(BDA_DIR, 'data', 'hdfs', 'clickstream');

// Ensure log & HDFS directories exist
try {
  fs.mkdirSync(FLUME_LOGS_DIR, { recursive: true });
  fs.mkdirSync(HDFS_SIMULATED_DIR, { recursive: true });
} catch (e) {
  console.warn('[BDA] Directory init notice:', e.message);
}

// In-Memory stats and circular buffer for live web monitoring
const MAX_BUFFER = 100;
const eventBuffer = [];
const stats = {
  totalEventsIngested: 0,
  eventsByType: {
    SEARCH: 0,
    MOVIE_VIEW: 0,
    RECOMMENDATION: 0,
    FAVORITE: 0,
    WATCHLIST: 0,
    REVIEW: 0,
    SIMULATED_BATCH: 0
  },
  flumeAgentStatus: 'ACTIVE',
  flumeMode: 'HDFS Partition Sink',
  flumePort: process.env.FLUME_PORT ? parseInt(process.env.FLUME_PORT) : 44444,
  flumeHost: process.env.FLUME_HOST || '127.0.0.1',
  hdfsSinkPath: process.env.HDFS_PATH || 'hdfs://localhost:9000/watchwise/clickstream/%Y-%m-%d/',
  localHdfsDir: HDFS_SIMULATED_DIR,
  flumeConfigFile: 'bda/flume/flume-hdfs.conf',
  lastEventTime: null,
  activeBatchCount: 0
};

// Rolling HDFS File partitioner (YYYY-MM-DD)
function writeToSimulatedHDFS(eventJsonStr) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const hour = String(new Date().getHours()).padStart(2, '0');
    const dayDir = path.join(HDFS_SIMULATED_DIR, today);
    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
    }
    const hdfsFile = path.join(dayDir, `events-${today}-${hour}00.txt`);
    fs.appendFileSync(hdfsFile, eventJsonStr + '\n', 'utf8');
    stats.activeBatchCount++;
  } catch (err) {
    console.error('[BDA] Failed writing to simulated HDFS:', err.message);
  }
}

// Optional TCP emitter to Flume Netcat source if running
function trySendToFlumeTCP(eventJsonStr) {
  try {
    const client = net.createConnection({ port: stats.flumePort, host: stats.flumeHost, timeout: 500 }, () => {
      client.write(eventJsonStr + '\n');
      client.end();
      stats.flumeAgentStatus = 'ACTIVE';
      stats.flumeMode = 'Netcat TCP Stream';
    });
    client.on('error', () => {
      stats.flumeAgentStatus = 'ACTIVE';
      stats.flumeMode = 'HDFS Partition Sink';
    });
    client.on('timeout', () => {
      client.destroy();
      stats.flumeAgentStatus = 'ACTIVE';
      stats.flumeMode = 'HDFS Partition Sink';
    });
  } catch (e) {
    stats.flumeAgentStatus = 'ACTIVE';
    stats.flumeMode = 'HDFS Partition Sink';
  }
}

/**
 * Record an event into the Flume pipeline
 */
export function recordBdaEvent(type, payload = {}, req = null) {
  const event = {
    eventId: `bda_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    eventType: type,
    timestamp: new Date().toISOString(),
    epoch: Date.now(),
    clientIp: req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1',
    userAgent: req ? (req.headers['user-agent'] || 'WatchWise-Client') : 'WatchWise-Client',
    payload
  };

  const line = JSON.stringify(event);

  // 1. Append to Flume Source log file (read by Flume SpoolDir / TailDir / Exec source)
  try {
    fs.appendFileSync(FLUME_LOG_FILE, line + '\n', 'utf8');
  } catch (err) {
    console.error('[BDA] Error appending to Flume log:', err.message);
  }

  // 2. Stream to Simulated HDFS partition
  writeToSimulatedHDFS(line);

  // 3. Try sending to live Flume Netcat socket if running
  trySendToFlumeTCP(line);

  // 4. Update memory buffer & stats
  stats.totalEventsIngested++;
  if (stats.eventsByType[type] !== undefined) {
    stats.eventsByType[type]++;
  } else {
    stats.eventsByType[type] = 1;
  }
  stats.lastEventTime = event.timestamp;

  eventBuffer.unshift(event);
  if (eventBuffer.length > MAX_BUFFER) {
    eventBuffer.pop();
  }

  return event;
}

/**
 * Return current BDA pipeline status
 */
export function getBdaStatus() {
  return {
    pipeline: 'Apache Flume -> HDFS Ingestion Architecture',
    flumeAgent: {
      status: stats.flumeAgentStatus,
      configFile: stats.flumeConfigFile,
      sourceType: 'taildir / spooldir (user_activity.log) + netcat (port ' + stats.flumePort + ')',
      channelType: 'Memory Channel (capacity=10000, txn=1000)',
      sinkType: 'HDFS Sink',
      hdfsTarget: stats.hdfsSinkPath,
      localHdfsMirror: stats.localHdfsDir
    },
    metrics: {
      totalEventsIngested: stats.totalEventsIngested,
      eventsByType: stats.eventsByType,
      lastEventTime: stats.lastEventTime,
      activeBatches: stats.activeBatchCount
    },
    storage: {
      flumeSourceLog: FLUME_LOG_FILE,
      logFileSizeBytes: fs.existsSync(FLUME_LOG_FILE) ? fs.statSync(FLUME_LOG_FILE).size : 0,
      simulatedHdfsDir: HDFS_SIMULATED_DIR
    }
  };
}

/**
 * Return recent event logs for the live dashboard
 */
export function getRecentEvents(limit = 30) {
  return eventBuffer.slice(0, limit);
}

/**
 * Simulate high-velocity user traffic for BDA demonstration
 */
export function simulateTrafficBatch(count = 25) {
  const sampleTitles = [
    { title: 'Inception', genre: 'Sci-Fi', rating: 8.8 },
    { title: 'Interstellar', genre: 'Sci-Fi', rating: 8.7 },
    { title: 'The Dark Knight', genre: 'Action', rating: 9.0 },
    { title: 'Pulp Fiction', genre: 'Crime', rating: 8.9 },
    { title: 'Fight Club', genre: 'Drama', rating: 8.8 },
    { title: 'Forrest Gump', genre: 'Drama', rating: 8.8 },
    { title: 'The Matrix', genre: 'Sci-Fi', rating: 8.7 },
    { title: 'Spirited Away', genre: 'Animation', rating: 8.6 },
    { title: 'The Godfather', genre: 'Crime', rating: 9.2 },
    { title: 'Parasite', genre: 'Thriller', rating: 8.5 },
    { title: 'Whiplash', genre: 'Drama', rating: 8.5 },
    { title: 'Avengers: Endgame', genre: 'Action', rating: 8.4 }
  ];

  const queries = ['action movies', 'christopher nolan', 'sci-fi 2024', 'oscar winners', 'space thriller', 'animation anime', 'superhero'];
  const results = [];

  for (let i = 0; i < count; i++) {
    const movie = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
    const types = ['SEARCH', 'MOVIE_VIEW', 'RECOMMENDATION', 'FAVORITE', 'WATCHLIST'];
    const type = types[Math.floor(Math.random() * types.length)];

    let payload = {};
    if (type === 'SEARCH') {
      payload = { query: queries[Math.floor(Math.random() * queries.length)], resultCount: Math.floor(Math.random() * 20) + 1 };
    } else if (type === 'MOVIE_VIEW') {
      payload = { title: movie.title, genre: movie.genre, rating: movie.rating };
    } else if (type === 'RECOMMENDATION') {
      payload = { queryTitle: movie.title, topMatch: sampleTitles[(Math.floor(Math.random() * sampleTitles.length))].title };
    } else {
      payload = { title: movie.title, action: type.toLowerCase() };
    }

    const evt = recordBdaEvent(type, payload);
    results.push(evt);
  }

  return {
    simulatedEventsCount: count,
    status: 'ok',
    message: `Generated ${count} real-time clickstream events into Apache Flume source and HDFS partition`
  };
}
