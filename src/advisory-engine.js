/**
 * @fileoverview Advisory & Delta Engine
 * Formulates persona-specific interventions (Ward Officers, RWAs, Schools),
 * calculates analytical snapshot deltas ("What Changed"), and synthesizes
 * multi-tier citizen advisories across reading levels and languages.
 * @module advisory-engine
 */

import { PERSONA_RULES, READING_LEVELS, I18N_TEMPLATES, AQI_BANDS } from './constants.js';
import { getAqiBand } from './aqi-engine.js';
import { sanitizeString, escapeHTML } from './security.js';

/**
 * Generates persona-tailored action checklists based on current AQI metrics and hotspots.
 *
 * @param {number} maxAqi - Maximum AQI observed in the jurisdiction.
 * @param {number} avgAqi - Average AQI across all wards.
 * @param {Array<Object>} hotspots - Top identified hotspot zones.
 * @returns {Object} Structured checklists for ward_officer, housing_society, and school.
 */
export function generatePersonaActions(maxAqi, avgAqi, hotspots = []) {
  const effectiveAqi = Math.max(maxAqi, avgAqi);
  const result = {};

  for (const [personaKey, personaDef] of Object.entries(PERSONA_RULES)) {
    const applicableActions = personaDef.actions.map((act) => {
      const isTriggered = effectiveAqi >= act.minAqi;
      let dynamicPriority = act.priority;

      // Escalate priority if in Severe / Emergency conditions
      if (effectiveAqi >= 400 && isTriggered) {
        dynamicPriority = 'Emergency';
      }

      return {
        id: act.id,
        text: act.text,
        scope: act.scope,
        timeframe: act.timeframe,
        basePriority: act.priority,
        priority: dynamicPriority,
        minAqi: act.minAqi,
        isTriggered,
        status: isTriggered ? 'Action Required' : 'Standby / Compliant'
      };
    });

    // Sort triggered actions first, then by priority
    applicableActions.sort((a, b) => {
      if (a.isTriggered === b.isTriggered) {
        const order = { Emergency: 0, Critical: 1, High: 2, Immediate: 3, Medium: 4, Low: 5 };
        return (order[a.priority] || 9) - (order[b.priority] || 9);
      }
      return a.isTriggered ? -1 : 1;
    });

    result[personaKey] = {
      roleKey: personaKey,
      title: personaDef.title,
      icon: personaDef.icon,
      statutoryRef: personaDef.statutoryRef,
      triggeredCount: applicableActions.filter((a) => a.isTriggered).length,
      totalCount: applicableActions.length,
      actions: applicableActions
    };
  }

  return result;
}

/**
 * Delta comparison status categories.
 */
export const DELTA_STATUS = Object.freeze({
  DETERIORATING: { label: 'Deteriorating', code: 'DETERIORATING', colorClass: 'text-red-600', badgeClass: 'badge-red', icon: '↗️' },
  IMPROVING: { label: 'Improving', code: 'IMPROVING', colorClass: 'text-emerald-600', badgeClass: 'badge-emerald', icon: '↘️' },
  STATIC_HOTSPOT: { label: 'Static Hotspot', code: 'STATIC_HOTSPOT', colorClass: 'text-amber-600', badgeClass: 'badge-amber', icon: '⚠️' },
  STABLE: { label: 'Stable', code: 'STABLE', colorClass: 'text-blue-600', badgeClass: 'badge-blue', icon: '↔️' }
});

/**
 * Compares current station data with a prior snapshot to compute "What Changed".
 *
 * @param {Array<Object>} currentStations - Current processed station list.
 * @param {Object|null} previousSnapshot - Previous briefing snapshot.
 * @returns {Object} Comprehensive delta analysis.
 */
