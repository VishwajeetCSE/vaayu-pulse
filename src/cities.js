// src/cities.js
// Loads city‑pincode data and populates the city selector dropdown.

import citiesData from '../sample_data/cities.json' assert { type: 'json' };

/**
 * Populate a <select> element with city options.
 * @param {HTMLSelectElement} selectElem
 */
export function populateCitySelect(selectElem) {
  if (!selectElem) return;
  // Clear existing options except placeholder
  selectElem.innerHTML = '<option value="" disabled selected>Select City</option>';
  citiesData.forEach(({ pincode, city }) => {
    const opt = document.createElement('option');
    opt.value = pincode;
    opt.textContent = `${city} (${pincode})`;
    selectElem.appendChild(opt);
  });
}

/**
 * Returns the selected city object or null.
 * @param {HTMLSelectElement} selectElem
 * @returns {{pincode:string,city:string}|null}
 */
export function getSelectedCity(selectElem) {
  if (!selectElem || !selectElem.value) return null;
  const pincode = selectElem.value;
  return citiesData.find(c => c.pincode === pincode) || null;
}
