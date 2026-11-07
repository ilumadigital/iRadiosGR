// backend/seo.js
const fs = require('fs');
const path = require('path');
const Station = require('./models/Station');

// 1. Βοηθητική συνάρτηση ελέγχου Bot
const isBotRequest = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    
    // Grouped for readability and easier maintenance.
    // The regular expression combines all these keywords using the OR (|) operator.
    const botPattern = new RegExp([
        // 1. Core Keywords (Catches the vast majority: Googlebot, Bingbot, Applebot, AhrefsBot, Baiduspider, etc.)
        'bot', 'crawler', 'spider', 'crawling', 
        
        // 2. Specific Search Engines & Archivers
        'slurp',       // Yahoo
        'yandex',      // Yandex (Russia)
        'seznam',      // Seznam (Czech Republic)
        'sogou',       // Sogou (China)
        'ia_archiver', // Internet Archive (Wayback Machine) / Alexa
        
        // 3. Social Media & Messaging Scrapers
        'facebookexternalhit', 'facebookbot', 
        'meta-externalagent', 'meta-externalfetcher', // Newer Meta agents
        'twitterbot', 'slackbot', 'discordbot', 
        'telegrambot', 'whatsapp', 'viber', 'skype', 
        'linkedinbot', 'pinterest',
        
        // 4. Google Specific Tools (Crucial for Search Console)
        'google-inspectiontool', 'googleother', 'google-extended',
        
        // 5. AI Crawlers & LLM Agents
        'chatgpt-user', 'oai-searchbot', 'gptbot',           // OpenAI
        'claude-user', 'claude-web', 'claudeBot', 'anthropic-ai', // Anthropic / Claude
        'perplexitybot', 'perplexity-user',                  // Perplexity AI
        'gemini-deep-research',                              // Google Gemini
        'applebot-extended',                                 // Apple AI
        'cohere-training-data-crawler', 'mistralai-user',    // Other AI
        'ai2', 'ccbot', 'amazonbot', 'diffbot', 'bytespider',// Various data crawlers
        
        // 6. SEO & Performance Tools
        'semrushbot', 'ahrefsbot', // (Usually caught by 'bot', but safe to include)
        'chrome-lighthouse', 'gtmetrix', 'ptst', 'w3c_validator',
        'seo'
    ].join('|'), 'i'); // 'i' flag makes it case-insensitive
    
    return botPattern.test(userAgent);
};

