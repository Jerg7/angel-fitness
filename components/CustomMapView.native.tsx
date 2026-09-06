import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Colors } from '@/constants/theme';

export interface Coord {
  latitude: number;
  longitude: number;
}

interface CustomMapViewProps {
  currentLocation: Coord;
  coords: Coord[];
  distance: number;
  darkMapStyle: any[];
  isRunning: boolean;
}

export default function CustomMapView({
  currentLocation,
  coords,
  distance,
  darkMapStyle,
  isRunning,
}: CustomMapViewProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      initialRegion={{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      region={{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
      showsCompass={true}
      followsUserLocation={isRunning}>
      {coords.length > 1 && (
        <Polyline
          coordinates={coords}
          strokeColor={Colors.primaryContainer}
          strokeWidth={5}
        />
      )}
      <Marker
        coordinate={currentLocation}
        title="Tu Ubicación"
        description={`${distance.toFixed(2)} km recorridos`}
      />
    </MapView>
  );
}
