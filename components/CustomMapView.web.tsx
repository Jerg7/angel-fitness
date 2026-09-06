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
  mapCenter?: Coord;
  coords?: Coord[];
  distance?: number;
  darkMapStyle?: any[];
  isRunning?: boolean;
  targetPoints?: TargetPoint[];
  targetDestination?: TargetPoint | null;
  targetRouteCoords?: Coord[];
  onMapPress?: (coord: Coord) => void;
}

export default function CustomMapView({
  currentLocation,
  mapCenter,
  coords = [],
  targetPoints = [],
  targetDestination,
  targetRouteCoords = [],
}: CustomMapViewProps) {
  const center = mapCenter || currentLocation;
  const { latitude, longitude } = center;

  // Combine targetPoints and targetDestination for markers
  const allTargetPoints = [...targetPoints];
  if (targetDestination && !allTargetPoints.some((p) => p.id === targetDestination.id)) {
    allTargetPoints.push(targetDestination);
  }

  // Generate interactive Leaflet HTML with dark mode tiles, route line to target destination
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
        var map = L.map('map', { zoomControl: false }).setView([${latitude}, ${longitude}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        var markersGroup = [];

        // Current User Location Marker
        var userIcon = L.divIcon({
          className: 'user-pin',
          html: '<div style="background-color:#10B981;width:16px;height:16px;border-radius:50%;border:3px solid #0A0E17;box-shadow:0 0 12px #10B981;"></div>',
          iconSize: [16, 16]
        });
        var userMkr = L.marker([${currentLocation.latitude}, ${currentLocation.longitude}], { icon: userIcon }).addTo(map).bindPopup("<b>Tu Ubicación Actual</b>");
        markersGroup.push(userMkr);

        // Target Goal Waypoint Markers
        ${allTargetPoints
          .map(
            (p) => `
          var targetIcon = L.divIcon({
            className: 'target-pin',
            html: '<div style="background-color:#F59E0B;width:24px;height:24px;border-radius:50%;border:3px solid #0A0E17;box-shadow:0 0 14px #F59E0B;display:flex;align-items:center;justify-content:center;color:#0A0E17;font-weight:bold;font-size:12px;">★</div>',
            iconSize: [24, 24]
          });
          var tgtMkr = L.marker([${p.latitude}, ${p.longitude}], { icon: targetIcon }).addTo(map).bindPopup("<b>Objetivo: ${p.name.replace(/"/g, '\\"')}</b><br>Lat: ${p.latitude.toFixed(4)}, Lon: ${p.longitude.toFixed(4)}");
          markersGroup.push(tgtMkr);
        `
          )
          .join('\n')}

        // Active Tracked Route Polyline
        ${
          coords.length > 1
            ? `L.polyline(${JSON.stringify(
                coords.map((c) => [c.latitude, c.longitude])
              )}, {color: '#10B981', weight: 5, opacity: 0.85}).addTo(map);`
            : ''
        }

        // Target Real Street Navigation Route Line
        ${
          targetRouteCoords && targetRouteCoords.length > 1
            ? `
            L.polyline(${JSON.stringify(
              targetRouteCoords.map((c) => [c.latitude, c.longitude])
            )}, { color: '#F59E0B', weight: 6, opacity: 0.9 }).addTo(map);
            `
            : targetDestination
            ? `
            L.polyline([
              [${currentLocation.latitude}, ${currentLocation.longitude}],
              [${targetDestination.latitude}, ${targetDestination.longitude}]
            ], { color: '#F59E0B', weight: 4, dashArray: '8, 8', opacity: 0.9 }).addTo(map);
            `
            : ''
        }

        // Fit map bounds to frame both user location and target destination
        if (markersGroup.length > 1) {
          var group = new L.featureGroup(markersGroup);
          map.fitBounds(group.getBounds().pad(0.2));
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
