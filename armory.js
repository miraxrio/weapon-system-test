// Per-weapon armory state: how many we have, broken down by status, plus a
// log of where each weapon has been fired (pilot, date, target coordinates).
// All values are illustrative / fictional — purely for the UI demo.
export const ARMORY = {
  "AIM-9 Sidewinder": {
    inventory: { storage: 142, ready: 32, maintenance: 6, needs: 4 },
    uses: [
      { pilot: "Maj. Erin Vasquez",   date: "2024-08-12", lat: 33.31,  lng: 43.78,  target: "Hostile MiG-29 intercept" },
      { pilot: "Capt. R. Kowalski",   date: "2024-09-03", lat: 36.19,  lng: 37.16,  target: "Threat aircraft, NFZ-2" },
      { pilot: "Lt. K. Tanaka",       date: "2024-11-21", lat: 31.78,  lng: 35.22,  target: "Drone swarm engagement" },
      { pilot: "Maj. Erin Vasquez",   date: "2025-02-04", lat: 26.22,  lng: 50.58,  target: "BDA confirmed, target down" },
    ],
  },
  "AIM-120 Amraam": {
    inventory: { storage: 88, ready: 24, maintenance: 4, needs: 3 },
    uses: [
      { pilot: "Col. D. Bertrand",    date: "2024-06-19", lat: 32.55,  lng: 44.42,  target: "BVR engagement, 3 kills" },
      { pilot: "Capt. R. Kowalski",   date: "2024-10-09", lat: 38.71,  lng: 26.94,  target: "ESCORT-2 sweep" },
      { pilot: "Lt. J. Singh",        date: "2025-01-14", lat: 41.02,  lng: 28.97,  target: "Inbound bomber pair" },
    ],
  },
  "AIM-132 Asraam": {
    inventory: { storage: 36, ready: 12, maintenance: 1, needs: 0 },
    uses: [
      { pilot: "Capt. H. Whitlock",   date: "2024-12-02", lat: 52.13,  lng: -1.31,  target: "Allied exercise WARRIOR" },
      { pilot: "Lt. F. Ngata",        date: "2025-03-22", lat: -25.27, lng: 130.84, target: "RAAF range trial" },
    ],
  },
  "AIM-54 Phoenix": {
    inventory: { storage: 8, ready: 2, maintenance: 1, needs: 1 },
    uses: [
      { pilot: "Cdr. M. Pasternak",   date: "1991-01-05", lat: 26.99,  lng: 50.10,  target: "Historic intercept, GULF" },
      { pilot: "Lt. F. Ngata",        date: "2024-04-17", lat: 22.40,  lng: 91.78,  target: "Long-range test fire" },
    ],
  },
  "KS-172 Novator": {
    inventory: { storage: 4, ready: 1, maintenance: 1, needs: 2 },
    uses: [
      { pilot: "Maj. A. Volkov",      date: "2023-11-11", lat: 55.75,  lng: 37.62,  target: "Test range, ZHUKOVSKY" },
    ],
  },
  "AGM-154 JSOW": {
    inventory: { storage: 54, ready: 18, maintenance: 3, needs: 2 },
    uses: [
      { pilot: "Maj. Erin Vasquez",   date: "2024-07-08", lat: 34.85,  lng: 39.22,  target: "Hardened depot strike" },
      { pilot: "Lt. K. Tanaka",       date: "2025-02-26", lat: 33.42,  lng: 36.59,  target: "Submunition pattern release" },
    ],
  },
  "GBU-24 Paveway": {
    inventory: { storage: 72, ready: 22, maintenance: 5, needs: 3 },
    uses: [
      { pilot: "Capt. R. Kowalski",   date: "2024-05-30", lat: 34.74,  lng: 43.97,  target: "Bunker complex, deep strike" },
      { pilot: "Col. D. Bertrand",    date: "2024-09-17", lat: 35.65,  lng: 41.18,  target: "Command node, BLU-109 fuze" },
      { pilot: "Maj. Erin Vasquez",   date: "2025-04-02", lat: 32.06,  lng: 44.36,  target: "Reinforced shelter, DMPI-3" },
    ],
  },
  "Mk83 bomb": {
    inventory: { storage: 320, ready: 96, maintenance: 8, needs: 6 },
    uses: [
      { pilot: "Lt. J. Singh",        date: "2024-08-29", lat: 33.10,  lng: 44.51,  target: "Convoy interdiction (8x salvo)" },
      { pilot: "Lt. K. Tanaka",       date: "2024-12-19", lat: 31.95,  lng: 35.93,  target: "Training range BULLSEYE-1" },
    ],
  },
  "MBDA Brimstone": {
    inventory: { storage: 64, ready: 16, maintenance: 2, needs: 1 },
    uses: [
      { pilot: "Capt. H. Whitlock",   date: "2024-10-25", lat: 36.30,  lng: 37.96,  target: "Mobile SAM hunt" },
      { pilot: "Lt. F. Ngata",        date: "2025-03-08", lat: 35.10,  lng: 43.16,  target: "T-72 column, dual SAL/mmW" },
    ],
  },
  "AGM65 Maverick": {
    inventory: { storage: 96, ready: 26, maintenance: 4, needs: 2 },
    uses: [
      { pilot: "Maj. Erin Vasquez",   date: "2024-03-12", lat: 33.41,  lng: 43.69,  target: "Hardened armor (WP-3)" },
      { pilot: "Col. D. Bertrand",    date: "2024-11-07", lat: 36.20,  lng: 43.99,  target: "Coastal patrol boat" },
      { pilot: "Lt. J. Singh",        date: "2025-01-29", lat: 25.20,  lng: 51.53,  target: "EO-guided precision shot" },
    ],
  },
};
