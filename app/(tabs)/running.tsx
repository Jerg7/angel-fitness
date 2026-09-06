import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Vibration,
  Linking,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import CustomMapView, { TargetPoint } from '@/components/CustomMapView';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type RunningMode = 'libre' | 'objetivo' | 'caco';
type CacoPhase = 'caminar' | 'correr';

interface Coord {
  latitude: number;
  longitude: number;
}

// Estilo de Mapa Oscuro Kinetic (Dark Mode) para react-native-maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0E17' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#74839A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E17' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#10B981' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#10B981' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#131B2E' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0F172A' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#090D16' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
];

// Calculate Haversine distance between two coordinates in kilometers
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function RunningScreen() {
  const [runningMode, setRunningMode] = useState<RunningMode>('caco');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // GPS Telemetry & Current Location State
  const [currentLocation, setCurrentLocation] = useState<Coord | null>(null);
  const [mapCenter, setMapCenter] = useState<Coord | null>(null);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [distance, setDistance] = useState<number>(0.0);
  const [calories, setCalories] = useState<number>(0);
  const [gpsStatus, setGpsStatus] = useState<string>('Esperando GPS...');
  const [savingSession, setSavingSession] = useState<boolean>(false);
  const [loadingInitialLocation, setLoadingInitialLocation] = useState<boolean>(true);

  // Objetivo Mode Config State (Distancia Objetivo & Puntos GPS Waypoints)
  const [objectiveModalVisible, setObjectiveModalVisible] = useState<boolean>(false);
  const [targetDestination, setTargetDestination] = useState<TargetPoint | null>(null);
  const [targetPoints, setTargetPoints] = useState<TargetPoint[]>([]);
  const [targetRouteCoords, setTargetRouteCoords] = useState<Coord[]>([]);
  const [newPointNameInput, setNewPointNameInput] = useState<string>('');

  // Initial distance calculation ref for destination route
  const initialDistanceToTarget = useRef<number>(0);

  // Fetch real street routing path via OSRM foot routing engine
  const fetchRealStreetRoute = async (start: Coord, dest: Coord) => {
    try {
      setGpsStatus('Trazando ruta por calles...');
      const url = `https://router.project-osrm.org/route/v1/foot/${start.longitude},${start.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.routes && data.routes.length > 0) {
          const rawCoords = data.routes[0].geometry.coordinates;
          const parsedRoute: Coord[] = rawCoords.map((c: [number, number]) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          setTargetRouteCoords(parsedRoute);
          const routeDistanceKm = data.routes[0].distance / 1000;
          initialDistanceToTarget.current = routeDistanceKm;
          setGpsStatus(`Ruta por calles (${routeDistanceKm.toFixed(2)} km)`);
          return;
        }
      }
    } catch (err) {
      console.warn('Error obteniendo ruta por calles OSRM:', err);
    }
    setTargetRouteCoords([start, { latitude: dest.latitude, longitude: dest.longitude }]);
  };

  useEffect(() => {
    if (targetDestination && currentLocation) {
      const dist = getHaversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        targetDestination.latitude,
        targetDestination.longitude
      );
      if (initialDistanceToTarget.current === 0 || initialDistanceToTarget.current < dist) {
        initialDistanceToTarget.current = dist;
      }
    } else if (!targetDestination) {
      initialDistanceToTarget.current = 0;
    }
  }, [targetDestination]);

  const remainingDistanceToTarget = targetDestination && currentLocation
    ? getHaversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        targetDestination.latitude,
        targetDestination.longitude
      )
    : 0;

  const totalTargetDistance = initialDistanceToTarget.current || remainingDistanceToTarget || 1;
  const distanceCoveredToTarget = Math.max(0, totalTargetDistance - remainingDistanceToTarget);
  const targetPercent = targetDestination
    ? Math.min(100, Math.round((distanceCoveredToTarget / totalTargetDistance) * 100))
    : 0;

  // Autocomplete Place Suggestions State (Estilo Google Maps)
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ place_id: string; display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState<boolean>(false);

  // CACO (Caminar-Correr) Interval Engine Config
  const [cacoModalVisible, setCacoModalVisible] = useState<boolean>(false);
  const [totalIntervals, setTotalIntervals] = useState<number>(6);
  const [walkMinutes, setWalkMinutes] = useState<number>(2);
  const [runMinutes, setRunMinutes] = useState<number>(3);

  // Live CACO State
  const [currentInterval, setCurrentInterval] = useState<number>(1);
  const [cacoPhase, setCacoPhase] = useState<CacoPhase>('correr');
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(3 * 60);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Real-time Debounced Place Autocomplete Search Effect
  useEffect(() => {
    let active = true;
    const query = newPointNameInput.trim();

    if (query.length < 3) {
      setPlaceSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    setIsSearchingPlaces(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
          {
            headers: { 'User-Agent': 'AngelFitnessApp/1.0' },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data)) {
            setPlaceSuggestions(data);
          }
        }
      } catch (err) {
        console.warn('Error al buscar sugerencias de lugares:', err);
      } finally {
        if (active) setIsSearchingPlaces(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [newPointNameInput]);

  // Function to acquire initial GPS location
  const requestLocationAndInitialize = async () => {
    try {
      setLoadingInitialLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('Permiso GPS Denegado');
        Alert.alert(
          'Permiso de Ubicación Necesario',
          'Habilita el permiso de ubicación en los Ajustes de iOS para ver el mapa y rastrear tu recorrido.'
        );
        setLoadingInitialLocation(false);
        return;
      }

      setGpsStatus('Obteniendo posición GPS...');

      let loc: Location.LocationObject | null = null;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (e) {
        loc = await Location.getLastKnownPositionAsync({});
      }

      if (loc && loc.coords) {
        const initCoord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrentLocation(initCoord);
        setMapCenter((prev) => prev || initCoord);
        setCoords((prev) => (prev.length === 0 ? [initCoord] : prev));
        setGpsStatus('GPS 5G • Listo');
      } else {
        setGpsStatus('GPS Listo (Pulsa Iniciar para conectar)');
      }
    } catch (err) {
      console.warn('Error obteniendo ubicación inicial:', err);
      setGpsStatus('GPS Listo (Conectando satélites)');
    } finally {
      setLoadingInitialLocation(false);
    }
  };

  // Request GPS Permissions on Mount
  useEffect(() => {
    requestLocationAndInitialize();
  }, []);

  // GPS Watcher Effect
  useEffect(() => {
    let isSubscribed = true;

    const startGpsTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 2,
          },
          (loc) => {
            if (!isSubscribed) return;
            const { latitude, longitude } = loc.coords;
            const newCoord = { latitude, longitude };

            setCurrentLocation(newCoord);

            setCoords((prev) => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const addedDist = getHaversineDistance(last.latitude, last.longitude, latitude, longitude);
                if (addedDist > 0.001) { // 1 meter threshold to avoid noise
                  setDistance((d) => parseFloat((d + addedDist).toFixed(2)));
                  setCalories((c) => Math.round(c + addedDist * 65));
                  return [...prev, newCoord];
                }
                return prev;
              }
              return [newCoord];
            });
            setGpsStatus('GPS Activo • Rastreando');
          }
        );
      } catch (err) {
        console.warn('Error iniciando rastreo GPS:', err);
      }
    };

    if (isRunning) {
      startGpsTracking();
    } else if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    return () => {
      isSubscribed = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [isRunning]);

  // Main Live Stopwatch & CACO Interval Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setTotalSeconds((prev) => prev + 1);

        // CACO Countdown Logic
        if (runningMode === 'caco') {
          setPhaseSecondsLeft((prevPhaseSec) => {
            if (prevPhaseSec <= 1) {
              // Trigger vibration feedback on transition
              if (Platform.OS !== 'web') {
                Vibration.vibrate([0, 400, 200, 400]);
              }

              if (cacoPhase === 'caminar') {
                setCacoPhase('correr');
                return runMinutes * 60;
              } else {
                setCacoPhase('caminar');
                setCurrentInterval((i) => Math.min(totalIntervals, i + 1));
                return walkMinutes * 60;
              }
            }
            return prevPhaseSec - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, runningMode, cacoPhase, walkMinutes, runMinutes, totalIntervals]);

  // Handle selecting a place from Google Maps-style autocomplete dropdown
  const handleSelectPlaceSuggestion = (item: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Ubicación No Válida', 'No se pudieron extraer las coordenadas del lugar seleccionado.');
      return;
    }

    const shortName = item.display_name.split(',')[0] || 'Lugar Seleccionado';
    const pointCoord = { latitude: lat, longitude: lon };

    const newTarget: TargetPoint = {
      id: String(Date.now()),
      name: shortName,
      latitude: lat,
      longitude: lon,
    };

    setTargetDestination(newTarget);
    setTargetPoints([newTarget]);

    // Fetch real street routing from current user location to target
    if (currentLocation) {
      fetchRealStreetRoute(currentLocation, pointCoord);
      const midLat = (currentLocation.latitude + lat) / 2;
      const midLon = (currentLocation.longitude + lon) / 2;
      setMapCenter({ latitude: midLat, longitude: midLon });
    } else {
      setMapCenter(pointCoord);
    }

    setNewPointNameInput('');
    setPlaceSuggestions([]);
    setGpsStatus(`Ruta hacia: ${shortName}`);
    setObjectiveModalVisible(false);

    if (Platform.OS !== 'web') {
      Vibration.vibrate(150);
    }

    const distFromStart = currentLocation
      ? getHaversineDistance(currentLocation.latitude, currentLocation.longitude, lat, lon).toFixed(2)
      : '0.00';

    Alert.alert(
      '¡Ruta GPS Trazada!',
      `Se ha trazado la ruta desde tu ubicación actual hasta "${shortName}" (${distFromStart} km).`
    );
  };

  // Add target from search input text or current device location
  const handleAddTargetFromInputOrGps = async () => {
    const query = newPointNameInput.trim();

    // 1. If text is entered in search box, search for matching location
    if (query.length > 0) {
      if (placeSuggestions.length > 0) {
        handleSelectPlaceSuggestion(placeSuggestions[0]);
        return;
      }

      try {
        setGpsStatus('Buscando coordenadas...');
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          { headers: { 'User-Agent': 'AngelFitnessApp/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            handleSelectPlaceSuggestion(data[0]);
            return;
          }
        }
        Alert.alert('Lugar No Encontrado', `No se encontraron coordenadas para "${query}". Intenta seleccionar una opción del desplegable.`);
      } catch (err) {
        console.warn('Error al buscar lugar:', err);
        Alert.alert('Error de Búsqueda', 'Comprueba tu conexión a internet para buscar este lugar.');
      }
      return;
    }

    // 2. If search text is empty, mark current device GPS location
    if (!currentLocation) {
      Alert.alert('GPS No Fijado', 'Espera a que el GPS obtenga tu posición o escribe el nombre de un lugar en el buscador.');
      return;
    }

    const name = `Punto GPS Actual`;
    const newTarget: TargetPoint = {
      id: String(Date.now()),
      name,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    setTargetDestination(newTarget);
    setTargetPoints([newTarget]);
    setMapCenter(currentLocation);
    setGpsStatus('Destino: Ubicación Actual');
    setObjectiveModalVisible(false);

    if (Platform.OS !== 'web') {
      Vibration.vibrate(150);
    }

    Alert.alert(
      '¡Destino Fijado!',
      `Se ha fijado tu ubicación GPS actual como destino.`
    );
  };

  const handleRemoveTargetPoint = (id: string) => {
    setTargetPoints((prev) => prev.filter((p) => p.id !== id));
  };

  // Calculate live pace (min/km)
  const calculatePace = () => {
    if (distance <= 0 || totalSeconds <= 0) return '0:00';
    const paceInSecondsPerKm = Math.round(totalSeconds / distance);
    const paceMins = Math.floor(paceInSecondsPerKm / 60);
    const paceSecs = paceInSecondsPerKm % 60;
    return `${paceMins}:${String(paceSecs).padStart(2, '0')}`;
  };

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatPhaseTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleRunning = () => {
    if (isLocked) return;
    setIsRunning((prev) => !prev);
  };

  const handleResetRunning = () => {
    if (isLocked) return;
    Alert.alert(
      'Reiniciar Cronómetro',
      '¿Deseas reiniciar la distancia GPS, tiempo e intervalos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: () => {
            setIsRunning(false);
            setTotalSeconds(0);
            setDistance(0.0);
            setCalories(0);
            setCoords(currentLocation ? [currentLocation] : []);
            setCurrentInterval(1);
            setCacoPhase('correr');
            setPhaseSecondsLeft(runMinutes * 60);
          },
        },
      ]
    );
  };

  const handleOpenMusic = async () => {
    try {
      const spotifySupported = await Linking.canOpenURL('spotify://');
      if (spotifySupported) {
        await Linking.openURL('spotify://');
      } else {
        const appleMusicSupported = await Linking.canOpenURL('music://');
        if (appleMusicSupported) {
          await Linking.openURL('music://');
        } else {
          await Linking.openURL('https://open.spotify.com');
        }
      }
    } catch {
      await Linking.openURL('https://open.spotify.com');
    }
  };

  const handleFinishRun = async () => {
    if (totalSeconds === 0 && distance === 0) {
      Alert.alert('Sesión Vacía', 'Inicia el cronómetro para registrar una carrera.');
      return;
    }

    setIsRunning(false);
    setSavingSession(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: dbErr } = await supabase.from('running_sessions').insert({
          user_id: user.id,
          distance_km: distance,
          duration_seconds: totalSeconds,
          calories: calories,
          mode: runningMode,
          created_at: new Date().toISOString(),
        });

        if (dbErr) {
          console.error('Error insertando en running_sessions:', dbErr);
          Alert.alert('Error al Guardar', `No se pudo guardar la carrera en Supabase: ${dbErr.message}`);
        } else {
          Alert.alert('¡Carrera Guardada!', `Se registraron ${distance.toFixed(2)} km en Supabase.`);
          // Reset after saving
          setTotalSeconds(0);
          setDistance(0.0);
          setCalories(0);
          setCoords(currentLocation ? [currentLocation] : []);
          setCurrentInterval(1);
        }
      }
    } catch (err: any) {
      console.error('Excepción guardando carrera:', err);
      Alert.alert('Error de Red', err.message || 'No se pudo comunicar con Supabase.');
    } finally {
      setSavingSession(false);
    }
  };

  // Render Map View component for Web or Native
  const renderMapView = () => {
    if (loadingInitialLocation) {
      return (
        <View style={styles.mapLoadingBox}>
          <ActivityIndicator size="large" color={Colors.primaryContainer} />
          <Text style={styles.mapLoadingText}>Buscando satélites y fijando mapa GPS...</Text>
        </View>
      );
    }

    if (!currentLocation) {
      return (
        <View style={styles.mapLoadingBox}>
          <MaterialIcons name="location-off" size={40} color={Colors.outline} />
          <Text style={styles.mapLoadingText}>Ubicación GPS no fijada</Text>
          <Pressable style={styles.recenterBtn} onPress={requestLocationAndInitialize}>
            <Text style={styles.recenterBtnText}>Obtener Mi Ubicación</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <CustomMapView
        currentLocation={currentLocation}
        mapCenter={mapCenter || currentLocation}
        coords={coords}
        distance={distance}
        darkMapStyle={darkMapStyle}
        isRunning={isRunning}
        targetPoints={targetPoints}
        targetDestination={targetDestination}
        targetRouteCoords={targetRouteCoords}
        onMapPress={(coord) => {
          if (runningMode === 'objetivo') {
            const pointCoord = { latitude: coord.latitude, longitude: coord.longitude };
            const newTarget: TargetPoint = {
              id: String(Date.now()),
              name: `Punto Tocado en el Mapa`,
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
            setTargetDestination(newTarget);
            setTargetPoints([newTarget]);
            if (currentLocation) {
              fetchRealStreetRoute(currentLocation, pointCoord);
              const midLat = (currentLocation.latitude + coord.latitude) / 2;
              const midLon = (currentLocation.longitude + coord.longitude) / 2;
              setMapCenter({ latitude: midLat, longitude: midLon });
            } else {
              setMapCenter(pointCoord);
            }

            const distFromStart = currentLocation
              ? getHaversineDistance(currentLocation.latitude, currentLocation.longitude, coord.latitude, coord.longitude).toFixed(2)
              : '0.00';

            Alert.alert(
              '¡Ruta por Calles Trazada!',
              `Se trazó la ruta real por calles desde tu posición actual hasta el punto tocado (${distFromStart} km).`
            );
          }
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Brand & Status */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <View style={styles.brandBadge}>
              <MaterialCommunityIcons name="run" size={20} color={Colors.primaryContainer} />
            </View>
            <View>
              <Text style={styles.brandTitle}>ANGEL RUNNING</Text>
              <Text style={styles.brandSub}>MAPA INTERACTIVO & GPS EN VIVO</Text>
            </View>
          </View>
          <View style={styles.gpsSignalBox}>
            <View style={[styles.pulseDot, !isRunning && { backgroundColor: Colors.onSurfaceVariant }]} />
            <Text style={styles.gpsSignalText}>{gpsStatus}</Text>
          </View>
        </View>

        {/* Mode Selector Chips */}
        <View style={styles.modeSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroll}>
            <Pressable
              style={[styles.modeChip, runningMode === 'libre' && styles.modeChipSelected]}
              onPress={() => setRunningMode('libre')}>
              <Text style={[styles.modeChipText, runningMode === 'libre' && styles.modeChipTextSelected]}>
                LIBRE
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeChip, runningMode === 'objetivo' && styles.modeChipSelected]}
              onPress={() => {
                setRunningMode('objetivo');
                setObjectiveModalVisible(true);
              }}>
              {runningMode === 'objetivo' && <View style={styles.chipActiveDot} />}
              <Text style={[styles.modeChipText, runningMode === 'objetivo' && styles.modeChipTextSelected]}>
                RUTA A DESTINO
              </Text>
              <MaterialIcons name="navigation" size={14} color={runningMode === 'objetivo' ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
            </Pressable>
            <Pressable
              style={[styles.modeChip, runningMode === 'caco' && styles.modeChipSelected]}
              onPress={() => {
                setRunningMode('caco');
                setCacoModalVisible(true);
              }}>
              {runningMode === 'caco' && <View style={styles.chipActiveDot} />}
              <Text style={[styles.modeChipText, runningMode === 'caco' && styles.modeChipTextSelected]}>
                INTERVALOS / CACO
              </Text>
              <MaterialIcons name="settings" size={14} color={runningMode === 'caco' ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
            </Pressable>
          </ScrollView>
        </View>

        {/* OBJETIVO Mode Goal Progress Banner */}
        {runningMode === 'objetivo' && (
          <View style={styles.cacoBanner}>
            <View style={styles.cacoLeft}>
              <View style={[styles.cacoPhaseCircle, { backgroundColor: Colors.secondary }]}>
                <MaterialIcons name="navigation" size={20} color={Colors.onPrimaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.cacoPhaseTag}>
                    {targetDestination ? `DESTINO: ${targetDestination.name.toUpperCase()}` : 'SELECCIONA UN DESTINO'}
                  </Text>
                  {targetDestination && (
                    <Text style={[styles.cacoPhaseTag, { color: Colors.secondary }]}>
                      Faltan {remainingDistanceToTarget.toFixed(2)} km
                    </Text>
                  )}
                </View>

                {targetDestination ? (
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${targetPercent}%` }]} />
                  </View>
                ) : (
                  <Text style={{ color: Colors.outline, fontSize: 11, marginTop: 2 }}>
                    Busca un lugar en el buscador para trazar la ruta
                  </Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
              <Pressable style={styles.configBtn} onPress={() => setObjectiveModalVisible(true)}>
                <MaterialIcons name="search" size={16} color={Colors.primaryContainer} />
                <Text style={styles.configBtnText}>Buscar Lugar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* CACO Phase Banner Indicator */}
        {runningMode === 'caco' && (
          <View style={styles.cacoBanner}>
            <View style={styles.cacoLeft}>
              <View style={[styles.cacoPhaseCircle, cacoPhase === 'correr' ? { backgroundColor: Colors.primaryContainer } : { backgroundColor: Colors.tertiary }]}>
                <MaterialCommunityIcons
                  name={cacoPhase === 'correr' ? 'run-fast' : 'walk'}
                  size={20}
                  color={Colors.onPrimaryContainer}
                />
              </View>
              <View>
                <Text style={styles.cacoPhaseTag}>
                  INTERVALO {currentInterval} DE {totalIntervals} • FASE DE {cacoPhase.toUpperCase()}
                </Text>
                <Text style={styles.cacoPhaseCountdown}>{formatPhaseTime(phaseSecondsLeft)}</Text>
              </View>
            </View>
            <Pressable style={styles.configBtn} onPress={() => setCacoModalVisible(true)}>
              <Text style={styles.configBtnText}>Ajustar</Text>
            </Pressable>
          </View>
        )}

        {/* Real Interactive GPS Map Container */}
        <View style={styles.mapCard}>
          {renderMapView()}

          {/* Map Top Header Overlay */}
          <View style={styles.mapTopOverlay}>
            <View style={styles.elevationBadge}>
              <MaterialCommunityIcons name="satellite-variant" size={14} color={Colors.primaryContainer} />
              <Text style={styles.elevationText}>{coords.length} Puntos GPS</Text>
            </View>
            <Pressable style={styles.northCompass} onPress={requestLocationAndInitialize}>
              <MaterialIcons name="my-location" size={16} color={Colors.primaryContainer} />
            </Pressable>
          </View>

          {/* Bottom Distance Overlay */}
          <View style={styles.mapBottomPin}>
            <MaterialIcons name="flag" size={16} color={Colors.primaryContainer} />
            <Text style={styles.mapDistanceVal}>{distance.toFixed(2)}</Text>
            <Text style={styles.mapDistanceUnit}>km</Text>
          </View>
        </View>

        {/* Primary Dynamic Live Telemetry HUD */}
        <View style={styles.telemetryHUD}>
          {/* Active Elapsed Timer Box */}
          <View style={styles.timerCard}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.pulseDot, !isRunning && { backgroundColor: Colors.onSurfaceVariant }]} />
                <Text style={styles.hudLabel}>{isRunning ? 'TIEMPO TOTAL EN MARCHA' : 'TIEMPO PAUSADO'}</Text>
              </View>
              <Text style={styles.displayTimer}>{formatTime(totalSeconds)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.intervalSub}>
                {runningMode === 'caco'
                  ? `Intervalo ${currentInterval}/${totalIntervals}`
                  : runningMode === 'objetivo'
                  ? targetDestination
                    ? `Faltan ${remainingDistanceToTarget.toFixed(2)} km`
                    : 'Sin Destino'
                  : 'Modo Libre'}
              </Text>
              <Text style={styles.intervalTitle}>
                {runningMode === 'caco' ? (cacoPhase === 'correr' ? 'Trote' : 'Caminata') : 'Carrera'}
              </Text>
            </View>
          </View>

          {/* 2-Column Real GPS Telemetry Grid */}
          <View style={styles.hudGrid}>
            {/* Real Distance */}
            <View style={styles.hudBox}>
              <View style={styles.hudBoxHeader}>
                <Text style={styles.hudBoxLabel}>DISTANCIA GPS REAL</Text>
                <MaterialCommunityIcons name="ruler" size={14} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.hudBoxBigVal}>{distance.toFixed(2)}</Text>
              <Text style={styles.hudBoxUnit}>km acumulados</Text>
            </View>

            {/* Real Pace */}
            <View style={styles.hudBox}>
              <View style={styles.hudBoxHeader}>
                <Text style={styles.hudBoxLabel}>RITMO MEDIO REAL</Text>
                <MaterialIcons name="speed" size={14} color={Colors.primaryContainer} />
              </View>
              <Text style={styles.hudBoxBigVal}>{calculatePace()}</Text>
              <Text style={styles.hudBoxUnit}>min/km</Text>
            </View>
          </View>

          {/* Secondary Micro-metrics */}
          <View style={styles.microMetricsRow}>
            {/* Calories */}
            <View style={styles.microBox}>
              <View style={styles.microIconWrap}>
                <MaterialCommunityIcons name="fire" size={18} color={Colors.primaryContainer} />
              </View>
              <View>
                <Text style={styles.microLabel}>Calorías Estimadas</Text>
                <Text style={styles.microVal}>
                  {calories} <Text style={styles.microUnit}>kcal</Text>
                </Text>
              </View>
            </View>

            {/* GPS Telemetry Badge */}
            <View style={styles.microBox}>
              <View style={styles.microIconWrap}>
                <MaterialCommunityIcons name="map-marker-distance" size={18} color={Colors.secondary} />
              </View>
              <View>
                <Text style={styles.microLabel}>Puntos Objetivo GPS</Text>
                <Text style={styles.microVal}>
                  {targetPoints.length} marcados
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Music App Deep Link Bar */}
        <Pressable style={styles.audioBar} onPress={handleOpenMusic}>
          <View style={styles.audioLeft}>
            <View style={styles.audioIconBox}>
              <MaterialCommunityIcons name="music-clef-treble" size={20} color={Colors.primaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.audioTrackName}>Abrir Reproductor de Música</Text>
              <Text style={styles.audioArtist}>Spotify / Apple Music</Text>
            </View>
          </View>
          <MaterialIcons name="open-in-new" size={20} color={Colors.primaryContainer} />
        </Pressable>

        {/* Tactical Floating Action Bar */}
        <View style={styles.actionBar}>
          {/* Flank Left: Reset */}
          <Pressable
            style={[styles.actionBtnSide, isLocked && styles.actionBtnDisabled]}
            onPress={handleResetRunning}>
            <MaterialIcons name="refresh" size={22} color={Colors.primaryContainer} />
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.actionBtnLabel}>REINICIAR</Text>
              <Text style={styles.actionBtnVal}>Reset</Text>
            </View>
          </Pressable>

          {/* Master Pause / Play Button */}
          <Pressable
            style={[
              styles.actionBtnMaster,
              !isRunning && styles.actionBtnMasterPaused,
              isLocked && styles.actionBtnDisabled,
            ]}
            onPress={handleToggleRunning}>
            <MaterialIcons
              name={isRunning ? 'pause' : 'play-arrow'}
              size={32}
              color={Colors.onPrimaryContainer}
            />
            <Text style={styles.masterBtnText}>{isRunning ? 'PAUSA' : 'INICIAR'}</Text>
          </Pressable>

          {/* Flank Right: Lock Touch Shield */}
          <Pressable style={styles.actionBtnSide} onPress={() => setIsLocked((prev) => !prev)}>
            <MaterialIcons
              name={isLocked ? 'lock' : 'lock-open'}
              size={22}
              color={isLocked ? Colors.primaryContainer : Colors.onSurfaceVariant}
            />
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={styles.actionBtnLabel}>CONTROL</Text>
              <Text style={[styles.actionBtnVal, isLocked && { color: Colors.primaryContainer }]}>
                {isLocked ? 'Bloqueado' : 'Bloqueo'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Finish Run Primary CTA */}
        <View style={styles.finishRunSection}>
          <Pressable
            style={[styles.finishRunBtn, savingSession && { opacity: 0.7 }]}
            onPress={handleFinishRun}
            disabled={savingSession}>
            {savingSession ? (
              <ActivityIndicator color={Colors.onPrimaryContainer} />
            ) : (
              <>
                <MaterialIcons name="flag" size={20} color={Colors.onPrimaryContainer} />
                <Text style={styles.finishRunBtnText}>Finalizar y Guardar Carrera</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* OBJETIVO Configuration Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={objectiveModalVisible}
          onRequestClose={() => setObjectiveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurar Objetivo de Carrera</Text>
                <Pressable onPress={() => setObjectiveModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <Text style={styles.modalDesc}>
                Busca un lugar específico en tiempo real (estilo Google Maps) para colocar la ubicación exacta en el mapa.
              </Text>

              {/* Real-time Place Autocomplete Search Bar */}
              <View style={[styles.inputGroup, { zIndex: 100 }]}>
                <Text style={styles.inputLabel}>BUSCAR LUGAR O DIRECCIÓN EN EL MAPA</Text>
                <View style={styles.searchPlaceInputWrapper}>
                  <MaterialIcons name="search" size={20} color={Colors.primaryContainer} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.searchPlaceInput}
                    placeholder="Escribe un lugar (ej. Parque Central, Estadio)..."
                    placeholderTextColor={Colors.outline}
                    value={newPointNameInput}
                    onChangeText={setNewPointNameInput}
                  />
                  {isSearchingPlaces ? (
                    <ActivityIndicator size="small" color={Colors.primaryContainer} style={{ marginRight: 10 }} />
                  ) : newPointNameInput.length > 0 ? (
                    <Pressable onPress={() => { setNewPointNameInput(''); setPlaceSuggestions([]); }}>
                      <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} style={{ marginRight: 10 }} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Autocomplete Dropdown List */}
                {placeSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {placeSuggestions.map((item) => (
                      <Pressable
                        key={item.place_id}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectPlaceSuggestion(item)}>
                        <MaterialIcons name="place" size={20} color={Colors.primaryContainer} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionTitle} numberOfLines={1}>
                            {item.display_name.split(',')[0]}
                          </Text>
                          <Text style={styles.suggestionSub} numberOfLines={1}>
                            {item.display_name}
                          </Text>
                        </View>
                        <MaterialIcons name="arrow-forward" size={14} color={Colors.onSurfaceVariant} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Add Location or Target Button */}
              <View style={styles.inputGroup}>
                <Pressable
                  style={styles.addPointBtnFull}
                  onPress={handleAddTargetFromInputOrGps}>
                  <MaterialIcons
                    name={newPointNameInput.trim().length > 0 ? 'navigation' : 'my-location'}
                    size={18}
                    color="#0A0E17"
                  />
                  <Text style={styles.addPointBtnText}>
                    {newPointNameInput.trim().length > 0
                      ? `+ Trazar Ruta a "${newPointNameInput.trim()}"`
                      : '+ Fijar Mi Ubicación GPS Actual'}
                  </Text>
                </Pressable>
              </View>

              {/* Target Points List */}
              {targetPoints.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PUNTOS REGISTRADOS ({targetPoints.length})</Text>
                  {targetPoints.map((pt) => (
                    <View key={pt.id} style={styles.pointItemRow}>
                      <MaterialIcons name="place" size={18} color={Colors.secondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pointItemName}>{pt.name}</Text>
                        <Text style={styles.pointItemCoords}>
                          {pt.latitude.toFixed(4)}, {pt.longitude.toFixed(4)}
                        </Text>
                      </View>
                      <Pressable
                        style={{ marginRight: 12 }}
                        onPress={() => {
                          setMapCenter({ latitude: pt.latitude, longitude: pt.longitude });
                          setObjectiveModalVisible(false);
                        }}>
                        <MaterialIcons name="center-focus-strong" size={20} color={Colors.primaryContainer} />
                      </Pressable>
                      <Pressable onPress={() => handleRemoveTargetPoint(pt.id)}>
                        <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                style={styles.saveCacoBtn}
                onPress={() => setObjectiveModalVisible(false)}>
                <Text style={styles.saveCacoBtnText}>Aplicar Objetivo</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* CACO Configuration Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={cacoModalVisible}
          onRequestClose={() => setCacoModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurar CACO (Caminar-Correr)</Text>
                <Pressable onPress={() => setCacoModalVisible(false)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurface} />
                </Pressable>
              </View>

              <Text style={styles.modalDesc}>
                Personaliza la estructura de intervalos para alternar caminata y trote con alertas de vibración.
              </Text>

              {/* Total Intervals Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NÚMERO DE INTERVALOS TOTALES</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(totalIntervals)}
                  onChangeText={(val) => setTotalIntervals(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              {/* Walk Minutes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DURACIÓN DE CAMINATA (MINUTOS)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(walkMinutes)}
                  onChangeText={(val) => setWalkMinutes(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              {/* Run Minutes */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DURACIÓN DE TROTE / CARRERA (MINUTOS)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={String(runMinutes)}
                  onChangeText={(val) => setRunMinutes(Math.max(1, parseInt(val, 10) || 1))}
                />
              </View>

              <Pressable
                style={styles.saveCacoBtn}
                onPress={() => {
                  setPhaseSecondsLeft(runMinutes * 60);
                  setCacoPhase('correr');
                  setCurrentInterval(1);
                  setCacoModalVisible(false);
                }}>
                <Text style={styles.saveCacoBtnText}>Aplicar Configuración CACO</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  brandTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandSub: {
    color: Colors.primaryContainer,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gpsSignalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryContainer,
  },
  gpsSignalText: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  modeSection: {
    marginBottom: Spacing.md,
  },
  modeScroll: {
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChipSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  chipActiveDot: {
    width: 6,
    height: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.onPrimaryContainer,
  },
  modeChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },
  modeChipTextSelected: {
    color: Colors.onPrimaryContainer,
    fontWeight: '800',
  },
  cacoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  cacoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cacoPhaseCircle: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacoPhaseTag: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
  },
  cacoPhaseCountdown: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  goalTrack: {
    height: 6,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.full,
    marginTop: 6,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: Radii.full,
  },
  configBtn: {
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  configBtnText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  mapCard: {
    height: 240,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  mapLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 8,
  },
  mapLoadingText: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  recenterBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.full,
    marginTop: 4,
  },
  recenterBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 11,
    fontWeight: '800',
  },
  mapTopOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  elevationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 4,
  },
  elevationText: {
    color: Colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  northCompass: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBottomPin: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  mapDistanceVal: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  mapDistanceUnit: {
    color: Colors.primaryContainer,
    fontSize: 11,
    fontWeight: '700',
  },
  telemetryHUD: {
    marginBottom: Spacing.md,
  },
  timerCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  hudLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  displayTimer: {
    color: Colors.onSurface,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  intervalSub: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
  },
  intervalTitle: {
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  hudGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  hudBox: {
    flex: 1,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  hudBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hudBoxLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hudBoxBigVal: {
    color: Colors.onSurface,
    fontSize: 26,
    fontWeight: '900',
  },
  hudBoxUnit: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '700',
  },
  microMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  microBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.lg,
    padding: Spacing.sm,
  },
  microIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  microVal: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  microUnit: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '600',
  },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  audioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  audioIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTrackName: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  audioArtist: {
    color: Colors.primaryContainer,
    fontSize: 11,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtnSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radii.xl,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  actionBtnLabel: {
    color: Colors.onSurfaceVariant,
    fontSize: 9,
    fontWeight: '800',
  },
  actionBtnVal: {
    color: Colors.onSurface,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnMaster: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.xl,
    paddingVertical: 14,
  },
  actionBtnMasterPaused: {
    backgroundColor: Colors.secondary,
  },
  masterBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  finishRunSection: {
    marginBottom: Spacing.md,
  },
  finishRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.xl,
    paddingVertical: 14,
  },
  finishRunBtnText: {
    color: Colors.onPrimaryContainer,
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    color: Colors.onSurface,
    fontSize: 18,
    fontWeight: '800',
  },
  modalDesc: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  presetChipSelected: {
    backgroundColor: Colors.secondary,
  },
  presetChipText: {
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },
  presetChipTextSelected: {
    color: Colors.onPrimaryContainer,
    fontWeight: '900',
  },
  searchPlaceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
    height: 48,
  },
  searchPlaceInput: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 14,
    paddingHorizontal: Spacing.sm,
  },
  suggestionsContainer: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.primaryContainer,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderTranslucent,
  },
  suggestionTitle: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionSub: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    marginTop: 1,
  },
  addPointBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: Radii.lg,
  },
  addPointBtnText: {
    color: '#0A0E17',
    fontSize: 14,
    fontWeight: '900',
  },
  pointItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    gap: 8,
    marginBottom: 6,
  },
  pointItemName: {
    color: Colors.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  pointItemCoords: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: Colors.primaryContainer,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.onSurface,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.borderTranslucent,
  },
  saveCacoBtn: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radii.xl,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveCacoBtnText: {
    color: '#0A0E17',
    fontSize: 15,
    fontWeight: '900',
  },
});
