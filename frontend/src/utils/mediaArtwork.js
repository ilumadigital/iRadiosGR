// Browser Media Session and the in-app car player share the same composed artwork.
// The JPEG endpoint keeps each station's original logo colours on a solid white
// background (including iOS lock screen / Control Center / compatible CarPlay).
export function stationMediaArtworkUrl(station) {
  const id = String(station?._id || '');
  if (/^[a-f0-9]{24}$/i.test(id)) {
    return `/api/media/station-logo/${id}.jpg?v=2`;
  }
  return station?.logo || '';
}
