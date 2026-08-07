let loadingPromise: Promise<void> | null = null;

// Loads the Maps JavaScript API script once and caches the promise so
// repeated mounts of the map overlay (switching cities, re-entering the
// closest zoom tier) don't inject the script tag more than once.
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMaps called during SSR"));
  }
  if (window.google?.maps) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    // No `loading=async` param: that switches Google's bootstrap loader into
    // a mode where google.maps.* namespaces (MapTypeId, SymbolPath, ...) are
    // only populated after calling google.maps.importLibrary(), which this
    // file doesn't use — with the param present, the classic constructors
    // below get called while those namespaces are still undefined.
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}
