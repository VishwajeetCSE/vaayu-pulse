/**
 * @fileoverview Civic Air Quality Briefing Studio Constants
 * Strict definitions for AQI thresholds, pollutant breakpoints, persona action protocols,
 * offline multi-lingual localization templates, and realistic civic test fixtures.
 * @module constants
 */

/**
 * Standard AQI classification bands with visual semantics and health advisories.
 * Conforms to Central Pollution Control Board (CPCB) and US EPA aligned standards.
 */
export const AQI_BANDS = Object.freeze([
  {
    category: 'Good',
    min: 0,
    max: 50,
    color: '#10b981', // Emerald
    bgColor: '#d1fae5',
    textColor: '#065f46',
    borderClass: 'border-emerald-500',
    severity: 'low',
    summary: 'Air quality is satisfactory and poses little or no risk.',
    healthRisk: 'Minimal impact on all population groups.'
  },
  {
    category: 'Satisfactory',
    min: 51,
    max: 100,
    color: '#84cc16', // Lime
    bgColor: '#ecfccb',
    textColor: '#3f6212',
    borderClass: 'border-lime-500',
    severity: 'moderate-low',
    summary: 'Air quality is acceptable; minor breathing discomfort for sensitive people.',
    healthRisk: 'Minor breathing discomfort to sensitive individuals (asthma, COPD).'
  },
  {
    category: 'Moderate',
    min: 101,
    max: 200,
    color: '#eab308', // Amber
    bgColor: '#fef9c3',
    textColor: '#854d0e',
    borderClass: 'border-amber-500',
    severity: 'moderate',
    summary: 'Breathing discomfort to people with lung, heart disease, children, and elderly.',
    healthRisk: 'Noticeable discomfort for vulnerable groups; slight irritation for healthy people.'
  },
  {
    category: 'Poor',
    min: 201,
    max: 300,
    color: '#f97316', // Orange
    bgColor: '#ffedd5',
    textColor: '#9a3412',
    borderClass: 'border-orange-500',
    severity: 'high',
    summary: 'Breathing discomfort to most people on prolonged exposure.',
    healthRisk: 'Respiratory symptoms likely in sensitive individuals; aggravated lung disease.'
  },
  {
    category: 'Very Poor',
    min: 301,
    max: 400,
    color: '#ef4444', // Red
    bgColor: '#fee2e2',
    textColor: '#991b1b',
    borderClass: 'border-red-500',
    severity: 'very-high',
    summary: 'Respiratory illness on prolonged exposure. Severe effect on sensitive groups.',
    healthRisk: 'Increased cardiovascular and respiratory complications for general population.'
  },
  {
    category: 'Severe',
    min: 401,
    max: 500,
    color: '#7f1d1d', // Dark Maroon
    bgColor: '#fecaca',
    textColor: '#450a0a',
    borderClass: 'border-rose-900',
    severity: 'emergency',
    summary: 'Emergency health warning: serious risk of respiratory damage for everyone.',
    healthRisk: 'Healthy people severely affected; serious impacts on diseased populations.'
  }
]);

/**
 * Standard pollutant concentration breakpoints for linear AQI sub-index calculation.
 * Formula: SubAQI = ((I_hi - I_lo) / (B_hi - B_lo)) * (C - B_lo) + I_lo
 */
