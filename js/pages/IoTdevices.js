// www/js/pages/IoTdevices.js
document.addEventListener('page:ready:IoTdevices', () => {
  const tbody = document.getElementById('device-list-body');
  const searchInput = document.getElementById('device-search');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnAdd = document.getElementById('btn-add');

  const SETTINGS_KEY = "systemSettings";
  let systemSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

  // Demo devices (replace with apiCall.getDevices() in production)
  let devices = [
    { name:'ESP32 Cam', type:'Camera', ip:'192.168.1.101', mac:'AA:BB:CC:DD:EE:01', status:'online', lastSeen:'2025-08-21 12:45', lastToggle:0, sensors:{temp:26, humidity:50} },
    { name:'Door Sensor', type:'Sensor', ip:'192.168.1.102', mac:'AA:BB:CC:DD:EE:02', status:'offline', lastSeen:'2025-08-20 21:10', lastToggle:0, sensors:{temp:null, humidity:null} },
    { name:'Smart Plug', type:'Actuator', ip:'192.168.1.103', mac:'AA:BB:CC:DD:EE:03', status:'online', lastSeen:'2025-08-21 12:10', lastToggle:0, sensors:{temp:null, humidity:null} }
  ];

  // ---------------- Render Table ----------------
  const renderTable = () => {
    tbody.innerHTML = '';
    devices.forEach(dev => {
      const row = document.createElement('tr');
      const statusBadge = dev.status === 'online'
        ? `<span class="status online" title="Device is active and reachable">● Online</span>`
        : `<span class="status offline" title="Device is offline">● Offline</span>`;
      const sensorData = dev.sensors.temp !== null ? `🌡️ ${dev.sensors.temp}°C 💧 ${dev.sensors.humidity}%` : 'N/A';

      row.innerHTML = `
        <td>${dev.name}</td>
        <td>${dev.type}</td>
        <td>${dev.ip}</td>
        <td>${dev.mac}</td>
        <td>${statusBadge}</td>
        <td>${dev.lastSeen}</td>
        <td>${sensorData}</td>
        <td>
          <button class="btn-toggle">Toggle</button>
          <button class="btn-edit">Edit</button>
          <button class="btn-remove">Remove</button>
        </td>
      `;

      // Attach actions
      row.querySelector('.btn-toggle').addEventListener('click', () => toggleDevice(dev.mac));
      row.querySelector('.btn-edit').addEventListener('click', () => editDevice(dev.mac));
      row.querySelector('.btn-remove').addEventListener('click', () => removeDevice(dev.mac));

      tbody.appendChild(row);
    });
  };

  // ---------------- Search / Filter ----------------
  searchInput.addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('#device-list-body tr').forEach(row => {
      const [name, type, ip] = [0,1,2].map(i => row.cells[i].textContent.toLowerCase());
      row.style.display = (name.includes(query) || type.includes(query) || ip.includes(query)) ? '' : 'none';
    });
  });

  // ---------------- CRUD Functions ----------------
  const toggleDevice = (mac) => {
    const dev = devices.find(d => d.mac === mac);
    if(!dev) return;
    const now = Date.now();
    const relayCD = (systemSettings.iot?.relayCD || 5) * 1000;
    if(now - (dev.lastToggle || 0) < relayCD) {
      return alert(`⏱ Cooldown active! Wait ${Math.ceil((relayCD-(now-dev.lastToggle))/1000)}s`);
    }
    dev.status = dev.status === 'online' ? 'offline' : 'online';
    dev.lastSeen = new Date().toISOString().slice(0,16).replace('T',' ');
    dev.lastToggle = now;
    renderTable();
    if(window.apiCall) window.apiCall.updateDevice(dev.mac, dev);
  };

  const editDevice = (mac) => {
    const dev = devices.find(d => d.mac === mac);
    if(!dev) return;
    const newName = prompt("Edit device name:", dev.name);
    if(newName) dev.name = newName;
    renderTable();
  };

  const removeDevice = (mac) => {
    if(!confirm(`Remove device ${mac}?`)) return;
    devices = devices.filter(d => d.mac !== mac);
    renderTable();
  };

  const addNewDevice = () => {
    const name = prompt("Device Name:");
    const type = prompt("Device Type:");
    const ip = prompt("IP Address:");
    const mac = prompt("MAC Address:");
    if(!name || !type || !ip || !mac) return alert("All fields required!");
    devices.push({
      name, type, ip, mac, status:'online',
      lastSeen: new Date().toISOString().slice(0,16).replace('T',' '),
      lastToggle:0, sensors:{temp:0, humidity:0}
    });
    renderTable();
  };

  // ---------------- Attach Buttons ----------------
  btnRefresh.addEventListener('click', renderTable);
  btnAdd.addEventListener('click', addNewDevice);

  // ---------------- WebSocket ----------------
  let ws;
  const initWebSocket = () => {
    if(ws) ws.close();
    ws = new WebSocket('ws://localhost:8080'); // replace with your backend
    ws.onopen = () => console.log('WebSocket connected for live sensor data');
    ws.onclose = () => setTimeout(initWebSocket, 5000);
    ws.onmessage = e => {
      const data = JSON.parse(e.data); // {mac,temp,humidity,status}
      const dev = devices.find(d => d.mac === data.mac);
      if(dev){
        dev.sensors.temp = data.temp;
        dev.sensors.humidity = data.humidity;
        dev.status = data.status;
        dev.lastSeen = new Date().toISOString().slice(0,16).replace('T',' ');
        renderTable();
      }
    };
  };

  // ---------------- Initialize Page ----------------
  renderTable();
  initWebSocket();

  // Optional: clean up WS on page unload
  window.addEventListener('hashchange', () => { if(ws) ws.close(); });
});
