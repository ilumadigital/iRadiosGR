require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path'); 
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

// --- 1. CONFIG & DB ---
const connectDB = require('./config/db');
connectDB(); // Σύνδεση στη MongoDB
// Real listener alerts are event-driven and never run in isolated staging.
require('./utils/listenerNotificationScheduler').start();
// Staging Premium billing emails use Mailpit; never enable the production
// general notification dispatcher from this isolated financial scheduler.
require('./utils/premiumBillingEmailScheduler').start();
// Recover lost Broadcaster checkout responses using signed GET only.
// This worker cannot create provider orders, MIT payments or grant entitlements.
require('./utils/broadcasterCheckoutRecoveryScheduler').start();
// Isolated broadcaster transactional outbox, staging -> Mailpit only.
require('./utils/broadcasterBillingEmailScheduler').start();
// Staging-only approval notifications via Mailpit, with durable retry queue.
require('./utils/adApprovalEmailScheduler').start();

// --- 2. IMPORT MODELS & CONTROLLERS ---
const User = require('./models/User');
const StationAnalytics = require('./models/StationAnalytics');
const Station = require('./models/Station'); 
const BannerAd = require('./models/BannerAd'); 
const Ad = require('./models/Ad'); 
const miscController = require('./controllers/miscController');

const { generateMinimalOgImage } = require('./utils/generateOgImage');

const { injectStationSeo, injectGenreSeo, injectRegionSeo, injectMapSeo, injectHomeSeo } = require('./seo');

// --- 3. INIT APP ---
const app = express();

// Staging-only defense: unauthenticated access to admin APIs must not expose
// imported production account and billing records.
if (process.env.APP_ENV === 'staging') {
  const { protect } = require('./utils/authMiddleware');
  const { authorizeRoles } = require('./utils/roleMiddleware');
  app.use('/api/admin', protect, authorizeRoles('admin'));
  app.use('/api/banners/admin', protect, authorizeRoles('admin'));
  app.use('/api/notifications/stats', protect, authorizeRoles('admin'));
}


// Fail closed for STAGING: never reach production payment, push or recognition services.
// Authentication for the entire staging host is also enforced by the host Nginx.
if (process.env.APP_ENV === 'staging') {
  app.use((req, res, next) => {
    const blocked = [
      /^\/api\/payments(?:\/|$)/,
      /^\/api\/notifications\/(?:send|subscribe)(?:\/|$)/,
      /^\/api\/recognize(?:\/|$)/
    ];
    if (blocked.some(regex => regex.test(req.path))) {
      return res.status(503).json({ error: 'Disabled in isolated staging environment' });
    }
    next();
  });
}

app.get('/api/health', (_req, res) => {
  const mongoose = require('mongoose');
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'database-unavailable', environment: process.env.APP_ENV || 'unknown' });
});

// Nexi Sandbox webhook must be mounted BEFORE express.json() and staging JWT
// deny-by-default. Authentication is HMAC over EXACT raw bytes, not a user JWT.
app.post('/api/gateway/webhook',express.raw({type:'application/json',limit:'64kb'}),
  require('./controllers/gatewayBillingController').webhook);

app.use(cors());
app.use(express.json());

// The public Turnstile site key must be reachable before stage's JWT guard.
// This route exposes no secret and fails closed if runtime keys are missing.
app.get('/api/auth/turnstile-config',require('./utils/turnstile').publicConfig);

// PUBLIC STAGING: browsable radio UI; all sensitive APIs require an admin JWT.
// This is installed after JSON parsing and before any API router.
if (process.env.APP_ENV === 'staging') {
  app.use('/api', require('./utils/stagePublicAccess').stagePublicAccess);
  // Safe anonymous playback telemetry, deliberately independent of the
  // disabled unauthenticated Socket.IO gateway and paid recognition services.
  app.set('stageListenerTracker',
    require('./services/stageListeningMetrics').createStageListenerTracker({Station,StationAnalytics}));
  app.post('/api/listen/heartbeat', require('./utils/stageListenerHeartbeat').heartbeat);
  require('./utils/stageNativeScanner').start();
}


