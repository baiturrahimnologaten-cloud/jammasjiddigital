/**
 * Standalone Offline Prayer Time Calculator for Jam Digital Masjid.
 * Supports standard astronomical calculations for Indonesia (MABIMS/Kemenag).
 */
class PrayerCalculator {
  constructor() {
    // Default coordinates: Nologaten, Yogyakarta, Indonesia
    this.defaultCoords = {
      latitude: -7.7828,
      longitude: 110.4011,
      timezone: 7, // WIB (UTC+7)
      method: 'KEMENAG' // Kemenag uses Fajr 20, Isha 18
    };
  }

  // Radians helper
  degToRad(deg) {
    return (deg * Math.PI) / 180.0;
  }

  // Degrees helper
  radToDeg(rad) {
    return (rad * 180.0) / Math.PI;
  }

  // Standardize hours to [0, 24] range
  fixHour(hour) {
    hour = hour - 24.0 * Math.floor(hour / 24.0);
    return hour < 0 ? hour + 24.0 : hour;
  }

  // Standardize angle to [0, 360] range
  fixAngle(angle) {
    angle = angle - 360.0 * Math.floor(angle / 360.0);
    return angle < 0 ? angle + 360.0 : angle;
  }

  /**
   * Calculates Julian Date from a Gregorian Date
   */
  getJulianDate(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    let A = Math.floor(year / 100);
    let B = 2 - A + Math.floor(A / 4);
    let JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    return JD;
  }

  /**
   * Calculates Solar declination and equation of time
   */
  getSolarCoords(jd) {
    let d = jd - 2451545.0; // days since J2000.0
    let g = this.fixAngle(357.529 + 0.98560028 * d);
    let q = this.fixAngle(280.459 + 0.98564736 * d);
    let L = this.fixAngle(q + 1.915 * Math.sin(this.degToRad(g)) + 0.020 * Math.sin(this.degToRad(2 * g)));

    let e = 23.439 - 0.00000036 * d; // obliquity of ecliptic

    let RA = this.radToDeg(Math.atan2(Math.cos(this.degToRad(e)) * Math.sin(this.degToRad(L)), Math.cos(this.degToRad(L))));
    RA = this.fixAngle(RA);

    let declination = this.radToDeg(Math.asin(Math.sin(this.degToRad(e)) * Math.sin(this.degToRad(L))));
    let equationOfTime = q / 15.0 - RA / 15.0;

    // Normalize equation of time to range [-12, 12] hours
    if (equationOfTime > 12) equationOfTime -= 24;
    if (equationOfTime < -12) equationOfTime += 24;

    return { declination, equationOfTime };
  }

