// Software / firmware bill of materials for the AIM-9M Sidewinder assembly
// shown in the detail viewer. Components are illustrative — they represent
// the kind of subsystems a real guided air-to-air missile would carry.
export const AIM9M_SBOM = {
  weapon: "AIM-9M Sidewinder",
  ncage: "30883",
  buildId: "WGU-4B-9M / 2025.04",
  exportControl: "ITAR — Cat. IV(a)(2)",

  sections: [
    {
      id: "seeker",
      label: "Seeker Section",
      desc: "WGU-4B all-aspect IIR seeker, dome, gimbal, and signal processor.",
      color: "#ffb84a",
      components: [
        { name: "IR Seeker Detector Firmware", version: "3.2.1", vendor: "Raytheon Missile Systems", license: "Proprietary", hash: "0x8af3…0991" },
        { name: "Cryogenic Cooler Driver",     version: "1.4.0", vendor: "Thales DEFCON",            license: "Proprietary", hash: "0x12c1…7e22" },
        { name: "Gimbal Servo Control Loop",   version: "2.7.3", vendor: "Honeywell DAS",            license: "Proprietary", hash: "0x77a0…f314" },
        { name: "Target Discriminator NN",     version: "6.1.0", vendor: "USN NAWCWD CL-86",         license: "USG-RIGHTS",  hash: "0xc002…3b8b" },
      ],
    },
    {
      id: "guidance",
      label: "Guidance Computer",
      desc: "WGU-4A digital autopilot and proportional-navigation kernel.",
      color: "#ffd870",
      components: [
        { name: "Flight Control RTOS",         version: "VxWorks 6.9-RT", vendor: "Wind River",            license: "Commercial", hash: "0x45d6…1aa9" },
        { name: "Autopilot Kernel",            version: "5.0.2",          vendor: "Lockheed Martin MFC",   license: "Proprietary", hash: "0x9119…44c3" },
        { name: "Proportional Nav Lib",        version: "1.18.0",         vendor: "USAF AFRL/RW",          license: "USG-RIGHTS",  hash: "0xab21…7d11" },
        { name: "BIT / POST ROM",              version: "1.8.2",          vendor: "Raytheon Missile Systems", license: "Proprietary", hash: "0xee04…0c22" },
      ],
    },
    {
      id: "warhead",
      label: "Warhead Section",
      desc: "WDU-17 annular blast-frag with DSU-15 active optical target detector.",
      color: "#ff6a3d",
      components: [
        { name: "DSU-15B Fuze Logic",          version: "3.0.7", vendor: "Raytheon Missile Systems", license: "Proprietary", hash: "0x52a1…d8b4" },
        { name: "Safe-Arm Sequencer FW",       version: "2.1.0", vendor: "Kilgore Flares",           license: "Proprietary", hash: "0x0f30…4af0" },
        { name: "Proximity Filter DSP",        version: "1.6.4", vendor: "Texas Instruments DSP",    license: "Proprietary", hash: "0x71b8…3e07" },
      ],
    },
    {
      id: "motor",
      label: "Rocket Motor",
      desc: "Mk 36 Mod 9 single-stage solid-propellant rocket motor.",
      color: "#7eb8ff",
      components: [
        { name: "Ignition Squib Driver",       version: "1.2.1", vendor: "Aerojet Rocketdyne",  license: "Proprietary", hash: "0x3c44…8e76" },
        { name: "Burn-rate Telemetry FW",      version: "0.9.3", vendor: "Aerojet Rocketdyne",  license: "Proprietary", hash: "0xb20d…1124" },
      ],
    },
    {
      id: "control",
      label: "Control Section",
      desc: "Roll-stabilising canard actuators and pneumatic gas generator.",
      color: "#45ff8c",
      components: [
        { name: "Canard Servo Controller",     version: "4.0.5", vendor: "Moog Aerospace",     license: "Proprietary", hash: "0x6611…0fda" },
        { name: "Battery Activation Driver",   version: "1.2.0", vendor: "Eaglepicher",        license: "Proprietary", hash: "0xa099…2210" },
        { name: "Hot-Gas Generator Controller",version: "2.0.1", vendor: "Aerojet Rocketdyne", license: "Proprietary", hash: "0x05c7…ed35" },
      ],
    },
    {
      id: "fins",
      label: "Rolleron Tail Fins",
      desc: "Passive gyroscopic roll-stabilisation surfaces.",
      color: "#b58cff",
      components: [
        { name: "Tail Fin Telemetry Tag",      version: "1.0.0", vendor: "Honeywell DAS",      license: "Proprietary", hash: "0x10ab…cc02" },
      ],
    },
  ],
};
