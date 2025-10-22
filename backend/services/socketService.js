let io = null;

export const initializeSocket = (socketIoInstance) => {
  io = socketIoInstance;
  io.on('connection', (socket) => {
    console.log('✅ Web client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('🔴 Web client disconnected:', socket.id);
    });
  });
};

export const broadcastVitals = (vitals) => {
  if (io) {
    io.emit('live-vitals', vitals);
  }
};

export const broadcastSnapshot = (snapshot) => {
  if (io) {
    io.emit('vitals-snapshot-result', snapshot);
  }
};

export const getIoInstance = () => io;