// 2. SEO Injection για ΣΤΑΘΜΟ
exports.injectStationSeo = async (req, res, next) => {
    try {
        if (!isBotRequest(req) && !req.query.bot) return next();

        const { slug } = req.params;
        const exactUrl = `__IRADIOS_SITE_ORIGIN__${req.originalUrl}`;
        const isObjectId = slug.match(/^[0-9a-fA-F]{24}$/);
        
        // 🟢 Φέρνουμε όλα τα δεδομένα του Station Model
        const station = await Station.findOne({ 
            $or: [ { slug: slug }, { _id: isObjectId ? slug : null } ] 
        }).lean();

        if (!station) {
            return res.status(404).send(`<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><title>Σταθμός δεν βρέθηκε | iRadios</title><meta name="robots" content="noindex, nofollow"></head><body><h1>404 - Ο σταθμός δεν βρέθηκε</h1></body></html>`);
        }

        // 🟢 1. Τραβάμε Δυναμικά το "Τώρα Παίζει" (Metadata)
        let nowPlaying = "";
        try {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            let fetchUrl = `${baseUrl}/api/metadata?stream=${encodeURIComponent(station.stream)}`;
            if (station.customMetadataUrl) {
                fetchUrl += `&customMeta=${encodeURIComponent(station.customMetadataUrl)}`;
            }
            
            const metaRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(2000) });
            if (metaRes.ok) {
                const metaData = await metaRes.json();
                if (metaData && metaData.title && metaData.title.toLowerCase() !== 'unknown') {
                    nowPlaying = metaData.title;
                }
            }
        } catch (e) {
            console.log(`[SEO] Failed to fetch metadata for ${station.name}`);
        }

        // 🟢 2. Βρίσκουμε το Πρόγραμμα της Ημέρας (Schedule)
        let currentDaySchedule = [];
        let scheduleHtml = '';
        let scheduleSchema = [];
        let scheduleTextParagraph = '';

        if (station.schedule && Array.isArray(station.schedule) && station.schedule.length > 0) {
            const currentDayIdx = new Date().getDay(); // 0 = Κυριακή, 1 = Δευτέρα, κλπ.
            
            currentDaySchedule = station.schedule
                .filter(s => s.day === currentDayIdx)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (currentDaySchedule.length > 0) {
                const showsList = currentDaySchedule.map(s => `την εκπομπή "${s.title}"${s.host ? ` με τον/την ${s.host}` : ''} στις ${s.startTime}`).join(', ');
                scheduleTextParagraph = `Για το σημερινό του πρόγραμμα, ο ραδιοφωνικός σταθμός έχει ετοιμάσει μοναδικές παραγωγές. Ανάμεσα τους ξεχωρίζουν ${showsList}. Οι ραδιοφωνικοί παραγωγοί του σταθμού βρίσκονται πίσω από τα μικρόφωνα για να σας μεταφέρουν τον παλμό, την ενημέρωση και φυσικά, την καλύτερη μουσική επιλογή. Συντονιστείτε για να μην χάσετε λεπτό από τις αγαπημένες σας εκπομπές και να ακούσετε ζωντανά τους αγαπημένους σας παραγωγούς.`;

                scheduleHtml = `
                    <section>
                        <h2>Πρόγραμμα Εκπομπών: Τι παίζει σήμερα ο σταθμός</h2>
                        <p>${scheduleTextParagraph}</p>
                        <ul>
                            ${currentDaySchedule.map(s => `<li><strong>${s.startTime} - ${s.endTime}</strong>: ${s.title} ${s.host ? `με τον/την ${s.host}` : ''}</li>`).join('')}
                        </ul>
                    </section>
                `;

                scheduleSchema = currentDaySchedule.map(s => ({
                    "@type": "BroadcastEvent",
                    "name": s.title,
                    "description": s.host ? `Εκπομπή με τον/την ${s.host} στον ${station.name}` : `Ζωντανή εκπομπή στο ${station.name}`,
                    "startDate": `T${s.startTime}:00`,
                    "endDate": `T${s.endTime}:00`
                }));
            }
        }

        // 🟢 3. Δημιουργία Backlinks (Social Media & Website)
        let linksHtml = '';
        if (station.website) linksHtml += `<li><a href="${station.website}" target="_blank" rel="noopener">Επίσημη Ιστοσελίδα (Website)</a></li>`;
        if (station.facebook) linksHtml += `<li><a href="${station.facebook}" target="_blank" rel="noopener">Επίσημη Σελίδα Facebook</a></li>`;
        if (station.instagram) linksHtml += `<li><a href="${station.instagram}" target="_blank" rel="noopener">Προφίλ Instagram</a></li>`;
        if (station.twitter) linksHtml += `<li><a href="${station.twitter}" target="_blank" rel="noopener">Λογαριασμός Twitter (X)</a></li>`;
        if (station.tiktok) linksHtml += `<li><a href="${station.tiktok}" target="_blank" rel="noopener">Κανάλι TikTok</a></li>`;

        let backlinksSection = linksHtml ? `
            <section>
                <h2>Επίσημοι Σύνδεσμοι & Κοινωνικά Δίκτυα (Social Media)</h2>
                <p>Μείνετε σε επαφή με τον αγαπημένο σας σταθμό ακολουθώντας τα επίσημα προφίλ του στα social media. Ανακαλύψτε διαγωνισμούς, πλούσιο φωτογραφικό υλικό από το στούντιο, συνεντεύξεις καλλιτεχνών και άμεση επικοινωνία με τους ραδιοφωνικούς παραγωγούς:</p>
                <ul>${linksHtml}</ul>
            </section>
        ` : '';

        // 🟢 4. Δυναμικές Μεταβλητές για το κείμενο
        const stationGenre = station.genre ? station.genre : 'μουσική';
        const stationCity = station.city ? station.city : 'όλη την Ελλάδα';
        const stationRegion = station.region ? station.region : '';
        const stationLocationText = station.city && station.region ? `${station.city}, ${station.region}` : stationCity;
        
        const nowPlayingSeoText = nowPlaying ? ` Now Playing: "${nowPlaying}".` : '';
        let rawDesc = station.description && station.description.trim() !== '' 
            ? station.description 
            : `Ακούστε ζωντανά τον ${station.name}, έναν από τους κορυφαίους ραδιοφωνικούς σταθμούς για τη μουσική κατηγορία ${stationGenre}. Εκπέμπει από ${stationLocationText} και προσφέρει ένα μοναδικό, αδιάλειπτο πρόγραμμα για τους ακροατές του.`;
        
        const desc = (rawDesc + nowPlayingSeoText).replace(/\r?\n|\r/g, " ").replace(/"/g, '&quot;'); 
        const title = `${station.name} στο iRadios - Το νέο App για ραδιόφωνο!`;
        const keywords = `${station.name}, ${stationGenre}, ${stationCity}, ${stationRegion}, ιραδιοσ, iradios, web radio, eradio, live24, online radio, ραδιόφωνο, ακούστε ζωντανά, live radio, streaming, ραδιοφωνικός σταθμός, spotify, podcasts${nowPlaying ? ', ' + nowPlaying : ''}`;
        
        const fullImageUrl = `__IRADIOS_SITE_ORIGIN__/og-image/${station.slug || station._id}.png`;

        // 🟢 5. Τραβάμε μερικούς παρόμοιους σταθμούς (Internal Linking)
        const similarStations = await Station.find({
            genre: station.genre,
            _id: { $ne: station._id },
            status: 'approved'
        }).limit(5).lean();

        let similarStationsHtml = '';
        if (similarStations.length > 0) {
            similarStationsHtml = `
            <section>
                <h2>Παρόμοιοι Σταθμοί που ίσως σας αρέσουν</h2>
                <p>Αν αγαπάτε τη μουσική του ${station.name} (${stationGenre}), σας προτείνουμε να ακούσετε και τους παρακάτω σταθμούς μέσα από το iRadios:</p>
                <ul>
                    ${similarStations.map(st => `<li><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">Ακούστε τον σταθμό ${st.name}</a></li>`).join('')}
                </ul>
            </section>`;
        }

        // 🟢 6. ΝΕΟ: Structural Internal Links για να λυθεί το "Dead End" error
        const genreLinkUrl = station.genre ? `__IRADIOS_SITE_ORIGIN__/genre/${encodeURIComponent(station.genre)}` : null;
        const regionLinkUrl = station.region ? `__IRADIOS_SITE_ORIGIN__/region/${encodeURIComponent(station.region)}` : (station.city ? `__IRADIOS_SITE_ORIGIN__/region/${encodeURIComponent(station.city)}` : null);

        const structuralLinksHtml = `
            <section>
                <h2>Εξερευνήστε Περισσότερα στο iRadios (Χρήσιμοι Σύνδεσμοι)</h2>
                <p>Το ταξίδι στον κόσμο του ραδιοφώνου δεν σταματά εδώ. Ανακαλύψτε περισσότερες επιλογές και λειτουργίες μέσα από την κεντρική μας πλατφόρμα:</p>
                <ul>
                    <li>Επιστρέψτε στην <a href="__IRADIOS_SITE_ORIGIN__/">Αρχική Σελίδα του iRadios</a> για να δείτε όλες τις προτάσεις μας.</li>
                    ${genreLinkUrl ? `<li>Ακούστε περισσότερα <a href="${genreLinkUrl}">${station.genre} ραδιόφωνα</a>.</li>` : ''}
                    ${regionLinkUrl ? `<li>Βρείτε κι άλλους τοπικούς <a href="${regionLinkUrl}">σταθμούς από την περιοχή: ${station.region || station.city}</a>.</li>` : ''}
                    <li>Περιηγηθείτε γεωγραφικά μέσα από τον <a href="__IRADIOS_SITE_ORIGIN__/map">Διαδραστικό Χάρτη Ραδιοφώνων (Live Radio Map)</a>.</li>
                </ul>
            </section>
        `;

        // 🟢 7. Ετοιμασία του τελικού JSON-LD Schema (με @graph)
        const schemaData = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "RadioStation",
                    "@id": exactUrl,
                    "name": station.name,
                    "url": exactUrl,
                    "image": fullImageUrl,
                    "description": desc,
                    "genre": stationGenre,
                    "address": {
                        "@type": "PostalAddress",
                        "addressCountry": "GR",
                        "addressLocality": stationCity,
                        "addressRegion": stationRegion
                    }
                },
                ...(scheduleSchema.length > 0 ? [{
                    "@type": "BroadcastService",
                    "name": `Πρόγραμμα ${station.name}`,
                    "broadcaster": { "@id": exactUrl },
                    "hasBroadcastChannel": {
                        "@type": "BroadcastChannel",
                        "broadcastServiceTier": "Internet"
                    },
                    "broadcasts": scheduleSchema
                }] : [])
            ]
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=240, s-maxage=240, stale-while-revalidate=120'); 
        
        return res.send(`
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <meta name="description" content="${desc}" />
                <meta name="keywords" content="${keywords}" />
                <meta name="author" content="iRadios" />
                <link rel="canonical" href="${exactUrl}" />

                <link rel="icon" type="image/png" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                <link rel="apple-touch-icon" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                
                <meta name="robots" content="index, follow, noarchive" />
                
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${exactUrl}" />
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${desc}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:site_name" content="iRadios" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="${exactUrl}" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${desc}" />
                <meta name="twitter:image" content="${fullImageUrl}" />
                
                <script type="application/ld+json">
                ${JSON.stringify(schemaData, null, 2)}
                </script>
            </head>
            <body>
                <nav aria-label="Breadcrumb">
                    <ol style="list-style-type: none; padding: 0; display: flex; gap: 10px;">
                        <li><a href="__IRADIOS_SITE_ORIGIN__/">Αρχική</a> &raquo;</li>
                        ${genreLinkUrl ? `<li><a href="${genreLinkUrl}">${stationGenre}</a> &raquo;</li>` : ''}
                        <li><a href="${exactUrl}" aria-current="page">${station.name}</a></li>
                    </ol>
                </nav>
                <main>
                    <article>
                        <header>
                            <h1>${title}</h1>
                            <h2>Ακούστε Ζωντανά ${station.name} | Live Web Radio στο iRadios</h2>
                            <p><span><strong>${title}</strong></span> Ο απόλυτος ψηφιακός προορισμός για να συντονιστείτε στον αγαπημένο σας σταθμό. Μάθετε τα πάντα για το πρόγραμμα, τη μουσική και τους παραγωγούς του.</p>
                        </header>
                        
                        <figure>
                            <img src="${fullImageUrl}" alt="${station.name} Logo iRadios ραδιόφωνο iluma digital agency athens egaleo" fetchpriority="high" style="width:100%; object-fit:cover;">
                        </figure>
                        
                        <section>
                            <h2>Η Ταυτότητα του Σταθμού: ${station.name}</h2>
                            <p>Καλώς ήρθατε στο επίσημο προφίλ του σταθμού <strong>${station.name}</strong>, μέσα από την πρωτοποριακή πλατφόρμα του iRadios. Ο συγκεκριμένος σταθμός έχει καταφέρει να χτίσει ένα ισχυρό, πιστό κοινό, προσφέροντας καθημερινά ένα προσεκτικά επιλεγμένο πρόγραμμα που συνδυάζει την άριστη μουσική ροή με την αμεσότητα του ζωντανού ραδιοφώνου.</p>
                            
                            <p>Η περιγραφή του σταθμού αναφέρει: <em>${rawDesc}</em></p>
                            
                            <p>Στη σύγχρονη εποχή του web radio, η ποιότητα μετάδοσης είναι το παν. Ο σταθμός εκπέμπει ψηφιακά με υψηλό bitrate, διασφαλίζοντας ότι κάθε νότα, κάθε εκπομπή και κάθε λέξη των παραγωγών φτάνει στα αυτιά σας με απόλυτη ευκρίνεια. Είτε τον ακούτε κατά τη διάρκεια της εργασίας σας στον υπολογιστή, είτε ενώ οδηγείτε στο αυτοκίνητο, είτε χαλαρώνοντας στο σπίτι μέσω του κινητού σας, η εμπειρία ακρόασης παραμένει σταθερή και χωρίς καθυστερήσεις (buffering).</p>
                        </section>

                        <section>
                            <h2>Μουσικό Προφίλ: ${stationGenre}</h2>
                            <p>Η μουσική ταυτότητα είναι αυτό που καθορίζει έναν ραδιοφωνικό σταθμό. Ο <strong>${station.name}</strong> ανήκει επίσημα στην κατηγορία <strong>${stationGenre}</strong>. Αυτό σημαίνει ότι οι ραδιοφωνικοί παραγωγοί και η διεύθυνση προγράμματος του σταθμού αφιερώνουν αμέτρητες ώρες καθημερινά για να επιλέξουν τα καλύτερα κομμάτια αυτού του είδους, δημιουργώντας playlists που κρατούν τους ακροατές συντονισμένους για ώρες.</p>
                            <p>${nowPlayingSeoText} <a href="https://open.spotify.com/search/${encodeURIComponent(nowPlaying)}" target="_blank" rel="noopener noreferrer">Αναζήτηση στο Spotify</a></p>
                            <p>Η μουσική ${stationGenre} έχει τη δική της ξεχωριστή ενέργεια. Μπορεί να σας φτιάξει τη διάθεση, να σας ταξιδέψει σε αναμνήσεις, ή να σας κρατήσει παρέα στις καθημερινές σας δραστηριότητες. Η επιτυχία του σταθμού βασίζεται ακριβώς σε αυτή την εξειδίκευση: γνωρίζει το κοινό του, σέβεται τις μουσικές του προτιμήσεις και φροντίζει να του προσφέρει συνεχώς νέες κυκλοφορίες αλλά και διαχρονικές επιτυχίες.</p>
                            
                            ${nowPlaying ? `<p>Αναρωτιέστε τι μουσική παίζει αυτή τη στιγμή; Χάρη στο σύστημα Live AI Music Radar του iRadios, βλέπουμε ότι <strong>αυτή τη στιγμή παίζει το κομμάτι "${nowPlaying}"</strong>. Ακούστε το ξανά ή προσθέστε το στις λίστες σας αναζητώντας το απευθείας στο <a href="https://open.spotify.com/search/${encodeURIComponent(nowPlaying)}" target="_blank" rel="noopener noreferrer">Spotify</a>. Μπείτε στην πλατφόρμα μας για να βλέπετε ζωντανά όλους τους τίτλους τραγουδιών (Now Playing).</p>` : ''}                        </section>

                        <section>
                            <h2>Γεωγραφικό Στίγμα: Εκπέμποντας από ${stationLocationText}</h2>
                            <p>Ένα από τα πιο γοητευτικά στοιχεία του ραδιοφώνου είναι η τοπική του σύνδεση. Ο σταθμός <strong>${station.name}</strong> έχει ως βάση εκπομπής <strong>${stationLocationText}</strong>. Το γεωγραφικό αυτό στίγμα δεν είναι απλώς μια διεύθυνση. Είναι η "φωνή" της περιοχής.</p>
                            
                            <p>Τα τοπικά ραδιόφωνα κατανοούν τον παλμό της κοινωνίας τους καλύτερα από οποιονδήποτε άλλον. Μεταδίδουν τον τοπικό πολιτισμό, στηρίζουν τους καλλιτέχνες της περιοχής και παρέχουν ενημέρωση για όσα συμβαίνουν γύρω τους. Ακόμα κι αν εσείς βρίσκεστε χιλιόμετρα μακριά, ίσως ακόμα και στο εξωτερικό, το να ακούτε έναν σταθμό από ${stationLocationText} σας φέρνει νοερά πίσω στην πατρίδα, δημιουργώντας μια βαθιά, συναισθηματική σύνδεση που μόνο το ραδιόφωνο μπορεί να επιτύχει.</p>
                            
                            <p>Αν θέλετε να εξερευνήσετε περισσότερους σταθμούς με βάση τη γεωγραφία τους, το iRadios προσφέρει έναν πρωτοποριακό Διαδραστικό Χάρτη. Μπορείτε να πλοηγηθείτε σε όλη την Ελλάδα και να ανακαλύψετε σταθμούς όπως αυτόν, κατευθείαν από τον τόπο εκπομπής τους.</p>
                        </section>

                        ${scheduleHtml}

                        ${backlinksSection}

                        ${similarStationsHtml}

                        ${structuralLinksHtml}

                        <section>
                            <h2>Η Απόλυτη Εμπειρία Ακρόασης με το iRadios</h2>
                            <p>Η εποχή που παλεύαμε με συχνότητες FM γεμάτες παράσιτα ή με ιστοσελίδες (directories) γεμάτες ενοχλητικά διαφημιστικά pop-ups, ανήκει οριστικά στο παρελθόν. Το <strong>iRadios</strong> δημιουργήθηκε για να σας προσφέρει τον <strong>${station.name}</strong> και χιλιάδες ακόμα σταθμούς, μέσα σε ένα καθαρό, υπερσύγχρονο ψηφιακό περιβάλλον.</p>
                            
                            <p>Η εφαρμογή μας (app) έχει αναπτυχθεί με τα πιο σύγχρονα πρότυπα της τεχνολογίας web, εξασφαλίζοντας ακαριαία αλλαγή σταθμών (zapping), ελάχιστη κατανάλωση δεδομένων και πλήρη συμβατότητα με όλες τις συσκευές. Επιπλέον, για τους πραγματικούς λάτρεις του ραδιοφώνου, διαθέτουμε το <strong>iRadios Premium</strong>. Με την αναβάθμιση, απολαμβάνετε ακρόαση χωρίς καμία απολύτως διαφήμιση εντός της εφαρμογής και αποκτάτε πρόσβαση στο Studio DSP, το οποίο επεξεργάζεται τον ήχο του σταθμού δίνοντάς του κρυστάλλινη, τρισδιάστατη μορφή.</p>
                            
                            <p>Αποθηκεύστε τον σταθμό <strong>${station.name}</strong> στα Αγαπημένα σας (Favorites) με ένα κλικ, φτιάξτε την προσωπική σας ραδιοφωνική λίστα και νιώστε ξανά τη μαγεία του ραδιοφώνου. Το έργο αυτό σχεδιάστηκε και υποστηρίζεται τεχνολογικά από την <a href="https://iluma.gr" target="_blank" rel="noopener">ILUMA Digital Agency</a>, ένα κορυφαίο agency που εξειδικεύεται στο User Experience (UX).</p>
                        </section>

                        <section>
                            <h3>Συντονιστείτε Τώρα</h3>
                            <p>Μην χάνετε άλλο χρόνο. Είστε ένα μόλις κλικ μακριά από την καλύτερη ραδιοφωνική εμπειρία. Πατήστε το κουμπί της αναπαραγωγής (Play) στην πλατφόρμα μας, δυναμώστε την ένταση και αφήστε τον σταθμό <strong>${station.name}</strong> να γεμίσει τον χώρο σας με την καλύτερη μουσική και τις πιο ενδιαφέρουσες εκπομπές. Καλή ακρόαση!</p>
                        </section>
                    </article>
                </main>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Station SEO Error:", err);
        return next();
    }
};

