/**
 * @fileoverview Indian City Air Quality Profiles & Selector
 * Provides pre-configured multi-ward sensor matrices for major Indian cities
 * with pincode lookup, zero external dependencies, and XSS-safe DOM population.
 * @module cities
 */

import { setSanitizedHTML, escapeHTML } from './security.js';

/**
 * Curated list of Indian metropolitan cities with authentic ward names and sensor readings.
 */
export const CITIES_DATA = Object.freeze([
  {
    city: 'Bhopal',
    pincode: '462001',
    state: 'Madhya Pradesh',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,MP Nagar Zone-I,84,162,38,14,1.4,42
2026-11-14T10:00:00Z,Arera Colony,42,88,22,8,0.7,35
2026-11-14T10:00:00Z,TT Nagar Stadium,68,135,31,11,1.1,38
2026-11-14T10:00:00Z,Kolar Road Bypass,112,210,49,18,1.9,50
2026-11-14T10:00:00Z,Govindpura Industrial,148,275,64,24,2.5,58
2026-11-14T10:00:00Z,Bairagarh Sant Hirdaram,55,104,26,9,0.9,32`
  },
  {
    city: 'New Delhi',
    pincode: '110001',
    state: 'Delhi NCR',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,Anand Vihar ISBT,345,490,92,34,3.8,62
2026-11-14T10:00:00Z,Connaught Place,175,280,58,19,2.1,48
2026-11-14T10:00:00Z,Punjabi Bagh,290,410,81,28,3.2,55
2026-11-14T10:00:00Z,RK Puram Sector 8,210,340,65,22,2.4,51
2026-11-14T10:00:00Z,Okhla Industrial Area,380,520,110,42,4.5,70
2026-11-14T10:00:00Z,Dwarka Sector 10,160,250,52,16,1.8,44`
  },
  {
    city: 'Mumbai',
    pincode: '400001',
    state: 'Maharashtra',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,BKC Commercial Complex,165,260,62,20,2.1,46
2026-11-14T10:00:00Z,Colaba Waterfront,38,72,18,6,0.5,30
2026-11-14T10:00:00Z,Andheri East Highway,140,230,55,17,1.8,42
2026-11-14T10:00:00Z,Chembur Refineries,210,335,74,31,2.8,54
2026-11-14T10:00:00Z,Borivali National Park,48,89,21,7,0.6,33`
  },
  {
    city: 'Bengaluru',
    pincode: '560001',
    state: 'Karnataka',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,Whitefield Tech Park,95,170,42,12,1.3,44
2026-11-14T10:00:00Z,Koramangala 4th Block,52,98,25,8,0.8,36
2026-11-14T10:00:00Z,Electronic City Phase 1,78,142,34,10,1.1,40
2026-11-14T10:00:00Z,Hebbal Flyover Junction,132,225,58,16,1.7,48
2026-11-14T10:00:00Z,Cubbon Park Nature Zone,28,54,14,5,0.4,26`
  },
  {
    city: 'Indore',
    pincode: '452001',
    state: 'Madhya Pradesh',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,Vijay Nagar Square,88,155,36,13,1.2,40
2026-11-14T10:00:00Z,Rajwada Heritage,72,130,30,10,1.0,36
2026-11-14T10:00:00Z,Palasia Old Ring Road,62,118,28,9,0.9,34
2026-11-14T10:00:00Z,Pithampur Industrial,155,280,68,26,2.6,56
2026-11-14T10:00:00Z,Super Corridor Tech,45,85,20,7,0.7,30`
  },
  {
    city: 'Kolkata',
    pincode: '700001',
    state: 'West Bengal',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,Victoria Memorial,115,195,48,16,1.6,44
2026-11-14T10:00:00Z,Salt Lake Sector V,82,145,35,11,1.1,38
2026-11-14T10:00:00Z,Park Street,138,220,54,18,1.8,46
2026-11-14T10:00:00Z,Howrah Railway Terminus,230,360,78,28,3.0,52
2026-11-14T10:00:00Z,Jadavpur University,90,160,39,12,1.2,40`
  },
  {
    city: 'Chennai',
    pincode: '600001',
    state: 'Tamil Nadu',
    dataset: `timestamp,ward,pm2.5,pm10,no2,so2,co,o3
2026-11-14T10:00:00Z,Marina Beach Coastal,32,65,15,5,0.4,28
2026-11-14T10:00:00Z,T Nagar Commercial,86,152,38,12,1.2,41
2026-11-14T10:00:00Z,Guindy Industrial Zone,124,208,52,16,1.7,46
2026-11-14T10:00:00Z,Adyar Residential,46,84,22,7,0.7,32
2026-11-14T10:00:00Z,Velachery Lake Road,74,136,33,10,1.0,38`
  }
]);

/**
 * Populates a <select> element with city options in an XSS-safe manner.
 * @param {HTMLSelectElement} selectElem - The target select element.
 */
export function populateCitySelect(selectElem) {
  if (!selectElem) return;

  const defaultOption = '<option value="" disabled selected>📍 Select City / Pincode...</option>';
  const cityOptions = CITIES_DATA.map(
    (c) => `<option value="${escapeHTML(c.pincode)}">${escapeHTML(c.city)} (${escapeHTML(c.pincode)} - ${escapeHTML(c.state)})</option>`
  ).join('');

  setSanitizedHTML(selectElem, defaultOption + cityOptions);
}

/**
 * Returns the selected city object or null.
 * @param {HTMLSelectElement} selectElem
 * @returns {Object|null}
 */
export function getSelectedCity(selectElem) {
  if (!selectElem || !selectElem.value) return null;
  const pincode = selectElem.value;
  return CITIES_DATA.find((c) => c.pincode === pincode) || null;
}

/**
 * Retrieves the raw CSV dataset for a given pincode or city name.
 * @param {string} query - Pincode or City name.
 * @returns {string|null}
 */
export function getCityDataset(query) {
  if (!query) return null;
  const normalized = String(query).trim().toLowerCase();
  const match = CITIES_DATA.find(
    (c) => c.pincode === normalized || c.city.toLowerCase() === normalized
  );
  return match ? match.dataset : null;
}
