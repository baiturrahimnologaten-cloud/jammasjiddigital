/**
 * Client-side Controller for the Admin Dashboard (admin.html).
 * Manages form binding, uploads (logo, QRIS, photos), announcements, and local/cloud persistence.
 */

// Local copy of configurations to edit
let localData = null;
let currentTheme = 'light';

document.addEventListener("DOMContentLoaded", () => {
  // 1. Fetch current data
  localData = JSON.parse(JSON.stringify(window.dataStore.getData()));

  // 2. Initialize theme (visible regardless of login state)
  initTheme();

  // 3. Verify Admin login session
  verifyAdminSession();
});

function verifyAdminSession() {
  const overlay = document.getElementById("overlay-login");
  const isLogged = sessionStorage.getItem("admin_logged_in") === "true";
  
  if (isLogged) {
    overlay.style.display = "none";
    initDashboard();
  } else {
    overlay.style.display = "flex";
    
    // Bind current logo to login overlay
    if (localData && localData.logoUrl) {
      document.getElementById("login-logo-img").src = localData.logoUrl;
    }
    
    const inputPass = document.getElementById("txt-login-password");
    const btnSubmit = document.getElementById("btn-submit-login");
    const lblError = document.getElementById("lbl-login-error");
    
    const handleLogin = () => {
      const entered = inputPass.value;
      const actualPassword = localData.adminPassword || "admin123";
      if (entered === actualPassword) {
        sessionStorage.setItem("admin_logged_in", "true");
        overlay.style.display = "none";
        lblError.style.display = "none";
        initDashboard();
      } else {
        lblError.style.display = "block";
        inputPass.value = "";
        inputPass.focus();
      }
    };
    
    btnSubmit.addEventListener("click", handleLogin);
    inputPass.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    });
    inputPass.focus();
  }
}

function initDashboard() {
  // Initialize UI binds
  initTabNavigation();
  initFormValues();
  initSliders();
  initPhotoGrid();
  initMarqueeList();
  initUploadListeners();
  initLocationDetector();

  // Register Global Save Event
  document.getElementById("btn-save-global").addEventListener("click", saveAllChanges);
  
  // Register Logout Event
  document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("admin_logged_in");
    window.location.reload();
  });

  // Register Test Alarm Event (Adzan - 5x)
  const btnTestAdzan = document.getElementById("btn-test-adzan");
  if (btnTestAdzan) {
    btnTestAdzan.addEventListener("click", () => {
      const selectedTone = document.getElementById("val-adzan-tone").value;
      playBuzzerTone(selectedTone, 5);
    });
  }

  // Register Test Alarm Event (Iqomah - 3x)
  const btnTestIqomah = document.getElementById("btn-test-iqomah");
  if (btnTestIqomah) {
    btnTestIqomah.addEventListener("click", () => {
      const selectedTone = document.getElementById("val-iqomah-tone").value;
      playBuzzerTone(selectedTone, 3);
    });
  }
}

/**
 * Tab Navigation Controller
 */
function initTabNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const tabTitle = document.getElementById("tab-title");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      const targetTab = item.getAttribute("data-tab");
      
      // Deactivate all
      navItems.forEach(nav => nav.classList.remove("active"));
      tabContents.forEach(tab => tab.classList.remove("active"));

      // Activate clicked
      item.classList.add("active");
      document.getElementById(targetTab).classList.add("show", "active");

      // Update heading text
      tabTitle.innerText = item.innerText.trim();
    });
  });
}

/**
 * Initialize Input values from localData
 */