export function compareSnapshots(currentStations, previousSnapshot) {
  if (!previousSnapshot || !Array.isArray(previousSnapshot.wards) || previousSnapshot.wards.length === 0) {
    return {
      hasBaseline: false,
      summaryText: 'No prior baseline snapshot selected for comparison. Current briefing acts as baseline.',
      wardDeltas: [],
      deterioratingCount: 0,
      improvingCount: 0,
      staticHotspotCount: 0,
      overallDelta: 0
    };
  }

  const prevMap = new Map();
  previousSnapshot.wards.forEach((w) => {
    const key = (w.ward || w.ward_name || w.name || '').toLowerCase().trim();
    if (key) {
      prevMap.set(key, w);
    }
  });

  const wardDeltas = [];
  let deterioratingCount = 0;
  let improvingCount = 0;
  let staticHotspotCount = 0;
  let totalDeltaSum = 0;
  let comparedCount = 0;

  currentStations.forEach((curr) => {
    const currKey = (curr.ward || '').toLowerCase().trim();
    const prev = prevMap.get(currKey);

    if (prev) {
      const prevAqi = typeof prev.aqi === 'number' ? prev.aqi : 0;
      const currAqi = curr.aqi;
      const deltaPoints = currAqi - prevAqi;
      const pctChange = prevAqi > 0 ? Math.round((deltaPoints / prevAqi) * 100) : 0;

      let status = DELTA_STATUS.STABLE;

      if (deltaPoints >= 15) {
        status = DELTA_STATUS.DETERIORATING;
        deterioratingCount++;
      } else if (deltaPoints <= -15) {
        status = DELTA_STATUS.IMPROVING;
        improvingCount++;
      } else if (currAqi >= 200) {
        status = DELTA_STATUS.STATIC_HOTSPOT;
        staticHotspotCount++;
      }

      totalDeltaSum += deltaPoints;
      comparedCount++;

      wardDeltas.push({
        ward: curr.ward,
        stationId: curr.stationId,
        currentAqi: currAqi,
        prevAqi,
        deltaPoints,
        pctChange,
        status,
        dominantPollutant: curr.dominantPollutant
      });
    } else {
      // Newly monitored ward not present in previous snapshot
      wardDeltas.push({
        ward: curr.ward,
        stationId: curr.stationId,
        currentAqi: curr.aqi,
        prevAqi: null,
        deltaPoints: 0,
        pctChange: 0,
        status: { label: 'New Sensor', code: 'NEW', colorClass: 'text-purple-600', badgeClass: 'badge-purple', icon: '✨' },
        dominantPollutant: curr.dominantPollutant
      });
    }
  });

  // Sort deltas by largest deterioration first
  wardDeltas.sort((a, b) => b.deltaPoints - a.deltaPoints);

  const avgDelta = comparedCount > 0 ? Math.round(totalDeltaSum / comparedCount) : 0;

  let summaryText = '';
  if (avgDelta > 10) {
    summaryText = `Overall city air quality has deteriorated by an average of ${avgDelta} AQI points compared to the baseline snapshot (${previousSnapshot.title || 'Previous Snapshot'}). ${deterioratingCount} ward(s) show acute worsening.`;
  } else if (avgDelta < -10) {
    summaryText = `Overall city air quality shows improvement with an average reduction of ${Math.abs(avgDelta)} AQI points compared to baseline. ${improvingCount} ward(s) improved.`;
  } else {
    summaryText = `City-wide air quality remains relatively stable (net delta: ${avgDelta > 0 ? '+' : ''}${avgDelta} AQI points), with ${staticHotspotCount} persistent severe hotspots requiring ongoing intervention.`;
  }

  return {
    hasBaseline: true,
    previousTitle: previousSnapshot.title || 'Previous Snapshot',
    previousTime: previousSnapshot.timestamp || 'Earlier',
    summaryText,
    wardDeltas,
    deterioratingCount,
    improvingCount,
    staticHotspotCount,
    overallDelta: avgDelta
  };
}

/**
 * Formats a Technical Internal Municipal Briefing Note.
 *
 * @param {Object} options
 * @param {number} options.avgAqi
 * @param {number} options.worstAqi
 * @param {Array<Object>} options.hotspots
 * @param {Object} options.deltaAnalysis
 * @param {Object} options.personaActions
 * @param {string} [options.lang='en']
 * @returns {string} Formatted markdown/plain-text technical briefing.
 */
