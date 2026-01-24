const express = require('express');
const cors = require('cors');
const path = require('path');

const sensorRoutes = require('./routes/sensors');
const plantRoutes = require('./routes/plants');
const taskRoutes = require('./routes/tasks');
const weatherRoutes = require('./routes/weather');
const bedRoutes = require('./routes/beds');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Ecowitt sends form-encoded data

// API Routes
app.use('/api/sensors', sensorRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/beds', bedRoutes);

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Garden Dashboard running at http://localhost:${PORT}`);
  console.log(`Ecowitt webhook endpoint: http://<your-pi-ip>:${PORT}/api/sensors/ecowitt`);
});
