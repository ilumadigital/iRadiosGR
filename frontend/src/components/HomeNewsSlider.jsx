import React, {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, ChevronLeft, ChevronRight, Newspaper} from 'lucide-react';
import {newsAge} from '../pages/NewsFeed';

// Full-width editorial carousel matching the HomeHeroSlider visual language.
// Links lead to the iRadios article preview, never directly to an external publisher.
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
      className="group relative isolate h-[315px] w-full min-w-0 overflow-hidden rounded-[25px] border border-white/10 bg-[#10161b] shadow-[0_22px_52px_rgba(0,0,0,.24)] sm:h-[365px] sm:rounded-[28px] lg:h-[405px] xl:h-[435px]">
      <div className="flex h-full w-full ease-in-out transition-transform duration-700 motion-reduce:transition-none"
        style={{transform: 'translate3d(-' + (activeIndex * 100) + '%, 0, 0)'}}>
        {articles.map((article, slideIndex) => {
          const time = newsAge(article.publishedAt, now);
          const visible = slideIndex === activeIndex;
          const showImage = Boolean(article.imageUrl && !brokenImages[article.key]);
          return (
            <div key={article.key} role="group" aria-roledescription="slide"
              aria-label={'Είδηση ' + (slideIndex + 1) + ' από ' + count}
              aria-hidden={!visible}
              className="relative h-full w-full min-w-full shrink-0">
              <Link to={'/newsfeed/' + article.key} state={{backTo: '/'}}
                tabIndex={visible ? 0 : -1}
                onClickCapture={handleLinkClick}
                aria-label={'Διάβασε την είδηση: ' + article.title}
                className="absolute inset-0 block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#ccff00]">
                {showImage ? (
                  <img src={article.imageUrl} alt="" loading={slideIndex <= 1 ? 'eager' : 'lazy'}
                    onError={() => setBrokenImages(previous => ({...previous, [article.key]: true}))}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
                ) : (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#24383b] via-[#18232d] to-[#0b1218]">
                    <Newspaper className="size-28 text-[#ccff00]/10 sm:size-36" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070a10]/95 via-[#090c14]/75 to-[#090d15]/15 sm:via-[#090c14]/65" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070d]/90 via-[#05070d]/25 to-transparent" />
                <div className="relative z-10 flex h-full w-full flex-col justify-end px-5 pb-16 pt-5 sm:px-9 sm:pb-16 sm:pt-8 lg:px-12">
                  <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                    <span className="inline-flex max-w-[70%] items-center truncate rounded-full border border-[#ccff00]/40 bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#ccff00] backdrop-blur">
                      {article.category || 'Επικαιρότητα'}
                    </span>
                    <span className="max-w-[40%] truncate rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur">
                      {article.source || 'iRadios News'}
                    </span>
                  </div>
                  <h3 className="line-clamp-3 max-w-[1000px] text-[clamp(1.3rem,3vw,2.8rem)] font-black leading-[1.12] tracking-tight text-white drop-shadow-xl sm:line-clamp-2">
                    {article.title}
                  </h3>
                  {article.summary && <p className="mt-3 hidden max-w-[800px] text-xs font-medium leading-relaxed text-zinc-200 sm:line-clamp-2 sm:text-sm lg:text-base">
                    {article.summary}
                  </p>}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-5">
                    <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#ccff00] px-4 text-xs font-black text-[#10140a] transition-colors group-hover:bg-[#e5ff91] sm:min-h-10 sm:px-5">
                      Διάβασε την είδηση <ArrowUpRight size={16} />
                    </span>
                    {time && <time dateTime={time.iso} title={time.absolute}
                      className="text-[11px] font-semibold text-white/80">{time.relative}</time>}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 sm:bottom-4 sm:left-6 sm:right-6">
          <div role="group" aria-label="Επιλογή είδησης"
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md sm:gap-2">
            {articles.map((article, slideIndex) => (
              <button key={article.key} type="button" onClick={() => setIndex(slideIndex)}
                aria-label={'Είδηση ' + (slideIndex + 1) + ' από ' + count}
                aria-current={slideIndex === activeIndex ? 'true' : undefined}
                className={'h-1.5 shrink-0 rounded-full transition-all duration-300 sm:h-2 ' +
                  (slideIndex === activeIndex ? 'w-5 bg-[#ccff00]' : 'w-1.5 bg-white/45 hover:bg-white sm:w-2')} />
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="mr-1 rounded-full border border-white/10 bg-black/50 px-2 py-1.5 text-[10px] font-black tabular-nums text-zinc-200 backdrop-blur-md">
              {activeIndex + 1} / {count}
            </span>
            <button type="button" onClick={() => move(-1)} aria-label="Προηγούμενη είδηση"
              className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur transition-colors hover:border-[#ccff00]/50 hover:text-[#ccff00] sm:size-10">
              <ChevronLeft size={19} />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Επόμενη είδηση"
              className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur transition-colors hover:border-[#ccff00]/50 hover:text-[#ccff00] sm:size-10">
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