export function generateTechnicalBriefing({ avgAqi, worstAqi, hotspots, deltaAnalysis, personaActions, lang = 'en' }) {
  const i18n = I18N_TEMPLATES[lang] || I18N_TEMPLATES.en;
  const band = getAqiBand(avgAqi);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  let doc = `# ${i18n.internalBriefing.toUpperCase()}\n`;
  doc += `**Issuance Timestamp:** ${now} UTC | **Security Classification:** CIVIC EXECUTIVE RESTRICTED\n`;
  doc += `**Citywide Average AQI:** ${avgAqi} (${band.category}) | **Peak Hotspot AQI:** ${worstAqi}\n\n`;

  doc += `## 1. SITUATION REPORT & EPIDEMIOLOGICAL THREAT VECTOR\n`;
  doc += `- **Health Risk Category:** ${band.healthRisk}\n`;
  doc += `- **Atmospheric Dispersion State:** Inversion conditions trapping particulate matter at ground level.\n`;
  if (deltaAnalysis?.hasBaseline) {
    doc += `- **Delta Vector:** ${deltaAnalysis.summaryText}\n`;
  }

  doc += `\n## 2. CRITICAL JURISDICTIONAL HOTSPOTS\n`;
  if (hotspots.length > 0) {
    hotspots.forEach((h) => {
      doc += `- **Ward: ${h.ward}** (Station: ${h.stationId}) | **AQI: ${h.aqi}** [${h.band.category}] | Dominant Pollutant: ${h.dominantPollutant} | Urgency: **${h.priority.toUpperCase()}**\n`;
    });
  } else {
    doc += `- No acute severe hotspots detected above baseline thresholds.\n`;
  }

  doc += `\n## 3. MANDATED STATUTORY INTERVENTIONS\n`;
  if (personaActions?.ward_officer) {
    doc += `### A. Municipal Ward Officers (${personaActions.ward_officer.statutoryRef})\n`;
    personaActions.ward_officer.actions
      .filter((a) => a.isTriggered)
      .forEach((a) => {
        doc += `  [ ] [${a.priority}] ${a.text} (Target: ${a.timeframe} | Scope: ${a.scope})\n`;
      });
  }

  if (personaActions?.school) {
    doc += `\n### B. Educational Institutions & Child Welfare (${personaActions.school.statutoryRef})\n`;
    personaActions.school.actions
      .filter((a) => a.isTriggered)
      .forEach((a) => {
        doc += `  [ ] [${a.priority}] ${a.text} (Target: ${a.timeframe} | Scope: ${a.scope})\n`;
      });
  }

  if (personaActions?.housing_society) {
    doc += `\n### C. Residential Welfare Associations & Societies\n`;
    personaActions.housing_society.actions
      .filter((a) => a.isTriggered)
      .forEach((a) => {
        doc += `  [ ] [${a.priority}] ${a.text} (Target: ${a.timeframe} | Scope: ${a.scope})\n`;
      });
  }

  doc += `\n## 4. INTER-AGENCY ENFORCEMENT TIMELINE\n`;
  doc += `- **T+0 to T+2 Hours:** Deployment of misting trucks, traffic rerouting at choke-points.\n`;
  doc += `- **T+2 to T+4 Hours:** Spot-checks on construction barriers and commercial DG usage.\n`;
  doc += `- **T+6 Hours:** Evening re-evaluation snapshot and public broadcast update.\n`;

  return doc;
}

/**
 * Formats a Plain-Language Citizen Advisory across selected reading levels and languages.
 *
 * @param {Object} options
 * @param {number} options.avgAqi
 * @param {string} options.dominantPollutant
 * @param {Array<Object>} options.hotspots
 * @param {string} [options.readingLevel='standard'] - 'standard' | 'simplified' | 'vulnerable'
 * @param {string} [options.lang='en'] - 'en' | 'hi' | 'bn' | 'ta' | 'mr' | 'es'
 * @returns {string} Plain-language formatted advisory.
 */
