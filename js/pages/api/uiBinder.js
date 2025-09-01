
// uiBinder.js
import { dispatchAction, subscribeDeviceStatus, subscribeActionLog } from "./iotCore.js";

let currentAction = null;
let selectedGateAction = null;

// ----------------------------
// Control Configuration
// ----------------------------
const controlConfigs = {
  brightnessManager: { type: "range", min: 0, max: 100, default: 50, label: "Brightness" },
  speakerToggle: { type: "range", min: 0, max: 100, default: 70, label: "Volume" },
  gateControl: { type: "buttons", options: ["Open", "Close"], label: "Gate Control" },
  nightVision_Manager: { type: "toggle", label: "Night Vision" },
  homelights_ToggleControls: { type: "toggle", label: "Home Lights" },
  dimLights: { type: "range", min: 0, max: 100, default: 50, label: "Dim Lights" },
  micToggle: { type: "toggle", label: "Microphone" },
  videoRecord_Save: { type: "toggle", label: "Video Record" },
  snapshot_Save: { type: "toggle", label: "Snapshot" },
  zoomControl: { type: "range", min: 1, max: 10, default: 5, label: "Zoom Level" },
  cameraCycle: { type: "toggle", label: "Camera Cycle" },
  camera_ConfigurationManager: { type: "toggle", label: "Camera Config" },
  cameraSensors_TroubleShoot: { type: "toggle", label: "Camera Troubleshoot" },
  smokeSensor: { type: "toggle", label: "Smoke Sensor" },
  glassBreakSensor: { type: "toggle", label: "Glass Break Sensor" },
  panicButton: { type: "toggle", label: "Panic Button" },
  alarmTrigger: { type: "toggle", label: "Alarm Trigger" },
  unusualSoundDetectors: { type: "toggle", label: "Unusual Sound Detector" },
  securityMode: { type: "toggle", label: "Security Mode" },
  remote_EmergencyTrigger: { type: "toggle", label: "Remote Emergency" },
  ac_Monitor: { type: "toggle", label: "AC Monitor" },
  dc_Monitor: { type: "toggle", label: "DC Monitor" },
  powerRelays_Control: { type: "toggle", label: "Power Relays" },
  home_Electrical_Cirquit_Manager: { type: "toggle", label: "Electrical Manager" },
  curtainControl: { type: "toggle", label: "Curtain Control" },
  doorsRelayManager: { type: "toggle", label: "Doors Relay Manager" },
  sprinklers_Control_Toggles: { type: "toggle", label: "Sprinklers" },
  home_Envornment_Manager: { type: "toggle", label: "Environment Manager" },
  service_Toggle1: { type: "toggle", label: "Service 1" },
  service_Toggle2: { type: "toggle", label: "Service 2" },
  service_Toggle3: { type: "toggle", label: "Service 3" },
  service_Toggle4: { type: "toggle", label: "Service 4" },
  service_Toggle5: { type: "toggle", label: "Service 5" },
  service_Toggle6: { type: "toggle", label: "Service 6" },
  reminder: { type: "toggle", label: "Reminder" },
  data_stock: { type: "toggle", label: "Data Stock" },
  energySaver: { type: "toggle", label: "Energy Optimization" },
  iot_connection_level: { type: "toggle", label: "IoT Graph" },
  iotLogs: { type: "toggle", label: "IoT Logs" },
  default: { type: "none", label: "No Controls" }
};

// ----------------------------
// Side Rail Button Binder
// ----------------------------
export function bindSideRailButtons() {
  document.querySelectorAll(".leftrail-btn, .rightrail-btn").forEach(btn => {
    let tapTimeout = null;
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;

      if (btn.classList.contains("active")) {
        clearTimeout(tapTimeout);
        btn.classList.remove("active");
        openControlModal(action);
      } else {
        btn.classList.add("active");
        // Quick action dispatch
        dispatchAction(action);
        tapTimeout = setTimeout(() => btn.classList.remove("active"), 1500);
      }
    });
  });
}

