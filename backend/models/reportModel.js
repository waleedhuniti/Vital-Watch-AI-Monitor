import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  hrv: Number,
  vascularAging: Number,
  heartRate: Number,
  stress: Number,
  bpSystolic: Number,
  bpDiastolic: Number,
  mood: Number,
  respirationRate: Number,
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

const Report = mongoose.model('Report', reportSchema);

export default Report;
