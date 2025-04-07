"use client";

import { useState, useEffect } from "react";

const useLocation = () => {
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const getLocation = () => {
    setLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Errore nel recupero della posizione:", error);
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      console.error("Geolocalizzazione non supportata");
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  return { userCoords, loadingLocation, getLocation };
};

export default useLocation;