// ----------------------------
// Control Modal Binder
// ----------------------------
function openControlModal(action) {
  currentAction = action;
  const config = controlConfigs[action] || controlConfigs.default;
  const panel = document.getElementById("controlPanel");
  const title = document.getElementById("panelTitle");
  const content = document.getElementById("panelContent");

  title.textContent = `Control: ${config.label}`;
  content.innerHTML = "";

  switch (config.type) {
    case "range":
      content.innerHTML = `
        <label class="block text-sm text-neutral-300">${config.label}</label>
        <input type="range" min="${config.min}" max="${config.max}" value="${config.default}" id="controlRange" class="w-full"/>
        <span id="rangeValue" class="text-sm text-emerald-400">${config.default}</span>
      `;
      const rangeInput = content.querySelector("#controlRange");
      rangeInput.addEventListener("input", () => {
        document.getElementById("rangeValue").textContent = rangeInput.value;
      });
      break;

    case "buttons":
      content.innerHTML = config.options.map(opt =>
        `<button class="w-full py-2 rounded-xl mb-2 ${opt === 'Open' ? 'bg-emerald-600' : 'bg-red-600'}">${opt}</button>`
      ).join('');
      content.querySelectorAll('button').forEach(btn =>
        btn.addEventListener('click', () => selectedGateAction = btn.innerText.toLowerCase())
      );
      break;

    case "toggle":
      content.innerHTML = `
        <label class="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" id="controlToggle"/> ${config.label}
        </label>`;
      break;

    default:
      content.innerHTML = `<p class="text-sm text-neutral-400">No extra controls, just confirm.</p>`;
  }

  panel.classList.remove("hidden");
  document.getElementById("closePanel").onclick = () => panel.classList.add("hidden");
}

// ----------------------------
// Confirm Modal Button
// ----------------------------
document.getElementById("panelConfirm").addEventListener("click", () => {
  let payload = {};
  const config = controlConfigs[currentAction] || controlConfigs.default;

  switch (config.type) {
    case "range":
      payload.value = parseInt(document.getElementById("controlRange").value);
      break;
    case "buttons":
      payload.state = selectedGateAction || "none";
      break;
    case "toggle":
      payload.state = document.getElementById("controlToggle")?.checked || false;
      break;
    default:
      payload.value = true;
  }

  dispatchAction(currentAction, payload);
  document.getElementById("controlPanel").classList.add("hidden");
});

// ----------------------------
// Detection / Recognition Buttons
// ----------------------------
export function bindDetectionRecognition() {
  document.querySelectorAll(".detection-btn").forEach(btn => {
    btn.addEventListener("click", () => dispatchAction(btn.dataset.action));
  });
}

// ----------------------------
// Timer / Schedule Controls
// ----------------------------
export function bindTimerControls() {
  document.getElementById("timerStart")?.addEventListener("click", () => dispatchAction("timerStart"));
  document.getElementById("timerPause")?.addEventListener("click", () => dispatchAction("timerPause"));
  document.getElementById("timerReset")?.addEventListener("click", () => dispatchAction("timerReset"));
}

// ----------------------------
// KPI Binding (with live DB integration)
// ----------------------------
export function bindKPI() {
  const kpiElements = document.querySelectorAll("[id^='kpi']");

  kpiElements.forEach(el => {
    const deviceId = el.dataset.device; // bind KPI to a deviceId
    if (deviceId) {
      subscribeDeviceStatus(deviceId, status => {
        el.textContent = status?.value ?? "--";
      });
    } else {
      el.textContent = "--";
    }
  });
}