function initFormValues() {
  if (!localData) return;

  // General Tab
  document.getElementById("txt-mosque-name").value = localData.mosqueName;
  document.getElementById("txt-mosque-address").value = localData.mosqueAddress;
  document.getElementById("txt-admin-password").value = localData.adminPassword || "admin123";
  document.getElementById("val-hijri-offset").value = localData.hijriOffset;
  document.getElementById("val-hijri-offset-label").innerText = `${localData.hijriOffset} Hari`;
  document.getElementById("num-latitude").value = localData.latitude;
  document.getElementById("num-longitude").value = localData.longitude;
  document.getElementById("sel-timezone").value = localData.timezone;

  // Finances Tab
  document.getElementById("num-balance").value = localData.infaqBalance;
  document.getElementById("num-income").value = localData.infaqIncome;
  document.getElementById("num-expense").value = localData.infaqExpense;

  // Set default previews
  document.getElementById("img-logo-preview").src = localData.logoUrl;
  document.getElementById("img-qris-preview").src = localData.qrisUrl;

  // Iqomah Sliders
  const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  prayers.forEach(p => {
    const val = localData.iqomah[p] || 0;
    document.getElementById(`val-iqomah-${p}`).value = val;
    document.getElementById(`val-iqomah-${p}-label`).innerText = `${val} Menit`;
  });

  // Display timers
  document.getElementById("val-duration-adzan").value = localData.adzanDuration;
  document.getElementById("val-duration-adzan-label").innerText = `${localData.adzanDuration} Menit`;
  
  document.getElementById("val-duration-sholat").value = localData.sholatDuration;
  document.getElementById("val-duration-sholat-label").innerText = `${localData.sholatDuration} Menit`;

  // Alarm Tones
  document.getElementById("val-adzan-tone").value = localData.adzanTone || "adzan_long";
  document.getElementById("val-iqomah-tone").value = localData.iqomahTone || "double_beep";

  // Offsets
  document.getElementById("num-offset-subuh").value = localData.offsets.subuh || 0;
  document.getElementById("num-offset-syuruq").value = localData.offsets.syuruq || 0;
  document.getElementById("num-offset-dzuhur").value = localData.offsets.dzuhur || 0;
  document.getElementById("num-offset-ashar").value = localData.offsets.ashar || 0;
  document.getElementById("num-offset-maghrib").value = localData.offsets.maghrib || 0;
  document.getElementById("num-offset-isya").value = localData.offsets.isya || 0;

  // Firebase Tab
  document.getElementById("chk-firebase-enable").checked = localData.firebase.enabled;
  document.getElementById("txt-fb-apikey").value = localData.firebase.apiKey || "";
  document.getElementById("txt-fb-authdomain").value = localData.firebase.authDomain || "";
  document.getElementById("txt-fb-projectid").value = localData.firebase.projectId || "";
  document.getElementById("txt-fb-storagebucket").value = localData.firebase.storageBucket || "";
  document.getElementById("txt-fb-senderid").value = localData.firebase.messagingSenderId || "";
  document.getElementById("txt-fb-appid").value = localData.firebase.appId || "";

  toggleFirebaseFields(localData.firebase.enabled);
}

/**
 * Handle Range Sliders interactive labels
 */
function initSliders() {
  // Helper slider hook
  const setupSliderLabel = (sliderId, labelId, suffix = "Menit") => {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (slider && label) {
      slider.addEventListener("input", (e) => {
        label.innerText = `${e.target.value} ${suffix}`;
      });
    }
  };

  setupSliderLabel("val-hijri-offset", "val-hijri-offset-label", "Hari");
  setupSliderLabel("val-duration-adzan", "val-duration-adzan-label", "Menit");
  setupSliderLabel("val-duration-sholat", "val-duration-sholat-label", "Menit");

  const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  prayers.forEach(p => {
    setupSliderLabel(`val-iqomah-${p}`, `val-iqomah-${p}-label`, "Menit");
  });

  // Firebase slider toggle display
  const fbToggle = document.getElementById("chk-firebase-enable");
  fbToggle.addEventListener("change", (e) => {
    toggleFirebaseFields(e.target.checked);
  });
}

function toggleFirebaseFields(isEnabled) {
  const fields = document.getElementById("firebase-config-fields");
  if (isEnabled) {
    fields.style.opacity = "1";
    fields.style.pointerEvents = "auto";
  } else {
    fields.style.opacity = "0.4";
    fields.style.pointerEvents = "none";
  }
}

/**
 * GPS Locator trigger
 */