// 3. SEO Injection για ΕΙΔΟΣ (Genre)
exports.injectGenreSeo = async (req, res, next) => {
    try {
        if (!isBotRequest(req) && !req.query.bot) return next();

        const { genreName } = req.params;
        const decodedGenre = decodeURIComponent(genreName);
        const exactUrl = `__IRADIOS_SITE_ORIGIN__${req.originalUrl}`;
        
        // 🟢 1. Τραβάμε τους σταθμούς αυτού του Genre (Έως 30 για πιο πλούσιο περιεχόμενο)
        const stations = await Station.find({ 
            genre: new RegExp('^' + decodedGenre + '$', 'i'),
            status: 'approved'
        }).limit(30).lean();

        // 🟢 2. Τραβάμε 10 τυχαία (ή διαφορετικά) Genres για δυνατά Internal Links!
        const relatedGenres = await Station.distinct('genre', { 
            status: 'approved',
            genre: { $ne: decodedGenre, $nin: [null, ''] }
        });
        const randomRelatedGenres = relatedGenres.sort(() => 0.5 - Math.random()).slice(0, 10);
        
        let internalLinksHtml = '';
        if (randomRelatedGenres.length > 0) {
            internalLinksHtml = `<ul>` + randomRelatedGenres.map(g => 
                `<li><a href="__IRADIOS_SITE_ORIGIN__/genre/${encodeURIComponent(g)}">Ανακαλύψτε σταθμούς με μουσική ${g}</a></li>`
            ).join('') + `</ul>`;
        }

        // 🟢 Δημιουργία HTML Λίστας Σταθμών για το SEO
        let stationsHtml = '';
        if (stations.length > 0) {
            stationsHtml += `<h2>Δημοφιλείς Σταθμοί στην κατηγορία: ${decodedGenre}</h2>`;
            stationsHtml += `<ul>`;
            
            stations.forEach(st => {
                let stLinks = [];
                if (st.website) stLinks.push(`<a href="${st.website}" target="_blank" rel="noopener">Website</a>`);
                if (st.facebook) stLinks.push(`<a href="${st.facebook}" target="_blank" rel="noopener">Facebook</a>`);
                if (st.instagram) stLinks.push(`<a href="${st.instagram}" target="_blank" rel="noopener">Instagram</a>`);
                if (st.twitter) stLinks.push(`<a href="${st.twitter}" target="_blank" rel="noopener">Twitter</a>`);
                if (st.tiktok) stLinks.push(`<a href="${st.tiktok}" target="_blank" rel="noopener">TikTok</a>`);
                
                const linksStr = stLinks.join(' | ');
                const stDesc = st.description && st.description.trim() !== '' 
                    ? st.description 
                    : `Ακούστε ζωντανά τον ραδιοφωνικό σταθμό ${st.name} στο iRadios. Ιδανική επιλογή για τη μουσική ${decodedGenre}.`;

                stationsHtml += `
                    <li style="margin-bottom: 20px;">
                        <h3><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></h3>
                        <p>${stDesc}</p>
                        ${linksStr ? `<p><strong>Επίσημα Links:</strong> ${linksStr}</p>` : ''}
                    </li>
                `;
            });
            stationsHtml += `</ul>`;
        } else {
            stationsHtml = `<p>Ανακαλύψτε τους καλύτερους σταθμούς για τη μουσική κατηγορία ${decodedGenre} στο iRadios.</p>`;
        }

        // 🟢 H1 και Title (Ταυτίζονται για SEO consistency)
        const title = `${decodedGenre} ραδιόφωνα στο iRadios - Το νέο App για ραδιόφωνο!`;
        const desc = `Ακούστε ${decodedGenre} ραδιόφωνα στο iRadios. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming web radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`;
        const keywords = `${decodedGenre}, μουσική ${decodedGenre}, ραδιόφωνο ${decodedGenre}, είδος ${decodedGenre}, ραδιόφωνα ${decodedGenre}, web radio, eradio, live24, online radio, ραδιόφωνο, ακούστε ζωντανά, live radio, iRadios, internet radio`;
        const fullImageUrl = `__IRADIOS_SITE_ORIGIN__/presskit/iradios_fbcover-logo.png`;

        // ΣΩΣΤΟ Schema.org για το Genre
        const schemaData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "url": exactUrl,
            "description": desc,
            "image": fullImageUrl,
            "mainEntity": {
                "@type": "ItemList",
                "itemListElement": stations.map((st, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "url": `__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}`,
                    "name": st.name
                }))
            }
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); 
        
        return res.send(`
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <meta name="description" content="${desc}" />
                <meta name="keywords" content="${keywords}" />
                <meta name="author" content="iRadios" />
                <link rel="canonical" href="${exactUrl}" />

                <link rel="icon" type="image/png" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                <link rel="apple-touch-icon" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                
                <meta name="robots" content="index, follow, noarchive" />

                <meta property="og:type" content="website" />
                <meta property="og:url" content="${exactUrl}" />
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${desc}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:site_name" content="iRadios" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="${exactUrl}" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${desc}" />
                <meta name="twitter:image" content="${fullImageUrl}" />
                
                <script type="application/ld+json">
                ${JSON.stringify(schemaData, null, 2)}
                </script>
            </head>
            <body>
                <main>
                    <article>
                        <header>
                            <h1>${title}</h1>
                            <p><span><strong>${title}</strong></span> Η απόλυτη επιλογή για όσους αγαπούν τη συγκεκριμένη μουσική. Καλώς ήρθατε στην κορυφαία πλατφόρμα ακρόασης.</p>
                        </header>

                        <figure>
                            <img src="${fullImageUrl}" alt="Λογότυπο iRadios για τη σελίδα ${decodedGenre}" fetchpriority="high" style="width:100%; object-fit:cover;">
                        </figure>

                        <section>
                            <h2>Ο Κόσμος της Κατηγορίας: ${decodedGenre}</h2>
                            <p>Η μουσική είναι ένας ζωντανός οργανισμός, ένα παγκόσμιο φαινόμενο που εξελίσσεται καθημερινά, και το είδος <strong>${decodedGenre}</strong> αποτελεί έναν από τους πιο σημαντικούς πυλώνες αυτής της εξέλιξης. Όταν επιλέγετε να ακούσετε ραδιοφωνικούς σταθμούς που εστιάζουν σε αυτό το μουσικό στυλ, δεν ακούτε απλώς μια σειρά από τραγούδια. Συμμετέχετε σε μια ακουστική εμπειρία που έχει διαμορφωθεί μέσα από χρόνια καλλιτεχνικής έκφρασης, κοινωνικών ζυμώσεων και πολιτιστικών αλλαγών.</p>
                            
                            <p>Η πλατφόρμα του <strong>iRadios</strong> δημιουργήθηκε με σκοπό να αναδείξει την ποικιλομορφία του ελληνικού και παγκόσμιου ραδιοφώνου. Κατανοούμε απόλυτα πως οι ακροατές της κατηγορίας ${decodedGenre} είναι απαιτητικοί. Αναζητούν άριστη ποιότητα ήχου, επιλεγμένα playlists, ταλαντούχους ραδιοφωνικούς παραγωγούς και, κυρίως, αδιάλειπτη ροή μουσικής χωρίς περιττές διακοπές. Γι' αυτό τον λόγο, συγκεντρώσαμε εδώ τους πιο αντιπροσωπευτικούς και δημοφιλείς σταθμούς, από τα FM μέχρι τα αποκλειστικά web radios.</p>
                            
                            <p>Το να ακούς ραδιόφωνο στο ίντερνετ (online radio) δεν είναι απλώς μια εναλλακτική λύση, είναι ο σύγχρονος κανόνας. Τα γεωγραφικά σύνορα δεν περιορίζουν πλέον τις επιλογές μας. Είτε μένετε στην Αθήνα, στη Θεσσαλονίκη, στην επαρχία, ή είστε Έλληνες του εξωτερικού, το ${decodedGenre} ταξιδεύει μαζί σας, μέσα από το κινητό, το tablet ή τον υπολογιστή σας.</p>
                        </section>

                        <section>
                            <h2>Γιατί να επιλέξετε ραδιόφωνα της κατηγορίας ${decodedGenre};</h2>
                            <p>Κάθε μουσικό είδος προσφέρει μια ξεχωριστή ενέργεια. Η μουσική <strong>${decodedGenre}</strong> ξεχωρίζει γιατί μπορεί να επηρεάσει άμεσα τη διάθεσή μας. Οι ραδιοφωνικοί σταθμοί που ειδικεύονται σε αυτή την κατηγορία, επενδύουν αμέτρητες ώρες στην έρευνα και στην οργάνωση του προγράμματός τους. Οι ραδιοφωνικοί παραγωγοί (DJ's και ραδιοερασιτέχνες) λειτουργούν ως οι απόλυτοι "curators" - συλλέκτες ήχων.</p>
                            
                            <p>Όταν συντονίζεστε σε ένα σταθμό αυτής της λίστας, γνωρίζετε εκ των προτέρων ότι ο ήχος θα ταιριάζει με τη στιγμή. Είναι το ιδανικό soundtrack για να ξεκινήσετε τη μέρα σας γεμάτοι ενέργεια, για να συγκεντρωθείτε κατά τη διάρκεια της εργασίας σας, ή για να χαλαρώσετε το βράδυ επιστρέφοντας στο σπίτι. Το iRadios έχει σχεδιαστεί έτσι ώστε η αναζήτηση και η αναπαραγωγή αυτών των σταθμών να είναι άμεση. Η μετάβαση από τον έναν σταθμό στον άλλον γίνεται ακαριαία, εξασφαλίζοντας μια απρόσκοπτη ραδιοφωνική εμπειρία.</p>
                            
                            <p>Επιπλέον, πολλά από τα ραδιόφωνα που ανήκουν στην κατηγορία ${decodedGenre} ενσωματώνουν στο πρόγραμμά τους συνεντεύξεις καλλιτεχνών, παρουσιάσεις νέων άλμπουμ, διαγωνισμούς και αποκλειστικά μουσικά νέα. Με αυτόν τον τρόπο, το ραδιόφωνο παραμένει το πιο ζωντανό και άμεσο μέσο ενημέρωσης γύρω από τις τάσεις της δισκογραφίας.</p>
                        </section>

                        <section>
                            <h2>Τεχνολογία και Ραδιόφωνο: Η εμπειρία του iRadios</h2>
                            <p>Σε αντίθεση με τις παλαιότερες πλατφόρμες αναζήτησης σταθμών (directories), το iRadios αποτελεί μια τεχνολογικά προηγμένη web εφαρμογή. Η κατηγορία <strong>${decodedGenre}</strong> αναδεικνύεται στο έπακρο μέσα από τα εργαλεία μας. Ένα από τα πιο αγαπημένα χαρακτηριστικά των χρηστών μας είναι το "Live AI Music Radar".</p>
                            
                            <p>Πόσες φορές βρεθήκατε να ακούτε ένα εκπληκτικό κομμάτι στο ραδιόφωνο και να αναρωτιέστε ποιος το τραγουδάει; Το σύστημά μας, αντλώντας δεδομένα απευθείας από τους streaming servers των σταθμών, προβάλλει τον τίτλο και τον καλλιτέχνη σε πραγματικό χρόνο (Now Playing metadata). Αυτό είναι ιδιαίτερα χρήσιμο στους σταθμούς ${decodedGenre}, όπου συχνά παρουσιάζονται νέοι δημιουργοί ή σπάνια remixes.</p>
                            
                            <p>Παράλληλα, το iRadios προσφέρει κορυφαία ποιότητα ροής (streaming quality). Όλοι οι σταθμοί αναπαράγονται στο μέγιστο δυνατό bitrate που υποστηρίζει ο εκάστοτε πάροχος, ενώ οι αλγόριθμοι μας φροντίζουν να ελαχιστοποιούνται τα φαινόμενα buffering, ακόμα και σε συνδέσεις κινητής τηλεφωνίας. Και για όσους αναζητούν την απόλυτη τελειότητα, το <strong>iRadios Premium</strong> εισάγει το Studio DSP (Digital Signal Processing), μια λειτουργία που δίνει βάθος, καθαρότητα και τρισδιάστατη αίσθηση στον ήχο, καταργώντας εντελώς τις in-app διαφημίσεις.</p>
                        </section>

                        <section>
                            ${stationsHtml}
                        </section>

                        <section>
                            <h2>Περισσότερες Μουσικές Επιλογές (Internal Links)</h2>
                            <p>Το ραδιόφωνο είναι ένα ατελείωτο ταξίδι εξερεύνησης. Αν αγαπάτε τη μουσική ${decodedGenre}, το iRadios σας προτείνει να ανοίξετε τους ορίζοντές σας και να ανακαλύψετε νέους ήχους, σταθμούς και παραγωγούς σε συγγενικά είδη μουσικής.</p>
                            <p>Η πλατφόρμα μας φιλοξενεί εκατοντάδες σταθμούς χωρισμένους σε κατηγορίες, επιτρέποντάς σας να αλλάζετε διάθεση με ένα μόνο κλικ. Δείτε παρακάτω άλλες δημοφιλείς μουσικές κατηγορίες που ακούνε οι χρήστες μας:</p>
                            
                            ${internalLinksHtml}
                            
                            <p>Μην ξεχνάτε ότι με το εργαλείο "Αγαπημένα", μπορείτε να φτιάξετε τη δική σας προσωπική λίστα με ραδιόφωνα, συνδυάζοντας το είδος ${decodedGenre} με οποιαδήποτε άλλη μουσική σας εκφράζει. Το iRadios είναι το προσωπικό σας ψηφιακό ραδιόφωνο, σχεδιασμένο απόλυτα πάνω στα μέτρα σας.</p>
                        </section>

                        <section>
                            <h2>Ο ρόλος των Web Radios (Ιντερνετικά Ραδιόφωνα)</h2>
                            <p>Στη λίστα των σταθμών της κατηγορίας <strong>${decodedGenre}</strong>, θα παρατηρήσετε μια ισχυρή παρουσία από web radios (διαδικτυακά ραδιόφωνα) που δεν εκπέμπουν στα παραδοσιακά FM. Τα web radios αποτελούν την πιο αγνή, ανεξάρτητη μορφή της σύγχρονης ραδιοφωνίας. Χωρίς τους αυστηρούς χρονικούς ή εμπορικούς περιορισμούς των μεγάλων συχνοτήτων, οι ιντερνετικοί σταθμοί έχουν την ελευθερία να πειραματιστούν, να παίξουν λιγότερο γνωστά κομμάτια και να στηρίξουν βαθύτερα τη μουσική σκηνή.</p>
                            
                            <p>Το iRadios στηρίζει έμπρακτα την ανεξάρτητη διαδικτυακή ραδιοφωνία, τοποθετώντας τα ποιοτικά web radios δίπλα στα μεγάλα ραδιοφωνικά δίκτυα της χώρας. Πολλοί από αυτούς τους σταθμούς έχουν αποκτήσει φανατικό κοινό, ακριβώς επειδή το πρόγραμμά τους προσφέρει κάτι διαφορετικό, κάτι μοναδικό που δεν βρίσκεις εύκολα στο "mainstream" στερέωμα.</p>
                        </section>

                        <section>
                            <h2>Συνοψίζοντας: Γιατί το iRadios είναι η καλύτερη επιλογή</h2>
                            <p>Αν ψάχνετε την απόλυτη εφαρμογή (app) για να απολαμβάνετε <strong>${decodedGenre} ραδιόφωνα στο iRadios - Το νέο App για ραδιόφωνο!</strong>, βρίσκεστε στο σωστό μέρος. Ήρθε η ώρα να αφήσετε πίσω τις ξεπερασμένες σελίδες με τις αργές ταχύτητες και τις ενοχλητικές διαφημίσεις. Το iRadios σας προσφέρει:</p>
                            <ul>
                                <li>Άμεση πρόσβαση στους καλύτερους σταθμούς της κατηγορίας ${decodedGenre}.</li>
                                <li>Ασυναγώνιστη ταχύτητα φόρτωσης και απόκρισης του player.</li>
                                <li>Οπτική ένδειξη του τραγουδιού που παίζει ζωντανά (Now Playing).</li>
                                <li>Πανεύκολη πλοήγηση μέσω υπολογιστή, κινητού ή tablet.</li>
                                <li>Δυνατότητα εύρεσης σταθμών μέσω του σύγχρονου διαδραστικού μας χάρτη.</li>
                            </ul>
                            <p>Συντονιστείτε, εξερευνήστε και νιώστε τη μαγεία της μουσικής. Η ομάδα της <a href="https://iluma.gr" target="_blank" rel="noopener">ILUMA Digital Agency</a> έχει σχεδιάσει την κάθε λεπτομέρεια αυτής της πλατφόρμας, με μοναδικό γνώμονα την απόλυτη ακουστική και οπτική εμπειρία του χρήστη.</p>
                        </section>
                    </article>
                </main>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Genre SEO Error:", err);
        return next();
    }
};

// 4. SEO Injection για ΠΕΡΙΟΧΗ (Region)
exports.injectRegionSeo = async (req, res, next) => {
    try {
        if (!isBotRequest(req) && !req.query.bot) return next();

        const { regionName } = req.params;
        const decodedRegion = decodeURIComponent(regionName);
        const exactUrl = `__IRADIOS_SITE_ORIGIN__${req.originalUrl}`;
        
        // 🟢 1. Τραβάμε από τη Βάση έως 30 σταθμούς που ανήκουν σε αυτή την Περιοχή (ή Πόλη)
        const stations = await Station.find({ 
            $or: [
                { region: new RegExp('^' + decodedRegion + '$', 'i') },
                { city: new RegExp('^' + decodedRegion + '$', 'i') }
            ],
            status: 'approved'
        }).limit(30).lean();

        // 🟢 2. Τραβάμε 10 τυχαίες Περιοχές/Πόλεις για δυνατά Internal Links!
        const relatedRegions = await Station.distinct('region', { 
            status: 'approved',
            region: { $ne: decodedRegion, $nin: [null, ''] }
        });
        const randomRelatedRegions = relatedRegions.sort(() => 0.5 - Math.random()).slice(0, 10);
        
        let internalLinksHtml = '';
        if (randomRelatedRegions.length > 0) {
            internalLinksHtml = `<ul>` + randomRelatedRegions.map(r => 
                `<li><a href="__IRADIOS_SITE_ORIGIN__/region/${encodeURIComponent(r)}">Ανακαλύψτε τοπικούς σταθμούς και web radios από: ${r}</a></li>`
            ).join('') + `</ul>`;
        }

        // 🟢 Δημιουργία HTML Λίστας Σταθμών για το SEO
        let stationsHtml = '';
        if (stations.length > 0) {
            stationsHtml += `<h2>Δημοφιλείς Σταθμοί στην περιοχή: ${decodedRegion}</h2>`;
            stationsHtml += `<ul>`;
            
            stations.forEach(st => {
                let stLinks = [];
                if (st.website) stLinks.push(`<a href="${st.website}" target="_blank" rel="noopener">Website</a>`);
                if (st.facebook) stLinks.push(`<a href="${st.facebook}" target="_blank" rel="noopener">Facebook</a>`);
                if (st.instagram) stLinks.push(`<a href="${st.instagram}" target="_blank" rel="noopener">Instagram</a>`);
                if (st.twitter) stLinks.push(`<a href="${st.twitter}" target="_blank" rel="noopener">Twitter</a>`);
                if (st.tiktok) stLinks.push(`<a href="${st.tiktok}" target="_blank" rel="noopener">TikTok</a>`);
                
                const linksStr = stLinks.join(' | ');
                const stDesc = st.description && st.description.trim() !== '' 
                    ? st.description 
                    : `Ακούστε ζωντανά τον ραδιοφωνικό σταθμό ${st.name} από ${st.city || st.region || decodedRegion} στο iRadios. Συντονιστείτε στο καλύτερο τοπικό ραδιόφωνο.`;

                stationsHtml += `
                    <li style="margin-bottom: 20px;">
                        <h3><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></h3>
                        <p>${stDesc}</p>
                        ${linksStr ? `<p><strong>Επίσημα Links:</strong> ${linksStr}</p>` : ''}
                    </li>
                `;
            });
            stationsHtml += `</ul>`;
        } else {
            stationsHtml = `<p>Ανακαλύψτε τα καλύτερα ραδιόφωνα και τη μουσική παράδοση της περιοχής ${decodedRegion} στο iRadios.</p>`;
        }

        // 🟢 H1 και Title (Ταυτίζονται για SEO consistency)
        const title = `Ραδιόφωνα ${decodedRegion} στο iRadios - Το νέο App για ραδιόφωνο!`;
        const desc = `Ακούστε ζωντανά ραδιόφωνα από ${decodedRegion} στο iRadios App. Όλα τα τοπικά ραδιόφωνα σε μία εφαρμογή. Streaming radio από την περιοχή σας με κορυφαία ποιότητα ήχου.`;
        const keywords = `iRadios, ραδιόφωνο, ${decodedRegion}, τοπικό ραδιόφωνο ${decodedRegion}, online radio, web radio, ελληνικό ραδιόφωνο, eradio, ζωντανή μουσική, ιντερνετικό ραδιόφωνο, εραδιο, ραδιοφωνικοί σταθμοί, podcasts`;
        const fullImageUrl = `__IRADIOS_SITE_ORIGIN__/presskit/iradios_fbcover-logo.png`;

        // ΣΩΣΤΟ Schema.org για το Region
        const schemaData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "url": exactUrl,
            "description": desc,
            "image": fullImageUrl,
            "mainEntity": {
                "@type": "ItemList",
                "itemListElement": stations.map((st, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "url": `__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}`,
                    "name": st.name
                }))
            }
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); 
        
        return res.send(`
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <meta name="description" content="${desc}" />
                <meta name="keywords" content="${keywords}" />
                <meta name="author" content="iRadios" />
                <link rel="canonical" href="${exactUrl}" />

                <link rel="icon" type="image/png" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                <link rel="apple-touch-icon" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                
                <meta name="robots" content="index, follow, noarchive" />
                
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${exactUrl}" />
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${desc}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:site_name" content="iRadios" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="${exactUrl}" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${desc}" />
                <meta name="twitter:image" content="${fullImageUrl}" />
                
                <script type="application/ld+json">
                ${JSON.stringify(schemaData, null, 2)}
                </script>
            </head>
            <body>
                <main>
                    <article>
                        <header>
                            <h1>${title}</h1>
                            <p><span><strong>${title}</strong></span> Ανακαλύψτε τη δύναμη του τοπικού ραδιοφώνου και συντονιστείτε στην καρδιά της αγαπημένης σας περιοχής.</p>
                        </header>

                        <figure>
                            <img src="${fullImageUrl}" alt="Λογότυπο iRadios - Τοπικοί Σταθμοί για ${decodedRegion}" fetchpriority="high" style="width:100%; object-fit:cover;">
                        </figure>

                        <section>
                            <h2>Η Μαγεία του Τοπικού Ραδιοφώνου στην περιοχή: ${decodedRegion}</h2>
                            <p>Το ραδιόφωνο αποτελούσε ανέκαθεν την πιο άμεση, την πιο "ζεστή" και ειλικρινή μορφή επικοινωνίας. Σε μια εποχή όπου η πληροφορία και η μουσική παγκοσμιοποιούνται με ιλιγγιώδεις ρυθμούς, το τοπικό ραδιόφωνο διατηρεί τον ξεχωριστό, αυθεντικό του χαρακτήρα. Όταν επιλέγετε να ακούσετε σταθμούς από την περιοχή <strong>${decodedRegion}</strong>, δεν συντονίζεστε απλώς σε μια συχνότητα. Συντονίζεστε στον παλμό, στην κουλτούρα και στην καθημερινότητα της τοπικής κοινωνίας.</p>
                            
                            <p>Το <strong>iRadios</strong> δημιουργήθηκε με ένα μεγάλο όραμα: να φέρει κάθε γωνιά της Ελλάδας και της Κύπρου, από τα μεγάλα αστικά κέντρα μέχρι τα πιο απομακρυσμένα νησιά, απευθείας στην οθόνη και τα ηχεία σας. Αν κατάγεστε από την περιοχή ${decodedRegion} αλλά ζείτε μακριά, αυτή η σελίδα αποτελεί το δικό σας ψηφιακό "εισιτήριο" επιστροφής. Αν πάλι βρίσκεστε εκεί, εδώ θα βρείτε οργανωμένα όλα τα αγαπημένα σας FM και Web Radios, για να τα απολαμβάνετε χωρίς παρεμβολές και περιορισμούς εμβέλειας.</p>
                            
                            <p>Η μετάβαση από το αναλογικό (FM/AM) στο ιντερνετικό ραδιόφωνο (online radio) έλυσε το αιώνιο πρόβλημα των γεωγραφικών συνόρων. Πλέον, μπορείτε να ακούτε τον αγαπημένο σας τοπικό ραδιοφωνικό παραγωγό, να μαθαίνετε τα νέα της πόλης σας και να απολαμβάνετε επιλεγμένη μουσική, από οποιοδήποτε σημείο του πλανήτη, με μοναδική προϋπόθεση την ύπαρξη σύνδεσης στο διαδίκτυο.</p>
                        </section>

                        <section>
                            <h2>Γιατί να συντονιστείτε στους σταθμούς της περιοχής ${decodedRegion};</h2>
                            <p>Το ραδιόφωνο της περιφέρειας έχει μια δική του, αξεπέραστη δυναμική. Οι ραδιοφωνικοί σταθμοί της περιοχής <strong>${decodedRegion}</strong> φημίζονται για την επαφή που έχουν με τους ακροατές τους. Οι παραγωγοί λειτουργούν συχνά ως η "φωνή" της κοινότητας, προβάλλοντας τοπικά ζητήματα, διοργανώνοντας διαγωνισμούς, αναδεικνύοντας ντόπιους καλλιτέχνες και μεταδίδοντας τον πολιτισμικό πλούτο του τόπου.</p>
                            
                            <p>Μέσα από τον κατάλογο του iRadios, η αναζήτηση και η ακρόαση αυτών των σταθμών γίνεται μια απολαυστική εμπειρία. Αντί να ψάχνετε χειροκίνητα συχνότητες ή να παλεύετε με κακό σήμα καθώς οδηγείτε, μπορείτε να έχετε όλους τους τοπικούς σταθμούς της περιοχής συγκεντρωμένους σε μια λίστα. Το περιβάλλον πλοήγησης (UI) είναι σχεδιασμένο ώστε η αλλαγή σταθμού να γίνεται ακαριαία.</p>
                            
                            <p>Ανεξάρτητα από το αν ψάχνετε λαϊκή μουσική, παραδοσιακά τραγούδια του τόπου, σύγχρονες pop επιτυχίες ή έντεχνο ελληνικό ρεπερτόριο, οι σταθμοί της περιοχής ${decodedRegion} καλύπτουν όλο το φάσμα των μουσικών προτιμήσεων. Επιπλέον, τα ενημερωτικά και αθλητικά ραδιόφωνα της περιοχής προσφέρουν έγκυρη και άμεση κάλυψη της τοπικής επικαιρότητας.</p>
                        </section>

                        <section>
                            <h2>Τεχνολογική Υπεροχή: Ζήστε το ραδιόφωνο διαφορετικά</h2>
                            <p>Πολλές πλατφόρμες αναζήτησης σταθμών περιορίζονται σε μια απλή παράθεση συνδέσμων, συχνά συνοδευόμενων από ενοχλητικά διαφημιστικά (pop-ups). Το iRadios αποτελεί μια τεχνολογική επανάσταση στο χώρο του διαδικτυακού ραδιοφώνου (web radio). Για τους σταθμούς της περιοχής <strong>${decodedRegion}</strong>, αλλά και για όλους τους σταθμούς του δικτύου μας, προσφέρουμε λειτουργίες που μεταμορφώνουν την ακρόαση.</p>
                            
                            <p>Μέσω της λειτουργίας "Live AI Music Radar", όταν συντονίζεστε σε έναν σταθμό της περιοχής που υποστηρίζει μετάδοση μεταδεδομένων (metadata), το iRadios εντοπίζει και εμφανίζει ζωντανά τον τίτλο και τον καλλιτέχνη του τραγουδιού που παίζει (Now Playing). Έτσι, όταν το τοπικό σας ραδιόφωνο μεταδίδει μια νέα κυκλοφορία ή ένα σπάνιο κομμάτι, θα ξέρετε ακριβώς περί τίνος πρόκειται.</p>
                            
                            <p>Παράλληλα, για τους ακροατές που αναζητούν την κορυφαία ακουστική ποιότητα, το <strong>iRadios Premium</strong> καταργεί πλήρως τις in-app διαφημίσεις και ενσωματώνει το Studio DSP (Digital Signal Processing). Η τεχνολογία αυτή προσφέρει τρισδιάστατη αίσθηση (spatial audio) και ομαλοποίηση της έντασης (normalization), αναβαθμίζοντας τον ήχο ακόμα και των πιο μικρών τοπικών web radios, ώστε να ακούγονται με επαγγελματικές προδιαγραφές στούντιο.</p>
                        </section>

                        <section>
                            ${stationsHtml}
                        </section>

                        <section>
                            <h2>Εξερευνήστε Περισσότερες Περιοχές της Ελλάδας (Internal Links)</h2>
                            <p>Το ταξίδι στα ερτζιανά δεν σταματάει εδώ. Αφού απολαύσετε το ραδιόφωνο της περιοχής ${decodedRegion}, σας προσκαλούμε να περιηγηθείτε ηχητικά σε ολόκληρη την Ελλάδα και την Κύπρο. Η μουσική και το τοπικό ταμπεραμέντο αλλάζουν από νομό σε νομό και από πόλη σε πόλη.</p>
                            <p>Μέσα από τον υπερσύγχρονο, διαδραστικό Χάρτη Ραδιοφώνων (Radio Map) του iRadios, ή μέσα από τις παρακάτω προτεινόμενες περιοχές, μπορείτε να ανακαλύψετε κρυμμένα ραδιοφωνικά "διαμάντια":</p>
                            
                            ${internalLinksHtml}
                            
                            <p>Μπορείτε πάντα να δημιουργήσετε τον δικό σας λογαριασμό στο iRadios εντελώς δωρεάν. Αποθηκεύοντας τους αγαπημένους σας σταθμούς (Favorites), φτιάχνετε τη δική σας προσωπική λίστα ακρόασης, συνδυάζοντας μεγάλους σταθμούς της πρωτεύουσας με τα καλύτερα τοπικά ραδιόφωνα της περιφέρειας.</p>
                        </section>

                        <section>
                            <h2>Ο ρόλος των Ανεξάρτητων Web Radios</h2>
                            <p>Στην περιοχή <strong>${decodedRegion}</strong>, πέρα από τους καταξιωμένους σταθμούς των FM, υπάρχει και μια τεράστια, ακμάζουσα σκηνή από ανεξάρτητα Web Radios. Αυτοί οι διαδικτυακοί σταθμοί δημιουργούνται συνήθως από ομάδες φίλων, συλλόγους, ή ραδιοερασιτέχνες με πάθος για τη μουσική. Δεν δεσμεύονται από playlists πολυεθνικών εταιρειών ούτε περιορίζονται γεωγραφικά.</p>
                            
                            <p>Στο iRadios θεωρούμε χρέος μας να στηρίζουμε την ανεξάρτητη ραδιοφωνία. Πιστεύουμε ότι η πολυφωνία είναι το μεγαλύτερο όπλο του μέσου. Έτσι, φροντίζουμε τα μικρά, τοπικά web radios της περιοχής ${decodedRegion} να βρίσκονται δίπλα στα "μεγαθήρια", δίνοντάς τους την πλατφόρμα και το κοινό που τους αξίζει. Αν είστε ιδιοκτήτης ενός τέτοιου σταθμού, η πόρτα μας είναι πάντα ανοιχτή για να προσθέσετε τη δική σας συχνότητα στο δίκτυό μας.</p>
                        </section>

                        <section>
                            <h2>Συνοψίζοντας: Γιατί το iRadios κυριαρχεί</h2>
                            <p>Είτε ψάχνετε μουσική, είτε ενημέρωση, είτε ζωντανές αθλητικές περιγραφές της τοπικής σας ομάδας, τα <strong>${title}</strong> είναι η απάντηση. Η εφαρμογή μας δεν δημιουργήθηκε τυχαία. Σχεδιάστηκε από την ομάδα της <a href="https://iluma.gr" target="_blank" rel="noopener">ILUMA Digital Agency</a>, ένα next-gen agency που ειδικεύεται στην κορυφαία εμπειρία χρήστη (UX).</p>
                            <ul>
                                <li>Συγκεντρωμένοι όλοι οι σταθμοί της περιοχής ${decodedRegion}.</li>
                                <li>Ασυναγώνιστη ταχύτητα φόρτωσης (blazing fast) και εναλλαγής (zapping).</li>
                                <li>Οπτική ένδειξη Now Playing (όπου υποστηρίζεται).</li>
                                <li>Λειτουργία στο παρασκήνιο (background play) στα κινητά και πλήρης υποστήριξη Bluetooth.</li>
                                <li>Διαδραστικός, πανελλαδικός χάρτης (Radio Map) για γεωγραφική πλοήγηση.</li>
                            </ul>
                            <p>Μην περιμένετε άλλο. Πατήστε "Play" σε έναν από τους σταθμούς της λίστας μας και αφήστε τους ραδιοφωνικούς παραγωγούς της περιοχής ${decodedRegion} να σας κρατήσουν την καλύτερη μουσική συντροφιά, όλο το εικοσιτετράωρο, επτά ημέρες την εβδομάδα.</p>
                        </section>
                    </article>
                </main>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Region SEO Error:", err);
        return next();
    }
};

