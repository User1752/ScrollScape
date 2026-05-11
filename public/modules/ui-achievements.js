// ============================================================================
// ACHIEVEMENTS SYSTEM
// ============================================================================

async function checkAndUnlockAchievements() {
  try {
    // Fetch current analytics data
    const anaData = await api("/api/analytics");
    const a = anaData.analytics || {};
    
    // Build analytics object for achievement checking
    const analytics = {
      totalChaptersRead: a.totalChaptersRead || state.readChapters.size,
      totalTimeSpent:    a.totalTimeSpent || 0,
      totalFavorites:    (anaData.totalFavorites || 0),
      completedCount:    (anaData.statusDistribution?.completed || 0),
      totalLists:        (anaData.totalLists || 0),
      statusDistribution: anaData.statusDistribution || {},
      dailyStreak:       a.dailyStreak || 0,
      libraryTitles:     (state.favorites || []).map(m => (m.title || '').toLowerCase())
    };

    // Check achievements using AchievementManager
    const newlyUnlocked = achievementManager.checkAchievements(analytics);
    
    // Send newly unlocked achievements to backend
    for (const achievementId of newlyUnlocked) {
      try {
        await api("/api/achievements/unlock", {
          method: "POST",
          body: JSON.stringify({ achievementId })
        });
        
        // Show toast notification
        const achievement = achievementManager.getAchievement(achievementId);
        if (achievement) {
          showToast(
            `Achievement Unlocked! `, 
            `${achievement.name}: ${achievement.description}`, 
            "success"
          );
        }
      } catch (err) {
        dbg.error(dbg.ERR_ACHIEVE, `Failed to sync achievement ${achievementId}`, err);
      }
    }
    
    // Update state
    state.earnedAchievements = achievementManager.unlockedAchievements;
    updateApBadge();
  } catch (e) {
    dbg.error(dbg.ERR_ACHIEVE, 'Error checking achievements', e);
  }
}

async function renderAchievementsGrid() {
  const grid = $("achievementsGrid");
  if (!grid) return;
  
  try {
    // Get achievement stats
    const stats = achievementManager.getStats();
    const countEl = $("achievementCount");
    if (countEl) countEl.textContent = `${stats.unlocked}/${stats.total}`;

    // Render achievements by category
    const html = achievementManager.categories.map(category => {
      const achievements = achievementManager.getAchievementsByCategory(category.id);
      
      return `
        <div class="achievement-category">
          <h3 class="achievement-category-title">${escapeHtml(category.name)}</h3>
          <p class="achievement-category-desc">${escapeHtml(category.description)}</p>
          <div class="achievement-category-grid">
            ${achievements.map(a => {
              const isUnlocked = achievementManager.isUnlocked(a.id);
              const rarityClass = a.rarity || 'common';
              
              return `
                <div class="achievement-item ${isUnlocked ? 'earned' : 'locked'} rarity-${rarityClass}">
                  <div class="achievement-icon">
                    <i data-feather="${escapeHtml(a.icon)}" ${isUnlocked ? '' : 'class="locked-icon"'}></i>
                  </div>
                  <div class="achievement-info">
                    <h4>${escapeHtml(a.name)}</h4>
                    <p>${escapeHtml(a.description)}</p>
                    ${a.points ? `<span class="achievement-points">+${a.points} pts</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html || '<div class="muted">No achievements available.</div>';
    
    // Initialize Feather icons if available
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
    
  } catch (e) {
    dbg.error(dbg.ERR_ACHIEVE, 'Error rendering achievements', e);
    grid.innerHTML = `<div class="muted">Could not load achievements.</div>`;
  }
}

/**
 * Render the full achievements page view with categories and dragon ball easter egg.
 */
async function renderAchievementsView() {
  const content = document.getElementById('achPageContent');
  if (!content) return;
  updateApBadge();

  // If definitions haven't loaded yet (e.g., first navigation hit before async
  // startup finished, or the initial fetch failed), try once more.
  if (achievementManager.categories.length === 0) {
    try {
      content.innerHTML = '<div class="muted">Loading achievements…</div>';
      await achievementManager.loadAchievements();
    } catch (_) { /* fall through — will show "no achievements" */ }
  }

  // Secret Dragon Ball easter egg: collect all 7 dragon balls → Shenlong grants 50 AP
  const db = document.getElementById('achDragonBall');
  if (db) {
    if (!db.dataset.eggBound) {
      db.dataset.eggBound = '1';
      db.dataset.ball = '1';
      let eggTimer = null;
      db.addEventListener('click', () => {
        let ball = parseInt(db.dataset.ball || '1');
        db.style.transform = `scale(1.25) rotate(${ball * 52}deg)`;
        setTimeout(() => { db.style.transform = ''; }, 250);
        clearTimeout(eggTimer);
        if (ball === 7) {
          // All 7 balls collected — summon Shenlong!
          db.dataset.ball = '1';
          setTimeout(() => { db.innerHTML = dragonBallSVG(1); }, 3000);
          summonShenlong();
        } else {
          ball++;
          db.dataset.ball = ball;
          db.innerHTML = dragonBallSVG(ball);
          // Reset if idle for 3 seconds without reaching 7
          eggTimer = setTimeout(() => {
            db.dataset.ball = '1';
            db.innerHTML = dragonBallSVG(1);
          }, 3000);
        }
      });
    }
    // Render current ball if empty
    if (!db.innerHTML.trim()) db.innerHTML = dragonBallSVG(1);
  }
  const total    = achievementManager.achievements.length;
  const unlocked = achievementManager.unlockedAchievements.size;
  const countEl  = document.getElementById('achievementCount');
  if (countEl) countEl.textContent = `${unlocked}/${total}`;
  const html = achievementManager.categories.map(cat => {
    const achs = achievementManager.getAchievementsByCategory(cat.id);
    const catUnlocked = achs.filter(a => achievementManager.isUnlocked(a.id)).length;
    return `
      <div class="ach-page-category">
        <div class="ach-category-header">
          <h3>${escapeHtml(cat.name)}</h3>
          <span class="ach-category-count">${catUnlocked}/${achs.length}</span>
        </div>
        <div class="ach-category-grid">
          ${achs.map(a => {
            const isUnlocked = achievementManager.isUnlocked(a.id);
            return `
              <div class="ach-card ${isUnlocked ? 'ach-unlocked' : 'ach-locked'} ach-rarity-${escapeHtml(a.rarity || 'common')}" title="${escapeHtml(a.description)}">
                <div class="ach-card-icon"><i data-feather="${escapeHtml(a.icon)}"></i></div>
                <div class="ach-card-name">${escapeHtml(a.name)}</div>
                ${isUnlocked
                  ? `<div class="ach-card-ap">+1 AP</div>`
                  : `<div class="ach-card-locked-desc">${escapeHtml(a.description)}</div>`}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  content.innerHTML = html || '<div class="muted">No achievements yet.</div>';
  if (typeof feather !== 'undefined') feather.replace();
}

