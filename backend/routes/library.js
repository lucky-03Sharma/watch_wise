import express from 'express';
import { memoryStore } from '../data/store.js';
import { recordBdaEvent } from '../bda/flume_collector.js';

const router = express.Router();

// GET /api/library/favorites
router.get('/favorites', (req, res) => {
  res.json({ status: 'ok', data: memoryStore.favorites });
});

// POST /api/library/favorites
router.post('/favorites', (req, res) => {
  const { tmdb_id, title, poster, rating, year, genre, director, overview } = req.body;
  const idNum = Number(tmdb_id);
  if (!idNum) return res.status(400).json({ status: 'error', message: 'tmdb_id required' });
  
  const exists = memoryStore.favorites.find(f => Number(f.tmdb_id) === idNum);
  if (exists) return res.json({ status: 'ok', message: 'Already in favorites', data: exists });
  
  const entry = {
    tmdb_id: idNum,
    title,
    poster,
    rating: Number(rating) || 7.5,
    year: Number(year) || 2018,
    genre: Array.isArray(genre) ? genre : [genre].filter(Boolean),
    director: director || 'N/A',
    overview: overview || '',
    addedAt: new Date().toISOString()
  };
  memoryStore.favorites.push(entry);
  recordBdaEvent('FAVORITE', { tmdb_id: idNum, title, genre: entry.genre }, req);
  res.json({ status: 'ok', message: 'Added to favorites', data: entry });
});

// DELETE /api/library/favorites/:tmdb_id
router.delete('/favorites/:tmdb_id', (req, res) => {
  const id = Number(req.params.tmdb_id);
  memoryStore.favorites = memoryStore.favorites.filter(f => Number(f.tmdb_id) !== id);
  res.json({ status: 'ok', message: 'Removed from favorites' });
});

// GET /api/library/watchlist
router.get('/watchlist', (req, res) => {
  res.json({ status: 'ok', data: memoryStore.watchlist });
});

// POST /api/library/watchlist
router.post('/watchlist', (req, res) => {
  const { tmdb_id, title, poster, rating, year, genre, director, overview } = req.body;
  const idNum = Number(tmdb_id);
  if (!idNum) return res.status(400).json({ status: 'error', message: 'tmdb_id required' });
  
  const exists = memoryStore.watchlist.find(w => Number(w.tmdb_id) === idNum);
  if (exists) return res.json({ status: 'ok', message: 'Already in watchlist', data: exists });
  
  const entry = {
    tmdb_id: idNum,
    title,
    poster,
    rating: Number(rating) || 7.5,
    year: Number(year) || 2018,
    genre: Array.isArray(genre) ? genre : [genre].filter(Boolean),
    director: director || 'N/A',
    overview: overview || '',
    addedAt: new Date().toISOString()
  };
  memoryStore.watchlist.push(entry);
  recordBdaEvent('WATCHLIST', { tmdb_id: idNum, title, genre: entry.genre }, req);
  res.json({ status: 'ok', message: 'Added to watchlist', data: entry });
});

// DELETE /api/library/watchlist/:tmdb_id
router.delete('/watchlist/:tmdb_id', (req, res) => {
  const id = Number(req.params.tmdb_id);
  memoryStore.watchlist = memoryStore.watchlist.filter(w => Number(w.tmdb_id) !== id);
  res.json({ status: 'ok', message: 'Removed from watchlist' });
});

// GET /api/library/reviews/:tmdb_id
router.get('/reviews/:tmdb_id', (req, res) => {
  const id = Number(req.params.tmdb_id);
  const reviews = memoryStore.reviews[id] || [];
  res.json({ status: 'ok', data: reviews });
});

// POST /api/library/reviews/:tmdb_id
router.post('/reviews/:tmdb_id', (req, res) => {
  const id = Number(req.params.tmdb_id);
  const { user, text, rating } = req.body;
  if (!text) return res.status(400).json({ status: 'error', message: 'Review text required' });
  if (!memoryStore.reviews[id]) memoryStore.reviews[id] = [];
  const review = { id: Date.now(), user: user || 'Anonymous', text, rating: rating || 5, createdAt: new Date().toISOString() };
  memoryStore.reviews[id].push(review);
  recordBdaEvent('REVIEW', { tmdb_id: id, rating: review.rating, user: review.user }, req);
  res.json({ status: 'ok', message: 'Review added', data: review });
});

export default router;