// ----------------------------
// Action Log Binding (optional UI integration)
// ----------------------------
export function bindActionLog() {
  const logContainer = document.getElementById("actionLog");
  if (!logContainer) return;

  subscribeActionLog(logs => {
    logContainer.innerHTML = "";
    if (logs) {
      Object.values(logs).reverse().slice(0, 10).forEach(log => {
        const entry = document.createElement("div");
        entry.className = "text-xs text-neutral-400 border-b border-neutral-700 py-1";
        entry.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.type} → ${JSON.stringify(log.payload)}`;
        logContainer.appendChild(entry);
      });
    }
  });
}

// ----------------------------
// Auto-init
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
  bindSideRailButtons();
  bindDetectionRecognition();
  bindTimerControls();
  bindKPI();
  bindActionLog();
});

















// import { dispatchAction } from "./iotCore.js"; // Your API handler

// let currentAction = null;
// let selectedGateAction = null;

// // ----------------------------
// // Control Configuration
// // ----------------------------
// const controlConfigs = {
//   brightnessManager: { type: "range", min: 0, max: 100, default: 50, label: "Brightness" },
//   speakerToggle: { type: "range", min: 0, max: 100, default: 70, label: "Volume" },
//   gateControl: { type: "buttons", options: ["Open", "Close"], label: "Gate Control" },
//   nightVision_Manager: { type: "toggle", label: "Night Vision" },
//   homelights_ToggleControls: { type: "toggle", label: "Home Lights" },
//   dimLights: { type: "range", min: 0, max: 100, default: 50, label: "Dim Lights" },
//   micToggle: { type: "toggle", label: "Microphone" },
//   videoRecord_Save: { type: "toggle", label: "Video Record" },
//   snapshot_Save: { type: "toggle", label: "Snapshot" },
//   zoomControl: { type: "range", min: 1, max: 10, default: 5, label: "Zoom Level" },
//   cameraCycle: { type: "toggle", label: "Camera Cycle" },
//   camera_ConfigurationManager: { type: "toggle", label: "Camera Config" },
//   cameraSensors_TroubleShoot: { type: "toggle", label: "Camera Troubleshoot" },
//   smokeSensor: { type: "toggle", label: "Smoke Sensor" },
//   glassBreakSensor: { type: "toggle", label: "Glass Break Sensor" },
//   panicButton: { type: "toggle", label: "Panic Button" },
//   alarmTrigger: { type: "toggle", label: "Alarm Trigger" },
//   unusualSoundDetectors: { type: "toggle", label: "Unusual Sound Detector" },
//   securityMode: { type: "toggle", label: "Security Mode" },
//   remote_EmergencyTrigger: { type: "toggle", label: "Remote Emergency" },
//   ac_Monitor: { type: "toggle", label: "AC Monitor" },
//   dc_Monitor: { type: "toggle", label: "DC Monitor" },
//   powerRelays_Control: { type: "toggle", label: "Power Relays" },
//   home_Electrical_Cirquit_Manager: { type: "toggle", label: "Electrical Manager" },
//   curtainControl: { type: "toggle", label: "Curtain Control" },
//   doorsRelayManager: { type: "toggle", label: "Doors Relay Manager" },
//   sprinklers_Control_Toggles: { type: "toggle", label: "Sprinklers" },
//   home_Envornment_Manager: { type: "toggle", label: "Environment Manager" },
//   service_Toggle1: { type: "toggle", label: "Service 1" },
//   service_Toggle2: { type: "toggle", label: "Service 2" },
//   service_Toggle3: { type: "toggle", label: "Service 3" },
//   service_Toggle4: { type: "toggle", label: "Service 4" },
//   service_Toggle5: { type: "toggle", label: "Service 5" },
//   service_Toggle6: { type: "toggle", label: "Service 6" },
//   reminder: { type: "toggle", label: "Reminder" },
//   data_stock: { type: "toggle", label: "Data Stock" },
//   energySaver: { type: "toggle", label: "Energy Optimization" },
//   iot_connection_level: { type: "toggle", label: "IoT Graph" },
//   iotLogs: { type: "toggle", label: "IoT Logs" },
//   default: { type: "none", label: "No Controls" }
// };

// // ----------------------------
// // Side Rail Button Binder
// // ----------------------------
// export function bindSideRailButtons() {
//   document.querySelectorAll(".leftrail-btn, .rightrail-btn").forEach(btn => {
//     let tapTimeout = null;
//     btn.addEventListener("click", () => {
//       const action = btn.dataset.action;

//       if (btn.classList.contains("active")) {
//         clearTimeout(tapTimeout);
//         btn.classList.remove("active");
//         openControlModal(action);
//       } else {
//         btn.classList.add("active");
//         // First tap → quick action dispatch
//         dispatchAction(action);
//         tapTimeout = setTimeout(() => btn.classList.remove("active"), 2000);
//       }
//     });
//   });
// }

// // ----------------------------
// // Control Modal Binder
// // ----------------------------
// function openControlModal(action) {
//   currentAction = action;
//   const config = controlConfigs[action] || controlConfigs.default;
//   const panel = document.getElementById("controlPanel");
//   const title = document.getElementById("panelTitle");
//   const content = document.getElementById("panelContent");

//   title.textContent = `Control: ${config.label}`;
//   content.innerHTML = "";

//   switch (config.type) {
//     case "range":
//       content.innerHTML = `
//         <label class="block text-sm text-neutral-300">${config.label}</label>
//         <input type="range" min="${config.min}" max="${config.max}" value="${config.default}" id="controlRange" class="w-full"/>
//       `;
//       break;

//     case "buttons":
//       content.innerHTML = config.options.map(opt =>
//         `<button class="w-full py-2 rounded-xl mb-2 ${opt==='Open'?'bg-emerald-600':'bg-red-600'}">${opt}</button>`
//       ).join('');
//       content.querySelectorAll('button').forEach(btn =>
//         btn.addEventListener('click', () => selectedGateAction = btn.innerText.toLowerCase())
//       );
//       break;

//     case "toggle":
//       content.innerHTML = `<label class="block text-sm text-neutral-300">${config.label}</label>
//         <input type="checkbox" id="controlToggle" class="w-full"/>`;
//       break;

//     default:
//       content.innerHTML = `<p class="text-sm text-neutral-400">No extra controls, just confirm.</p>`;
//   }

//   panel.classList.remove("hidden");
//   document.getElementById("closePanel").onclick = () => panel.classList.add("hidden");
// }

// // ----------------------------
// // Confirm Modal Button
// // ----------------------------
// document.getElementById("panelConfirm").addEventListener("click", () => {
//   let payload = {};
//   const config = controlConfigs[currentAction] || controlConfigs.default;

//   switch (config.type) {
//     case "range":
//       payload.value = parseInt(document.getElementById("controlRange").value);
//       break;
//     case "buttons":
//       payload.state = selectedGateAction || "none";
//       break;
//     case "toggle":
//       payload.state = document.getElementById("controlToggle")?.checked || false;
//       break;
//     default:
//       payload.value = true;
//   }

//   dispatchAction(currentAction, payload);
//   document.getElementById("controlPanel").classList.add("hidden");
// });

// // ----------------------------
// // Detection / Recognition Buttons
// // ----------------------------
// export function bindDetectionRecognition() {
//   document.querySelectorAll(".detection-btn").forEach(btn => {
//     btn.addEventListener("click", () => dispatchAction(btn.dataset.action));
//   });
// }

// // ----------------------------
// // Timer / Schedule Controls
// // ----------------------------
// export function bindTimerControls() {
//   document.getElementById("timerStart")?.addEventListener("click", () => dispatchAction("timerStart"));
//   document.getElementById("timerPause")?.addEventListener("click", () => dispatchAction("timerPause"));
//   document.getElementById("timerReset")?.addEventListener("click", () => dispatchAction("timerReset"));
// }

// // ----------------------------
// // KPI Binding (DB integration placeholder)
// // ----------------------------
// export function bindKPI() {
//   const kpiElements = document.querySelectorAll("[id^='kpi']");
//   kpiElements.forEach(el => {
//     // Replace with real DB subscription
//     el.textContent = Math.floor(Math.random() * 100);
//   });
// }

// // ----------------------------
// // Auto-init
// // ----------------------------
// document.addEventListener("DOMContentLoaded", () => {
//   bindSideRailButtons();
//   bindDetectionRecognition();
//   bindTimerControls();
//   bindKPI();
// });