export const POLLUTANT_BREAKPOINTS = Object.freeze({
  pm25: [
    { bpLo: 0, bpHi: 30, aqiLo: 0, aqiHi: 50 },
    { bpLo: 31, bpHi: 60, aqiLo: 51, aqiHi: 100 },
    { bpLo: 61, bpHi: 90, aqiLo: 101, aqiHi: 200 },
    { bpLo: 91, bpHi: 120, aqiLo: 201, aqiHi: 300 },
    { bpLo: 121, bpHi: 250, aqiLo: 301, aqiHi: 400 },
    { bpLo: 251, bpHi: 500, aqiLo: 401, aqiHi: 500 }
  ],
  pm10: [
    { bpLo: 0, bpHi: 50, aqiLo: 0, aqiHi: 50 },
    { bpLo: 51, bpHi: 100, aqiLo: 51, aqiHi: 100 },
    { bpLo: 101, bpHi: 250, aqiLo: 101, aqiHi: 200 },
    { bpLo: 251, bpHi: 350, aqiLo: 201, aqiHi: 300 },
    { bpLo: 351, bpHi: 430, aqiLo: 301, aqiHi: 400 },
    { bpLo: 431, bpHi: 600, aqiLo: 401, aqiHi: 500 }
  ],
  no2: [
    { bpLo: 0, bpHi: 40, aqiLo: 0, aqiHi: 50 },
    { bpLo: 41, bpHi: 80, aqiLo: 51, aqiHi: 100 },
    { bpLo: 81, bpHi: 180, aqiLo: 101, aqiHi: 200 },
    { bpLo: 181, bpHi: 280, aqiLo: 201, aqiHi: 300 },
    { bpLo: 281, bpHi: 400, aqiLo: 301, aqiHi: 400 },
    { bpLo: 401, bpHi: 600, aqiLo: 401, aqiHi: 500 }
  ],
  so2: [
    { bpLo: 0, bpHi: 40, aqiLo: 0, aqiHi: 50 },
    { bpLo: 41, bpHi: 80, aqiLo: 51, aqiHi: 100 },
    { bpLo: 81, bpHi: 380, aqiLo: 101, aqiHi: 200 },
    { bpLo: 381, bpHi: 800, aqiLo: 201, aqiHi: 300 },
    { bpLo: 801, bpHi: 1600, aqiLo: 301, aqiHi: 400 },
    { bpLo: 1601, bpHi: 2400, aqiLo: 401, aqiHi: 500 }
  ],
  co: [
    { bpLo: 0, bpHi: 1.0, aqiLo: 0, aqiHi: 50 },
    { bpLo: 1.1, bpHi: 2.0, aqiLo: 51, aqiHi: 100 },
    { bpLo: 2.1, bpHi: 10.0, aqiLo: 101, aqiHi: 200 },
    { bpLo: 10.1, bpHi: 17.0, aqiLo: 201, aqiHi: 300 },
    { bpLo: 17.1, bpHi: 34.0, aqiLo: 301, aqiHi: 400 },
    { bpLo: 34.1, bpHi: 50.0, aqiLo: 401, aqiHi: 500 }
  ],
  o3: [
    { bpLo: 0, bpHi: 50, aqiLo: 0, aqiHi: 50 },
    { bpLo: 51, bpHi: 100, aqiLo: 51, aqiHi: 100 },
    { bpLo: 101, bpHi: 168, aqiLo: 101, aqiHi: 200 },
    { bpLo: 169, bpHi: 208, aqiLo: 201, aqiHi: 300 },
    { bpLo: 209, bpHi: 748, aqiLo: 301, aqiHi: 400 },
    { bpLo: 749, bpHi: 1000, aqiLo: 401, aqiHi: 500 }
  ]
});

/**
 * Molecular weights and standard conversion multipliers from ppm/ppb to µg/m³
 * at Standard Ambient Temperature & Pressure (25°C, 101.325 kPa).
 * µg/m³ = ppm * (molecular_weight / 24.45) * 1000
 */
export const UNIT_CONVERSIONS = Object.freeze({
  no2: { ppmToUgM3: 1880, ppbToUgM3: 1.88, mgM3ToUgM3: 1000 },
  so2: { ppmToUgM3: 2620, ppbToUgM3: 2.62, mgM3ToUgM3: 1000 },
  co: { ppmToMgM3: 1.145, mgM3ToPpm: 0.873, mgM3ToUgM3: 1000 },
  o3: { ppmToUgM3: 1960, ppbToUgM3: 1.96, mgM3ToUgM3: 1000 }
});

/**
 * Persona-tailored civic intervention catalog mapped to AQI threshold triggers.
 */
