import React from 'react';
import { Helmet } from 'react-helmet-async';
import RadioGeoMap from './RadioGeoMap';
import useCatalogNowPlaying from '../hooks/useCatalogNowPlaying';

// Η κεντρική προβολή /map και όλες οι περιοχές μοιράζονται την ίδια map engine.
export default function MapMode({ stations, currentStation, onPlayStation, isPlaying, onPlayPause, currentUser }) {
  const {byId:catalogNowPlaying,clock:catalogClock}=useCatalogNowPlaying(currentUser);
  return (
    <>
      <Helmet>
        <title>Χάρτης Ραδιοφώνων | iRadios</title>
        <meta name="keywords" content="χάρτης ραδιοφώνων, διαδραστικός χάρτης, radio garden, ραδιόφωνα ανά περιοχή, live map radio, iRadios map, ελληνικά ραδιόφωνα" />
        <meta name="description" content="Ανακάλυψε ραδιοφωνικούς σταθμούς στην Ελλάδα, την Κύπρο και τον κόσμο στον διαδραστικό σκοτεινό χάρτη του iRadios." />
        <meta property="og:title" content="Χάρτης Ραδιοφώνων | iRadios" />
      </Helmet>
      <RadioGeoMap
        stations={stations}
        nowPlayingById={catalogNowPlaying}
        catalogClock={catalogClock}
        currentUser={currentUser}
        currentStation={currentStation}
        onPlayStation={onPlayStation}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        initialZoom={6}
        showFilters
        className="h-[calc(100dvh-120px)] min-h-[470px] max-h-[900px]"
      />
    </>
  );
}
