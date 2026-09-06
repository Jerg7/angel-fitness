import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Radii } from '@/constants/theme';

export interface Coord {
  latitude: number;
  longitude: number;
}

export interface TargetPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface CustomMapViewProps {
  currentLocation: Coord;
  coords?: Coord[];
  distance?: number;
  darkMapStyle?: any[];
  isRunning?: boolean;
  targetPoints?: TargetPoint[];
  onMapPress?: (coord: Coord) => void;
}

export default function CustomMapView({
  currentLocation,
  coords = [],
  targetPoints = [],
}: CustomMapViewProps) {
  const { latitude, longitude } = currentLocation;

  // Generate interactive Leaflet HTML with dark mode tiles and all Target Waypoint Markers
  const leafHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body { margin:0; padding:0; width:100%; height:100%; background: #0A0E17; }
        #map { width:100%; height:100%; background: #0A0E17; }
        .leaflet-tile { filter: invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${latitude}, ${longitude}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        // Current User Location Marker
        var userIcon = L.divIcon({
          className: 'user-pin',
          html: '<div style="background-color:#10B981;width:16px;height:16px;border-radius:50%;border:3px solid #0A0E17;box-shadow:0 0 10px #10B981;"></div>',
          iconSize: [16, 16]
        });
        L.marker([${latitude}, ${longitude}], { icon: userIcon }).addTo(map).bindPopup("<b>Tu Ubicación Actual</b>");

        // Target Goal Waypoint Markers
        ${targetPoints
          .map(
            (p) => `
          var targetIcon = L.divIcon({
            className: 'target-pin',
            html: '<div style="background-color:#F59E0B;width:20px;height:20px;border-radius:50%;border:3px solid #0A0E17;box-shadow:0 0 12px #F59E0B;display:flex;align-items:center;justify-content:center;color:#0A0E17;font-weight:bold;font-size:10px;">★</div>',
            iconSize: [20, 20]
          });
          L.marker([${p.latitude}, ${p.longitude}], { icon: targetIcon }).addTo(map).bindPopup("<b>Punto Objetivo: ${p.name.replace(/"/g, '\\"')}</b><br>Lat: ${p.latitude.toFixed(4)}, Lon: ${p.longitude.toFixed(4)}");
        `
          )
          .join('\n')}

        // Route Polyline
        ${
          coords.length > 1
            ? `L.polyline(${JSON.stringify(
                coords.map((c) => [c.latitude, c.longitude])
              )}, {color: '#10B981', weight: 5, opacity: 0.8}).addTo(map);`
            : ''
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.webMapContainer}>
      {/* @ts-ignore iframe is supported on web */}
      <iframe
        srcDoc={leafHtml}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          borderRadius: Radii.xl,
        }}
        title="OpenStreetMap Web Embed"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: {
    width: '100%',
    height: '100%',
  },
});
