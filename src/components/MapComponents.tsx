import React, { useEffect, useRef, useMemo } from 'react';
import { useMap, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { LocationData } from '../types';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export function MapRecenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (zoom) {
      map.setView([lat, lng], zoom);
    } else {
      map.setView([lat, lng]);
    }
  }, [lat, lng, zoom, map]);
  return null;
}

export function LocationPicker({ location, setLocation }: { location: LocationData | null, setLocation: (loc: LocationData) => void }) {
  useMapEvents({
    click(e) {
      setLocation({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        accuracy: 0,
        timestamp: Date.now()
      });
    }
  });

  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const pos = marker.getLatLng();
          setLocation({
            latitude: pos.lat,
            longitude: pos.lng,
            accuracy: 0,
            timestamp: Date.now()
          });
        }
      },
    }),
    [setLocation]
  );

  return location ? (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[location.latitude, location.longitude]}
      ref={markerRef}
    >
      <Popup>
        Votre position exacte <br /> 
        {location.accuracy > 0 ? `Précision: ±${location.accuracy.toFixed(0)}m` : 'Position manuelle'}
        <br />
        <span className="text-xs text-gray-500">(Déplacez le marqueur si besoin)</span>
      </Popup>
    </Marker>
  ) : null;
}