function initLocationDetector() {
  const btn = document.getElementById("btn-detect-gps");
  btn.addEventListener("click", () => {
    if ("geolocation" in navigator) {
      btn.innerText = "Mendeteksi...";
      btn.disabled = true;
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          document.getElementById("num-latitude").value = position.coords.latitude.toFixed(6);
          document.getElementById("num-longitude").value = position.coords.longitude.toFixed(6);
          btn.innerHTML = `
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            GPS Terdeteksi!
          `;
          setTimeout(() => {
            btn.innerHTML = `
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Deteksi Lokasi GPS
            `;
            btn.disabled = false;
          }, 3000);
        },
        (error) => {
          console.error("GPS detection error", error);
          alert("Gagal mendeteksi lokasi GPS. Pastikan izin lokasi aktif atau isi koordinat secara manual.");
          btn.innerText = "Deteksi Lokasi GPS";
          btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      alert("Fitur Geolocation tidak didukung di browser ini.");
    }
  });
}

/**
 * Image Upload Listeners (Logo, QRIS, & Activities Photos)
 */
function initUploadListeners() {
  // 1. Logo Upload
  document.getElementById("file-logo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image before saving (maxWidth = 300 for logos)
        const compressedBase64 = await window.dataStore.compressImage(file, 300, 0.8);
        localData.logoUrl = compressedBase64;
        document.getElementById("img-logo-preview").src = compressedBase64;
        document.getElementById("sidebar-logo").src = compressedBase64;
      } catch (err) {
        alert("Gagal memproses gambar logo.");
      }
    }
  });

  // 2. QRIS Upload
  document.getElementById("file-qris").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image (maxWidth = 600 for QR codes)
        const compressedBase64 = await window.dataStore.compressImage(file, 600, 0.9);
        localData.qrisUrl = compressedBase64;
        document.getElementById("img-qris-preview").src = compressedBase64;
      } catch (err) {
        alert("Gagal memproses gambar QRIS.");
      }
    }
  });

  // 3. Activity Photos Upload
  document.getElementById("file-activity").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const captionInput = document.getElementById("txt-photo-caption");
    const caption = captionInput.value.trim() || "Dokumentasi Kegiatan Masjid";
    
    if (file) {
      try {
        // Compress activity photo (maxWidth = 800 for TV display resolution)
        const compressedBase64 = await window.dataStore.compressImage(file, 800, 0.7);
        
        // Add new photo item to local data list
        const newPhoto = {
          id: Date.now().toString(),
          url: compressedBase64,
          caption: caption
        };
        
        localData.photos.push(newPhoto);
        
        // Clear input caption, refresh preview cards
        captionInput.value = "";
        initPhotoGrid();
      } catch (err) {
        console.error(err);
        alert("Gagal mengunggah gambar kegiatan. Pastikan ukuran file wajar.");
      }
    }
  });
}

/**
 * Render Photos Grid
 */
