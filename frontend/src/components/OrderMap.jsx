import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Leaflet DivIcons (prevents missing image asset errors in Vite)
const storeIcon = L.divIcon({
  className: 'custom-pin-store',
  html: `<div style="background-color:#3A7D7C; width:32px; height:32px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(58,125,124,0.5); display:flex; align-items:center; justify-content:center; font-size:16px;">🏪</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const driverIcon = L.divIcon({
  className: 'custom-pin-driver',
  html: `<div style="background-color:#10b981; width:36px; height:36px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 4px 14px rgba(16,185,129,0.6); display:flex; align-items:center; justify-content:center; font-size:18px;">🛵</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18]
});

const customerIcon = L.divIcon({
  className: 'custom-pin-customer',
  html: `<div style="background-color:#0ea5e9; width:32px; height:32px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(14,165,233,0.5); display:flex; align-items:center; justify-content:center; font-size:16px;">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Helper component to auto-fit bounds on coordinate changes
function MapController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        if (bounds.length === 1) {
          map.setView(bounds[0], 14);
        } else {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      } catch (e) {}
    }
  }, [map, bounds]);
  return null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

export default function OrderMap({
  restaurantLat = 15.3647,
  restaurantLng = 75.1240,
  restaurantName = 'Restaurant Kitchen',
  customerLat,
  customerLng,
  customerAddress = 'Delivery Destination',
  driverCoords, // { lat, lng }
  driverName,
  orderStatus,
  distanceKm
}) {
  const restLat = parseFloat(restaurantLat) || 15.3647;
  const restLng = parseFloat(restaurantLng) || 75.1240;

  const custLat = customerLat ? parseFloat(customerLat) : null;
  const custLng = customerLng ? parseFloat(customerLng) : null;

  const driverLat = driverCoords?.lat ? parseFloat(driverCoords.lat) : null;
  const driverLng = driverCoords?.lng ? parseFloat(driverCoords.lng) : null;

  // Build bounds array
  const bounds = useMemo(() => {
    const points = [[restLat, restLng]];
    if (custLat && custLng) points.push([custLat, custLng]);
    if (driverLat && driverLng) points.push([driverLat, driverLng]);
    return points;
  }, [restLat, restLng, custLat, custLng, driverLat, driverLng]);

  // Build polyline route path: Restaurant -> Driver -> Customer
  const polylinePath = useMemo(() => {
    const path = [[restLat, restLng]];
    if (driverLat && driverLng) path.push([driverLat, driverLng]);
    if (custLat && custLng) path.push([custLat, custLng]);
    return path;
  }, [restLat, restLng, custLat, custLng, driverLat, driverLng]);

  const calcDist = useMemo(() => {
    if (distanceKm) return distanceKm;
    if (custLat && custLng) return haversineDistance(restLat, restLng, custLat, custLng);
    return null;
  }, [distanceKm, restLat, restLng, custLat, custLng]);

  const centerPos = driverLat && driverLng ? [driverLat, driverLng] : (custLat && custLng ? [custLat, custLng] : [restLat, restLng]);

  return (
    <div className="w-full h-full min-h-[220px] rounded-2xl overflow-hidden shadow-inner border border-[#D7E5E8] relative z-0">
      <MapContainer
        center={centerPos}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full rounded-2xl"
        style={{ height: '100%', width: '100%', minHeight: '220px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <MapController bounds={bounds} />

        {/* Restaurant Pin */}
        <Marker position={[restLat, restLng]} icon={storeIcon}>
          <Popup>
            <div className="p-1 font-sans text-[#1F2937]">
              <strong className="block text-xs font-bold">{restaurantName}</strong>
              <span className="text-[10px] text-[#64748B] block">Restaurant Kitchen</span>
            </div>
          </Popup>
        </Marker>

        {/* Driver Pin */}
        {driverLat && driverLng && (
          <Marker position={[driverLat, driverLng]} icon={driverIcon}>
            <Popup>
              <div className="p-1 font-sans text-[#1F2937]">
                <strong className="block text-xs font-bold">{driverName || 'Delivery Partner'} 🛵</strong>
                <span className="text-[10px] text-emerald-700 font-bold block">Live GPS Active</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Customer Pin */}
        {custLat && custLng && (
          <Marker position={[custLat, custLng]} icon={customerIcon}>
            <Popup>
              <div className="p-1 font-sans text-[#1F2937]">
                <strong className="block text-xs font-bold">Delivery Destination</strong>
                <span className="text-[10px] text-[#64748B] block">{customerAddress}</span>
                {calcDist && (
                  <span className="text-[10px] font-bold text-[#3A7D7C] block mt-1">
                    Est. Distance: {calcDist} km
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Polyline Delivery Route */}
        {polylinePath.length >= 2 && (
          <Polyline
            positions={polylinePath}
            pathOptions={{
              color: '#3A7D7C',
              weight: 4,
              opacity: 0.85,
              dashArray: '8, 8'
            }}
          />
        )}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#D7E5E8] shadow-md text-[10px] font-semibold text-[#1F2937] flex items-center gap-3 pointer-events-auto">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3A7D7C] inline-block"></span> Store</span>
        {driverLat && driverLng && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Driver Live 🛵</span>}
        {custLat && custLng && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> Customer</span>}
        {calcDist && (
          <span className="bg-[#EAF4F7] text-[#3A7D7C] px-2 py-0.5 rounded font-bold text-[10px] border border-[#D7E5E8]">
            {calcDist} km
          </span>
        )}
      </div>
    </div>
  );
}
