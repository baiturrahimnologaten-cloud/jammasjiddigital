/**
 * Unified Data Store for Jam Digital Masjid.
 * Manages LocalStorage and optional Firebase Real-time Cloud Synchronization.
 */
const STORAGE_KEY = 'masjid_digital_clock_data';

const DEFAULT_DATA = {
  adminPassword: "admin123",
  mosqueName: "Masjid Baiturrahim Nologaten",
  mosqueAddress: "Jl. Nologaten, Caturtunggal, Depok, Sleman, D.I. Yogyakarta",
  latitude: -7.7828,
  longitude: 110.4011,
  timezone: 7, // WIB (UTC+7)
  hijriOffset: 0,
  infaqBalance: 12500000,
  infaqIncome: 1850000,
  infaqExpense: 450000,
  qrisUrl: "assets/qris.png",
  logoUrl: "assets/logo.png",
  iqomah: {
    subuh: 10,
    dzuhur: 5,
    ashar: 5,
    maghrib: 5,
    isya: 7
  },
  sholatDuration: 15, // minutes of blank screen
  adzanDuration: 3, // minutes of adzan overlay
  adzanTone: "adzan_long", // Nada alarm saat masuk waktu adzan (5x)
  iqomahTone: "double_beep", // Nada alarm saat jeda iqomah selesai/sholat mulai (3x)
  offsets: {
    subuh: 2,
    syuruq: -1,
    dzuhur: 2,
    ashar: 2,
    maghrib: 2,
    isya: 2
  },
  runningTexts: [
    "Selamat Datang di Masjid Baiturrahim Nologaten. Harap meluruskan dan merapatkan shaf sholat.",
    "Bagi jamaah yang membawa handphone, mohon dinonaktifkan atau disenyapkan selama ibadah sholat berlangsung.",
    "Jumlah Infaq Jum'at yang lalu sebesar Rp 1.850.000,- Syukron Jazakumullah Khairan.",
    "Kajian Rutin Ahad Pagi dilaksanakan pukul 06.00 WIB bersama Ustadz Pengampu."
  ],
  photos: [
    { id: "1", url: "assets/photo1.png", caption: "Kajian Rutin Ba'da Maghrib Jamaah Masjid Baiturrahim" },
    { id: "2", url: "assets/photo2.png", caption: "Penyaluran Bantuan Sosial & Sembako Kepada Warga Sekitar" },
    { id: "3", url: "assets/photo3.png", caption: "Kerja Bakti Rutin Remaja Masjid Baiturrahim" }
  ],
  firebase: {
    enabled: false,
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  infaqTransactions: [
    { id: "tx_1", date: "2026-07-20", type: "income", amount: 1850000, description: "Kotak Infaq Jum'at Utama" },
    { id: "tx_2", date: "2026-07-18", type: "income", amount: 250000, description: "Infaq Donatur Kajian Ahad" },
    { id: "tx_3", date: "2026-07-15", type: "expense", amount: 350000, description: "Pembayaran Tagihan Listrik Masjid" },
    { id: "tx_4", date: "2026-07-12", type: "expense", amount: 100000, description: "Pembelian Air Mineral Galon Kajian" },
    { id: "tx_5", date: "2026-07-05", type: "income", amount: 12500000, description: "Saldo Awal Kas Masjid" }
  ]
};

class DataStore {
  constructor() {
    this.listeners = [];
    this.data = this.loadLocal();
    this.firebaseInitialized = false;
    this.firebaseUnsubscribe = null;

    // Listen to localStorage updates from other windows (real-time local sync)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.data = this.loadLocal();
        this.notifyListeners();
      }
    });

    // Initialize Firebase if configured
    this.initFirebase();
  }

  // Load from local storage with default fallback
  loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    let loadedData = null;
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
      loadedData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    } else {
      try {
        const parsed = JSON.parse(raw);
        // Merge with default to handle missing keys in future upgrades
        loadedData = { ...DEFAULT_DATA, ...parsed };
      } catch (e) {
        console.error("Error parsing local storage, resetting to default", e);
        loadedData = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    }

    // Force inject global Firebase config if defined in js/firebase-config.js
    if (window.firebaseConfig && window.firebaseConfig.projectId && window.firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
      loadedData.firebase = {
        enabled: true,
        ...window.firebaseConfig
      };
    }
    return loadedData;
  }

  // Save to local storage
  saveLocal(data) {
    // Sanitize data by converting to plain JSON to strip undefined values or custom prototypes
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Force inject Firebase configuration to local copy if valid config is present
    if (window.firebaseConfig && window.firebaseConfig.projectId && window.firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
      sanitized.firebase = {
        enabled: true,
        ...window.firebaseConfig
      };
    }
    this.data = sanitized;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    this.notifyListeners();
  }

  // Retrieve current data
  getData() {
    return this.data;
  }

  // Update data and sync (returns Promise to handle loading status in UI)
  async updateData(newData) {
    this.saveLocal(newData);
    
    // Sync to Firebase if enabled
    if (this.data.firebase && this.data.firebase.enabled && this.firebaseInitialized) {
      return this.syncToFirebase(newData);
    }
    return Promise.resolve();
  }

  // Register listener for real-time updates
  onUpdate(callback) {
    this.listeners.push(callback);
    // Initial call
    callback(this.data);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Aggregates and calculates financial summaries for a week, month, and year
   */
  getFinanceSummary(data = this.data) {
    const transactions = data.infaqTransactions || [];
    const now = new Date();
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    let weekIncome = 0;
    let weekExpense = 0;
    
    let monthIncome = 0;
    let monthExpense = 0;
    
    let yearIncome = 0;
    let yearExpense = 0;
    
    // Parse date safely ignoring timezone shifts
    const parseLocalDate = (dateStr) => {
      const parts = dateStr.split('-');
      return new Date(parts[0], parts[1] - 1, parts[2]);
    };
    
    const oneDay = 24 * 60 * 60 * 1000;
    
    transactions.forEach(tx => {
      const txDate = parseLocalDate(tx.date);
      // Reset hours to compare dates cleanly
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const txZeroDate = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
      
      const diffTime = todayDate - txZeroDate;
      const diffDays = Math.floor(diffTime / oneDay);
      
      // Weekly = last 7 days (including today)
      const isThisWeek = diffDays >= 0 && diffDays < 7;
      // Monthly = same calendar month and year
      const isThisMonth = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      // Yearly = same calendar year
      const isThisYear = txDate.getFullYear() === now.getFullYear();
      
      const amount = Number(tx.amount) || 0;
      
      if (tx.type === 'income') {
        totalIncome += amount;
        if (isThisWeek) weekIncome += amount;
        if (isThisMonth) monthIncome += amount;
        if (isThisYear) yearIncome += amount;
      } else {
        totalExpense += amount;
        if (isThisWeek) weekExpense += amount;
        if (isThisMonth) monthExpense += amount;
        if (isThisYear) yearExpense += amount;
      }
    });
    
    return {
      balance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      week: { income: weekIncome, expense: weekExpense },
      month: { income: monthIncome, expense: monthExpense },
      year: { income: yearIncome, expense: yearExpense }
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.data));
  }

  /**
   * Helper to compress images on upload to prevent exceeding localStorage/Firestore limits
   */
  compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if wider than maxWidth
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to PNG if original file is PNG to preserve transparency, otherwise JPEG
          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressedBase64 = outputFormat === 'image/png' 
            ? canvas.toDataURL('image/png') 
            : canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  /**
   * Initialize Firebase if configured
   */
  initFirebase() {
    const config = this.data.firebase;
    if (config && config.enabled && config.projectId) {
      if (typeof firebase !== 'undefined') {
        try {
          // If already initialized, we don't do it again
          if (firebase.apps.length === 0) {
            firebase.initializeApp(config);
          }
          this.firebaseInitialized = true;
          this.subscribeToFirebase();
          console.log("Firebase synced successfully");
        } catch (e) {
          console.error("Firebase init failed", e);
        }
      } else {
        console.warn("Firebase SDK not loaded yet. Make sure internet is connected.");
      }
    } else {
      // Disconnect Firebase listeners if active
      if (this.firebaseUnsubscribe) {
        this.firebaseUnsubscribe();
        this.firebaseUnsubscribe = null;
      }
      this.firebaseInitialized = false;
    }
  }

  // Subscribe to cloud changes
  subscribeToFirebase() {
    if (!this.firebaseInitialized) return;
    try {
      const db = firebase.firestore();
      this.firebaseUnsubscribe = db.collection('masjid').doc('config').onSnapshot((doc) => {
        if (doc.exists) {
          const cloudData = doc.data();
          
          // Compare data without the firebase configuration to avoid infinite loops
          const cleanLocal = { ...this.data };
          const cleanCloud = { ...cloudData };
          delete cleanLocal.firebase;
          delete cleanCloud.firebase;

          if (JSON.stringify(cleanCloud) !== JSON.stringify(cleanLocal)) {
            console.log("Received data updates from Firebase Cloud");
            this.saveLocal({ ...this.data, ...cloudData });
          }
        } else {
          // Document doesn't exist, create it in cloud with local data
          this.syncToFirebase(this.data);
        }
      }, (error) => {
        console.error("Firestore listener error", error);
      });
    } catch (e) {
      console.error("Firebase subscription error", e);
    }
  }

  // Upload/Sync data to Firebase (returns Promise)
  syncToFirebase(data) {
    if (!this.firebaseInitialized) return Promise.resolve();
    try {
      const db = firebase.firestore();
      // Sanitize data by converting to plain JSON to strip undefined values or custom prototypes
      const sanitized = JSON.parse(JSON.stringify(data));
      return db.collection('masjid').doc('config').set(sanitized)
        .then(() => {
          console.log("Cloud database synchronized");
        })
        .catch(err => {
          console.error("Cloud database synchronization failed", err);
          throw err;
        });
    } catch (e) {
      console.error("Firebase sync error", e);
      return Promise.reject(e);
    }
  }
}

// Bind instance to window
window.dataStore = new DataStore();
