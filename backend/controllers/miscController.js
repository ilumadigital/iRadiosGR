const Station = require('../models/Station');
const Parser = require('icecast-parser');

const { Readable } = require('stream');

// 🟢 PROXY ΓΙΑ ΕΞΩΦΥΛΛΑ (WATERFALL: Apple Music -> Deezer)
exports.getCoverArt = async (req, res) => {
    const { term } = req.query;

    if (!term) {
        return res.json({ artworkUrl: null });
    }

    try {
        // ==========================================
        // 1η ΠΡΟΣΠΑΘΕΙΑ: ITUNES (APPLE MUSIC)
        // ==========================================
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`;
        
        const itunesResponse = await fetch(itunesUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (itunesResponse.ok) {
            const itunesData = await itunesResponse.json();
            if (itunesData.results && itunesData.results.length > 0) {
                // Βρέθηκε στην Apple! Φέρνουμε την High-Res 600x600
                const highResUrl = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                return res.json({ artworkUrl: highResUrl });
            }
        }

        // ==========================================
        // 2η ΠΡΟΣΠΑΘΕΙΑ: DEEZER API (Αν αποτύχει η Apple)
        // ==========================================
        console.log(`[CoverArt Proxy] Apple missed '${term}', trying Deezer...`);
        
        const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=1`;
        const deezerResponse = await fetch(deezerUrl);

        if (deezerResponse.ok) {
            const deezerData = await deezerResponse.json();
            if (deezerData.data && deezerData.data.length > 0) {
                // Το Deezer επιστρέφει το 'cover_xl' που είναι πολύ υψηλής ανάλυσης (συνήθως 1000x1000 ή 500x500)
                const deezerCover = deezerData.data[0].album.cover_xl || deezerData.data[0].album.cover_big;
                
                if (deezerCover) {
                    return res.json({ artworkUrl: deezerCover });
                }
            }
        }

        // ==========================================
        // ΑΠΟΤΥΧΙΑ: Δεν βρέθηκε πουθενά
        // ==========================================
        console.log(`[CoverArt Proxy] No cover found anywhere for '${term}'`);
        return res.json({ artworkUrl: null });

    } catch (error) {
        console.error("[CoverArt Proxy] Global Error:", error.message);
        return res.json({ artworkUrl: null });
    }
};

exports.proxyStream = async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('No URL provided');

    // 1. Δημιουργούμε δικό μας Controller για να ελέγχουμε το Timeout
    const controller = new AbortController();
    // Δίνουμε 10 δευτερόλεπτα MAX για να απαντήσει ο σταθμός στην αρχή
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
        const targetRes = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow', // Ακολουθεί τα Redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Icy-MetaData': '0' 
            },
            signal: controller.signal
        });

        // 🚀 ΚΡΙΣΙΜΟ: Ο σταθμός απάντησε! Ακυρώνουμε το Timeout για να παίζει άπειρα.
        clearTimeout(timeoutId);

        if (!targetRes.ok) {
            return res.status(targetRes.status).send('Stream unavailable');
        }

        let contentType = targetRes.headers.get('content-type');
        if (!contentType || contentType.includes('text/html')) {
            if (targetUrl.toLowerCase().includes('.ogg')) contentType = 'audio/ogg';
            else if (targetUrl.toLowerCase().includes('.aac')) contentType = 'audio/aac';
            else contentType = 'audio/mpeg';
        }

        const responseHeaders = {
            'Content-Type': contentType,
            'Transfer-Encoding': 'chunked',
            'Access-Control-Allow-Origin': '*', 
            'Access-Control-Expose-Headers': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive'
        };

        targetRes.headers.forEach((value, key) => {
            if (!key.toLowerCase().startsWith('icy-') && !responseHeaders[key]) {
                responseHeaders[key] = value;
            }
        });

        res.writeHead(200, responseHeaders);

        // 2. Μετατροπή σε Node.js Stream και ΠΡΟΣΤΑΣΙΑ ΑΠΟ CRASH
        const nodeStream = Readable.fromWeb(targetRes.body);
        
        // 🚀 ΑΝΕΣΤΗΛΩΣΗ (ANTI-CRASH): Αν διακοπεί το Web Stream, απλά κλείνουμε το response μας, δεν ρίχνουμε τον server!
        nodeStream.on('error', (err) => {
            console.error(`[Proxy Stream Error] Διακοπή ροής από: ${targetUrl} - ${err.message}`);
            res.end(); 
        });

        nodeStream.pipe(res);

        // 3. CLEANUP: Αν ο ακροατής κλείσει το tab ή αλλάξει σταθμό, κόβουμε τη σύνδεση με τον σταθμό για να μην καίμε bandwidth
        req.on('close', () => {
            controller.abort(); 
        });

    } catch (err) {
        clearTimeout(timeoutId); // Σιγουρεύουμε ότι καθαρίζει το χρονόμετρο
        console.error('Stream Proxy Connection Error [', targetUrl, ']:', err.message);
        
        if (!res.headersSent) {
            res.status(500).send('Error proxying stream');
        } else {
            res.end();
        }
    }
};


