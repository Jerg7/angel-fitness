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
  mapCenter?: Coord;
  coords: Coord[];
  distance: number;
  darkMapStyle: any[];
  isRunning: boolean;
  targetPoints?: TargetPoint[];
  targetDestination?: TargetPoint | null;
  targetRouteCoords?: Coord[];
  onMapPress?: (coord: Coord) => void;
}

export default function CustomMapView({
  currentLocation,
  mapCenter,
  coords,
  distance,
  darkMapStyle,
  isRunning,
  targetPoints = [],
  targetDestination,
  targetRouteCoords = [],
  onMapPress,
}: CustomMapViewProps) {
  const center = mapCenter || currentLocation;

  // Combine targetPoints and targetDestination for markers
  const allTargetPoints = [...targetPoints];
  if (targetDestination && !allTargetPoints.some((p) => p.id === targetDestination.id)) {
    allTargetPoints.push(targetDestination);
  }

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }}
      region={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }}
      showsUserLocation={true}
      showsMyLocationButton={true}
      showsCompass={true}
      followsUserLocation={isRunning && !mapCenter}
      onPress={(e) => {
        if (onMapPress && e.nativeEvent && e.nativeEvent.coordinate) {
          onMapPress(e.nativeEvent.coordinate);
        }
      }}>
      {/* Active Run Tracked Polyline */}
      {coords.length > 1 && (
        <Polyline
          coordinates={coords}
          strokeColor={Colors.primaryContainer}
          strokeWidth={5}
        />
      )}

      {/* Target Real Street Route Polyline */}
      {targetRouteCoords && targetRouteCoords.length > 1 ? (
        <Polyline
          coordinates={targetRouteCoords}
          strokeColor="#F59E0B"
          strokeWidth={6}
        />
      ) : targetDestination ? (
        <Polyline
          coordinates={[
            { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
            { latitude: targetDestination.latitude, longitude: targetDestination.longitude },
          ]}
          strokeColor="#F59E0B"
          strokeWidth={4}
          lineDashPattern={[8, 8]}
        />
      ) : null}
      
      {/* Current location user marker */}
      <Marker
        coordinate={currentLocation}
        title="Tu Ubicación Actual"
        description={`${distance.toFixed(2)} km recorridos`}
      />

      {/* Target Points / Waypoint Markers */}
      {allTargetPoints.map((point) => (
        <Marker
          key={point.id}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          title={`Objetivo: ${point.name}`}
          description={`Meta GPS (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`}
          pinColor="#F59E0B"
        />
      ))}
    </MapView>
  );
}
