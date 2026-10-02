import express from 'express';
import axios from 'axios';
import { popularMovies, getRecommendations, getAllGenres, getMoviesByGenre } from '../data/store.js';
import { recordBdaEvent } from '../bda/flume_collector.js';

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// Helper: enrich an ML movie object with poster/year from popularMovies if title matches
// Returns null if the movie has no verified image so it can be cleanly filtered out
function enrichMLMovie(m) {
  if (!m) return null;
  const match = popularMovies.find(p => p.title.toLowerCase() === (m.title || '').toLowerCase());
  const poster = match?.poster || m.poster || null;
  
  // If no verified poster is available, do not return it
  if (!poster || poster.includes('unsplash')) {
    return null;
  }

  const genres = (m.genres && m.genres.length) ? m.genres : (match ? match.genre : ['Drama']);
  return {
    tmdb_id: match ? match.tmdb_id : m.tmdb_id,
    title: match ? match.title : m.title,
    rating: match?.rating || m.rating || 7.5,
    year: match ? match.year : (m.year || 2018),
    genre: Array.isArray(genres) ? genres : (genres || '').split(' ').filter(Boolean),
    poster: poster,
    overview: match?.overview || m.overview || 'Plot synopsis available in the full dataset.',
    director: match?.director || 'Acclaimed Director'
  };
}

// GET /api/movies/genres — get all genres with counts
router.get('/genres', (req, res) => {
  const genres = getAllGenres();
  res.json({
    status: 'ok',
    data: genres,
    totalGenres: genres.length
  });
});

// GET /api/movies/genre/:genre — get movies filtered by genre (only movies with verified posters)
router.get('/genre/:genre', async (req, res) => {
  const { genre } = req.params;
  const limit = parseInt(req.query.limit) || 48;
  const offset = parseInt(req.query.offset) || 0;

  let movies = [];
  const localMatches = getMoviesByGenre(genre, limit);

  // 1. Query ML service for matching titles in the 45k dataset
  try {
    const mlRes = await axios.get(
      `${ML_SERVICE_URL}/genre?genre=${encodeURIComponent(genre)}&limit=${limit}&offset=${offset}`,
      { timeout: 4000 }
    );
    if (mlRes.data?.status === 'ok' && mlRes.data.data?.length > 0) {
      const mlEnriched = mlRes.data.data
        .map(enrichMLMovie)
        .filter(Boolean);

      const seen = new Set();
      for (const m of [...mlEnriched, ...localMatches]) {
        const key = m.title.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          movies.push(m);
        }
      }
    }
  } catch (err) {
    // ML service offline or slow; use local matches
  }

  if (movies.length === 0) {
    movies = localMatches;
  }

  // Ensure ONLY movies with verified active posters are returned
  const verifiedMovies = movies.filter(m => m && m.poster && !m.poster.includes('unsplash'));

  res.json({
    status: 'ok',
    genre,
    count: verifiedMovies.length,
    total: verifiedMovies.length,
    source: 'verified_catalog',
    data: verifiedMovies.slice(0, limit)
  });
});

// GET /api/movies/home — featured movies for homepage
router.get('/home', (req, res) => {
  const verified = popularMovies.filter(m => m.poster && !m.poster.includes('unsplash'));
  const featured = verified.slice(0, 8);
  const trending = [...verified].sort((a, b) => b.rating - a.rating).slice(0, 12);
  const topPicks = [...verified].sort(() => Math.random() - 0.5).slice(0, 16);
  const genres = getAllGenres();

  res.json({
    status: 'ok',
    data: {
      featured,
      trending,
      topPicks,
      genres,
      totalMovies: verified.length,
      datasetSize: '45,447 movies (50,000 TF-IDF features)'
    }
  });
});

// GET /api/movies/search?query=<term>
router.get('/search', async (req, res) => {
  const { query = '', genre = '' } = req.query;
  
  if (genre && !query) {
    const results = getMoviesByGenre(genre, 30).filter(m => m && m.poster && !m.poster.includes('unsplash'));
    return res.json({ status: 'ok', data: results, query: genre });
  }

  if (!query.trim()) {
    return res.json({ status: 'ok', data: [], query: '' });
  }

  // 1. Query ML Engine with 45,447 movies
  try {
    const mlRes = await axios.get(`${ML_SERVICE_URL}/search?query=${encodeURIComponent(query)}&limit=30`, { timeout: 3500 });
    if (mlRes.data?.status === 'ok' && mlRes.data.data?.length > 0) {
      const enriched = mlRes.data.data
        .map(enrichMLMovie)
        .filter(Boolean);
      if (enriched.length > 0) {
        recordBdaEvent('SEARCH', { query, count: enriched.length, source: 'ml_engine' }, req);
        return res.json({ status: 'ok', source: 'ml_engine_45k', data: enriched, query });
      }
    }
  } catch (err) {
    // fallback seamlessly
  }

  const results = getRecommendations(query, 24).filter(m => m && m.poster && !m.poster.includes('unsplash'));
  recordBdaEvent('SEARCH', { query, count: results.length, source: 'local_store' }, req);
  res.json({ status: 'ok', source: 'local_store', data: results, query });
});

