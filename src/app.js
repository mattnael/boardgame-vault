const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secretpassword',
  database: process.env.DB_NAME || 'boardgame_vault_db',
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inisialisasi tabel database otomatis
async function initDb() {
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
    console.log('Database tabel games siap.');
  } catch (err) {
    console.error('Gagal inisialisasi database:', err.message);
  }
}
initDb();

// Health Check Endpoint (Wajib Soal)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// READ: Menampilkan semua data (GET /)
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM games ORDER BY id DESC');
    res.render('index', { games: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// CREATE: Menambah data baru (POST /games)
app.post('/games', async (req, res) => {
  const { title, category, duration, difficulty, review } = req.body;
  try {
    await pool.query(
      'INSERT INTO games (title, category, duration, difficulty, review) VALUES ($1, $2, $3, $4, $5)',
      [title, category, parseInt(duration, 10), difficulty, review || '']
    );
    res.status(201).redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal menambah data.');
  }
});

// UPDATE: Halaman Form Edit (GET /games/edit/:id)
app.get('/games/edit/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Data tidak ditemukan');
    }
    res.render('edit', { game: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// UPDATE: Proses Simpan Perubahan (POST /games/edit/:id)
app.post('/games/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { title, category, duration, difficulty, review } = req.body;
  try {
    await pool.query(
      'UPDATE games SET title = $1, category = $2, duration = $3, difficulty = $4, review = $5 WHERE id = $6',
      [title, category, parseInt(duration, 10), difficulty, review || '', id]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal memperbarui data.');
  }
});

// DELETE: Hapus data (POST /games/delete/:id)
app.post('/games/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM games WHERE id = $1', [id]);
    res.redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal menghapus data.');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});