// 5. SEO Injection για τον Διαδραστικό Χάρτη (Map)
exports.injectMapSeo = async (req, res, next) => {
    try {
        if (!isBotRequest(req) && !req.query.bot) return next();

        const exactUrl = `__IRADIOS_SITE_ORIGIN__/map`;
        
        // 🟢 1. Τραβάμε ΟΛΟΥΣ τους σταθμούς που έχουν καταχωρημένες συντεταγμένες (lat, lng)
        const mapStations = await Station.find({
            status: 'approved',
            'location.lat': { $exists: true, $ne: null },
            'location.lng': { $exists: true, $ne: null }
        }).lean();

        let allStationsKeywords = '';
        let list1Html = '';
        let list2Html = '';
        let list3Html = '';

        if (mapStations.length > 0) {
            allStationsKeywords = mapStations.map(st => st.name).join(', ');

            // Χωρίζουμε τους σταθμούς του χάρτη σε 3 ίσα μέρη για καλύτερη παρουσίαση στο HTML
            const chunkSize = Math.ceil(mapStations.length / 3);
            const chunk1 = mapStations.slice(0, chunkSize);
            const chunk2 = mapStations.slice(chunkSize, chunkSize * 2);
            const chunk3 = mapStations.slice(chunkSize * 2);

            // Δημιουργούμε πλούσια Internal Links (με πόλη/περιοχή εφόσον υπάρχει)
            list1Html = `<ul>` + chunk1.map(st => `<li>Εκπέμπει ζωντανά: <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong> ${st.city ? 'από ' + st.city : ''}</li>`).join('') + `</ul>`;
            if (chunk2.length > 0) {
                list2Html = `<ul>` + chunk2.map(st => `<li>Ανακαλύψτε στον χάρτη: <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong> ${st.genre ? '- Μουσική ' + st.genre : ''}</li>`).join('') + `</ul>`;
            }
            if (chunk3.length > 0) {
                list3Html = `<ul>` + chunk3.map(st => `<li>Βρείτε το στίγμα του: <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong> ${st.region ? 'στην περιοχή ' + st.region : ''}</li>`).join('') + `</ul>`;
            }
        }

        const title = `Χάρτης Ραδιοφώνων στο iRadios - Το νέο App για ραδιόφωνο!`;
        const desc = `Εξερευνήστε τον χάρτη του iRadios. Βρείτε και ακούστε ζωντανά ραδιοφωνικούς σταθμούς από όλη την Ελλάδα, την Κύπρο και τον κόσμο, απευθείας από την τοποθεσία εκπομπής τους. Μια νέα εμπειρία web radio.`;
        const keywords = `χάρτης ραδιοφώνων, διαδραστικός χάρτης, radio garden, ραδιόφωνα ανά περιοχή, live map radio, iRadios map, web radio map, ελληνικά ραδιόφωνα χάρτης, eradio map, ραδιόφωνο, τοπικοί σταθμοί, ${allStationsKeywords}`;
        
        const fullImageUrl = `__IRADIOS_SITE_ORIGIN__/presskit/iradios_fbcover-mockups.png`; 

        // 🟢 ΣΩΣΤΟ Schema.org για τον Χάρτη. 
        // Χρησιμοποιούμε "Dataset" (μιας και το Map είναι λιγότερο υποστηριζόμενο για items) ή "CollectionPage" με Places
        const schemaData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "url": exactUrl,
            "description": desc,
            "image": fullImageUrl,
            "mainEntity": {
                "@type": "ItemList",
                "itemListElement": mapStations.map((st, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "item": {
                        "@type": "RadioStation",
                        "name": st.name,
                        "url": `__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}`,
                        "location": {
                            "@type": "Place",
                            "geo": {
                                "@type": "GeoCoordinates",
                                "latitude": st.location.lat,
                                "longitude": st.location.lng
                            }
                        }
                    }
                }))
            }
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); 
        
        return res.send(`
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <meta name="description" content="${desc}" />
                <meta name="keywords" content="${keywords}" />
                <meta name="author" content="iRadios" />

                <link rel="icon" type="image/png" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                <link rel="apple-touch-icon" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                
                <link rel="canonical" href="${exactUrl}" />
                
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${exactUrl}" />
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${desc}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:site_name" content="iRadios" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="${exactUrl}" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${desc}" />
                <meta name="twitter:image" content="${fullImageUrl}" />
                
                <script type="application/ld+json">
                ${JSON.stringify(schemaData, null, 2)}
                </script>
            </head>
            <body>
                <main>
                    <article>
                        <header>
                            <h1>${title}</h1>
                            <p><span><strong>${title}</strong></span> Ανακαλύψτε τη μαγεία της γεωγραφικής περιήγησης στα ερτζιανά και ακούστε τον κόσμο αλλιώς.</p>
                        </header>

                        <figure>
                            <img src="${fullImageUrl}" alt="iRadios Map Χάρτης Ραδιοφώνων | iRadios - Η Νέα ελληνική εφαρμογή για το ραδιόφωνο! eradio live24 radio garden" fetchpriority="high" style="width:100%; object-fit:cover;">
                        </figure>

                        <section>
                            <h2>Η Επανάσταση στην Ανακάλυψη Μουσικής: Ο Διαδραστικός Χάρτης</h2>
                            <p>Η ακρόαση ραδιοφώνου έχει περάσει πλέον σε μια εντελώς νέα διάσταση. Το <strong>iRadios</strong> δεν είναι απλώς ένας κατάλογος σταθμών, αλλά ένα παράθυρο στον κόσμο της μουσικής και της ενημέρωσης. Μέσω του πρωτοποριακού, διαδραστικού χάρτη μας (Radio Map), οι χρήστες έχουν τη δυνατότητα να ταξιδέψουν ψηφιακά πάνω από την Ελλάδα, την Κύπρο και όχι μόνο, ανακαλύπτοντας τοπικούς ραδιοφωνικούς σταθμούς στο φυσικό τους περιβάλλον: το ακριβές σημείο από το οποίο εκπέμπουν.</p>
                            
                            <p>Αντί να αναζητάτε σταθμούς μέσα από ατελείωτες λίστες ή να θυμάστε συχνότητες FM, ο χάρτης ραδιοφώνων μετατρέπει την οθόνη σας σε ένα παγκόσμιο δέκτη. Κάθε κουκκίδα στον χάρτη αντιπροσωπεύει μια φωνή, ένα τοπικό στούντιο, μια παρέα παραγωγών. Κάνοντας zoom σε οποιαδήποτε πόλη, νησί ή χωριό, μπορείτε να ακούσετε ακριβώς ό,τι ακούνε και οι ντόπιοι κάτοικοι εκείνη τη στιγμή. Είναι η απόλυτη γεωγραφική εμπειρία του web radio.</p>
                            
                            <p>Η συγκεκριμένη τεχνολογία, η οποία έγινε ευρέως γνωστή παγκοσμίως από εφαρμογές όπως το radio garden, έχει πλέον προσαρμοστεί απόλυτα στα ελληνικά δεδομένα μέσω του iRadios. Ο χάρτης μας είναι βελτιστοποιημένος για άμεση απόκριση, χωρίς καθυστερήσεις, επιτρέποντάς σας να "πετάτε" από την Κρήτη στη Θράκη σε κλάσματα του δευτερολέπτου, ενώ η μουσική σας ακολουθεί απρόσκοπτα.</p>
                        </section>

                        <section>
                            <h2>Πώς λειτουργεί ο Χάρτης Ραδιοφώνων του iRadios</h2>
                            <p>Η πλοήγηση είναι σχεδιασμένη ώστε να είναι απολύτως ενστικτώδης (user-friendly), είτε χρησιμοποιείτε τον υπολογιστή σας με ποντίκι, είτε την οθόνη αφής του κινητού σας τηλεφώνου. Ο αλγόριθμος του iRadios εντοπίζει την τοποθεσία σας (εφόσον το επιτρέψετε) και κεντράρει τον χάρτη στην περιοχή σας, προτείνοντάς σας αμέσως τους κορυφαίους σταθμούς της πόλης σας.</p>
                            
                            <p>Καθώς σέρνετε τον χάρτη (pan) και μετακινείστε σε άλλες γεωγραφικές περιοχές, ο δέκτης "πιάνει" αυτόματα το σήμα των σταθμών που βρίσκονται στο επίκεντρο της οθόνης σας. Αυτή η εμπειρία προσομοιώνει την αίσθηση που είχαμε παλαιότερα στα αναλογικά ραδιόφωνα, όταν γυρίζαμε τη ροδέλα αναζητώντας συχνότητες, με τη διαφορά ότι τώρα έχουμε κρυστάλλινο, ψηφιακό ήχο, χωρίς παρεμβολές και παράσιτα.</p>
                            
                            <p>Κάθε σταθμός που εμφανίζεται στον χάρτη συνοδεύεται από το λογότυπό του και, όπου είναι διαθέσιμο μέσω της τεχνολογίας Live AI Music Radar, εμφανίζεται και το τραγούδι που παίζει ζωντανά (Now Playing metadata). Με αυτόν τον τρόπο, η εξερεύνηση γίνεται όχι μόνο γεωγραφική, αλλά και καθαρά μουσική.</p>
                        </section>

                        <section>
                            <h2>Εξερευνήστε τους Σταθμούς του Χάρτη (Internal Links)</h2>
                            <p>Στον διαδραστικό μας χάρτη φιλοξενούνται εκατοντάδες ραδιοφωνικοί σταθμοί που έχουν δηλώσει το ακριβές γεωγραφικό τους στίγμα (συντεταγμένες). Από τα μεγάλα ειδησεογραφικά δίκτυα της πρωτεύουσας μέχρι τα μικρά, ανεξάρτητα web radios των νησιών του Αιγαίου. Παρακάτω, σας παρουσιάζουμε ορισμένους από τους σταθμούς που μπορείτε να εντοπίσετε και να ακούσετε ζωντανά εξερευνώντας τον χάρτη μας:</p>
                            
                            ${list1Html}
                        </section>

                        <section>
                            <h2>Η Σύνδεση με τον Τόπο Καταγωγής και την Ομογένεια</h2>
                            <p>Ο χάρτης ραδιοφώνων δεν είναι απλώς ένα τεχνολογικό παιχνίδι. Είναι ένα ισχυρό εργαλείο σύνδεσης των ανθρώπων με τις ρίζες τους. Οι Έλληνες του εξωτερικού (ομογένεια), οι φοιτητές που σπουδάζουν μακριά από τα σπίτια τους, και οι επαγγελματίες που μετακόμισαν σε άλλες πόλεις, βρίσκουν στο iRadios Map μια ζεστή "αγκαλιά".</p>
                            
                            <p>Με μερικά κλικ, μπορούν να "επιστρέψουν" εικονικά στο χωριό ή στην πόλη τους. Να ακούσουν τον τοπικό παραγωγό που τους έκανε παρέα στα εφηβικά τους χρόνια, να ακούσουν τα τοπικά νέα, τις αθλητικές μεταδόσεις των τοπικών ομάδων, και την παραδοσιακή μουσική του τόπου τους. Το τοπικό ραδιόφωνο διατηρεί ζωντανή την πολιτισμική κληρονομιά και ο χάρτης του iRadios την κάνει προσβάσιμη σε ολόκληρο τον πλανήτη.</p>
                            
                            ${list2Html}
                        </section>

                        <section>
                            <h2>Γιατί να επιλέξετε τον χάρτη του iRadios αντί για άλλες πλατφόρμες;</h2>
                            <p>Η πλατφόρμα μας αναπτύχθηκε από την αρχή με επίκεντρο τον Έλληνα ακροατή. Σε αντίθεση με διεθνείς πλατφόρμες αναζήτησης ραδιοφώνων που συχνά έχουν ξεπερασμένα δεδομένα, σπασμένα links ή απουσία μικρών ελληνικών σταθμών, το iRadios ενημερώνεται καθημερινά. Φροντίζουμε ώστε το streaming των σταθμών να λειτουργεί άψογα και η θέση τους στον χάρτη να είναι απόλυτα ακριβής.</p>
                            
                            <p>Επιπλέον, η οπτική εμπειρία που προσφέρει το iRadios είναι απαλλαγμένη από επιθετικές, in-app διαφημίσεις (pop-ups) που διακόπτουν την πλοήγηση. Θέλουμε ο χρήστης να αφοσιωθεί στην ανακάλυψη της μουσικής. Συνδυάζοντας τον χάρτη με τη λειτουργία του "AI Mood Matcher", η εφαρμογή μας δεν σας βοηθάει απλώς να βρείτε από πού εκπέμπει ένας σταθμός, αλλά σας προτείνει σταθμούς με βάση τη γεωγραφία ΚΑΙ τη διάθεσή σας!</p>
                            
                            ${list3Html}
                        </section>

                        <section>
                            <h2>Premium Εμπειρία και Τεχνολογική Εγγύηση</h2>
                            <p>Η άψογη λειτουργία του διαδραστικού χάρτη και της συνολικής πλατφόρμας φέρει την υπογραφή της <a href="https://iluma.gr" target="_blank" rel="noopener">ILUMA Digital Agency</a>. Η τεχνογνωσία μας στο User Experience (UX) και το μοντέρνο web development εξασφαλίζει ότι ο χάρτης φορτώνει αστραπιαία (blazing fast), καταναλώνει ελάχιστα δεδομένα (data) και μπαταρία, και προσφέρει κρυστάλλινο ήχο.</p>
                            
                            <p>Για όσους επιθυμούν την απόλυτη εμπειρία, η συνδρομή <strong>iRadios Premium</strong> αφαιρεί τα πάντα εκτός από τη μουσική. Απολαύστε τον χάρτη χωρίς καμία απολύτως οπτική ή ηχητική ενόχληση. Το Premium ξεκλειδώνει επίσης το <strong>Studio DSP</strong> (Digital Signal Processing), ενισχύοντας τον ήχο κάθε σταθμού που ανακαλύπτετε στον χάρτη, κάνοντάς τον να ακούγεται βαθύς, πλούσιος και τρισδιάστατος.</p>
                        </section>

                        <section>
                            <h3>Ξεκινήστε την Ηχητική σας Εξερεύνηση</h3>
                            <p>Μην περιορίζεστε στους ίδιους και στους ίδιους σταθμούς. Ανοίξτε τον χάρτη ραδιοφώνων του iRadios, σύρετε την οθόνη προς μια άγνωστη για εσάς περιοχή, και αφήστε τους τοπικούς παραγωγούς να σας εκπλήξουν. Ανακαλύψτε νέες μουσικές σκηνές, παραδοσιακούς ήχους και φωνές που δεν είχατε ακούσει ποτέ ξανά. Αποθηκεύστε τα νέα σας "ευρήματα" στα Αγαπημένα σας (Favorites) και δημιουργήστε τον δικό σας, προσωπικό, πανελλαδικό ραδιοφωνικό δέκτη.</p>
                        </section>
                    </article>
                </main>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Map SEO Error:", err);
        return next();
    }
};

// 6. SEO Injection για την ΑΡΧΙΚΗ ΣΕΛΙΔΑ (Home Page /)
exports.injectHomeSeo = async (req, res, next) => {
    try {
        if (!isBotRequest(req) && !req.query.bot) return next();

        const exactUrl = `__IRADIOS_SITE_ORIGIN__/`;
        
        // 🟢 Τραβάμε ΟΛΟΥΣ τους εγκεκριμένους σταθμούς
        const allStations = await Station.find({ status: 'approved' }).lean();
        
        // 🟢 Διαχωρίζουμε τους σταθμούς για να τους "πλέξουμε" οργανικά στο κείμενο
        let musicStationsHtml = '';
        let talkStationsHtml = '';
        let localStationsHtml = '';
        let allStationsKeywords = '';

        if (allStations.length > 0) {
            allStationsKeywords = allStations.map(st => st.name).join(', ');

            // Χωρίζουμε όλους τους σταθμούς σε 3 ίσα (περίπου) μέρη
            const chunkSize = Math.ceil(allStations.length / 3);
            const chunk1 = allStations.slice(0, chunkSize);
            const chunk2 = allStations.slice(chunkSize, chunkSize * 2);
            const chunk3 = allStations.slice(chunkSize * 2);

            musicStationsHtml = `<ul>` + chunk1.map(st => `<li>Ακούστε δυνατά <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong>: ${st.description ? st.description.substring(0, 60) + '...' : 'Μουσική χωρίς διακοπές.'}</li>`).join('') + `</ul>`;
            
            if(chunk2.length > 0) {
                talkStationsHtml = `<ul>` + chunk2.map(st => `<li>Συντονιστείτε στον <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong>: ${st.genre ? 'Κατηγορία ' + st.genre : 'Ενημέρωση και Ψυχαγωγία'}.</li>`).join('') + `</ul>`;
            }
            
            if(chunk3.length > 0) {
                localStationsHtml = `<ul>` + chunk3.map(st => `<li>Επιλέξτε τον <strong><a href="__IRADIOS_SITE_ORIGIN__/station/${st.slug || st._id}">${st.name}</a></strong>: Εκπέμπει ${st.city ? 'από ' + st.city : 'ζωντανά'} και σας κρατάει συντροφιά.</li>`).join('') + `</ul>`;
            }
        }

        const title = `Ραδιόφωνο στο iRadios | Όλα τα Ραδιόφωνα στο iRadios App`;
        const desc = `Ακούστε ζωντανά ραδιόφωνο στο iRadios. Όλοι οι ελληνικοί ραδιοφωνικοί σταθμοί, web radios, μουσική και podcasts είναι στο iRadios App. Η νέα, σύγχρονη εποχή στο online ραδιόφωνο με premium ήχο και AI Mood Matcher.`;
        
        // 🟢 Keywords: Εδώ κρατάμε τους ανταγωνιστές για τα "μάτια" της Google, και προσθέτουμε δυναμικά ΟΛΟΥΣ τους σταθμούς
        const keywords = `ραδιόφωνο, ραδιοφωνικοί σταθμοί, live radio, greek radio, web radio, ιντερνετικό ραδιόφωνο, e-radio, eradio, live24, radio garden, ραδιοφωνο live, online radio, ακούστε ζωντανά, μουσική, ειδήσεις, αθλητικά, AI Mood Matcher, ραδιόφωνο, ελληνικό ραδιόφωνο, ελληνικά ραδιόφωνα, e-radio, e radio, eradio, radio, greek radio, live radio, radio station, radio stations, live radio streaming, greek internet radio, web radio, athens radio, streaming, streaming media, αθλητικά, λαϊκά, επιτυχίες, ροκ, ειδήσεις, greek hits, mainstream, listen, online radio, Hellenic, radio portal, radio guide, radio directory, live greek music, greek music, greek music radio, greek news, modern greek music, iRadios, ${allStationsKeywords}`;
        
        const fullImageUrl = `__IRADIOS_SITE_ORIGIN__/presskit/iradios_fbcover-logo.png`;

        // 🟢 Schema.org για την Αρχική Σελίδα (WebSite & SearchAction)
        const schemaData = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "iRadios",
            "url": "__IRADIOS_SITE_ORIGIN__/",
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "__IRADIOS_SITE_ORIGIN__/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
            }
        };

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=240, s-maxage=240, stale-while-revalidate=120'); 
        
        return res.send(`
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <meta name="description" content="${desc}" />
                <meta name="keywords" content="${keywords}" />
                <meta name="author" content="iRadios" />
                <meta name="generator" content="ILUMA Digital Agency - iluma.gr" />
                <link rel="canonical" href="${exactUrl}" />
                
                <link rel="icon" type="image/png" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                <link rel="apple-touch-icon" href="__IRADIOS_SITE_ORIGIN__/favicon.png" />
                
                <meta name="robots" content="index, follow, noarchive" />
                
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${exactUrl}" />
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${desc}" />
                <meta property="og:image" content="${fullImageUrl}" />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:site_name" content="iRadios" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content="${exactUrl}" />
                <meta name="twitter:title" content="${title}" />
                <meta name="twitter:description" content="${desc}" />
                <meta name="twitter:image" content="${fullImageUrl}" />
                
                <script type="application/ld+json">
                ${JSON.stringify(schemaData, null, 2)}
                </script>
            </head>
            <body>
                <main>
                    <article>
                        <header>
                            <h1>${title}</h1>
                            <p>Η νέα εποχή στο <strong>ελληνικό ραδιόφωνο</strong> είναι εδώ. Το iRadios αποτελεί τον απόλυτο ψηφιακό προορισμό που συγκεντρώνει όλους τους αγαπημένους σας ραδιοφωνικούς σταθμούς από την Αθήνα, τη Θεσσαλονίκη, την Κύπρο και την ελληνική επαρχία, σε μία υπερσύγχρονη και αστραπιαία πλατφόρμα. Ακούστε ζωντανά web radio, ανακαλύψτε νέες μουσικές τάσεις, ενημερωθείτε από τα μεγαλύτερα ειδησεογραφικά δίκτυα και απολαύστε αθλητικές μεταδόσεις, όλα μέσα από ένα περιβάλλον σχεδιασμένο για τον σύγχρονο ακροατή.</p>
                        </header>
                        
                        <figure>
                            <img src="${fullImageUrl}" alt="iRadios - Η Νέα Ελληνική Εφαρμογή για Live Ραδιόφωνο, Web Radio" fetchpriority="high" style="width:100%; object-fit:cover;">
                        </figure>

                        <section>
                            <h2>Η Εξέλιξη του Διαδικτυακού Ραδιοφώνου (Web Radio)</h2>
                            <p>Το ραδιόφωνο υπήρξε ανέκαθεν η πιο άμεση και συντροφική μορφή ψυχαγωγίας και ενημέρωσης. Με το πέρασμα στην ψηφιακή εποχή, το <strong>ιντερνετικό ραδιόφωνο (online radio)</strong> κατέρριψε τους γεωγραφικούς περιορισμούς των FM συχνοτήτων. Πλέον, δεν έχει σημασία αν βρίσκεστε στην Ελλάδα, στην Κύπρο ή στο εξωτερικό. Μπορείτε να ακούσετε τον αγαπημένο σας τοπικό σταθμό με κρυστάλλινη ποιότητα ήχου οπουδήποτε κι αν είστε.</p>
                            <p>Στο iRadios πήραμε αυτή τη βασική αρχή του διαδικτυακού streaming και την ανεβάσαμε επίπεδο. Κατανοώντας τις ανάγκες των ακροατών για άμεση πρόσβαση στη μουσική χωρίς καθυστερήσεις (buffering) και ενοχλητικές παρεμβολές, δημιουργήσαμε μια πλατφόρμα που βάζει τον χρήστη στο επίκεντρο. Το live radio δεν ήταν ποτέ πιο προσιτό, πιο γρήγορο και πιο όμορφο οπτικά.</p>
                        </section>

                        <section>
                            <h2>Η Αναβάθμιση στην Εμπειρία Ακρόασης</h2>
                            <p>Όσοι αγαπούν το ραδιόφωνο στο ίντερνετ, αναζητούν την πιο γρήγορη και φιλική προς τον χρήστη εμπειρία. Αφήνοντας πίσω πλατφόρμες παλαιότερης γενιάς που βασίζονταν σε βαρύ κώδικα και δεκάδες διαφημιστικά banners, το iRadios έρχεται να προσφέρει μια απόλυτα καθαρή (clean UI) εμπειρία ακρόασης.</p>
                            <span>Ακούστε όλα τα ελληνικά ραδιόφωνα από Αθήνα, Θεσσαλονίκη, τα web radio και όλη την Ελλάδα, mainstream, sophisticated, house, ελληνικές επιτυχίες, έντεχνο, ειδήσεις, αθλητικά, λαϊκά, μπαλάντες</span>
                            <p>Η πλατφόρμα μας είναι βελτιστοποιημένη ώστε η αλλαγή σταθμών να γίνεται ακαριαία, θυμίζοντας την αίσθηση που έχει το αναλογικό ραδιόφωνο του αυτοκινήτου, αλλά με την ποιότητα του ψηφιακού streaming. Περιηγηθείτε ελεύθερα, βρείτε σταθμούς με ένα κλικ και απολαύστε ένα σύγχρονο, μινιμαλιστικό design.</p>
                        </section>

                        <section>
                            <h2>Τεχνολογικές Καινοτομίες στην Ακρόαση που θα βρεις μόνο στο iRadios App</h2>
                            <p>Τι κάνει το iRadios να ξεχωρίζει από οποιοδήποτε άλλο directory ραδιοφωνικών σταθμών; Έχουμε ενσωματώσει λειτουργίες που αλλάζουν ριζικά τον τρόπο που ακούτε μουσική.</p>
                            <ul>
                                <li><strong>AI Mood Matcher:</strong> Δεν ξέρετε τι να ακούσετε; Η τεχνητή νοημοσύνη του iRadios αναλύει τη διάθεσή σας! Πείτε μας πώς νιώθετε (π.χ. χαλαρά, ενεργητικά, μελαγχολικά) ή τι κάνετε (διάβασμα, γυμναστική, οδήγηση) και το <strong>AI Mood Matcher</strong> θα σας προτείνει αμέσως τους ιδανικούς ραδιοφωνικούς σταθμούς που ταιριάζουν απόλυτα στη στιγμή σας.</li>
                                <li><strong>Live AI Music Radar:</strong> Ο έξυπνος αλγόριθμός μας αναγνωρίζει σε πραγματικό χρόνο τα μεταδεδομένα (metadata) του σταθμού και σας δείχνει ακριβώς ποιο κομμάτι παίζει (Now Playing) τη δεδομένη στιγμή, με το όνομα του καλλιτέχνη και τον τίτλο του τραγουδιού.</li>
                                <li><strong>Διαδραστικός Χάρτης Ραδιοφώνων:</strong> Εξερευνήστε γεωγραφικά την Ελλάδα και την Κύπρο. Κάντε zoom στην Κρήτη, στη Θεσσαλονίκη, στα νησιά του Αιγαίου ή στην Πελοπόννησο και συντονιστείτε άμεσα στον παλμό της κάθε περιοχής, με μια εμπειρία παγκόσμιων προδιαγραφών.</li>
                                <li><strong>Απόλυτη Συμβατότητα (Cross-Platform):</strong> Είτε βρίσκεστε σε υπολογιστή, είτε σε tablet, είτε στο κινητό σας, το iRadios προσαρμόζεται άψογα. Μπορείτε να ελέγχετε την αναπαραγωγή μέσω των media keys της συσκευής σας, να στέλνετε τον ήχο στο Bluetooth ηχείο σας ή στο αυτοκίνητο.</li>
                            </ul>
                        </section>

                        <section>
                            <h2>Κορυφαίες Επιλογές: Μουσικό Ραδιόφωνο</h2>
                            <p>Η μουσική ενώνει. Ανάλογα με τη διάθεσή σας, το iRadios σας παρέχει απεριόριστες επιλογές. Ακούστε τις μεγαλύτερες επιτυχίες (Mainstream & Top 40), ταξιδέψτε με έντεχνη ελληνική μουσική, ανεβάστε τους ρυθμούς με λαϊκά, ή επιλέξτε διεθνή pop, rock, jazz, και ηλεκτρονική μουσική. Ανακαλύψτε παρακάτω μερικές από τις κορυφαίες επιλογές των χρηστών μας:</p>
                            ${musicStationsHtml}
                        </section>

                        <section>
                            <h2>Ενημερωτικό & Αθλητικό Ραδιόφωνο (Talk Radio)</h2>
                            <p>Μείνετε συντονισμένοι με την επικαιρότητα. Στο iRadios θα βρείτε όλα τα μεγάλα ενημερωτικά ραδιόφωνα για να ακούτε ζωντανά τις ειδήσεις της ημέρας, πολιτικές αναλύσεις και talk shows. Για τους λάτρεις των σπορ, οι κορυφαίοι αθλητικοί σταθμοί εκπέμπουν ζωντανά, προσφέροντας ραδιοφωνικές περιγραφές αγώνων (ποδόσφαιρο, μπάσκετ) ώστε να μην χάνετε λεπτό από τη δράση. Ενδεικτικά, μπορείτε να ακούσετε:</p>
                            ${talkStationsHtml}
                        </section>

                        <section>
                            <h2>Η Δύναμη του Τοπικού Ραδιοφώνου</h2>
                            <p>Μία από τις μεγαλύτερες χαρές του ιντερνετικού ραδιοφώνου είναι η δυνατότητα επαφής με την τοπική κοινωνία. Μέσω του iRadios, μπορείτε να ακούσετε τους αγαπημένους σας σταθμούς από την επαρχία, νιώθοντας ξανά κοντά στο σπίτι σας.</p>
                            <p>Το τοπικό ραδιόφωνο έχει τη δική του, μοναδική φωνή. Προωθεί ντόπιους καλλιτέχνες, μεταδίδει τοπικά νέα και διατηρεί ζωντανή την παράδοση. Στηρίζουμε έμπρακτα την περιφέρεια, δίνοντας ίση προβολή σε ανεξάρτητους web broadcasters και σε πανελλαδικά δίκτυα των FM. Μερικοί από τους σταθμούς της περιφέρειας που ξεχωρίζουν:</p>
                            ${localStationsHtml}
                        </section>

                        <section>
                            <h2>Premium Εμπειρία & Η Υπογραφή της ILUMA Digital Agency</h2>
                            <p>Το iRadios δεν είναι απλώς άλλη μία ιστοσελίδα. Είναι ένα προηγμένο τεχνολογικό οικοσύστημα. Πίσω από την κομψή σχεδίαση και την ταχύτατη απόδοση κρύβεται η <a href="https://iluma.gr" target="_blank" rel="noopener">ILUMA Digital Agency</a>, ένα από τα κορυφαία next-gen digital agencies. Η τεχνογνωσία της ILUMA στο UX (User Experience) εγγυάται μια εμπειρία ακρόασης παγκόσμιας κλάσης.</p>
                            <p>Επιπλέον, για τους πιο απαιτητικούς χρήστες, προσφέρουμε το <strong>iRadios Premium</strong>. Με την αναβάθμιση σε Premium, οι ακροατές απολαμβάνουν μια εντελώς απαλλαγμένη από in-app διαφημίσεις εμπειρία. Το Premium ξεκλειδώνει το προηγμένο <strong>Studio DSP (Digital Signal Processing)</strong>, το οποίο σταθεροποιεί τις εναλλαγές της έντασης (normalization) και προσφέρει έναν πλούσιο, τρισδιάστατο ήχο.</p>
                        </section>

                        <section>
                            <h3>Ξεκινήστε την Ακρόαση Σήμερα!</h3>
                            <p>Εξερευνήστε τον κατάλογό μας, φιλτράρετε τους σταθμούς ανά είδος ή περιοχή, χρησιμοποιήστε τον διαδραστικό χάρτη και αποθηκεύστε τους αγαπημένους σας σταθμούς για άμεση πρόσβαση. Είτε διαλέξετε μόνοι σας σταθμό, είτε αφήσετε το <strong>AI Mood Matcher</strong> να επιλέξει για εσάς, το iRadios είναι ο δικός σας, προσωπικός ραδιοφωνικός δέκτης στην ψηφιακή εποχή. Συντονιστείτε τώρα και νιώστε ξανά τη μαγεία του ραδιοφώνου, χωρίς όρια.</p>
                            <a href="https://iluma.gr" target="_blank">Handcrafted by ILUMA Digital Agency</a>
                        </section>
                    </article>
                </main>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Home SEO Error:", err);
        return next();
    }
};
