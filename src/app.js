const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('redis');
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

// Konfigurasi Redis Client
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

async function startRedis() {
  await redisClient.connect();
  console.log('Terhubung ke Redis Cache.');
}
startRedis();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Healthcheck Endpoint (termasuk status Redis & Database)
app.get('/health', async (req, res) => {
  let redisStatus = 'UP';
  try {
    await redisClient.ping();
  } catch (e) {
    redisStatus = 'DOWN';
  }

  res.status(200).json({
    status: 'UP',
    database: 'CONNECTED',
    redis_cache: redisStatus,
    timestamp: new Date().toISOString()
  });
});

// READ: Beranda dengan Redis Cache untuk Statistik
app.get('/', async (req, res) => {
  const { search, difficulty, sort } = req.query;
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

    if (sort === 'title_asc') {
      query += ' ORDER BY title ASC';
    } else if (sort === 'title_desc') {
      query += ' ORDER BY title DESC';
    } else if (sort === 'duration_asc') {
      query += ' ORDER BY duration ASC';
    } else if (sort === 'duration_desc') {
      query += ' ORDER BY duration DESC';
    } else {
      query += ' ORDER BY id DESC';
    }

    const result = await pool.query(query, params);
    
    // Cek Cache Redis untuk Statistik Dashboard
    let stats;
    const cacheKey = 'dashboard_stats';
    const cachedStats = await redisClient.get(cacheKey);

    if (cachedStats) {
      stats = JSON.parse(cachedStats);
    } else {
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) AS total_games,
          COALESCE(ROUND(AVG(duration)), 0) AS avg_duration
        FROM games
      `);
      stats = statsResult.rows[0];
      // Simpan ke Redis selama 60 detik
      await redisClient.setEx(cacheKey, 60, JSON.stringify(stats));
    }

    res.render('index', { 
      games: result.rows, 
      stats, 
      search: search || '', 
      selectedDifficulty: difficulty || 'Semua',
      selectedSort: sort || 'newest'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// CREATE: Halaman Tambah
app.get('/games/new', (req, res) => {
  res.render('new');
});

// CREATE: Simpan Data & Hapus Cache agar Statistik Ter-update
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
    // Invalidate/Hapus cache statistik saat ada data baru
    await redisClient.del('dashboard_stats');
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
    await redisClient.del('dashboard_stats');
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
    await redisClient.del('dashboard_stats');
    res.redirect('/');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Gagal menghapus data.');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});