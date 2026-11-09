const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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

// Pastikan folder public/uploads ada
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.static(path.join(__dirname, '../public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        duration INT NOT NULL,
        difficulty VARCHAR(50) NOT NULL,
        image_url TEXT,
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

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// READ: Menampilkan semua data dengan dukungan Search & Filter
app.get('/', async (req, res) => {
  const { search, difficulty } = req.query;
  try {
    let query = 'SELECT * FROM games WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR category ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (difficulty && difficulty !== 'Semua') {
      query += ` AND difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    query += ' ORDER BY id DESC';

    const result = await pool.query(query, params);
    
    // Ambil statistik ringkasan untuk Dashboard
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) AS total_games,
        COALESCE(ROUND(AVG(duration)), 0) AS avg_duration
      FROM games
    `);
    const stats = statsResult.rows[0];

    res.render('index', { 
      games: result.rows, 
      stats, 
      search: search || '', 
      selectedDifficulty: difficulty || 'Semua' 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.post('/games', upload.single('image'), async (req, res) => {
  const { title, category, duration, difficulty, review } = req.body;
  
  let finalImage = req.file 
    ? `/uploads/${req.file.filename}` 
    : `https://picsum.photos/seed/${encodeURIComponent(title || 'boardgame')}/800/600`;

  try {
    await pool.query(
      'INSERT INTO games (title, category, duration, difficulty, image_url, review) VALUES ($1, $2, $3, $4, $5, $6)',
      [title, category, parseInt(duration, 10), difficulty, finalImage, review || '']
    );
    res.status(201).redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal menambah data.');
  }
});

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

app.post('/games/edit/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, category, duration, difficulty, review, current_image } = req.body;
  
  let finalImage = req.file ? `/uploads/${req.file.filename}` : current_image;

  try {
    await pool.query(
      'UPDATE games SET title = $1, category = $2, duration = $3, difficulty = $4, image_url = $5, review = $6 WHERE id = $7',
      [title, category, parseInt(duration, 10), difficulty, finalImage, review || '', id]
    );
    res.redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal memperbarui data.');
  }
});

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