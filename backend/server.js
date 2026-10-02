import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import moviesRouter from './routes/movies.js';
import libraryRouter from './routes/library.js';
import authRouter from './routes/auth.js';
import bdaRouter from './routes/bda.js';
import { getBdaStatus } from './bda/flume_collector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/movierecommender';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// MongoDB connection
let mongoConnected = false;
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  mongoConnected = true;
  console.log('Connected to MongoDB successfully at', MONGO_URI);
}).catch((err) => {
  console.warn(' MongoDB connection note:', err.message);
  console.log('Running in resilient mode with memory persistence fallback.');
});

mongoose.connection.on('connected', () => { mongoConnected = true; });
mongoose.connection.on('disconnected', () => { mongoConnected = false; });

// Serve frontend static files
app.use(express.static(join(__dirname, '../public')));

// API Routes
app.use('/api/movies', moviesRouter);
app.use('/api/library', libraryRouter);
app.use('/api/auth', authRouter);
app.use('/api/bda', bdaRouter);

// System Status endpoint
app.get('/api/status', async (req, res) => {
  let mlStatus = 'offline';
  let mlDetails = null;

  try {
    const mlCheck = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    if (mlCheck.data?.status === 'ok') {
      mlStatus = 'online';
      mlDetails = { url: ML_SERVICE_URL, status: 'ok', dataset: '45,447 movies loaded' };
    }
  } catch (e) {
    mlStatus = 'offline';
    mlDetails = { error: e.message };
  }

  res.json({
    status: 'online',
    server: 'Express.js MERN Backend',
    port: PORT,
    database: {
      type: 'MongoDB',
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState === 1 ? 'connected' : 'connecting/fallback'
    },
    mlEngine: {
      status: mlStatus,
      details: mlDetails
    },
    bdaPipeline: getBdaStatus(),
    timestamp: new Date().toISOString()
  });
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(` Express MERN server running at http://localhost:${PORT}`);
});
