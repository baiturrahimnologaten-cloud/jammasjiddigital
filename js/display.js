/**
 * Client-side Controller for the Main TV Display (index.html).
 * Manages clocks, prayer calculations, slideshows, and the interactive adzan/iqomah/sholat state machine.
 */

// Global State Variables
let config = null;
let prayerTimes = null;
let currentHijriDate = null;
let prayerCalc = new PrayerCalculator();

// State Machine Variables
let currentState = 'NORMAL'; // NORMAL, ADZAN, IQOMAH, SHOLAT
let activePrayer = null;     // 'subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'
let stateCountdownSeconds = 0;
let lastStateTickTime = Date.now();

// Media Carousel Variables
let slideIndex = 0;
let slideInterval = null;

// Audio context helper for beep alert (Web Audio API)
let audioPlayedForCurrentState = false;

// Helpers: convert time string "HH:MM" to seconds from midnight
function timeToSeconds(timeStr) {
  if (!timeStr || timeStr === '--:--') return -1;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 3600 + minutes * 60;
}

// Helpers: convert seconds to "HH:MM:SS" or "MM:SS"
function formatDuration(totalSeconds, includeHours = true) {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (includeHours && hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Sound buzzer tones (Web Audio API)
function playBuzzer(overrideTone = null, count = 3) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    
    // Use override tone (e.g. for testing/fixed events) or fall back to global config
    const toneType = overrideTone || (config && config.alarmTone) || "standard";
    
    if (toneType === "standard") {
      // Standard Beep 5x or 3x (longer & louder: 550ms beep, 0.9 gain)
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.value = 880; // Pitch A5
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02); // Louder (0.9 volume)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55); // Longer (550ms duration)
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.55);
        }, delay);
        delay += 850; // Jeda 300ms antar bip
      }
    } else if (toneType.startsWith("adzan_long")) {
      // Dynamic Long Beep (supports adzan_long: 1.0s, adzan_long_15: 1.5s, adzan_long_20: 2.0s)
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
          osc.frequency.value = 800; // Warm pitch
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.03); // Loud (0.9 volume)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beepDuration);
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + beepDuration);
        }, delay);
        delay += (beepDuration + 0.5) * 1000; // 0.5s pause after beep
      }
    } else if (toneType === "bell") {
      // Soft Resonant Bell Chime (Ding)
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
          osc.frequency.value = 523.25; // Pitch C5
          
          oscHarmonic.type = 'sine';
          oscHarmonic.frequency.value = 783.99; // Pitch G5 (overtone harmonic)
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02); // Louder
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2); // Longer decay
          
          osc.start(ctx.currentTime);
          oscHarmonic.start(ctx.currentTime);
          
          osc.stop(ctx.currentTime + 1.2);
          oscHarmonic.stop(ctx.currentTime + 1.2);
        }, delay);
        delay += 1400;
      }
    } else if (toneType === "chime") {
      // Modern Dual Chime (Ding-Dong)
      let delay = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          // Ding
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.type = 'sine';
          osc1.frequency.value = 659.25; // Pitch E5
          
          gain1.gain.setValueAtTime(0, ctx.currentTime);
          gain1.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.05); // Louder
          gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
          
          osc1.start(ctx.currentTime);
          osc1.stop(ctx.currentTime + 0.7);
          
          // Dong (delayed by 450ms)
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            
            osc2.type = 'sine';
            osc2.frequency.value = 523.25; // Pitch C5
            
            gain2.gain.setValueAtTime(0, ctx.currentTime);
            gain2.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 0.05); // Louder
            gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
            
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.9);
          }, 450);
        }, delay);
        delay += 1400;
      }
    } else if (toneType === "double_beep") {
      // Fast Double Beep
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
              gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.03); // Louder
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

/**
 * Main application initialization
 */