export const PERSONA_RULES = Object.freeze({
  ward_officer: {
    title: 'Ward Officers & Municipal Engineers',
    icon: '🏢',
    statutoryRef: 'Section 19, Air (Prevention and Control of Pollution) Act & GRAP Protocols',
    actions: [
      {
        id: 'wo_sprinklers',
        minAqi: 150,
        priority: 'High',
        timeframe: '< 2 hrs',
        text: 'Deploy anti-smog water mist cannons and mechanized vacuum sweepers along primary arterials.',
        scope: 'Arterial corridors & high-traffic junctions'
      },
      {
        id: 'wo_traffic',
        minAqi: 200,
        priority: 'High',
        timeframe: '< 3 hrs',
        text: 'Activate traffic diversion protocols to avoid bottleneck hotspots and prevent vehicle idling.',
        scope: 'Signal choke points and commercial centers'
      },
      {
        id: 'wo_construction',
        minAqi: 250,
        priority: 'Critical',
        timeframe: '< 1 hr',
        text: 'Enforce construction dust halts (C&D waste covering, wind-breaking barriers, cessation of earthwork).',
        scope: 'Active building and infrastructure sites'
      },
      {
        id: 'wo_burning',
        minAqi: 100,
        priority: 'Immediate',
        timeframe: 'Continuous',
        text: 'Deploy rapid-response vigilance squads against open biomass, garbage, and plastic burning.',
        scope: 'Municipal waste dumps, vacant plots, slum clusters'
      },
      {
        id: 'wo_diesel_inspection',
        minAqi: 300,
        priority: 'Critical',
        timeframe: '< 4 hrs',
        text: 'Strict audit of commercial Diesel Generator (DG) sets without emission retrofits.',
        scope: 'Commercial hubs, malls, and industrial units'
      }
    ]
  },
  housing_society: {
    title: 'Housing Societies & RWAs (Resident Welfare)',
    icon: '🏘️',
    statutoryRef: 'Civic Environmental Bye-Laws & Community Green Protocols',
    actions: [
      {
        id: 'rwa_dg_ban',
        minAqi: 200,
        priority: 'Critical',
        timeframe: '< 1 hr',
        text: 'Cease non-essential Diesel Generator (DG) backup usage; mandate grid/battery-inverter reliance.',
        scope: 'Residential tower power backups'
      },
      {
        id: 'rwa_green_misting',
        minAqi: 150,
        priority: 'Medium',
        timeframe: 'Morning & Evening',
        text: 'Perform mist watering of internal perimeter trees and shrub canopy to trap settleable dust.',
        scope: 'Common parks, gardens, and boundary hedges'
      },
      {
        id: 'rwa_purifier_lounges',
        minAqi: 250,
        priority: 'High',
        timeframe: '< 2 hrs',
        text: 'Establish HEPA-purified "Clean Air Havens" in clubhouse or reading rooms for senior residents.',
        scope: 'Community hall, clubhouse, library'
      },
      {
        id: 'rwa_security_shifts',
        minAqi: 200,
        priority: 'High',
        timeframe: 'Immediate',
        text: 'Rotate outdoor security guard shifts into enclosed booths; provide certified N95 masks.',
        scope: 'Gate security personnel & maintenance staff'
      },
      {
        id: 'rwa_carpark_vent',
        minAqi: 180,
        priority: 'Medium',
        timeframe: 'Peak hours',
        text: 'Operate forced mechanical ventilation in multi-level basements during morning/evening commute.',
        scope: 'Basement parking levels'
      }
    ]
  },
  school: {
    title: 'School Administrators & Principals',
    icon: '🏫',
    statutoryRef: 'Department of Education Air Quality Safety Advisory Circular',
    actions: [
      {
        id: 'sch_indoor_recess',
        minAqi: 150,
        priority: 'High',
        timeframe: 'Immediate',
        text: 'Shift all recess, lunch, and assemblies to enclosed indoor multi-purpose halls.',
        scope: 'All grade levels (KG to 12)'
      },
      {
        id: 'sch_sports_cancel',
        minAqi: 200,
        priority: 'Critical',
        timeframe: 'Immediate',
        text: 'Suspend outdoor sports periods, athletic training, marathons, and strenuous physical activities.',
        scope: 'Sports teams & PE curricula'
      },
      {
        id: 'sch_bus_idle',
        minAqi: 100,
        priority: 'High',
        timeframe: 'Continuous',
        text: 'Enforce strict 0-minute engine idling policy in school bus pickup and drop-off zones.',
        scope: 'School transport & parent carpools'
      },
      {
        id: 'sch_filter_audit',
        minAqi: 200,
        priority: 'Medium',
        timeframe: 'Daily',
        text: 'Inspect classroom HVAC filters and ensure windows remain sealed during peak traffic hours.',
        scope: 'Classrooms, computer labs, auditoriums'
      },
      {
        id: 'sch_vulnerable_register',
        minAqi: 180,
        priority: 'High',
        timeframe: 'Immediate',
        text: 'Activate Asthmatic/Respiratory Student Register with sick bay standby and inhaler access.',
        scope: 'Medical room & primary teachers'
      }
    ]
  }
});

