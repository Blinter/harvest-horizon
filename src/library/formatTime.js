/**
 * Formats milliseconds into an approximate human-readable time
 * string (e.g., "less than a minute", "about 5 minutes",
 * "about 1 hour"). The goal is to provide descriptions that change
 * less frequently.
 *
 * @param {number} ms Milliseconds remaining.
 * @returns {string} Approximate formatted time string.
 */
export const formatTime = ms => {
  if (ms <= 0) return '0 seconds';

  const seconds = Math.floor(ms / 1000);
  const minutes = seconds / 60;
  const hours = seconds / 3600;
  const days = seconds / 86400;

  // Less than 10 seconds
  if (seconds < 10) {
    return `less than 10 seconds`;
  }

  // Less than 1 minute
  if (seconds < 60) {
    return `less than a minute`;
  }

  // Between 1 minute and 57.5 minutes (round to nearest 5 minutes)
  if (minutes < 57.5) {
    // Keep for debugging
    // minutes = seconds / 60; // Already calculated
    const roundedMinutes = Math.max(5, Math.round(minutes / 5) * 5);
    return `about ${roundedMinutes} minutes`;
  }

  // Between 57.5 minutes and ~23.5 hours (round to nearest hour)
  // Use 23.5 hours (84600s) as threshold before rounding to '1 day'
  if (seconds < 84600) {
    // Keep for debugging
    // hours = seconds / 3600; // Already calculated
    const roundedHours = Math.max(1, Math.round(hours));
    return `about ${roundedHours} hour${roundedHours > 1 ? 's' : ''}`;
  }

  // ~23.5 hours or more (round to nearest day)
  // days = seconds / 86400; // Already calculated
  const roundedDays = Math.max(1, Math.round(days));
  return `about ${roundedDays} day${roundedDays > 1 ? 's' : ''}`;
};


/**
 * Formats milliseconds into a human-readable time string (e.g.,
 * "1 day, 2 hours, 5 minutes, 30 seconds"). Only includes non-zero
 * units.
 *
 * @param {number} ms Milliseconds remaining.
 * @returns {string} Formatted time string.
 */
export const formatTimeDefault = ms => {
  if (ms <= 0) return '0 seconds';

  const units = [
    { name: 'year', seconds: 31536000 }, // 365 * 24 * 60 * 60
    { name: 'week', seconds: 604800 },   // 7 * 24 * 60 * 60
    { name: 'day', seconds: 86400 },     // 24 * 60 * 60
    { name: 'hour', seconds: 3600 },      // 60 * 60
    { name: 'minute', seconds: 60 },
    // Note: Seconds are handled separately after the loop
  ];

  let remainingSeconds = Math.floor(ms / 1000);
  const timeParts = [];

  // Calculate parts for units larger than seconds
  for (const unit of units) {
    if (remainingSeconds >= unit.seconds) {
      const count = Math.floor(remainingSeconds / unit.seconds);
      timeParts.push(`${count} ${unit.name}${count > 1 ? 's' : ''}`);
      remainingSeconds %= unit.seconds; // Update remaining seconds
    }
  }

  // Add remaining seconds if necessary
  if (remainingSeconds > 0 || timeParts.length === 0) {
    timeParts.push(
      `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`,
    );
  }

  return timeParts.join(', ');
};