// ==============================================================
// 🎨 ΔΥΝΑΜΙΚΗ ΠΑΡΑΓΩΓΗ OG IMAGE ΓΙΑ ΤΑ SOCIAL MEDIA BOTS
// ==============================================================
app.get('/og-image/:slug.png', async (req, res) => {
    try {
        const { slug } = req.params;
        const isObjectId = slug.match(/^[0-9a-fA-F]{24}$/);
        const station = await Station.findOne({ 
            $or: [ { slug: slug }, { _id: isObjectId ? slug : null } ] 
        }).lean();

        if (!station) {
            // Δίνουμε ένα κενό string ως δεύτερη παράμετρο
            const fallbackBuffer = await generateMinimalOgImage('/iradios-logo.png', 'iRadios');
            res.setHeader('Content-Type', 'image/png');
            return res.send(fallbackBuffer);
        }

        // 🚀 ΠΡΟΣΘΗΚΗ: Περνάμε το station.name στη συνάρτηση!
        const imageBuffer = await generateMinimalOgImage(station.logo, station.name);

        // Σερβίρισμα
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24 ώρες για εξοικονόμηση πόρων
        res.send(imageBuffer);
    } catch (err) {
        console.error("OG Image Route Error:", err);
        res.status(500).send("Server Error");
    }
});

// ==============================================================
// 🚀 SEO INJECTION ROUTES (ΑΠΟ ΤΟ seo.js)
// ==============================================================
app.get('/station/:slug', injectStationSeo);
app.get('/genre/:genreName', injectGenreSeo);
app.get('/region/:regionName', injectRegionSeo);
app.get('/map', injectMapSeo);
app.get('/newsfeed/:key', require('./utils/newsArticleSeo').injectNewsArticleSeo);
app.get('/', injectHomeSeo);


const PORT = process.env.PORT || 5011;