/**
 * Reading level styles for Citizen Advisory.
 */
export const READING_LEVELS = Object.freeze({
  standard: {
    name: 'Standard Citizen',
    tag: 'General Audience',
    desc: 'Clear, civic-oriented recommendations with balanced actionable guidance.'
  },
  simplified: {
    name: 'Simplified / Child-Friendly',
    tag: 'Grade 3-6 Level',
    desc: 'Simple words, vivid analogies, short sentences, and reassuring action steps.'
  },
  vulnerable: {
    name: 'Vulnerable Health Focus',
    tag: 'Seniors, Asthma & Cardiac',
    desc: 'Clinical cautionary guidance, symptom warning signs, medication reminders, and indoor refuge rules.'
  }
});

/**
 * Multi-language pre-configured localization dictionaries and templates.
 */
export const I18N_TEMPLATES = Object.freeze({
  en: {
    name: 'English',
    title: 'Civic Air Quality Briefing',
    aqiLabel: 'Air Quality Index',
    statusLabel: 'Status',
    primaryPollutant: 'Primary Pollutant',
    wardSummary: 'Ward Air Quality Overview',
    recommendations: 'Action Interventions',
    whatChanged: 'Trend Delta Analysis',
    citizenAdvisory: 'Citizen Advisory',
    internalBriefing: 'Technical Municipal Briefing Note',
    anomalyBadge: 'Data Anomaly Flagged',
    reliable: 'Sensor Verified',
    deltaImproving: 'Air Quality Improving',
    deltaDeteriorating: 'Air Quality Deteriorating',
    deltaStable: 'Air Quality Stable'
  },
  hi: {
    name: 'हिंदी (Hindi)',
    title: 'नागरिक वायु गुणवत्ता बुलेटिन',
    aqiLabel: 'वायु गुणवत्ता सूचकांक (AQI)',
    statusLabel: 'स्थिति',
    primaryPollutant: 'प्रमुख प्रदूषक',
    wardSummary: 'वार्ड-वार वायु गुणवत्ता सारांश',
    recommendations: 'कार्रवाई हस्तक्षेप',
    whatChanged: 'परिवर्तन और रुझान विश्लेषण',
    citizenAdvisory: 'नागरिक परामर्श',
    internalBriefing: 'तकनीकी प्रशासनिक नोट',
    anomalyBadge: 'डेटा विसंगति चिह्नित',
    reliable: 'सेंसर सत्यापित',
    deltaImproving: 'वायु गुणवत्ता में सुधार',
    deltaDeteriorating: 'वायु गुणवत्ता में गिरावट',
    deltaStable: 'वायु गुणवत्ता स्थिर'
  },
  bn: {
    name: 'বাংলা (Bengali)',
    title: 'নাগরিক বায়ু মানের বুলেটিন',
    aqiLabel: 'বায়ু মান সূচক (AQI)',
    statusLabel: 'অবস্থা',
    primaryPollutant: 'প্রধান দূষণকারী',
    wardSummary: 'ওয়ার্ডভিত্তিক বায়ুর গুণমান পর্যালোচনা',
    recommendations: 'করণীয় পদক্ষেপ',
    whatChanged: 'পরিবর্তন ও প্রবণতা বিশ্লেষণ',
    citizenAdvisory: 'নাগরিক সতর্কতা ও নির্দেশিকা',
    internalBriefing: 'প্রশাসনিক প্রযুক্তিগত নোট',
    anomalyBadge: 'তথ্য অসঙ্গতি চিহ্নিত',
    reliable: 'সেন্সর নির্ভরযোগ্য',
    deltaImproving: 'বায়ু মানের উন্নতি হচ্ছে',
    deltaDeteriorating: 'বায়ু মানের অবনতি হচ্ছে',
    deltaStable: 'বায়ু মান স্থিতিশীল'
  },
  ta: {
    name: 'தமிழ் (Tamil)',
    title: 'குடிமக்கள் காற்று தர அறிக்கை',
    aqiLabel: 'காற்று தரக் குறியீடு (AQI)',
    statusLabel: 'நிலை',
    primaryPollutant: 'முதன்மை மாசுபடுத்தி',
    wardSummary: 'வார்டு வாரியான காற்று தரம்',
    recommendations: 'பரிந்துரைக்கப்பட்ட நடவடிக்கைகள்',
    whatChanged: 'மாற்றங்கள் மற்றும் போக்குகள்',
    citizenAdvisory: 'பொதுமக்கள் ஆலோசனை',
    internalBriefing: 'தொழில்நுட்ப நகராட்சி குறிப்பு',
    anomalyBadge: 'தரவு முரண்பாடு',
    reliable: 'சென்சார் சரிபார்க்கப்பட்டது',
    deltaImproving: 'காற்று தரம் மேம்படுகிறது',
    deltaDeteriorating: 'காற்று தரம் மோசமடைகிறது',
    deltaStable: 'காற்று தரம் நிலையானது'
  },
  mr: {
    name: 'मराठी (Marathi)',
    title: 'नागरी हवा गुणवत्ता बुलेटिन',
    aqiLabel: 'हवा गुणवत्ता निर्देशांक (AQI)',
    statusLabel: 'स्थिती',
    primaryPollutant: 'मुख्य प्रदूषक',
    wardSummary: 'प्रभागनिहाय हवा गुणवत्ता आढावा',
    recommendations: 'कृती योजना',
    whatChanged: 'बदल आणि कल विश्लेषण',
    citizenAdvisory: 'नागरिक सल्लागार पत्र',
    internalBriefing: 'तांत्रिक महापालिका टिपण',
    anomalyBadge: 'माहिती विसंगती',
    reliable: 'सेन्सर प्रमाणीकृत',
    deltaImproving: 'हवा गुणवत्तेत सुधारणा',
    deltaDeteriorating: 'हवा गुणवत्ता ढासळत आहे',
    deltaStable: 'हवा गुणवत्ता स्थिर'
  },
  es: {
    name: 'Español (Spanish)',
    title: 'Boletín Cívico de Calidad del Aire',
    aqiLabel: 'Índice de Calidad del Aire (ICA)',
    statusLabel: 'Estado',
    primaryPollutant: 'Contaminante Principal',
    wardSummary: 'Resumen por Distritos',
    recommendations: 'Intervenciones Recomendadas',
    whatChanged: 'Análisis de Tendencias',
    citizenAdvisory: 'Aviso a la Ciudadanía',
    internalBriefing: 'Nota Técnica Interna Municipal',
    anomalyBadge: 'Anomalía de Datos Detectada',
    reliable: 'Sensor Verificado',
    deltaImproving: 'Calidad del aire mejorando',
    deltaDeteriorating: 'Calidad del aire deteriorándose',
    deltaStable: 'Calidad del aire estable'
  }
});

