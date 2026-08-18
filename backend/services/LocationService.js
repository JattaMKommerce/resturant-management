/**
 * LocationService.js
 * Authoritative Server-side Geolocation & Distance calculation using Haversine Formula
 */

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers rounded to 2 decimal places
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const p1Lat = parseFloat(lat1);
  const p1Lon = parseFloat(lon1);
  const p2Lat = parseFloat(lat2);
  const p2Lon = parseFloat(lon2);

  if (isNaN(p1Lat) || isNaN(p1Lon) || isNaN(p2Lat) || isNaN(p2Lon)) {
    throw new Error('Invalid latitude or longitude coordinates provided.');
  }

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = toRad(p2Lat - p1Lat);
  const dLon = toRad(p2Lon - p1Lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1Lat)) * Math.cos(toRad(p2Lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Server-side validation of customer delivery address location against restaurant coordinates
 */
function validateDeliveryRadius(restaurantLat, restaurantLng, customerLat, customerLng, maxRadiusKm = 10.0) {
  const distanceKm = calculateHaversineDistance(restaurantLat, restaurantLng, customerLat, customerLng);
  const isValid = distanceKm <= maxRadiusKm;

  return {
    isValid,
    distanceKm,
    maxRadiusKm: parseFloat(maxRadiusKm)
  };
}

module.exports = {
  calculateHaversineDistance,
  validateDeliveryRadius
};