// ==============================================================
// 4. ROUTES SETUP
// ==============================================================
const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const adRoutes = require('./routes/adRoutes');
const adminRoutes = require('./routes/adminRoutes');
const extraRoutes = require('./routes/extraRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const producerRoutes = require('./routes/producerRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const statsRoutes = require('./routes/stats');

// Phase-1 catalog + isolated complimentary subscriptions. No charging routes.
app.use('/api', require('./routes/billingPhase1Routes'));
// Phase 3: staging-only signed Gateway checkout/status. All other environments fail closed.
app.use('/api',require('./routes/billingCheckoutRoutes'));
// Phase 4: independently scoped broadcaster subscription / one-off Boost staging checkout.
app.use('/api',require('./routes/broadcasterBillingRoutes'));

app.use('/api', producerRoutes);
app.use('/api', require('./routes/backofficeRoutes'));
app.use('/api', require('./routes/widgetPreviewRoutes'));
app.use('/api', require('./routes/broadcasterInvitationRoutes'));
app.use('/api', require('./routes/emailPreviewRoutes'));
app.use('/api', authRoutes);
app.use('/api', stationRoutes);
app.use('/api', require('./routes/stationContactRoutes'));
app.use('/api', adRoutes);
app.use('/api', adminRoutes);
app.use('/api', extraRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api', require('./routes/homeSlideRoutes'));
app.use('/api', require('./routes/newsFeedRoutes'));
app.use('/api', require('./routes/promotedStationRoutes'));
app.use('/api', require('./routes/catalogNowPlayingRoutes'));
app.use('/api', require('./routes/stationPlaylistRoutes'));
app.use('/api/agency', agencyRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/stats', statsRoutes);

app.get('/sitemap.xml', miscController.getSitemap);
app.get('/api/proxy-stream', process.env.APP_ENV === 'staging'
  ? require('./utils/stageStreamProxy').stageStreamProxy
  : miscController.proxyStream);
app.get('/api/cover-art', miscController.getCoverArt);

// ==============================================================
// 1. ΕΠΙΤΡΕΠΟΥΜΕ ΤΑ IFRAMES (ΓΙΑ ΤΟ REACT ROUTER /widget/:id)
// ==============================================================
app.use('/widget', (req, res, next) => {
    res.removeHeader('X-Frame-Options'); 
    res.setHeader('Content-Security-Policy', "frame-ancestors *"); 
    next(); // 🟢 ΚΡΙΣΙΜΟ: Πρέπει να έχει next() για να προχωρήσει και να φορτώσει το React!
});

// ==============================================================
// 2. ΣΕΡΒΙΡΟΥΜΕ ΤΟ JAVASCRIPT ΑΡΧΕΙΟ (<script src="/widget.js">)
// ==============================================================
app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        (function() {
            var script = document.currentScript;
            if (!script) {
                var scripts = document.getElementsByTagName('script');
                script = scripts[scripts.length - 1];
            }            
            var stationId = script.getAttribute('data-station');
            if (!stationId) {
                console.error('iRadios Widget: Λείπει το data-station attribute.');
                return;
            }
            var container = document.createElement('div');
            container.style.width = "100%";
            container.style.maxWidth = "600px"; // Responsive με όριο τα 600px
            container.style.aspectRatio = "1 / 1"; // Τετράγωνο
            container.style.margin = "0 auto";
            container.style.borderRadius = "32px";
            container.style.overflow = "hidden";
            container.style.boxShadow = "0 20px 40px rgba(0,0,0,0.5)";
            container.style.backgroundColor = "#09090b";
            container.style.position = "relative";
            
            var iframe = document.createElement('iframe');
            iframe.src = "__IRADIOS_SITE_ORIGIN__/widget/" + stationId;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            iframe.allow = "autoplay";
            
            container.appendChild(iframe);
            script.parentNode.insertBefore(container, script.nextSibling);
        })();
    `);
});

// ==============================================================
// 🟢 ΣΕΡΒΙΡΙΣΜΑ FRONTEND & CACHE CONTROL 
// ==============================================================
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// ΤΟ ORIGINAL CATCH-ALL ΣΟΥ (ΑΘΙΚΤΟ ΓΙΑ ΝΑ ΜΗΝ ΚΡΑΣΑΡΕΙ)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==============================================================
// 🟢 ΚΑΘΑΡΙΣΜΟΣ ΛΗΓΜΕΝΩΝ BOOSTS & ADS
// ==============================================================
const cron = require('node-cron');

const cleanupExpiredItems = async () => {
  console.log('🧹 [SYSTEM] Ξεκινάει ο έλεγχος ληγμένων συνδρομών & διαφημίσεων...');
  const now = new Date();

  try {
    const boostResult = await Station.updateMany(
      { boostStatus: true, boostExpiresAt: { $lt: now } },
      { $set: { boostStatus: false, position: 999, boostExpiresAt: null, isFeatured: false } }
    );
    if (boostResult.modifiedCount > 0) {
      console.log(`✅ [SYSTEM] Αφαιρέθηκαν ${boostResult.modifiedCount} ληγμένα Station Boosts.`);
    }

    // Preserve campaign history and analytics. Expiry is a status transition,
    // never a destructive DELETE.
    const bannerResult = await BannerAd.updateMany(
      { expiresAt: { $lt: now }, status: { $ne: 'expired' } },
      { $set: { status: 'expired', isActive: false } }
    );
    const audioResult = await Ad.updateMany(
      { expiresAt: { $lt: now }, status: { $ne: 'expired' } },
      { $set: { status: 'expired' } }
    );
    if (bannerResult.modifiedCount || audioResult.modifiedCount) {
      console.log(`[ADS] Expired ${bannerResult.modifiedCount} banners and ${audioResult.modifiedCount} spots (history preserved).`);
    }
  } catch (error) {
    console.error('❌ [SYSTEM] Σφάλμα στον καθαρισμό:', error);
  }
};

if (process.env.APP_ENV !== 'staging') {
  cron.schedule('0 * * * *', cleanupExpiredItems);
} else {
  console.log('[STAGING] Expired-item cleanup is disabled to preserve imported snapshot data.');
}


// ==============================================================
// 5. SERVER & SOCKET.IO SETUP
// ==============================================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ["GET", "POST"] },
  path: '/api/socket.io',
  // The socket handlers contain legacy unauthenticated broadcasts and user-room
  // operations; do not expose them on a public clone of live user accounts.
  allowRequest: (req, callback) => callback(null, process.env.APP_ENV !== 'staging')
});

const activeListeners = {}; 
const socketSessions = {};  

// 🚀 NEW: Κρατάμε τις συνδεδεμένες συσκευές ανά User ID
const userDevices = {};

app.set('activeListeners', activeListeners);
app.set('socketSessions', socketSessions);
app.set('io', io); 

global.totalLiveListeners = 0; 

const broadcastGlobalLiveCount = () => {
  const currentCount = Object.keys(socketSessions).length;
  global.totalLiveListeners = currentCount; 
  io.emit('admin_live_listeners', currentCount); 
  io.emit('global_live_listeners', currentCount); 
};

io.on('connection', (socket) => {
  
  socket.on('get_live_count', () => {
    socket.emit('admin_live_listeners', Object.keys(socketSessions).length);
  });

  socket.on('register_device', (data) => {
    const { userId, deviceId, deviceName } = data;
    if (!userId || !deviceId) return;
    const safeUserId = String(userId);
    
    socket.join(`user_${safeUserId}`);
    if (!userDevices[safeUserId]) userDevices[safeUserId] = {};

    let wasPlaying = false;
    let currentActiveStation = null;
    
    if (userDevices[safeUserId][deviceId]) {
      wasPlaying = userDevices[safeUserId][deviceId].isPlaying;
      currentActiveStation = userDevices[safeUserId][deviceId].station;
    }

    userDevices[safeUserId][deviceId] = { 
      deviceId, 
      deviceName, 
      socketId: socket.id, 
      isPlaying: wasPlaying,
      station: currentActiveStation
    };

    io.to(`user_${safeUserId}`).emit('update_devices', Object.values(userDevices[safeUserId]));
  });

  socket.on('local_play_started', (data) => {
    const { userId, deviceId, station } = data; 
    if (!userId || !deviceId) return;
    const safeUserId = String(userId);

    if (!userDevices[safeUserId]) return;

    for (let dId in userDevices[safeUserId]) {
      if (dId === deviceId) {
        userDevices[safeUserId][dId].isPlaying = true;
        if (station) userDevices[safeUserId][dId].station = station; 
      } else {
        if (userDevices[safeUserId][dId].isPlaying) {
           userDevices[safeUserId][dId].isPlaying = false;
           io.to(userDevices[safeUserId][dId].socketId).emit('stop_transfer');
        }
      }
    }
    io.to(`user_${safeUserId}`).emit('update_devices', Object.values(userDevices[safeUserId]));
  });

  socket.on('local_play_stopped', (data) => {
    const { userId, deviceId } = data;
    if (!userId || !deviceId) return;
    const safeUserId = String(userId);

    if (userDevices[safeUserId] && userDevices[safeUserId][deviceId]) {
      userDevices[safeUserId][deviceId].isPlaying = false;
      io.to(`user_${safeUserId}`).emit('update_devices', Object.values(userDevices[safeUserId]));
    }
  });

  socket.on('transfer_playback', (data) => {
    const { userId, targetDeviceId, station } = data;
    if (!userId || !targetDeviceId || !station) return;
    const safeUserId = String(userId);

    const devices = userDevices[safeUserId];
    if (devices) {
      for (let dId in devices) {
        if (dId === targetDeviceId) {
          devices[dId].isPlaying = true;
          io.to(devices[dId].socketId).emit('play_transfer', { station });
        } else {
          devices[dId].isPlaying = false;
          io.to(devices[dId].socketId).emit('stop_transfer');
        }
      }
      io.to(`user_${safeUserId}`).emit('update_devices', Object.values(devices));
    }
  });

  socket.on('request_devices', (data) => {
    const { userId } = data;
    if (!userId) return;
    const safeUserId = String(userId);
    
    io.to(`user_${safeUserId}`).emit('ping_announce');
    
    if (userDevices[safeUserId]) {
      socket.emit('update_devices', Object.values(userDevices[safeUserId]));
    }
  });

  socket.on('disconnect', () => {
    for (let uId in userDevices) {
      for (let dId in userDevices[uId]) {
        if (userDevices[uId][dId].socketId === socket.id) {
          delete userDevices[uId][dId];
          io.to(`user_${uId}`).emit('update_devices', Object.values(userDevices[uId]));
          break;
        }
      }
    }
  });

  const handleStopListen = async (socketId) => {
    const session = socketSessions[socketId];
    if (session) {
      const duration = Math.floor((Date.now() - session.startTime) / 1000);
      
      if (activeListeners[session.stationId]) {
        activeListeners[session.stationId].delete(socketId);
      }
      
      try {
        await StationAnalytics.findOneAndUpdate(
          { stationId: session.stationId },
          { $inc: { totalListenTime: duration, totalSessions: 1 } },
          { upsert: true }
        );
      } catch(e) { }
      
      delete socketSessions[socketId];
      broadcastGlobalLiveCount(); 
    }
  };

  socket.on('start_listen', async (data) => {
    const { stationId, location } = data;
    if (!stationId) return;

    await handleStopListen(socket.id); 
    
    if (!activeListeners[stationId]) activeListeners[stationId] = new Set();
    activeListeners[stationId].add(socket.id);
    
    socketSessions[socket.id] = { stationId, startTime: Date.now(), location };
    
    broadcastGlobalLiveCount(); 

    try {
      await Station.findByIdAndUpdate(stationId, { $inc: { plays: 1 } });
    } catch(e) {}
    
    if (location && location.city && location.city !== 'Unknown') {
      const locKey = `${location.city}_${location.country || 'Unknown'}`;
      try {
        await StationAnalytics.findOneAndUpdate(
          { stationId },
          { $inc: { [`locations.${locKey.replace(/\./g, '_')}`]: 1 } }, 
          { upsert: true }
        );
      } catch(e) {}
    }
  });

  socket.on('stop_listen', () => handleStopListen(socket.id));
  
  socket.on('disconnect', () => {
    handleStopListen(socket.id);

    for (let userId in userDevices) {
      if (userDevices[userId][socket.id]) {
        delete userDevices[userId][socket.id];
        io.to(`user_${userId}`).emit('update_devices', Object.values(userDevices[userId]));
        if (Object.keys(userDevices[userId]).length === 0) {
          delete userDevices[userId];
        }
        break;
      }
    }
  });
});

// ==============================================================
// 6. STARTUP SCRIPTS & LISTEN
// ==============================================================
const fixDatabasePasswords = async () => {
  try {
    const users = await User.find({});
    for (let u of users) {
      if (u.password && !u.password.startsWith('$2b$')) {
        u.password = await bcrypt.hash(u.password, 10);
        await u.save();
      }
      if (u.isVerified === undefined) {
         u.isVerified = true;
         await u.save();
      }
    }
    const adminHash = await bcrypt.hash("iluma25", 10);
    await User.updateOne(
      { email: "admin@iluma.gr" }, 
      { $set: { password: adminHash, isVerified: true, role: 'admin' } },
      { upsert: false }
    );
  } catch (err) {}
};

server.listen(PORT, '0.0.0.0', async () => {
  await fixDatabasePasswords();
  await cleanupExpiredItems(); 
  console.log(`🚀 iRadios Server up: http://0.0.0.0:${PORT}`);
});
