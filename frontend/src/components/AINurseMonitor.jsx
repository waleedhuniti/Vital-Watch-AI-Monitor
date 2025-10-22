import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Heart, Activity, Droplet, Thermometer, Wind, Battery, Users, Download, AlertCircle, Settings, FileText, Zap, Bell, CheckCircle, XCircle, Brain, Stethoscope, Upload, Watch } from 'lucide-react';

// Use environment variable for the backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AINurseMonitor = ( ) => {
  // --- STATE MANAGEMENT ---
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [socket, setSocket] = useState(null);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);

  // Data states
  const [liveData, setLiveData] = useState({ heartRate: 0, bloodOxygen: 0, bpSystolic: 0, bpDiastolic: 0 });
  const [vitalsSnapshot, setVitalsSnapshot] = useState(null);
  const [vitalsSnapshotInProgress, setVitalsSnapshotInProgress] = useState(false);
  
  // Chart and UI states
  const [heartRateHistory, setHeartRateHistory] = useState([]);
  const [spo2History, setSpo2History] = useState([]);
  const maxDataPoints = 50;

  // --- EFFECT FOR SOCKET CONNECTION ---
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connected to backend gateway!');
      setGatewayConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔴 Disconnected from backend gateway.');
      setGatewayConnected(false);
      setDeviceConnected(false);
    });

    newSocket.on('live-vitals', (data) => {
      if (data.connected === false) {
        setDeviceConnected(false);
        return;
      }
      setDeviceConnected(true);
      setLiveData(prev => ({ ...prev, ...data }));
      addToChartHistory(data.heartRate, data.bloodOxygen);
    });
    
    newSocket.on('vitals-snapshot-result', (snapshot) => {
        setVitalsSnapshot(snapshot);
        setVitalsSnapshotInProgress(false);
        alert('Vitals Snapshot Completed!');
    });

    return () => newSocket.disconnect();
  }, []);

  // --- ACTIONS ---
  const startVitalsSnapshot = () => {
    if (socket && deviceConnected) {
      setVitalsSnapshot(null); // Clear previous snapshot
      setVitalsSnapshotInProgress(true);
      socket.emit('start-vitals-snapshot');
      // Set a timeout to prevent infinite loading state
      setTimeout(() => {
          if (vitalsSnapshotInProgress) {
              setVitalsSnapshotInProgress(false);
              alert("Snapshot request timed out. Please try again.");
          }
      }, 65000); // 65 seconds
    } else {
      alert("Device is not connected via the gateway.");
    }
  };

  const addToChartHistory = (hr, spo2) => {
    const timestamp = new Date();
    if (hr > 0) setHeartRateHistory(prev => [...prev, { time: timestamp, value: hr }].slice(-maxDataPoints));
    if (spo2 > 0) setSpo2History(prev => [...prev, { time: timestamp, value: spo2 }].slice(-maxDataPoints));
  };

  // --- UI COMPONENTS ---
  // All your UI components (VitalCard, LineChart, VitalsSnapshotCard, etc.) go here.
  // They are perfect as they are. I will include the VitalsSnapshotCard for completeness.
  const VitalsSnapshotCard = ({ snapshot, inProgress }) => {
    if (!inProgress && !snapshot) return null;
    const SnapshotItem = ({ label, value, unit }) => (
      <div className="bg-purple-50 p-4 rounded-lg text-center">
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-purple-700">{value}</p>
        <p className="text-xs text-gray-500">{unit}</p>
      </div>
    );
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Watch className="w-6 h-6 text-purple-600" />Comprehensive Vitals Snapshot</h3>
        {inProgress && !snapshot && (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-purple-500 mx-auto animate-pulse mb-4" />
            <p className="font-semibold text-purple-800">Measurement in progress...</p>
            <p className="text-sm text-gray-600">Please remain still. This will take about a minute.</p>
          </div>
        )}
        {snapshot && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Measurement completed</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
              <SnapshotItem label="HRV" value={snapshot.hrv} unit="ms" />
              <SnapshotItem label="Blood Pressure" value={`${snapshot.bpSystolic}/${snapshot.bpDiastolic}`} unit="mmHg" />
              <SnapshotItem label="Stress" value={snapshot.stress} unit="" />
              <SnapshotItem label="Mood" value={snapshot.mood} unit="" />
              <SnapshotItem label="Heart Rate" value={snapshot.heartRate} unit="BPM" />
              <SnapshotItem label="Vascular Age" value={snapshot.vascularAging} unit="yrs" />
              <SnapshotItem label="Resp. Rate" value={snapshot.respirationRate} unit="BPM" />
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // --- RENDER LOGIC ---
  // The rest of your main component's return statement, pages, etc.
  // Make sure to update buttons and status indicators.
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Your main layout and navigation */}
      <div className="p-4">
        <div className="flex justify-end items-center gap-4 mb-4">
            <div className="flex items-center gap-2" title="Connection to the backend server">
                <div className={`w-3 h-3 rounded-full ${gatewayConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">Gateway</span>
            </div>
            <div className="flex items-center gap-2" title="Connection to the physical watch">
                <div className={`w-3 h-3 rounded-full ${deviceConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm">Device</span>
            </div>
        </div>
        
        {/* Example of updated button on Monitor Page */}
        <button 
            onClick={startVitalsSnapshot} 
            disabled={!deviceConnected || vitalsSnapshotInProgress}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            <Watch className="w-5 h-5" />
            {vitalsSnapshotInProgress ? 'Measuring...' : 'Start Vitals Snapshot'}
        </button>

        <VitalsSnapshotCard snapshot={vitalsSnapshot} inProgress={vitalsSnapshotInProgress} />
        {/* ... rest of your UI */}
      </div>
    </div>
  );
};

export default AINurseMonitor;
