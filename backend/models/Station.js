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
  secondaryGenre: { type: String, default: '' }, // Legacy: first selected subcategory
  secondaryGenres: { type: [String], default: [], validate: {
    validator: values => Array.isArray(values) && values.length<=3 && new Set(values).size===values.length,
    message: 'Μέχρι 3 μοναδικές δευτερεύουσες κατηγορίες.'
  } },
  // Null means an existing station has not yet explicitly answered the question.
  hasCommercialAds: { type: Boolean, default: null },
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
  // Atomic deletion lease; never exposed in the public station payload.
  deletionLockToken: { type: String, default: undefined, select: false },
  deletionLockUntil: { type: Date, default: undefined, select: false },
  // Approval and stream availability are independent: offline stations remain visible.
  isOffline: { type: Boolean, default: false },
  broadcasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  dspPreset: { type: String, default: 'AUTO_MODE' },
  // EQ and stereo persist independently of the selected preset.
  // Soft clipper is optional and disabled (level 0) for existing stations.
  dspSettings: {
    bass: { type: Number, default: 0, min: -12, max: 12 },
    mid: { type: Number, default: 0, min: -12, max: 12 },
    treble: { type: Number, default: 0, min: -12, max: 12 },
    output: { type: Number, default: 0, min: -7, max: 7 },
    stereoWidth: { type: Number, default: 100, min: 0, max: 150 }
  },
  // Additional compressor controls: presets define the starting curve,
  // manual overrides persist independently, and off leaves EQ/width active.
  dspCompressor: {
    mode: { type: String, enum: ['preset','manual','off'], default: 'preset' },
    threshold: { type: Number, default: -18, min: -42, max: 0 },
    ratio: { type: Number, default: 2.1, min: 1, max: 8 },
    attack: { type: Number, default: .045, min: .003, max: .2 },
    release: { type: Number, default: .34, min: .08, max: 1.2 },
    makeup: { type: Number, default: 0, min: -6, max: 6 }
  },
  // Legacy field name kept to preserve existing station DSP settings.
  // "level" is the per-mode Booster (0–8); headroomEnabled is a deprecated
  // compatibility field ignored by the shared engine, which enforces -0.5 dBFS
  // peak Headroom in every active broadcaster DSP mode.
  dspAutoBalance: { type: Number, default: 0, min: -100, max: 100, validate: Number.isInteger },
  dspClipper: {
    ENHANCER: {
      headroomEnabled: { type: Boolean, default: true },
      level: { type: Number, default: 0, min: 0, max: 8, validate: Number.isInteger }
    },
    FM_MODE: {
      headroomEnabled: { type: Boolean, default: true },
      level: { type: Number, default: 0, min: 0, max: 8, validate: Number.isInteger }
    }
  },
  pendingEdits: { type: Object, default: null },
  slug: { type: String, unique: true, sparse: true },
  popularity: { type: Number, default: 0 },
  // 0 = legacy Monday index; 1 = ISO Monday index. Undefined means untagged legacy data.
  scheduleDayBase: { type: Number, enum: [0,1], default: undefined },
  schedule: [scheduleSchema],
  // Excluded from public station documents; only read by authenticated backoffice.
  scheduleFeed: {type:scheduleFeedSchema,default:undefined,select:false},
  position: { type: Number, default: 999 },
  // Independent manual rankings for genre and region catalogs; global order is "position".
  // Each station can have one entry per catalog scope. Existing stations require no migration.
  rankings: [{
    scope: { type: String, enum: ['genre', 'region'], required: true },
    value: { type: String, required: true },
    position: { type: Number, min: 1, required: true }
  }],
  boostStatus: { type: Boolean, default: false },
  boostExpiresAt: { type: Date, default: null },
  disableNetworkAds: { type: Boolean, default: false } 
});

module.exports = mongoose.model('Station', stationSchema);
