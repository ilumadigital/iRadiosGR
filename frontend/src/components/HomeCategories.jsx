import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Disc3, Music2 } from 'lucide-react';
import { PRIMARY_CATEGORY_GROUPS, normalizePrimaryCategory } from '../utils/stationCategories';

const gradients = [
  'from-[#812e70] via-[#4a2145] to-[#11151d]',
  'from-[#966337] via-[#573c24] to-[#11151d]',
  'from-[#4643a5] via-[#252963] to-[#11151d]',
  'from-[#7b344f] via-[#472139] to-[#11151d]',
  'from-[#446f83] via-[#203f54] to-[#11151d]',
  'from-[#777431] via-[#434322] to-[#11151d]',
  'from-[#366d68] via-[#224744] to-[#11151d]',
  'from-[#784755] via-[#392531] to-[#11151d]'
];

export default function HomeCategories({ stations = [], currentUser, allLink = true }) {
  const shell = useRef(null);
  const [columns, setColumns] = useState(2);
  const [genreSlides, setGenreSlides] = useState([]);

  // Match the compact For You card grid against the real content width.
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    const update = () => {
      const width = element.getBoundingClientRect().width;
      const next = width >= 1320 ? 6 : width >= 1080 ? 5 : width >= 780 ? 4
        : width >= 600 ? 3 : 2;
      setColumns(previous => previous === next ? previous : next);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/home-slides?' + new URLSearchParams({ placement: 'genre', tiles: '1' }), {
      signal: controller.signal
    })
      .then(response => response.ok ? response.json() : [])
      .then(data => {
        if (!controller.signal.aborted) setGenreSlides(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map(PRIMARY_CATEGORY_GROUPS.flatMap(group => group.items.map(item => [item, 0])));
    stations.forEach(station => {
      if (!station?._id || (station.status && station.status !== 'approved')) return;
      for (const category of counts.keys()) {
        if (normalizePrimaryCategory(station.genre) === category) {
          counts.set(category, counts.get(category) + 1);
        }
      }
    });
    return counts;
  }, [stations]);

  const allowedSlides = useMemo(() => genreSlides.filter(slide =>
    !slide.audience || slide.audience === 'all' ||
    (slide.audience === 'guest' && !currentUser) ||
    (slide.audience === 'member' && Boolean(currentUser)) ||
    (slide.audience === 'premium' && Boolean(currentUser &&
      (currentUser.isPremium || currentUser.role === 'admin' ||
        currentUser?.broadcasterProfile?.tier === 'premium')))
  ), [genreSlides, currentUser]);

  return (
    <section id="home-categories" ref={shell} className="min-w-0 scroll-mt-24 space-y-5" aria-label="Κατηγορίες ραδιοφώνων">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
          <Disc3 size={23} className="text-[#ccff00]"/> Κατηγορίες
        </h2>
        {allLink && <Link to="/categories"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#ccff00] hover:text-white">
          Όλα τα είδη <ChevronRight size={16}/>
        </Link>}
      </div>

      {PRIMARY_CATEGORY_GROUPS.map((group, groupIndex) => (
        <div key={group.label} className="min-w-0">
          <h3 className="mb-2.5 text-[10px] font-black uppercase tracking-[.18em] text-zinc-400">
            {group.label}
          </h3>
          <div className="grid min-w-0 gap-3"
            style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}>
            {group.items.map((category, index) => {
              const slide = allowedSlides.find(item => item.placementValue === category);
              const count = categoryCounts.get(category) || 0;
              return (
                <Link key={category} to={'/genre/' + encodeURIComponent(category)}
                  aria-label={category + ' · ' + count + ' σταθμοί'}
                  className={`group relative isolate flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ccff00]/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ccff00] aspect-[1.85] min-h-[128px] ${gradients[(index + groupIndex * 5) % gradients.length]}`}>
                  {slide?.imageUrl && <>
                    <img src={slide.imageUrl} alt="" loading="lazy" aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"/>
                    <span aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10"/>
                  </>}
                  <span aria-hidden="true"
                    className="pointer-events-none absolute -bottom-6 -right-3 h-20 w-20 rounded-full border-[14px] border-white/10"/>
                  <Music2 size={20} className="relative z-10 text-white/90"/>
                  <span className="relative z-10 block min-w-0">
                    <span className="block line-clamp-2 text-xs font-black leading-snug text-white sm:text-[13px]">
                      {category}
                    </span>
                    <span className="mt-1 block text-[10px] text-zinc-300">
                      {count} {count === 1 ? 'σταθμός' : 'σταθμοί'}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
