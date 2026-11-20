import React, {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, ChevronLeft, ChevronRight, Newspaper} from 'lucide-react';
import {newsAge} from '../pages/NewsFeed';
import './HomeNewsSlider.css';

// Homepage editorial slider: a contained (never cropped) news photo and its
// blurred ambient extension, with a separate readable Swift-style glass card.
// Article links remain internal; no publisher is opened directly.
export default function HomeNewsSlider({articles = [], category = 'all', now = Date.now()}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});
  const touchStart = useRef(null);
  const suppressClick = useRef(false);
  const count = articles.length;
  const activeIndex = count ? index % count : 0;

  useEffect(() => setIndex(0), [category]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % count);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  const move = direction => {
    if (count <= 1) return;
    setIndex(current => (current + count + direction) % count);
  };

  const handleTouchStart = event => {
    const touch = event.touches[0];
    touchStart.current = touch ? {x: touch.clientX, y: touch.clientY} : null;
    suppressClick.current = false;
  };
  const handleTouchEnd = event => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || count <= 1) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Preserve vertical scrolling and ordinary taps.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    suppressClick.current = true;
    move(dx < 0 ? 1 : -1);
  };
  const handleLinkClick = event => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  if (!count) return null;

  return (
    <section aria-label="Οι 10 τελευταίες ειδήσεις" aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);}}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {touchStart.current = null;}}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight') {event.preventDefault(); move(1);}
        if (event.key === 'ArrowLeft') {event.preventDefault(); move(-1);}
      }}
      tabIndex={0}
      className="ir-home-news-carousel group relative isolate w-full min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1119] shadow-[0_24px_76px_rgba(0,0,0,.34)]">
      <div className="ir-news-track ease-in-out transition-transform duration-700 motion-reduce:transition-none"
        style={{transform: 'translate3d(-' + (activeIndex * 100) + '%, 0, 0)'}}>
        {articles.map((article, slideIndex) => {
          const time = newsAge(article.publishedAt, now);
          const visible = slideIndex === activeIndex;
          const showImage = Boolean(article.imageUrl && !brokenImages[article.key]);
          return (
            <div key={article.key} role="group" aria-roledescription="slide"
              aria-label={'Είδηση ' + (slideIndex + 1) + ' από ' + count}
              aria-hidden={!visible}
              className="ir-news-slide relative h-full w-full min-w-full shrink-0">
              <Link to={'/newsfeed/' + article.key} state={{backTo: '/'}}
                tabIndex={visible ? 0 : -1}
                onClickCapture={handleLinkClick}
                aria-label={'Διάβασε την είδηση: ' + article.title}
                className="ir-news-slide-link relative block h-full w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#ccff00]">
                <div className="ir-news-ambient pointer-events-none absolute inset-0" aria-hidden="true">
                  {showImage && (visible || slideIndex === (activeIndex + 1) % count) &&
                    <img src={article.imageUrl} alt="" loading={visible ? 'eager' : 'lazy'} decoding="async"
                      className="ir-news-ambient-image" />}
                  <div className="ir-news-ambient-tint absolute inset-0" />
                </div>
                <div className="ir-news-slide-layout relative z-10">
                  <div className="ir-news-visual relative isolate min-w-0 overflow-hidden" aria-hidden="true">
                    {showImage ? (
                      <img src={article.imageUrl} alt="" loading={slideIndex <= 1 ? 'eager' : 'lazy'}
                        decoding="async" onError={() => setBrokenImages(previous => ({...previous, [article.key]: true}))}
                        className="ir-news-visual-image pointer-events-none" />
                    ) : (
                      <div className="ir-news-photo-fallback flex h-full w-full items-center justify-center">
                        <Newspaper className="size-20 text-[#ccff00]/25 sm:size-28" />
                      </div>
                    )}
                    <div className="ir-news-photo-shine pointer-events-none absolute inset-0" />
                    <span className="ir-news-photo-label pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#111923]/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/90 backdrop-blur-xl sm:left-5 sm:top-5">
                      <span className="size-1.5 rounded-full bg-[#ccff00]" /> iRadios News
                    </span>
                  </div>
                  <div className="ir-news-glass-panel relative flex min-h-0 min-w-0 flex-col">
                    <div className="ir-news-meta flex min-w-0 flex-wrap items-center gap-2">
                      <span className="ir-news-category inline-flex max-w-full items-center truncate rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ccff00]">
                        {article.category || 'Επικαιρότητα'}
                      </span>
                      {article.source && <span className="ir-news-source max-w-full truncate rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-semibold text-zinc-300">
                        {article.source}
                      </span>}
                    </div>
                    <h3 className="ir-news-headline font-black tracking-tight text-white">
                      {article.title}
                    </h3>
                    {article.summary && <p className="ir-news-summary font-medium text-zinc-300">
                      {article.summary}
                    </p>}
                    <div className="ir-news-bottom mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                      <span className="ir-news-cta inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[#ccff00] px-4 text-xs font-black text-[#111606] transition-all duration-200 group-hover:bg-[#e6ff95] sm:px-5">
                        Διάβασε την είδηση <ArrowUpRight size={17} />
                      </span>
                      {time && <time dateTime={time.iso} title={time.absolute}
                        className="text-[11px] font-semibold text-zinc-400">{time.relative}</time>}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <nav aria-label="Πλοήγηση ειδήσεων"
          className="ir-news-controls relative z-20 flex min-w-0 items-center justify-between gap-2 border-t border-white/[.07]">
          <div className="ir-news-pagination flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[11px] font-black tabular-nums tracking-wide text-white/75">
              {String(activeIndex + 1).padStart(2, '0')} <span className="text-white/30">/</span> {String(count).padStart(2, '0')}
            </span>
            <div role="group" aria-label="Επιλογή είδησης" className="ir-news-dots flex min-w-0 items-center gap-1.5">
              {articles.map((article, slideIndex) => (
                <button key={article.key} type="button" onClick={() => setIndex(slideIndex)}
                  aria-label={'Είδηση ' + (slideIndex + 1) + ' από ' + count}
                  aria-current={slideIndex === activeIndex ? 'true' : undefined}
                  className={'ir-news-dot h-1.5 shrink-0 rounded-full transition-all duration-300 ' +
                    (slideIndex === activeIndex ? 'w-5 bg-[#ccff00]' : 'w-1.5 bg-white/30 hover:bg-white/75')} />
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => move(-1)} aria-label="Προηγούμενη είδηση"
              className="ir-news-arrow flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[.055] text-white transition-colors hover:border-[#ccff00]/40 hover:text-[#ccff00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Επόμενη είδηση"
              className="ir-news-arrow flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[.055] text-white transition-colors hover:border-[#ccff00]/40 hover:text-[#ccff00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]">
              <ChevronRight size={20} />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