document.addEventListener("DOMContentLoaded", () => {
  // Subscribe to data updates from our Unified Data Store
  window.dataStore.onUpdate((newData) => {
    config = newData;
    renderStaticData();
    recalculateTimes();
    setupSlideshow();
    // Do a state sync on load / config update
    syncStateWithClock();
    
    // Auto-refresh transparency overlay if currently open
    const overlay = document.getElementById("overlay-recap");
    if (overlay && overlay.classList.contains("show")) {
      renderFinancialOverlay();
    }
  });

  // Start the 1-second system clock loop
  setInterval(tickClock, 1000);
  
  // Fast loop for overlay animations or smooth countdown ticks (every 100ms)
  setInterval(tickStateCountdown, 1000);

  // Fullscreen Toggle controller
  const fsBtn = document.getElementById("btn-fullscreen");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error("Error attempting to enable fullscreen", err);
        });
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        // Change to Exit Fullscreen icon
        fsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path></svg>`;
      } else {
        // Change to Enter Fullscreen icon
        fsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
    });
  }
  
  // Financial Recap Overlay Controller
  const btnShowRecap = document.getElementById("btn-show-recap");
  const btnCloseRecap = document.getElementById("btn-close-recap");
  const overlayRecap = document.getElementById("overlay-recap");
  
  if (btnShowRecap && btnCloseRecap && overlayRecap) {
    btnShowRecap.addEventListener("click", () => {
      renderFinancialOverlay();
      overlayRecap.classList.add("show");
    });
    
    const hideRecap = () => {
      overlayRecap.classList.remove("show");
    };
    
    btnCloseRecap.addEventListener("click", hideRecap);
    
    overlayRecap.addEventListener("click", (e) => {
      if (e.target === overlayRecap) {
        hideRecap();
      }
    });
  }
});

/**
 * Render details that don't change every second (Name, Address, Finances, Logo)
 */
function renderStaticData() {
  if (!config) return;

  // Mosque info
  document.getElementById("lbl-mosque-name").innerText = config.mosqueName;
  document.getElementById("lbl-mosque-address").innerText = config.mosqueAddress;

  // Financial info (automatically calculated from transactions)
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };
  const finSummary = window.dataStore.getFinanceSummary(config);
  document.getElementById("lbl-balance").innerText = formatRupiah(finSummary.balance);
  document.getElementById("lbl-income").innerText = formatRupiah(finSummary.week.income);
  document.getElementById("lbl-expense").innerText = formatRupiah(finSummary.week.expense);

  // Logo and QRIS images
  document.getElementById("masjid-logo-img").src = config.logoUrl;
  document.getElementById("qris-code-img").src = config.qrisUrl;

  // Running text announcement marquee (joined with custom dividers)
  const marqueeText = config.runningTexts.join(" &nbsp;&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;&nbsp; ");
  const marqueeEl = document.getElementById("txt-marquee");
  
  // Only update DOM if the text changed to prevent animation jumps
  if (marqueeEl.innerHTML !== marqueeText) {
    marqueeEl.innerHTML = marqueeText;
  }
}

/**
 * Calculate times based on location and offsets
 */
function recalculateTimes() {
  if (!config) return;
  const now = new Date();
  
  // Recalculate schedules using our class
  prayerTimes = prayerCalc.calculatePrayerTimes(
    now,
    config.latitude,
    config.longitude,
    config.timezone,
    config.offsets
  );

  // Calculate Hijri date
  currentHijriDate = prayerCalc.getHijriDate(now, config.hijriOffset);

  // Update schedule board UI
  document.getElementById("time-subuh").innerText = prayerTimes.subuh;
  document.getElementById("time-syuruq").innerText = prayerTimes.syuruq;
  document.getElementById("time-dzuhur").innerText = prayerTimes.dzuhur;
  document.getElementById("time-ashar").innerText = prayerTimes.ashar;
  document.getElementById("time-maghrib").innerText = prayerTimes.maghrib;
  document.getElementById("time-isya").innerText = prayerTimes.isya;
}

/**
 * Clock tick - runs every 1 second
 */
function tickClock() {
  const now = new Date();
  
  // 1. Update clock display
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById("txt-clock").innerText = `${hours}:${minutes}:${seconds}`;

  // 2. Update Gregorian & Hijri Combined Date Text
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const gregStr = now.toLocaleDateString('id-ID', options);
  const hijriStr = currentHijriDate ? currentHijriDate.formatted : "";
  document.getElementById("txt-date-sub").innerHTML = `${gregStr} &nbsp;&nbsp;•&nbsp;&nbsp; ${hijriStr}`;

  // 4. Daily recalculation check (at midnight)
  if (hours === '00' && minutes === '00' && seconds === '00') {
    recalculateTimes();
  }
}

/**
 * Synchronization state engine.
 * Converts time to seconds and inspects if current time falls within active prayer sequences.
 * Prevents disruption and keeps countdowns synced during page reloads/power outages.
 */
function syncStateWithClock() {
  if (!config || !prayerTimes) return;

  const now = new Date();
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  const prayers = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  let detectedState = 'NORMAL';
  let activeP = null;
  let remainingSec = 0;

  for (let p of prayers) {
    const timeStr = prayerTimes[p];
    const startSec = timeToSeconds(timeStr);
    
    if (startSec === -1) continue;

    const adzanSec = config.adzanDuration * 60;
    const iqomahSec = (config.iqomah[p] || 0) * 60;
    const sholatSec = config.sholatDuration * 60;

    const adzanEnd = startSec + adzanSec;
    const iqomahEnd = adzanEnd + iqomahSec;
    const sholatEnd = iqomahEnd + sholatSec;

    // Check overlaps
    if (currentSeconds >= startSec && currentSeconds < adzanEnd) {
      detectedState = 'ADZAN';
      activeP = p;
      remainingSec = adzanEnd - currentSeconds;
      break;
    } else if (currentSeconds >= adzanEnd && currentSeconds < iqomahEnd) {
      detectedState = 'IQOMAH';
      activeP = p;
      remainingSec = iqomahEnd - currentSeconds;
      break;
    } else if (currentSeconds >= iqomahEnd && currentSeconds < sholatEnd) {
      detectedState = 'SHOLAT';
      activeP = p;
      remainingSec = sholatEnd - currentSeconds;
      break;
    }
  }

  // Update global state and count
  if (currentState !== detectedState || activePrayer !== activeP) {
    transitionToState(detectedState, activeP, remainingSec);
  } else {
    // Just keep remaining seconds corrected
    stateCountdownSeconds = remainingSec;
  }
}

/**
 * Handle transitions between display states
 */
function transitionToState(newState, prayerName, durationSec) {
  console.log(`Transition state: ${currentState} -> ${newState} (${prayerName || 'None'}, duration: ${durationSec}s)`);
  
  // Clean up old state visuals
  document.getElementById("overlay-adzan").classList.remove("show");
  document.getElementById("overlay-iqomah").classList.remove("show");
  document.getElementById("overlay-sholat").classList.remove("show");

  currentState = newState;
  activePrayer = prayerName;
  stateCountdownSeconds = durationSec;
  audioPlayedForCurrentState = false;

  // Apply new state visual overlays
  if (newState === 'ADZAN') {
    document.getElementById("adzan-sholat-title").innerText = prayerName.toUpperCase();
    document.getElementById("overlay-adzan").classList.add("show");
    
    // Buzz adzan alert sound (beep 5x)
    if (!audioPlayedForCurrentState) {
      playBuzzer(config.adzanTone || "adzan_long", 5);
      audioPlayedForCurrentState = true;
    }
  } 
  else if (newState === 'IQOMAH') {
    document.getElementById("iqomah-sholat-title").innerText = prayerName.toUpperCase();
    document.getElementById("iqomah-countdown-timer").innerText = formatDuration(durationSec, false);
    document.getElementById("overlay-iqomah").classList.add("show");
  } 
  else if (newState === 'SHOLAT') {
    document.getElementById("overlay-sholat").classList.add("show");
    
    // Play sound notification that iqomah has finished / prayer has started (beep 3x)
    if (!audioPlayedForCurrentState) {
      playBuzzer(config.iqomahTone || "double_beep", 3);
      audioPlayedForCurrentState = true;
    }
  } 
  else {
    // NORMAL state
    // Recalculate which is the next prayer to highlight
    updateNextPrayerCountdown();
  }
}

/**
 * Ticks the state machine countdowns - runs every 1 second
 */
function tickStateCountdown() {
  // If we are in interactive states, count down
  if (currentState !== 'NORMAL') {
    stateCountdownSeconds--;
    
    if (currentState === 'ADZAN') {
      if (stateCountdownSeconds <= 0) {
        // Go to iqomah if duration is set, otherwise skip to sholat
        const iqomahDuration = config.iqomah[activePrayer] || 0;
        if (iqomahDuration > 0) {
          transitionToState('IQOMAH', activePrayer, iqomahDuration * 60);
        } else {
          transitionToState('SHOLAT', activePrayer, config.sholatDuration * 60);
        }
      }
    } 
    else if (currentState === 'IQOMAH') {
      // Update display text timer
      document.getElementById("iqomah-countdown-timer").innerText = formatDuration(stateCountdownSeconds, false);
      
      // Near iqomah sound indicator (10s left)
      if (stateCountdownSeconds === 10 && !audioPlayedForCurrentState) {
        playBuzzer("double_beep");
      }

      if (stateCountdownSeconds <= 0) {
        transitionToState('SHOLAT', activePrayer, config.sholatDuration * 60);
      }
    } 
    else if (currentState === 'SHOLAT') {
      if (stateCountdownSeconds <= 0) {
        transitionToState('NORMAL', null, 0);
      }
    }
  } 
  else {
    // We are in NORMAL mode. We sync occasionally, and update next prayer card highlight.
    // Also, we run a check every 10 seconds just in case of clock shifts
    const seconds = new Date().getSeconds();
    if (seconds % 10 === 0) {
      syncStateWithClock();
    }
    
    updateNextPrayerCountdown();
  }
}

/**
 * Scans schedules and highlights the next upcoming prayer time
 * with count down display in the card.
 */
function updateNextPrayerCountdown() {
  if (!prayerTimes) return;

  const now = new Date();
  const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  // List of all prayer names and their times (in chronological order)
  const prayers = ['subuh', 'syuruq', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  let nextP = null;
  let minDiff = Infinity;

  for (let p of prayers) {
    const timeStr = prayerTimes[p];
    const targetSeconds = timeToSeconds(timeStr);
    
    if (targetSeconds === -1) continue;

    // Time difference (seconds)
    let diff = targetSeconds - currentSeconds;
    
    // If difference is negative, the prayer has already passed today.
    // We check if it is the next day's Fajr (Subuh).
    if (diff <= 0) {
      diff += 24 * 3600; // Add 24 hours
    }

    if (diff < minDiff) {
      minDiff = diff;
      nextP = p;
    }
  }

  // Remove active glow from all prayer cards
  prayers.forEach(p => {
    const card = document.getElementById(`p-${p}`);
    if (card) {
      card.classList.remove("active");
      const cdEl = document.getElementById(`cd-${p}`);
      if (cdEl) cdEl.innerText = '--:--';
    }
  });

  // Highlight next prayer card and show countdown timer
  if (nextP) {
    const nextCard = document.getElementById(`p-${nextP}`);
    if (nextCard) {
      nextCard.classList.add("active");
      
      const cdEl = document.getElementById(`cd-${nextP}`);
      if (cdEl) {
        // Render remaining time in HH:MM:SS
        cdEl.innerText = formatDuration(minDiff, true);
      }
    }
  }
}

/**
 * Setup and rotate images for the documentation slideshow
 */
function setupSlideshow() {
  if (!config || !config.photos) return;

  const container = document.getElementById("slideshow-images-container");
  
  // Build slide HTML
  let slidesHtml = "";
  config.photos.forEach((photo, idx) => {
    // Prepend active class on first slide
    const activeClass = idx === 0 ? "active" : "";
    slidesHtml += `<img src="${photo.url}" alt="${photo.caption || 'Foto'}" class="slide-img ${activeClass}" id="slide-${idx}">`;
  });
  
  container.innerHTML = slidesHtml;

  // Set the caption of the first slide
  if (config.photos.length > 0) {
    document.getElementById("slide-desc").innerText = config.photos[0].caption || "";
  }

  // Clear previous intervals if any
  if (slideInterval) {
    clearInterval(slideInterval);
  }

  slideIndex = 0;
  
  // Only start rotation if we have more than 1 image
  if (config.photos.length > 1) {
    slideInterval = setInterval(rotateSlides, 7000); // rotate every 7 seconds
  }
}

function rotateSlides() {
  if (!config || !config.photos || config.photos.length <= 1) return;

  const totalPhotos = config.photos.length;
  
  // Hide current slide
  const currSlide = document.getElementById(`slide-${slideIndex}`);
  if (currSlide) currSlide.classList.remove("active");

  // Move to next slide
  slideIndex = (slideIndex + 1) % totalPhotos;

  // Show next slide
  const nextSlide = document.getElementById(`slide-${slideIndex}`);
  if (nextSlide) nextSlide.classList.add("active");

  // Update caption description text
  document.getElementById("slide-desc").innerText = config.photos[slideIndex].caption || "";
}

/**
 * Renders the transparent financial details and recent transactions list
 */
function renderFinancialOverlay() {
  if (!config) return;
  
  const summary = window.dataStore.getFinanceSummary(config);
  
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };
  
  // Render summaries
  document.getElementById("recap-lbl-balance").innerText = formatRupiah(summary.balance);
  document.getElementById("recap-lbl-month-income").innerText = "+ " + formatRupiah(summary.month.income).replace("Rp", "Rp ");
  document.getElementById("recap-lbl-month-expense").innerText = "- " + formatRupiah(summary.month.expense).replace("Rp", "Rp ");
  
  // Render table rows
  const tbody = document.getElementById("recap-table-body");
  const emptyState = document.getElementById("recap-empty-state");
  if (!tbody || !emptyState) return;
  
  const transactions = config.infaqTransactions || [];
  if (transactions.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  
  emptyState.style.display = "none";
  
  // Sort by date descending and show max 10
  const sortedTxs = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
    
  tbody.innerHTML = sortedTxs.map(tx => {
    return `
      <tr>
        <td style="color: var(--color-muted); padding: 12px 10px; white-space: nowrap;">${tx.date}</td>
        <td style="font-weight: 500; color: var(--color-primary); padding: 12px 10px;">${tx.description}</td>
        <td style="text-align: right; font-weight: 700; color: ${tx.type === 'income' ? '#24b36d' : '#ef4444'}; padding: 12px 10px; white-space: nowrap;">
          ${tx.type === 'income' ? '+' : '-'} ${formatRupiah(tx.amount).replace("Rp", "Rp ")}
        </td>
      </tr>
    `;
  }).join("");
}