export function generateCitizenAdvisory({ avgAqi, dominantPollutant = 'PM2.5', hotspots = [], readingLevel = 'standard', lang = 'en' }) {
  const i18n = I18N_TEMPLATES[lang] || I18N_TEMPLATES.en;
  const band = getAqiBand(avgAqi);
  const topHotspot = hotspots.length > 0 ? hotspots[0] : null;

  // 1. SIMPLIFIED / CHILD-FRIENDLY (Grade 3-6)
  if (readingLevel === 'simplified') {
    if (lang === 'hi') {
      return `📢 **बच्चों और छात्रों के लिए आज की हवा की रिपोर्ट**

🌟 **आज की हवा कैसी है?**
आज हमारे शहर की हवा **${band.category}** श्रेणी में है (स्कोर: ${avgAqi}/500)। हवा में छोटे-छोटे धूल के कण (जिन्हें ${dominantPollutant} कहते हैं) ज्यादा घूम रहे हैं।

🛡️ **आज आपको क्या करना चाहिए?**
1. 🏃 **बाहर दौड़ने से बचें:** खेल के मैदान में भारी दौड़-भाग वाले खेलों के बजाय कमरे के अंदर लूडो, कैरम या किताबें पढ़ें।
2. 😷 **सुपरहीरो मास्क पहनें:** जब भी आप स्कूल बस के लिए या बाहर जाएं, अपना मास्क जरूर पहनें।
3. 💧 **खूब पानी पिएं:** दिन भर साफ पानी और नारियल पानी पिएं।
4. 🪟 **खिड़कियां बंद रखें:** जब बाहर गाड़ियां ज्यादा चल रही हों, कमरे की खिड़की बंद रखें।`;
    }

    if (lang === 'bn') {
      return `📢 **শিশুদের ও ছাত্রছাত্রীদের জন্য আজকের বায়ুর খবর**

🌟 **আজকের বাতাস কেমন?**
আজ আমাদের শহরের বায়ু **${band.category}** অবস্থায় আছে (স্কোর: ${avgAqi}/500)। বাতাসে ধূলিকণা (${dominantPollutant}) বেশি রয়েছে।

🛡️ **আজ তোমার কী করা উচিত?**
1. 🏃 **বাইরে দৌড়াদৌড়ি কম করো:** মাঠের বাইরে ভারী খেলাধুলো না করে ঘরের মধ্যে বসে গল্প করো বা ছবি আঁকো।
2. 😷 **মাস্ক পরে বেরোও:** স্কুলে যাওয়ার সময় মুখে পরিষ্কার মাস্ক পরে থেকো।
3. 💧 **পর্যাপ্ত জল খাও:** ঘন ঘন জল ও তরল খাবার খাও।
4. 🪟 **জানালা বন্ধ রাখো:** রাস্তার ধোঁয়া যাতে ঘরে না ঢোকে, তাই দরজা-জানালা বন্ধ রাখো।`;
    }

    // Default English Simplified
    return `📢 **KIDS & STUDENTS SPECIAL AIR ADVISORY**

🌟 **What is our air like today?**
Our city's air is currently in the **${band.category}** zone (Score: ${avgAqi} out of 500). Invisible tiny dust particles (called ${dominantPollutant}) are floating in the outdoor breeze.

🛡️ **Your Action Rules for Today:**
1. 🏃 **Indoor Play Day:** Swap outdoor running and soccer with fun indoor games like chess, drawing, or reading.
2. 😷 **Wear Your Shield Mask:** Put on a snug-fitting mask whenever waiting for the school bus or walking outdoors.
3. 💧 **Hydration Hero:** Drink water frequently throughout the day to keep your throat healthy.
4. 🪟 **Keep Windows Shut:** Close classroom and bedroom windows during morning and evening rush hour.`;
  }

  // 2. VULNERABLE HEALTH FOCUS (Seniors, Asthma, Heart Patients, Pregnant Women)
  if (readingLevel === 'vulnerable') {
    if (lang === 'hi') {
      return `🚨 **वरिष्ठ नागरिकों और श्वास रोगियों के लिए विशेष स्वास्थ्य परामर्श**

⚠️ **वर्तमान जोखिम स्तर:** ${band.category} (AQI: ${avgAqi}) | मुख्य प्रदूषक: ${dominantPollutant}
${topHotspot ? `📍 *विशेष रूप से प्रभावित क्षेत्र:* ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

🩺 **अनिवार्य चिकित्सीय दिशा-निर्देश:**
1. 🛑 **सुबह की सैर स्थगित करें:** सुबह और देर शाम बाहर टहलना बिल्कुल बंद रखें जब वायु प्रदूषण सबसे अधिक सघन रहता है।
2. 💊 **दवाएं और इनहेलर साथ रखें:** अस्थमा और ब्रोंकाइटिस रोगी अपने रिलीफ इनहेलर को हर समय पास रखें और एक्सपायरी तिथि जांचें।
3. 🏠 **स्वच्छ वायु कक्ष (Clean Air Sanctuary):** घर के एक कमरे में एयर प्यूरीफायर चालू रखें और दरवाजे-खिड़कियां बंद रखें।
4. 🚨 **चेतावनी लक्षण:** यदि सीने में भारीपन, सांस फूलना, लगातार खांसी या चक्कर आए तो तुरंत नजदीकी स्वास्थ्य केंद्र से संपर्क करें।
5. 😷 **N95/FFP2 मास्क:** यदि बाहर जाना अपरिहार्य हो, तो केवल प्रमाणित N95 मास्क का उपयोग करें।`;
    }

    if (lang === 'bn') {
      return `🚨 **বয়োজ্যেষ্ঠ ও শ্বাসকষ্টের রোগীদের জন্য বিশেষ স্বাস্থ্য সতর্কতা**

⚠️ **বর্তমান ঝুঁকির মাত্রা:** ${band.category} (AQI: ${avgAqi}) | প্রধান দূষক: ${dominantPollutant}
${topHotspot ? `📍 *অতিরিক্ত দূষিত অঞ্চল:* ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

🩺 **জরুরি চিকিৎসা নির্দেশিকা:**
1. 🛑 **ভোরের প্রাতর্ভ্রমণ বন্ধ রাখুন:** ভোর ও সন্ধ্যায় বাইরের বায়ুতে বিষাক্ত কণার ঘনত্ব বেশি থাকে, তাই বাইরে হাঁটবেন না।
2. 💊 **ইনহেলার ও ওষুধ প্রস্তুত রাখুন:** শ্বাসকষ্টের রোগীরা সর্বক্ষণ প্রয়োজনীয় ওষুধ সাথে রাখুন।
3. 🏠 **ঘরের ভেতরের বায়ু পরিষ্কার রাখুন:** জানালা বন্ধ রেখে এয়ার পিউরিফায়ার ব্যবহার করুন।
4. 🚨 **বিপদ সংকেত:** বুকে চাপ, তীব্র শ্বাসকষ্ট বা মাথা ঘোরার অনুভূতি হলে তৎক্ষণাৎ চিকিৎসকের পরামর্শ নিন।
5. 😷 **সার্টিফায়েড N95 মাস্ক:** বাইরে যেতে বাধ্য হলে সাধারণ কাপড়ের মাস্ক নয়, N95 মাস্ক ব্যবহার করুন।`;
    }

    // Default English Vulnerable
    return `🚨 **SPECIAL MEDICAL & VULNERABLE HEALTH ADVISORY**
*Target: Seniors (60+), Individuals with Asthma, COPD, Cardiovascular Conditions & Expectant Mothers*

⚠️ **CURRENT EXPOSURE RISK:** ${band.category.toUpperCase()} (AQI: ${avgAqi})
Primary Toxic Vector: Microscopic ${dominantPollutant} particulates.
${topHotspot ? `📍 *Critical Hotspot Identified:* ${topHotspot.ward} (AQI: ${topHotspot.aqi} - ${topHotspot.band.category})` : ''}

🩺 **Immediate Protective Actions:**
1. 🛑 **Cease Morning & Late Evening Walks:** Stagnant atmospheric inversion causes peak pollutant accumulation at dawn and dusk.
2. 💊 **Inhaler & Medication Readiness:** Ensure minimum 14-day supply of bronchodilators, antihistamines, and cardio prescriptions. Keep rescue inhaler within arm's reach.
3. 🏠 **Create a Clean Air Sanctuary:** Isolate one bedroom with sealed windows and continuous HEPA filtration.
4. 😷 **Mandatory Certified N95 Protection:** Cloth masks do not filter fine ${dominantPollutant}. Wear only certified N95/FFP2 masks if transit is unavoidable.
5. 🚨 **Red Flag Symptoms:** Immediate medical consultation required if you experience chest tightness, wheezing, palpitations, or acute shortness of breath.`;
  }

  // 3. STANDARD CITIZEN (Default)
  if (lang === 'hi') {
    return `📢 **नागरिक वायु गुणवत्ता दैनिक बुलेटिन**

📊 **आज का शहर औसत AQI:** ${avgAqi} - **${band.category}**
प्रमुख प्रदूषक: **${dominantPollutant}** | स्वास्थ्य प्रभाव: ${band.healthRisk}
${topHotspot ? `⚠️ **सर्वाधिक प्रदूषित क्षेत्र (हॉटस्पॉट):** ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

✅ **नागरिकों के लिए अनुशंसित कदम:**
- 🚴 **खुले में भारी व्यायाम कम करें:** पार्क में दौड़ने और साइकिल चलाने का समय कम करें।
- 🚗 **सार्वजनिक परिवहन अपनाएं:** मेट्रो, बस या कारपूल का उपयोग करें; ट्रैफिक सिग्नल पर इंजन बंद करें।
- 🚫 **खुले में कचरा न जलाएं:** पत्तियां या कचरा जलाने की घटना देखते ही नगर निगम ऐप पर रिपोर्ट करें।
- 🌿 **पौधों पर पानी का छिड़काव:** बालकनी और बगीचे के पौधों पर हल्का पानी छिड़कें ताकि उड़ती धूल कम हो।`;
  }

  if (lang === 'bn') {
    return `📢 **দৈনিক নাগরিক বায়ু মান বুলেটিন**

📊 **আজ শহরের সার্বিক AQI:** ${avgAqi} - **${band.category}**
প্রধান দূষণকারী: **${dominantPollutant}** | স্বাস্থ্য ঝুঁকি: ${band.healthRisk}
${topHotspot ? `⚠️ **সবচেয়ে বেশি দূষিত এলাকা:** ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

✅ **নাগরিকদের জন্য প্রয়োজনীয় পরামর্শ:**
- 🚴 **বাইরে শরীরচর্চা নিয়ন্ত্রণ করুন:** ভোরবেলা বা ব্যস্ত রাস্তায় অতিরিক্ত ব্যায়াম পরিহার করুন।
- 🚗 **গণপরিবহন ব্যবহার করুন:** ব্যক্তিগত গাড়ির পরিবর্তে বাস ও মেট্রো বেছে নিন।
- 🚫 **বর্জ্য পোড়ানো নিষিদ্ধ:** কোথাও প্লাস্টিক বা আবর্জনা পোড়াতে দেখলে স্থানীয় পুরসভায় খবর দিন।
- 🌿 **গাছপালায় জল দিন:** বাড়ির বারান্দা ও চারপাশের ধূলিকণা কমাতে গাছে হালকা জল ছিটিয়ে দিন।`;
  }

  if (lang === 'ta') {
    return `📢 **தினசரி குடிமக்கள் காற்று தர அறிக்கை**

📊 **நகரத்தின் சராசரி AQI:** ${avgAqi} - **${band.category}**
முதன்மை மாசுபடுத்தி: **${dominantPollutant}** | சுகாதார தாக்கம்: ${band.healthRisk}
${topHotspot ? `⚠️ **அதிக மாசுபாடு உள்ள பகுதி:** ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

✅ **பொதுமக்கள் செய்ய வேண்டியவை:**
- 🚴 **வெளிப்புற உடற்பயிற்சிகளைக் குறைக்கவும்:** காலை மற்றும் மாலை நேரங்களில் கடுமையான உடற்பயிற்சிகளைத் தவிர்க்கவும்.
- 🚗 **பொதுப் போக்குவரத்தைப் பயன்படுத்துங்கள்:** தனிப்பட்ட வாகன பயன்பாட்டைக் குறைக்கவும்.
- 🚫 **குப்பைகளை எரிக்காதீர்கள்:** பிளாஸ்டிக் அல்லது உலர் இலைகளை திறந்த வெளியில் எரிக்க வேண்டாம்.
- 😷 **முகக்கவசம் அணியுங்கள்:** குறிப்பாக குழந்தைகள் மற்றும் முதியவர்கள் வெளியில் செல்லும் போது மாஸ்க் அணியவும்.`;
  }

  if (lang === 'mr') {
    return `📢 **दैनिक नागरी हवा गुणवत्ता बुलेटिन**

📊 **शहराचा सरासरी AQI:** ${avgAqi} - **${band.category}**
मुख्य प्रदूषक: **${dominantPollutant}** | आरोग्य जोखीम: ${band.healthRisk}
${topHotspot ? `⚠️ **सर्वाधिक प्रदूषित परिसर (हॉटस्पॉट):** ${topHotspot.ward} (AQI: ${topHotspot.aqi})` : ''}

✅ **नागरिकांसाठी मार्गदर्शक सूचना:**
- 🚴 **बाहेर व्यायाम करणे मर्यादित ठेवा:** जास्त प्रदूषण असलेल्या वेळेत मैदानी धावणे टाळा.
- 🚗 **सार्वजनिक वाहतुकीचा वापर करा:** सिग्नलवर वाहनांचे इंजिन बंद ठेवा.
- 🚫 **कचरा जाळण्यास सक्त मनाई:** उघड्यावर कचरा किंवा पाने जाळू नका.
- 😷 **मास्कचा वापर करा:** गर्दीच्या आणि प्रदूषित ठिकाणी जाताना N95 मास्क वापरा.`;
  }

  if (lang === 'es') {
    return `📢 **Boletín Cívico Diario de Calidad del Aire**

📊 **Índice Promedio de la Ciudad (ICA):** ${avgAqi} - **${band.category}**
Contaminante principal: **${dominantPollutant}** | Riesgo para la salud: ${band.healthRisk}
${topHotspot ? `⚠️ **Zona crítica más afectada:** ${topHotspot.ward} (ICA: ${topHotspot.aqi})` : ''}

✅ **Recomendaciones para la Ciudadanía:**
- 🚴 **Moderar actividades al aire libre:** Evite ejercicios intensos durante las horas pico de tráfico.
- 🚗 **Priorizar el transporte colectivo:** Reduzca los viajes en vehículos particulares y apague el motor en semáforos prolongados.
- 🚫 **Tolerancia cero a quemas:** Prohibido quemar residuos, hojas secas o basura en espacios abiertos.
- 😷 **Uso de mascarilla protectora:** Personas sensibles deben utilizar mascarilla N95 al transitar cerca de avenidas con alta congestión.`;
  }

  // Default English Standard
  return `📢 **DAILY CIVIC AIR QUALITY BRIEFING & ADVISORY**

📊 **Citywide Average AQI:** ${avgAqi} — **${band.category.toUpperCase()}**
Dominant Particulate Threat: **${dominantPollutant}** | Exposure Assessment: ${band.healthRisk}
${topHotspot ? `⚠️ **Primary Critical Hotspot:** ${topHotspot.ward} (Station: ${topHotspot.stationId} | AQI: ${topHotspot.aqi} - ${topHotspot.band.category})` : ''}

✅ **Key Recommended Citizen Interventions:**
- 🚴 **Calibrate Outdoor Exercise:** Reschedule strenuous aerobic workouts (running, cycling) from early morning peak inversion to mid-afternoon hours.
- 🚗 **Transit Decarbonization:** Shift commuting to mass rapid transit (Metro/Electric Bus) and observe zero-idling at signal junctions.
- 🚫 **Report Open Combustion:** Prohibit open leaf or refuse burning. Promptly report incidents to the Municipal 24x7 Control Room.
- 🌿 **Vegetation Wetting:** Wet private balconies and compound foliage to entrap settleable suspended dust.
- 😷 **Protective Masks:** Vulnerable family members should utilize certified N95 masks when navigating congested roadways.`;
}