function initPhotoGrid() {
  const container = document.getElementById("container-photo-grid");
  if (!container || !localData) return;

  container.innerHTML = "";

  if (localData.photos.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">
        Belum ada foto kegiatan. Silakan pilih foto di atas untuk diunggah.
      </div>
    `;
    return;
  }

  localData.photos.forEach(photo => {
    const card = document.createElement("div");
    card.className = "photo-card";
    
    card.innerHTML = `
      <img src="${photo.url}" alt="Foto Kegiatan">
      <button class="delete-photo-btn" data-id="${photo.id}" title="Hapus Foto">&times;</button>
      <div class="photo-card-body">
        <input type="text" class="photo-caption-input" value="${photo.caption || ''}" placeholder="Tulis deskripsi..." data-id="${photo.id}">
      </div>
    `;
    
    // Bind Delete action
    card.querySelector(".delete-photo-btn").addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      localData.photos = localData.photos.filter(p => p.id !== id);
      initPhotoGrid();
    });

    // Bind Caption update on text input change
    card.querySelector(".photo-caption-input").addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-id");
      const matchedPhoto = localData.photos.find(p => p.id === id);
      if (matchedPhoto) {
        matchedPhoto.caption = e.target.value.trim();
      }
    });

    container.appendChild(card);
  });
}

/**
 * Marquee announcements editor logic (Tab 5)
 */
function initMarqueeList() {
  const container = document.getElementById("container-marquee-list");
  const newMarqueeInput = document.getElementById("txt-new-marquee");
  const btnAdd = document.getElementById("btn-add-marquee");

  const renderMarquees = () => {
    container.innerHTML = "";
    if (localData.runningTexts.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.95rem; text-align: center; padding: 15px;">Belum ada teks pengumuman. Tambahkan di bawah.</p>`;
      return;
    }

    localData.runningTexts.forEach((text, index) => {
      const row = document.createElement("div");
      row.className = "running-text-item";
      
      row.innerHTML = `
        <span class="running-text-val">${text}</span>
        <div class="text-action-btns">
          <button class="icon-btn danger btn-delete-text" data-index="${index}" title="Hapus Pengumuman">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `;
      
      row.querySelector(".btn-delete-text").addEventListener("click", () => {
        localData.runningTexts.splice(index, 1);
        renderMarquees();
      });

      container.appendChild(row);
    });
  };

  // Add marquee action
  btnAdd.addEventListener("click", () => {
    const val = newMarqueeInput.value.trim();
    if (val) {
      localData.runningTexts.push(val);
      newMarqueeInput.value = "";
      renderMarquees();
    }
  });

  // Enable press Enter on text input
  newMarqueeInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') {
      btnAdd.click();
    }
  });

  renderMarquees();
}

/**
 * Handle Theme Light/Dark styling
 */
function initTheme() {
  const btn = document.getElementById("btn-theme-toggle");
  const icon = document.getElementById("theme-icon");

  // Load from local storage
  currentTheme = localStorage.getItem("admin_theme") || "light";
  document.body.setAttribute("data-theme", currentTheme);
  updateThemeIcon();

  btn.addEventListener("click", () => {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    document.body.setAttribute("data-theme", currentTheme);
    localStorage.setItem("admin_theme", currentTheme);
    updateThemeIcon();
  });
}

function updateThemeIcon() {
  const icon = document.getElementById("theme-icon");
  if (currentTheme === "dark") {
    // Show Sun icon
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>`;
  } else {
    // Show Moon icon
    icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>`;
  }
}

/**
 * Gather all fields and commit to storage
 */
