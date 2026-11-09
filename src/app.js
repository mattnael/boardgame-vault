const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi Database Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inisialisasi Tabel Database saat Startup
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        duration INT NOT NULL,
        difficulty VARCHAR(50) NOT NULL,
        review TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tabel games berhasil disiapkan.');
  } catch (err) {
    console.error('Gagal menginisialisasi database:', err);
  }
}
initDB();

// 1. Endpoint Health Check (Wajib)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// 2. Endpoint Halaman Utama (Frontend + Tampil Data GET)
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games ORDER BY id DESC');
    res.render('index', { games: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Terjadi kesalahan pada server.');
  }
});

// 3. Endpoint API JSON Baca Data (GET)
app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games ORDER BY id DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Endpoint Tulis Data (POST)
app.post('/api/games', async (req, res) => {
  const { title, category, duration, difficulty, review } = req.body;
  if (!title || !category || !duration || !difficulty) {
    return res.status(400).json({ error: 'Field wajib tidak boleh kosong.' });
  }

  try {
    const query = `
      INSERT INTO games (title, category, duration, difficulty, review)
      VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `;
    const values = [title, category, parseInt(duration, 10), difficulty, review || ''];
    const newGame = await pool.query(query, values);
    
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
      return res.redirect('/');
    }
    res.status(201).json(newGame.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan pada port ${port}`);
});