const db = require('../models/db');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM alert_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Compute the suggested profile for a bed based on its placements.
 * - Returns 'seedling' if any placement is a seed planted within graduation window
 * - Returns 'cool_season' if any plant is frost_tolerant (protects heat-sensitive plants)
 * - Returns 'warm_season' only if all plants are warm-season
 * - Returns null for empty beds
 */
function computeSuggestedProfile(bedId) {
  try {
    const placements = db.prepare(`
      SELECT bp.planting_method, bp.planted_date, p.frost_tolerant
      FROM bed_placements bp
      JOIN plants p ON bp.plant_id = p.id
      WHERE bp.bed_id = ?
    `).all(bedId);

    if (placements.length === 0) return null;

    const graduationWeeks = parseInt(getSetting('seedling_graduation_weeks')) || 4;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - graduationWeeks * 7);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Check if any seed placements are still within the graduation window
    const hasActiveSeedlings = placements.some(
      p => p.planting_method === 'seed' && p.planted_date >= cutoffStr
    );

    if (hasActiveSeedlings) return 'seedling';

    // If any plant is cool-season (frost_tolerant), use cool_season to protect from heat
    const anyCoolSeason = placements.some(p => p.frost_tolerant);
    if (anyCoolSeason) return 'cool_season';

    return 'warm_season';
  } catch (e) {
    console.error('Error computing suggested profile:', e.message);
    return null;
  }
}

module.exports = { computeSuggestedProfile };
