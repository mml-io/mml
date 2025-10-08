// Health bar animation demo
(() => {
  let currentHealth = 100;
  const maxHealth = 100;
  let totalDamageTaken = 0;
  let totalHealingDone = 0;

  const healthBar = document.getElementById('health-bar') as HTMLElement;
  const healthText = document.getElementById('health-text') as HTMLElement;
  const damageTakenEl = document.getElementById('damage-taken') as HTMLElement;
  const healingDoneEl = document.getElementById('healing-done') as HTMLElement;
  const playerCube = document.getElementById('player-cube');

  function updateHealthBar() {
    if (!healthBar || !healthText) return;

    const healthPercent = (currentHealth / maxHealth) * 100;
    healthBar.style.width = `${healthPercent}%`;
    healthText.textContent = `${Math.max(0, currentHealth)} / ${maxHealth}`;

    // Change color based on health level
    if (healthPercent > 60) {
      healthBar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
      healthText.style.color = '#4ade80';
    } else if (healthPercent > 30) {
      healthBar.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
      healthText.style.color = '#fbbf24';
    } else {
      healthBar.style.background = 'linear-gradient(90deg, #f87171, #dc2626)';
      healthText.style.color = '#f87171';
    }

    // Update player cube color based on health
    if (playerCube) {
      if (healthPercent > 60) {
        playerCube.setAttribute('color', '#4a9eff');
      } else if (healthPercent > 30) {
        playerCube.setAttribute('color', '#fbbf24');
      } else {
        playerCube.setAttribute('color', '#f87171');
      }
    }
  }

  function takeDamage() {
    const damage = Math.floor(Math.random() * 46) + 5; // 5-50 damage
    currentHealth = Math.max(0, currentHealth - damage);
    totalDamageTaken += damage;

    if (damageTakenEl) {
      damageTakenEl.textContent = String(totalDamageTaken);
    }

    updateHealthBar();

    // Shake effect on player cube
    if (playerCube) {
      const originalY = playerCube.getAttribute('y') || '0.75';
      playerCube.setAttribute('y', '1');
      setTimeout(() => {
        playerCube.setAttribute('y', originalY);
      }, 100);
    }
  }

  function heal() {
    if (currentHealth >= maxHealth) return;

    const healAmount = 20;
    const actualHeal = Math.min(healAmount, maxHealth - currentHealth);
    currentHealth = Math.min(maxHealth, currentHealth + healAmount);
    totalHealingDone += actualHeal;

    if (healingDoneEl) {
      healingDoneEl.textContent = String(totalHealingDone);
    }

    updateHealthBar();

    // Bounce effect on player cube
    if (playerCube) {
      const originalY = playerCube.getAttribute('y') || '0.75';
      playerCube.setAttribute('y', '1.2');
      setTimeout(() => {
        playerCube.setAttribute('y', originalY);
      }, 200);
    }
  }

  document.getElementById('btn-damage')?.addEventListener('click', takeDamage);
  document.getElementById('btn-heal')?.addEventListener('click', heal);

  // Initialize health bar
  updateHealthBar();
})();

