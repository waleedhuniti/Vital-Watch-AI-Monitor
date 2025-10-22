import noble from '@abandonware/noble';
import { broadcastVitals, broadcastSnapshot, getIoInstance } from './socketService.js';
import Report from '../models/reportModel.js';

const VITAL_WATCH_SERVICE_UUID = 'fff0';
let txCharacteristic = null;
let bleState = {
  blePoweredOn: false,
  deviceConnected: false,
  deviceName: null,
};

// --- Command Helper ---
const calculateCRC = (data) => {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    sum += data[i];
  }
  return sum & 0xFF;
};

const writeCommand = async (commandBytes) => {
  if (!txCharacteristic) {
    console.error('❌ Cannot write command: TX characteristic not available.');
    return;
  }
  const command = new Uint8Array(16);
  command.set(commandBytes);
  command[15] = calculateCRC(command);
  try {
    await txCharacteristic.writeValue(command);
    console.log('⬆️  Command sent:', Array.from(command).map(b => b.toString(16).padStart(2, '0')).join(' '));
  } catch (error) {
    console.error('❌ Failed to write command:', error);
  }
};

// --- BLE Logic ---
export const startBleScan = () => {
  if (bleState.deviceConnected) {
      console.log('Device already connected. Skipping scan.');
      return;
  }
  noble.on('stateChange', async (state) => {
    bleState.blePoweredOn = (state === 'poweredOn');
    if (bleState.blePoweredOn) {
      console.log('🔵 BLE Powered On. Starting scan for Vital Watch...');
      await noble.startScanningAsync([VITAL_WATCH_SERVICE_UUID], false);
    } else {
      console.log('🔴 BLE is not powered on. Please enable Bluetooth.');
      await noble.stopScanningAsync();
    }
  });

  noble.on('discover', async (peripheral) => {
    console.log(`✅ Found device: ${peripheral.advertisement.localName} [${peripheral.id}]`);
    await noble.stopScanningAsync();
    await connectToDevice(peripheral);
  });
};

const connectToDevice = async (peripheral) => {
  try {
    await peripheral.connectAsync();
    console.log('✅ Connected to device.');
    bleState.deviceConnected = true;
    bleState.deviceName = peripheral.advertisement.localName;

    peripheral.once('disconnect', () => {
      console.log('🔴 Device disconnected. Restarting scan...');
      bleState.deviceConnected = false;
      bleState.deviceName = null;
      txCharacteristic = null;
      broadcastVitals({ connected: false });
      setTimeout(startBleScan, 5000); // Wait 5 seconds before rescanning
    });

    const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['fff0'], ['fff6', 'fff7']);
    txCharacteristic = characteristics.find(c => c.uuid === 'fff6');
    const rxCharacteristic = characteristics.find(c => c.uuid === 'fff7');

    if (txCharacteristic && rxCharacteristic) {
      console.log('✅ Found TX and RX characteristics.');
      await rxCharacteristic.subscribeAsync();
      rxCharacteristic.on('data', (data) => handleNotification(data));

      // Register for socket events from the frontend
      const io = getIoInstance();
      io.on('connection', (socket) => {
        socket.on('start-vitals-snapshot', () => writeCommand([0x99, 0x00, 0x00]));
        socket.on('start-ecg-stream', () => writeCommand([0x99, 0x01, 0x00])); // Example for ECG only
        socket.on('stop-ecg-stream', () => writeCommand([0x98]));
      });

      // Send initial commands to start real-time data
      await writeCommand([0x09, 0x01, 0x01]); // Start real-time steps/hr/temp
      await writeCommand([0x28, 0x03, 0x01]); // Start real-time SpO2/BP
    }
  } catch (error) {
    console.error('❌ Failed to connect or setup device:', error);
    bleState.deviceConnected = false;
  }
};

const handleNotification = async (data) => {
  const dataView = new DataView(data.buffer);
  const commandId = dataView.getUint8(0);
  console.log('⬇️  Data received:', Array.from(new Uint8Array(data.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));

  if (commandId === 0x28) {
    const liveVitals = {
      heartRate: dataView.getUint8(2),
      bloodOxygen: dataView.getUint8(3),
      bpSystolic: dataView.getUint8(6),
      bpDiastolic: dataView.getUint8(7),
      connected: true,
    };
    broadcastVitals(liveVitals);
  } else if (commandId === 0x9C && dataView.getUint8(1) === 3) {
    const snapshot = {
      hrv: dataView.getUint8(2),
      vascularAging: dataView.getUint8(3),
      heartRate: dataView.getUint8(4),
      stress: dataView.getUint8(5),
      bpSystolic: dataView.getUint8(6),
      bpDiastolic: dataView.getUint8(7),
      mood: dataView.getUint8(8),
      respirationRate: dataView.getUint8(9),
    };
    broadcastSnapshot(snapshot);
    // Save the report to the database
    try {
        const report = new Report(snapshot);
        await report.save();
        console.log('✅ Snapshot report saved to database.');
    } catch (dbError) {
        console.error('❌ Error saving report to DB:', dbError);
    }
  }
  // Add handlers for 0xAA (ECG) and 0xAB (PPG) if needed for streaming
};

export const getBleState = () => bleState;
