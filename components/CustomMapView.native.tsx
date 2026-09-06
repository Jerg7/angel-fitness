import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Colors } from '@/constants/theme';

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

interface CustomMapViewProps {
  currentLocation: Coord;
  coords: Coord[];
  distance: number;
  darkMapStyle: any[];
  isRunning: boolean;
  targetPoints?: TargetPoint[];
  onMapPress?: (coord: Coord) => void;
}

export default function CustomMapView({
  currentLocation,
  coords,
  distance,
  darkMapStyle,
  isRunning,
  targetPoints = [],
  onMapPress,
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
      followsUserLocation={isRunning}
      onPress={(e) => {
        if (onMapPress && e.nativeEvent && e.nativeEvent.coordinate) {
          onMapPress(e.nativeEvent.coordinate);
        }
      }}>
      {coords.length > 1 && (
        <Polyline
          coordinates={coords}
          strokeColor={Colors.primaryContainer}
          strokeWidth={5}
        />
      )}
      
      {/* Current location user marker */}
      <Marker
        coordinate={currentLocation}
        title="Tu Ubicación Actual"
        description={`${distance.toFixed(2)} km recorridos`}
      />

      {/* Target Points / Waypoint Markers */}
      {targetPoints.map((point) => (
        <Marker
          key={point.id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          title={`Punto Objetivo: ${point.name}`}
          description={`Meta GPS (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`}
          pinColor="#F59E0B"
        />
      ))}
    </MapView>
  );
}
