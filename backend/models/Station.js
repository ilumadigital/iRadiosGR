const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  title: { type: String, required: true },
  host: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' }
});

const scheduleFeedSchema=new mongoose.Schema({
  enabled:{type:Boolean,default:false},
  url:{type:String,default:''},
  rowTag:{type:String,default:''},
  mapping:{type:mongoose.Schema.Types.Mixed,default:{}},
  dayFormat:{type:String,enum:['iso','monday0','sunday0'],default:'iso'},
  lastCheckedAt:{type:Date,default:null},
  lastSuccessAt:{type:Date,default:null},
  lastChangedAt:{type:Date,default:null},
  lastHash:{type:String,default:''},
  lastCount:{type:Number,default:0},
  lastError:{type:String,default:''},
  failures:{type:Number,default:0},
  lockUntil:{type:Date,default:null}
},{_id:false});

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slogan: { type: String },
  description: { type: String },
  genre: { type: String, required: true },
  // Old records are left as-is until manually classified.
  secondaryGenre: { type: String, default: '' },
  country: { type: String, default: 'Ελλάδα' },
  region: { type: String },
  prefecture: { type: String, default: '' },
  city: { type: String },
  
  // 🟢 ΝΕΑ ΠΕΔΙΑ: Τύπος Μετάδοσης & Συχνότητα
  transmissionType: { 
    type: String, 
    enum: ['Επίγειο', 'Web Radio', 'DAB'], 
    default: 'Web Radio' 
  },
  frequency: { type: String, default: '' },

  plays: { type: Number, default: 0 },

  logo: { type: String, required: true },
  cover: { type: String },
  stream: { type: String, required: true },
  metadata: {type: String},
  website: { type: String },
  facebook: { type: String },
  instagram: { type: String },
  twitter: { type: String },
  tiktok: { type: String },
  phone: { type: String },
  viber: { 
    type: String, 
    match: [/^\+?[1-9]\d{7,14}$/, 'Το Viber πρέπει να είναι έγκυρος αριθμός τηλεφώνου (π.χ. +306912345678, +35799123456, +1234567890)'],
    default: null 
  },
  email: { type: String },
  explicit: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  // Approval and stream availability are independent: offline stations remain visible.
  isOffline: { type: Boolean, default: false },
  broadcasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  dspPreset: { type: String, default: 'OFF' },
  pendingEdits: { type: Object, default: null },
  slug: { type: String, unique: true, sparse: true },
  popularity: { type: Number, default: 0 },
  // 0 = legacy Monday index; 1 = ISO Monday index. Undefined means untagged legacy data.
  scheduleDayBase: { type: Number, enum: [0,1], default: undefined },
  schedule: [scheduleSchema],
  // Excluded from public station documents; only read by authenticated backoffice.
  scheduleFeed: {type:scheduleFeedSchema,default:undefined,select:false},
  position: { type: Number, default: 999 },
  boostStatus: { type: Boolean, default: false },
  boostExpiresAt: { type: Date, default: null },
  disableNetworkAds: { type: Boolean, default: false } 
});

module.exports = mongoose.model('Station', stationSchema);