// 🎵 METADATA CONTROLLER
exports.getMetadata = async (req, res) => {
  const streamUrl = req.query.stream;
  let customMetaUrl = req.query.customMeta; 
  
  if (!streamUrl || streamUrl.includes('/api/proxy-stream') || streamUrl.includes('sh.onweb')) {
      return res.json({ title: '' }); 
  }

  // =========================================================
  // 🔍 0. ΕΛΕΓΧΟΣ ΣΤΗ ΒΑΣΗ ΔΕΔΟΜΕΝΩΝ (DB) ΓΙΑ ΤΟ ΝΕΟ ΠΕΔΙΟ
  // =========================================================
  try {
    const dbStation = await Station.findOne({ stream: streamUrl }).select('metadata').lean();
    if (dbStation && dbStation.metadata && dbStation.metadata.trim() !== '') {
        customMetaUrl = dbStation.metadata.trim();
    }
  } catch (dbErr) {
    console.error("Σφάλμα κατά την αναζήτηση metadata σταθμού στη DB:", dbErr.message);
  }

  let finalTitle = '';
  
  const urlObj = new URL(streamUrl);
  const baseHost = `${urlObj.protocol}//${urlObj.host}`;
  const mountPoint = urlObj.pathname !== '/' ? urlObj.pathname.replace(/\/$/, '') : ''; 

  const isValidMetadata = (text) => {
    if (!text) return false;
    const clean = text.trim();
    if (clean === '' || /^[-. ]+$/.test(clean) || clean.toLowerCase() === 'unknown') {
      return false;
    }
    return true;
  };

  const cleanTitleText = (rawTitle) => {
    if (!rawTitle) return '';
    return rawTitle
      .replace(/\[Wz\]/gi, '')
      .replace(/\[V7\]/gi, '')
      .replace(/\[WD\]/gi, '') 
      .replace(/\[II\]/gi, '')
      .trim(); 
  };

  // =========================================================
  // 🌟 CUSTOM METADATA URL (Από DB ή από Query) ΠΡΩΤΑ
  // =========================================================
  if (customMetaUrl && customMetaUrl.trim() !== '') {
    try {
      const customRes = await fetch(customMetaUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' }, 
          signal: AbortSignal.timeout(4000) 
      });
      
      if (customRes.ok) {
        const contentType = customRes.headers.get("content-type");
        const rawText = await customRes.text(); // Παίρνουμε το text πάντα πρώτα
        
        let data = null;
        let isJson = false;

        // 1. Δοκιμάζουμε αν είναι κανονικό JSON
        try {
            data = JSON.parse(rawText);
            isJson = true;
        } catch (e) {
            isJson = false;
        }

        // 2. Αν ΔΕΝ είναι κανονικό JSON, μήπως είναι Voscast JSONP?
        if (!isJson && rawText.includes('updateStats_')) {
             // Ψάχνουμε να βρούμε το { ... } μέσα στο updateStats_X(...)
             const match = rawText.match(/updateStats_[a-zA-Z0-9_]+\s*\(\s*(\{.*\})\s*\)/);
             if (match && match[1]) {
                 try {
                     data = JSON.parse(match[1]); // Κάνουμε parse το {"songtitle":"..."}
                     isJson = true;
                 } catch (e) {
                     console.error("Failed to parse Voscast JSONP inner JSON");
                 }
             }
        }

        if (isJson && data) {
          // 🟢 ΠΕΡΙΠΤΩΣΗ A: CentovaCast / StreamUpSolutions
          if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
            const streamData = data.data[0];
            if (streamData.rawmeta) finalTitle = streamData.rawmeta;
            else if (streamData.track && (streamData.track.artist || streamData.track.title)) {
               const artist = streamData.track.artist || '';
               const title = streamData.track.title || '';
               finalTitle = (artist && title) ? `${artist} - ${title}` : (title || artist);
            } 
            else if (streamData.song) finalTitle = streamData.song;
          }
          // 🟢 ΠΕΡΙΠΤΩΣΗ B: Icecast / status-json.xsl 
          else if (data && data.icestats && data.icestats.source) {
            const sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source];
            let activeSource = sources.find(s => mountPoint && s.listenurl && s.listenurl.includes(mountPoint) && s.title && s.title !== 'Unknown');
            if (!activeSource) activeSource = sources.find(s => s.title && s.title !== 'Unknown');
            if (activeSource && activeSource.title) finalTitle = activeSource.title;
          }
          // 🟢 ΠΕΡΙΠΤΩΣΗ C: Γενικά JSON APIs (Attica Radios, Radiojar, Revma)
          else if (data.artist !== undefined || data.song !== undefined || data.title !== undefined || data.track !== undefined) {
            const artistName = data.artist ? String(data.artist).trim() : '';
            const songName = data.song ? String(data.song).trim() : (data.track ? String(data.track).trim() : '');
            const titleName = data.title ? String(data.title).trim() : '';

            if (artistName && songName) finalTitle = `${artistName} - ${songName}`;
            else if (artistName && titleName && !titleName.includes(artistName)) finalTitle = `${artistName} - ${titleName}`;
            else finalTitle = titleName || songName || artistName;
          } 
          // 🟢 ΠΕΡΙΠΤΩΣΗ D: Voscast & Simple JSON ({"songtitle": "..."})
          else if (data.songtitle) finalTitle = data.songtitle.trim();
          else if (data.title) finalTitle = data.title.trim();
        } 
        else {
          // Αν δεν είναι ούτε JSON ούτε Voscast JSONP, δοκιμάζουμε καθαρό Text HTML (π.χ. Shoutcast currentsong)
          const cleanText = rawText.replace(/<[^>]*>?/gm, '').trim(); 
          if (cleanText && cleanText.length > 0 && !cleanText.includes('404')) finalTitle = cleanText;
        }
      }
    } catch (e) {
      console.error("Custom Metadata Fetch Error:", e.message);
    }

    if (finalTitle && isValidMetadata(finalTitle)) {
      return res.json({ title: cleanTitleText(finalTitle) }); 
    }
  }

  // =========================================================
  // AUTO-FALLBACKS ΑΝ ΤΟ CUSTOM ΑΠΕΤΥΧΕ 
  // =========================================================
  finalTitle = ''; 

  try {
    // 🚀 1. ΛΟΓΙΚΗ ΓΙΑ LIVE24 
    if (streamUrl.includes('live24.gr') && mountPoint) {
      const live24StatsUrl = `https://songs.live24.gr/live24stats/songs_list.xsl?mount=${mountPoint}`;
      try {
        const live24Res = await fetch(live24StatsUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) 
        });
        if (live24Res.ok) {
          const data = await live24Res.json();
          if (data && data.icestats && data.icestats[mountPoint] && data.icestats[mountPoint].title) {
            const cleanText = data.icestats[mountPoint].title.trim();
            if (isValidMetadata(cleanText) && !cleanText.toLowerCase().includes('live24')) {
              finalTitle = cleanText;
            }
          }
        }
      } catch (e) {}
    } 

    // 🚀 2. RADIOJAR & REVMA (RCS)
    if (!finalTitle && (streamUrl.includes('radiojar.com') || streamUrl.includes('revma.com')) && mountPoint) {
      const hash = mountPoint.replace(/^\//, ''); 
      const radiojarApiUrl = `https://www.radiojar.com/api/stations/${hash}/now_playing/`;
      try {
        const radiojarRes = await fetch(radiojarApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
        if (radiojarRes.ok) {
          const data = await radiojarRes.json();
          if (data && (data.title || data.artist)) {
            const songName = data.title || data.track; 
            const artistName = data.artist;
            if (songName || artistName) {
              let trackInfo = (artistName && songName) ? `${artistName} - ${songName}` : (songName || artistName);
              if (isValidMetadata(trackInfo)) finalTitle = trackInfo.trim();
            }
          }
        }
      } catch (e) {}
    }

    // 🎧 3. ICECAST/SHOUTCAST AUTO-DISCOVERY 
    if (!finalTitle) {
      try {
        const scTextRes = await fetch(`${baseHost}/currentsong?sid=1`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(2000) });
        if (scTextRes.ok) {
          const text = await scTextRes.text(); 
          if (isValidMetadata(text) && !text.includes('<html')) finalTitle = text.trim();
        }
      } catch (e) {}

      if (!finalTitle) {
        try {
          const icRes = await fetch(`${baseHost}/status-json.xsl`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(2000) });
          if (icRes.ok) {
            const data = await icRes.json();
            if (data.icestats && data.icestats.source) {
              const sources = Array.isArray(data.icestats.source) ? data.icestats.source : [data.icestats.source];
              let activeSource = sources.find(s => mountPoint && s.listenurl && s.listenurl.includes(mountPoint) && isValidMetadata(s.title));
              if (!activeSource) activeSource = sources.find(s => isValidMetadata(s.title));
              if (activeSource) finalTitle = activeSource.title;
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Αν βρήκαμε κάτι από τα Web Fallbacks, το στέλνουμε
  if (finalTitle && isValidMetadata(finalTitle)) {
    return res.json({ title: cleanTitleText(finalTitle) }); 
  }

  // =========================================================
  // 🛡️ 5. FALLBACK: ICY-METADATA PARSER (Τελευταία Ελπίδα)
  // =========================================================
  try {
    const isCloudflareProtected = streamUrl.includes('revma.com') || streamUrl.includes('radiojar.com');
    const dynamicUserAgent = isCloudflareProtected 
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        : 'VLC/3.0.16 LibVLC/3.0.16';

    const radioStation = new Parser({ 
        url: streamUrl, 
        keepListen: true, 
        autoUpdate: false, 
        userAgent: dynamicUserAgent 
    });
    
    let responded = false;

    radioStation.on('metadata', (metadata) => {
      const title = metadata.StreamTitle || '';
      if (!responded && isValidMetadata(title) && !title.toLowerCase().includes('live24')) {
        responded = true;
        res.json({ title: cleanTitleText(title) }); 
        radioStation.destroy(); 
      }
    });

    setTimeout(() => {
      if (!responded) { 
        responded = true; 
        res.json({ title: '' }); 
        radioStation.destroy(); 
      }
    }, 8000);

  } catch (err) { 
      if (!res.headersSent) {
          res.json({ title: '' }); 
      }
  }
};

// 🗺️ SITEMAP CONTROLLER (Βελτιστοποιημένη Έκδοση)
exports.getSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || '__IRADIOS_SITE_ORIGIN__'; 
    const today = new Date().toISOString().split('T')[0];

    // 1. Φέρνουμε Σταθμούς, Genres, Regions ΚΑΙ Cities ΠΑΡΑΛΛΗΛΑ.
    // Η συνθήκη { status: 'approved' } εγγυάται ότι θα φέρει ΜΟΝΟ δεδομένα από σταθμούς που υπάρχουν μέσα.
    const [stations, rawGenres, rawSubgenres, rawRegions, rawCities] = await Promise.all([
      Station.find({ status: 'approved' }, 'slug createdAt updatedAt').sort({ createdAt: -1 }).lean(),
      Station.distinct('genre', { status: 'approved' }),
      Station.distinct('secondaryGenre', { status: 'approved' }),
      Station.distinct('region', { status: 'approved' }),
      Station.distinct('city', { status: 'approved' }) 
    ]);

    // 2. Καθαρισμός και Ενοποίηση
    // Αφαιρούμε null/undefined και τυχόν κενά strings
    // Include approved secondary genres in sitemap for SEO and AI discovery,
    // without adding them to the primary listener navigation.
    const genres = [...new Set([...rawGenres,...rawSubgenres]
        .filter(g => typeof g === 'string')
        .map(g => g.trim())
        .filter(Boolean))];
    
    // Ενώνουμε Regions και Cities, αφαιρούμε κενά και διπλότυπα (μέσω Set)
    const allLocationsRaw = [...rawRegions, ...rawCities];
    const uniqueLocations = [...new Set(allLocationsRaw)]
        .filter(loc => loc != null)
        .map(loc => loc.trim()) 
        .filter(loc => loc !== ''); 

    // 3. Ορισμός Στατικών Σελίδων (ΜΟΝΟ Home και Map)
    const staticPages = [
      { path: '/', priority: '1.0', freq: 'hourly' },
      { path: '/map', priority: '0.9', freq: 'hourly' }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 4. Προσθήκη Στατικών Σελίδων
    staticPages.forEach(page => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.freq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 5. Προσθήκη Σελίδων Σταθμών (Δυναμικά)
    stations.forEach(station => {
      const stationIdentifier = station.slug || station._id;
      const lastModDate = station.updatedAt || station.createdAt || new Date();
      const lastMod = new Date(lastModDate).toISOString().split('T')[0];

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/station/${stationIdentifier}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>always</changefreq>\n`;
      xml += `    <priority>1.0</priority>\n`;
      xml += `  </url>\n`;
    });

    // 6. Προσθήκη Σελίδων Ειδών / Genres (Δυναμικά)
    genres.forEach(genre => {
      const encodedGenre = encodeURIComponent(genre);
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/genre/${encodedGenre}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>hourly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    });

    // 7. Προσθήκη Σελίδων Περιοχών & Πόλεων (Ενοποιημένα)
    uniqueLocations.forEach(location => {
      const encodedLocation = encodeURIComponent(location);
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/region/${encodedLocation}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>hourly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) { 
    console.error("Sitemap Generation Error:", err);
    res.status(500).send("Error generating sitemap"); 
  }
};