  /**
   * Computes hour angle for a specific altitude angle
   */
  getHourAngle(latitude, declination, angle) {
    let latRad = this.degToRad(latitude);
    let decRad = this.degToRad(declination);
    let angRad = this.degToRad(angle);

    let cosH = (Math.sin(angRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
    
    if (cosH > 1.0 || cosH < -1.0) {
      return null; // Sun never reaches this altitude
    }
    
    return this.radToDeg(Math.acos(cosH));
  }

  /**
   * Calculates all prayer times for a given date and location
   */
  calculatePrayerTimes(date, lat, lng, timezone, offsets = {}) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();

    let jd = this.getJulianDate(year, month, day);
    let { declination, equationOfTime } = this.getSolarCoords(jd);

    // Midday (Transit/Dzuhur)
    let transit = 12.0 + timezone - lng / 15.0 - equationOfTime;
    transit = this.fixHour(transit);

    // Standard altitude angles (Kemenag / MABIMS)
    let fajrAngle = -20.0; // Subuh: 20 degrees below horizon
    let ishaAngle = -18.0; // Isya: 18 degrees below horizon
    let sunriseAngle = -0.833; // Syuruq: refraction & semidiameter offset

    // 1. Fajr (Subuh)
    let fajrHA = this.getHourAngle(lat, declination, fajrAngle);
    let fajrTime = fajrHA !== null ? this.fixHour(transit - fajrHA / 15.0) : null;

    // 2. Sunrise (Syuruq)
    let sunriseHA = this.getHourAngle(lat, declination, sunriseAngle);
    let sunriseTime = sunriseHA !== null ? this.fixHour(transit - sunriseHA / 15.0) : null;

    // 3. Dhuhr (Dzuhur)
    // Add a small buffer (usually 1-2 minutes) for safety so the sun has passed the meridian
    let dhuhrTime = transit + (2.0 / 60.0); 

    // 4. Asr (Ashar)
    // Shadow length factor = 1 (Standard Shafi'i/Hanafi is 1, Hanafi is 2)
    let latRad = this.degToRad(lat);
    let decRad = this.degToRad(declination);
    let asrAngle = this.radToDeg(Math.atan(1.0 / (1.0 + Math.tan(Math.abs(latRad - decRad)))));
    let asrHA = this.getHourAngle(lat, declination, asrAngle);
    let asrTime = asrHA !== null ? this.fixHour(transit + asrHA / 15.0) : null;

    // 5. Maghrib (Maghrib = Sunset)
    let maghribTime = sunriseHA !== null ? this.fixHour(transit + sunriseHA / 15.0) : null;

    // 6. Isha (Isya)
    let ishaHA = this.getHourAngle(lat, declination, ishaAngle);
    let ishaTime = ishaHA !== null ? this.fixHour(transit + ishaHA / 15.0) : null;

    // Apply manual offset adjustments (in minutes)
    const applyOffset = (time, offset = 0) => {
      if (time === null) return null;
      return this.fixHour(time + (offset / 60.0));
    };

    let times = {
      subuh: applyOffset(fajrTime, offsets.subuh || 0),
      syuruq: applyOffset(sunriseTime, offsets.syuruq || 0),
      dzuhur: applyOffset(dhuhrTime, offsets.dzuhur || 0),
      ashar: applyOffset(asrTime, offsets.ashar || 0),
      maghrib: applyOffset(maghribTime, offsets.maghrib || 0),
      isya: applyOffset(ishaTime, offsets.isya || 0)
    };

    // Format times to HH:MM
    const formatTime = (timeDec) => {
      if (timeDec === null) return '--:--';
      let totalMinutes = Math.round(timeDec * 60);
      let hours = Math.floor(totalMinutes / 60) % 24;
      let minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    return {
      subuh: formatTime(times.subuh),
      syuruq: formatTime(times.syuruq),
      dzuhur: formatTime(times.dzuhur),
      ashar: formatTime(times.ashar),
      maghrib: formatTime(times.maghrib),
      isya: formatTime(times.isya)
    };
  }

  /**
   * Estimates the Hijri Date using tabular Kuwaiti Algorithm
   * and applies a manual offset (+/- days)
   */
  getHijriDate(date, offsetDays = 0) {
    // Add offset days to target date
    let targetDate = new Date(date.getTime());
    targetDate.setDate(targetDate.getDate() + offsetDays);

    let year = targetDate.getFullYear();
    let month = targetDate.getMonth() + 1;
    let day = targetDate.getDate();

    // Calculate Julian Day
    let jd = this.getJulianDate(year, month, day);

    // Days since Julian epoch for Hijri (approx. July 16, 622 CE)
    let epochDays = jd - 1948439.5;
    
    // Mean length of synodic month is ~29.530588853 days
    let cycles = Math.floor(epochDays / 10631.0);
    let cycleRemainder = epochDays - (cycles * 10631.0);
    
    let hijriYear = Math.floor(cycleRemainder / 354.36667);
    let yearRemainder = cycleRemainder - Math.round(hijriYear * 354.36667);
    
    // Complete Hijri Year
    let hYear = cycles * 30 + hijriYear;
    
    // Estimate month
    let hMonth = Math.floor(yearRemainder / 29.5) + 1;
    if (hMonth > 12) hMonth = 12;
    
    // Month starts array (days from start of year)
    let monthStarts = [0, 30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];
    let monthStart = monthStarts[hMonth - 1];
    
    // If it's a leap year
    let isLeap = ((hYear * 11 + 14) % 30) < 11;
    
    let hDay = Math.round(yearRemainder - monthStart) + 1;
    if (hDay > 30) {
      hDay = 30; // safety clamp
    }
    if (hDay < 1) hDay = 1;

    // Check months adjustments
    const hijriMonthsIndo = [
      "Muharram", "Safar", "Rabi'ul Awal", "Rabi'ul Akhir",
      "Jumadil Awal", "Jumadil Akhir", "Rajab", "Sya'ban",
      "Ramadhan", "Syawal", "Dzulqa'dah", "Dzulhijjah"
    ];

    return {
      day: hDay,
      month: hMonth,
      monthName: hijriMonthsIndo[hMonth - 1],
      year: hYear,
      formatted: `${hDay} ${hijriMonthsIndo[hMonth - 1]} ${hYear} H`
    };
  }
}

// Bind to window for easy direct browser scripts access
window.PrayerCalculator = PrayerCalculator;