/**
 * Realistic Demo Datasets demonstrating messy parsing, unit conversions,
 * data gap flagging, and snapshot comparison.
 */
export const DEMO_DATASETS = Object.freeze({
  cleanCsv: `Station_ID,Ward_Name,Timestamp,PM2.5,PM10,NO2,SO2,CO,Unit
ST-101,Central Civic Plaza,2026-11-14 08:00,165.4,280.2,54.1,22.0,2.4,ug/m3
ST-102,Industrial East Corridor,2026-11-14 08:00,312.0,460.5,115.3,48.2,4.8,ug/m3
ST-103,Green Meadows Sector 4,2026-11-14 08:00,42.5,78.0,18.4,8.1,0.8,ug/m3
ST-104,Metro North Transit Hub,2026-11-14 08:00,225.8,340.0,88.7,31.4,3.2,ug/m3
ST-105,South Tech Park,2026-11-14 08:00,88.2,142.1,35.0,14.5,1.2,ug/m3`,

  messyTsv: `Station\tWard\tTime\tPM2.5\tPM10\tNO2\tSO2\tStatus
ST-201\tOld Market Basti\t14/11/2026 08:15 AM\t245.0\t390.2\t95.0\t\tActive
ST-202\tRiverfront Port Zone\t2026-11-14T08:15:00Z\t\t510.0\t140.2\t62.0\tAnomaly
ST-203\tCantonment Hills\t2026-11-14 08:10\t28.4\t48.0\t12.1\t4.5\tActive
ST-204\tOuter Ring Choke\t08:15 14-Nov-26\t385.0\t\t185.0\t45.0\tIntermittent
ST-205\tWest Lake Enclave\t2026-11-14 08:00\t-12.0\t120.0\t40.0\t15.0\tError`,

  mixedUnits: `Location,Ward,Recorded_At,PM2.5,PM10,NO2,CO,Unit_Note
Sensor-A,Downtown Ward 1,2026-11-14 08:30,185.0 ug/m3,290.0 ug/m3,0.065 ppm,2.8 mg/m3,Mixed Units
Sensor-B,Suburban Ward 8,2026-11-14 08:30,55.0 ug/m3,98.0 ug/m3,0.021 ppm,0.9 mg/m3,Mixed Units
Sensor-C,Freight Depot Ward 12,2026-11-14 08:30,340.0 ug/m3,520.0 ug/m3,0.125 ppm,5.4 mg/m3,Mixed Units
Sensor-D,Botanical Ward 3,2026-11-14 08:30,32.0 ug/m3,60.0 ug/m3,0.012 ppm,0.5 mg/m3,Mixed Units`,

  markdownTable: `| Station Code | Ward | Observation Time | PM2.5 (ug/m3) | PM10 (ug/m3) | NO2 (ug/m3) | CO (mg/m3) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| W-11 | Central Secretariat | 2026-11-14 08:45 | 178.5 | 288.0 | 62.0 | 2.5 |
| W-12 | Brick Kiln Cluster | 2026-11-14 08:45 | 415.0 | 590.0 | 165.0 | 6.2 |
| W-13 | University Campus | 2026-11-14 08:45 | 65.0 | 110.0 | 28.0 | 1.1 |
| W-14 | Harbor Expressway | 2026-11-14 08:45 | 290.0 | 410.0 | 105.0 | 3.8 |`,

  baselineSnapshot: {
    timestamp: '2026-11-14 02:00:00',
    title: 'Early Morning Baseline Briefing (02:00 AM)',
    wards: [
      { ward: 'Central Civic Plaza', aqi: 185, primaryPollutant: 'PM2.5', pm25: 120, pm10: 210 },
      { ward: 'Industrial East Corridor', aqi: 280, primaryPollutant: 'PM10', pm25: 210, pm10: 380 },
      { ward: 'Green Meadows Sector 4', aqi: 48, primaryPollutant: 'PM2.5', pm25: 28, pm10: 55 },
      { ward: 'Metro North Transit Hub', aqi: 195, primaryPollutant: 'PM2.5', pm25: 140, pm10: 230 },
      { ward: 'South Tech Park', aqi: 92, primaryPollutant: 'PM10', pm25: 58, pm10: 145 },
      { ward: 'Old Market Basti', aqi: 210, primaryPollutant: 'PM2.5', pm25: 160, pm10: 260 },
      { ward: 'Riverfront Port Zone', aqi: 310, primaryPollutant: 'PM10', pm25: 250, pm10: 420 },
      { ward: 'Brick Kiln Cluster', aqi: 360, primaryPollutant: 'PM2.5', pm25: 290, pm10: 480 }
    ]
  }
});
