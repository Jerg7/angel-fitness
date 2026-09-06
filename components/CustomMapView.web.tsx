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
}: CustomMapViewProps) {
  const { latitude, longitude } = currentLocation;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005}%2C${latitude - 0.005}%2C${longitude + 0.005}%2C${latitude + 0.005}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <View style={styles.webMapContainer}>
      {/* @ts-ignore iframe is supported on web */}
      <iframe
        src={mapUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          borderRadius: Radii.xl,
          filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)',
        }}
        title="OpenStreetMap Web"
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
