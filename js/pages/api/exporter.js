// www/js/pages/api/exporter.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
  getDatabase, ref, get, set, push, update, remove, onValue, off, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyB1Z1rd67bYtsBrpEUkcOzYO9HzHrDmtnY",
  authDomain: "stanforis-iot.firebaseapp.com",
  databaseURL: "https://stanforis-iot-default-rtdb.firebaseio.com",
  projectId: "stanforis-iot",
  storageBucket: "stanforis-iot.appspot.com",
  messagingSenderId: "529674223964",
  appId: "1:529674223964:web:2068cf5eb34e6372864199",
  measurementId: "G-MBMF6KCJDF"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Create DB instance
const db = getDatabase(app);

// Export both the factory and the instance
export { 
  getDatabase, // ← add this
  db, ref, get, set, push, update, remove, onValue, off, serverTimestamp 
};
