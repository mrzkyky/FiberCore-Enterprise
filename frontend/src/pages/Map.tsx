// @ts-nocheck
import React from 'react';
import MapGL, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapIcon } from 'lucide-react';

export default function Map() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-text flex items-center gap-2">
            <MapIcon className="text-primary" />
            Basic Map
          </h2>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden border border-dark-border shadow-lg relative z-0">
        <MapGL 
          initialViewState={{ longitude: 106.816666, latitude: -6.200000, zoom: 12 }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        >
          <NavigationControl position="top-right" />
        </MapGL>
      </div>
    </div>
  );
}