function saveAllChanges() {
  if (!localData) return;

  // General Tab
  localData.mosqueName = document.getElementById("txt-mosque-name").value.trim();
  localData.mosqueAddress = document.getElementById("txt-mosque-address").value.trim();
  localData.adminPassword = document.getElementById("txt-admin-password").value.trim() || "admin123";
  localData.hijriOffset = parseInt(document.getElementById("val-hijri-offset").value);
  localData.latitude = parseFloat(document.getElementById("num-latitude").value) || -7.7828;
  localData.longitude = parseFloat(document.getElementById("num-longitude").value) || 110.4011;
  localData.timezone = parseInt(document.getElementById("sel-timezone").value) || 7;

  // Finances Tab
  localData.infaqBalance = parseInt(document.getElementById("num-balance").value) || 0;
  localData.infaqIncome = parseInt(document.getElementById("num-income").value) || 0;
  localData.infaqExpense = parseInt(document.getElementById("num-expense").value) || 0;

  // Iqomah
  const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  prayers.forEach(p => {
    localData.iqomah[p] = parseInt(document.getElementById(`val-iqomah-${p}`).value);
  });

  // Display timers and alarm tones
  localData.adzanDuration = parseInt(document.getElementById("val-duration-adzan").value);
  localData.sholatDuration = parseInt(document.getElementById("val-duration-sholat").value);
  localData.adzanTone = document.getElementById("val-adzan-tone").value;
  localData.iqomahTone = document.getElementById("val-iqomah-tone").value;

  // Offsets
  localData.offsets = {
    subuh: parseInt(document.getElementById("num-offset-subuh").value) || 0,
    syuruq: parseInt(document.getElementById("num-offset-syuruq").value) || 0,
    dzuhur: parseInt(document.getElementById("num-offset-dzuhur").value) || 0,
    ashar: parseInt(document.getElementById("num-offset-ashar").value) || 0,
    maghrib: parseInt(document.getElementById("num-offset-maghrib").value) || 0,
    isya: parseInt(document.getElementById("num-offset-isya").value) || 0
  };

  // Firebase
  localData.firebase.enabled = document.getElementById("chk-firebase-enable").checked;
  localData.firebase.apiKey = document.getElementById("txt-fb-apikey").value.trim();
  localData.firebase.authDomain = document.getElementById("txt-fb-authdomain").value.trim();
  localData.firebase.projectId = document.getElementById("txt-fb-projectid").value.trim();
  localData.firebase.storageBucket = document.getElementById("txt-fb-storagebucket").value.trim();
  localData.firebase.messagingSenderId = document.getElementById("txt-fb-senderid").value.trim();
  localData.firebase.appId = document.getElementById("txt-fb-appid").value.trim();

  // Commit changes to Unified Store (which writes to LocalStorage & optional Firebase database)
  window.dataStore.updateData(localData);

  // Show "Perubahan Disimpan" toast/indicator in header
  const indicator = document.getElementById("save-indicator");
  if (localData.firebase && localData.firebase.enabled) {
    indicator.innerText = "Perubahan disinkronkan ke Cloud & Lokal!";
    indicator.style.color = "#10b981"; // Success green color
  } else {
    indicator.innerText = "Perubahan disimpan secara lokal!";
    indicator.style.color = ""; // Default style color
  }
  indicator.classList.add("show");
  
  setTimeout(() => {
    indicator.classList.remove("show");
  }, 3500);
}

/**
 * Play selected buzzer sound in admin panel for testing (matches display.js)
 */
function playBuzzerTone(toneType, count = 3) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    
    if (toneType === "standard") {
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.value = 880;
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02); // Louder (0.9 volume)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55); // Longer (550ms beep)
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.55);
        }, delay);
        delay += 850;
      }
    } else if (toneType.startsWith("adzan_long")) {
      let beepDuration = 1.0;
      if (toneType === "adzan_long_15") beepDuration = 1.5;
      else if (toneType === "adzan_long_20") beepDuration = 2.0;
      
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.value = 800;
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.03); // Loud (0.9 volume)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beepDuration);
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + beepDuration);
        }, delay);
        delay += (beepDuration + 0.5) * 1000;
      }
    } else if (toneType === "bell") {
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const oscHarmonic = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          oscHarmonic.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.value = 523.25;
          
          oscHarmonic.type = 'sine';
          oscHarmonic.frequency.value = 783.99;
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
          
          osc.start(ctx.currentTime);
          oscHarmonic.start(ctx.currentTime);
          
          osc.stop(ctx.currentTime + 1.2);
          oscHarmonic.stop(ctx.currentTime + 1.2);
        }, delay);
        delay += 1400;
      }
    } else if (toneType === "chime") {
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.type = 'sine';
          osc1.frequency.value = 659.25;
          
          gain1.gain.setValueAtTime(0, ctx.currentTime);
          gain1.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.05);
          gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
          
          osc1.start(ctx.currentTime);
          osc1.stop(ctx.currentTime + 0.7);
          
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            
            osc2.type = 'sine';
            osc2.frequency.value = 523.25;
            
            gain2.gain.setValueAtTime(0, ctx.currentTime);
            gain2.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
            
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.9);
          }, 450);
        }, delay);
        delay += 1400;
      }
    } else if (toneType === "double_beep") {
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          let innerDelay = 0;
          for (let j = 0; j < 2; j++) {
            setTimeout(() => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              osc.type = 'sine';
              osc.frequency.value = 1000;
              
              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.03);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
              
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.15);
            }, innerDelay);
            innerDelay += 180;
          }
        }, delay);
        delay += 500;
      }
    }
  } catch (err) {
    console.warn("Could not play sound: Web Audio API blocked or not supported", err);
  }
}
