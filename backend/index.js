import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { initializeSocket } from './services/socketService.js';
import { startBleScan, getBleState } from './services/bleService.js';
import Report from './models/reportModel.js';

dotenv.config( );

const app = express();
const server = http.createServer(app );

// Middleware
const corsOptions = {
  origin: [process.env.CORS_ORIGIN, 'http://localhost:5173'], // Allow local dev and prod
  methods: ["GET", "POST"]
};
app.use(cors(corsOptions ));
app.use(express.json());

// WebSocket Server
const io = new Server(server, { cors: corsOptions });
initializeSocket(io);

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    // Start scanning for BLE devices
    startBleScan();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- API Routes ---
app.get('/api/status', (req, res) => {
  res.json(getBleState());
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).limit(20);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reports', error });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Backend gateway running on port ${PORT}`));