// GET /api/movies/bundle?query=<term> — search + recommendations
router.get('/bundle', (req, res) => {
  const { query = '' } = req.query;
  const results = getRecommendations(query, 6).filter(m => m && m.poster && !m.poster.includes('unsplash'));
  const recommendations = getRecommendations('action', 4).filter(m => m && m.poster && !m.poster.includes('unsplash'));
  res.json({
    status: 'ok',
    query,
    data: {
      results,
      recommendations,
    }
  });
});

// GET /api/movies/:tmdb_id — get single movie details + genre-accurate recommendations
router.get('/:tmdb_id', async (req, res) => {
  const id = parseInt(req.params.tmdb_id);
  let movie = popularMovies.find(m => m.tmdb_id === id);

  // If not in static list, retrieve from 45,447 ML dataset
  if (!movie) {
    try {
      const mlMovieRes = await axios.get(`${ML_SERVICE_URL}/movie/${id}`, { timeout: 3000 });
      if (mlMovieRes.data?.status === 'ok' && mlMovieRes.data.data) {
        movie = enrichMLMovie(mlMovieRes.data.data);
      }
    } catch (e) {}
  }

  if (!movie) {
    return res.status(404).json({ status: 'error', message: 'Movie not found' });
  }

  const movieGenres = (movie.genre || []).map(g => g.toLowerCase());
  const isHorror = movieGenres.includes('horror');
  const isAnimation = movieGenres.includes('animation');

  let similar = [];

  // 1. Query Python ML Engine for Cosine Similarity from the 45,447 movie dataset!
  try {
    const mlRes = await axios.get(`${ML_SERVICE_URL}/recommend?title=${encodeURIComponent(movie.title)}&limit=24`, { timeout: 5000 });
    if (mlRes.data?.status === 'ok' && mlRes.data.data?.length > 0) {
      similar = mlRes.data.data
        .map(enrichMLMovie)
        .filter(Boolean)
        .filter(s => {
          const sGenres = (s.genre || []).map(g => g.toLowerCase());
          if (isHorror) return sGenres.includes('horror');
          if (isAnimation) return sGenres.includes('animation');
          return true;
        });
    }
  } catch (e) {
    // Fallback if ML service offline
  }

  // 2. Strict & intelligent genre relevance scoring for recommendation fallback
  function computeRelevance(cand) {
    if (cand.tmdb_id === id || cand.title.toLowerCase() === movie.title.toLowerCase()) return -9999;
    const candGenres = (cand.genre || []).map(g => g.toLowerCase());
    const candIsHorror = candGenres.includes('horror');
    const candIsAnim = candGenres.includes('animation');

    // Strict genre isolation for Horror: Horror movies MUST only suggest Horror!
    if (isHorror && !candIsHorror) return -9999;
    if (!isHorror && candIsHorror) return -9999;

    // Strict genre isolation for Animation: Animation movies MUST only suggest Animation!
    if (isAnimation && !candIsAnim) return -9999;
    if (!isAnimation && candIsAnim) return -9999;

    let score = 0;
    // Overlapping genre points
    for (const g of candGenres) {
      if (movieGenres.includes(g)) score += 25;
    }

    // Primary genre match bonus
    if (movieGenres[0] && candGenres[0] && movieGenres[0] === candGenres[0]) {
      score += 35;
    }

    // Small rating tiebreaker
    score += (cand.rating || 7.0);
    return score;
  }

  // Supplement recommendations from verified popularMovies catalog
  const scoredCatalog = popularMovies
    .map(cand => ({ movie: cand, score: computeRelevance(cand) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const item of scoredCatalog) {
    const cand = item.movie;
    if (!similar.some(s => s.tmdb_id === cand.tmdb_id || s.title.toLowerCase() === cand.title.toLowerCase())) {
      similar.push(cand);
    }
    if (similar.length >= 8) break;
  }

  // Record BDA event for Flume ingestion
  recordBdaEvent('MOVIE_VIEW', {
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    genre: movie.genre,
    rating: movie.rating
  }, req);

  if (similar.length > 0) {
    recordBdaEvent('RECOMMENDATION', {
      queryTitle: movie.title,
      count: similar.length,
      topRecommendation: similar[0]?.title || null
    }, req);
  }

  res.json({ status: 'ok', data: { ...movie, similar } });
});

export default router;
