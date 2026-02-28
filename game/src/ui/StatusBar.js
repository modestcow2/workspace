import Phaser from 'phaser';
import { COLORS } from '../utils/Constants.js';

export class StatusBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, dogState) {
    super(scene, x, y);
    scene.add.existing(this);
    this.dogState = dogState;
    this.bars = {};
    this.createBars();
    this.createCoinDisplay();
  }

  createBars() {
    const stats = [
      { key: 'hunger', icon: '🍖', color: COLORS.hunger, label: '배고픔' },
      { key: 'happiness', icon: '😊', color: COLORS.happiness, label: '행복' },
      { key: 'cleanliness', icon: '✨', color: COLORS.cleanliness, label: '청결' },
      { key: 'energy', icon: '⚡', color: COLORS.energy, label: '체력' },
      { key: 'affection', icon: '💕', color: COLORS.affection, label: '친밀도' },
    ];

    // Background panel
    const panelW = stats.length * 120 + 20;
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x000000, 0.15);
    panel.fillRoundedRect(-10, -5, panelW, 45, 10);
    this.add(panel);

    stats.forEach((stat, i) => {
      const ox = i * 120;

      // Icon
      const icon = this.scene.add.text(ox, 5, stat.icon, {
        fontSize: '16px',
      });
      this.add(icon);

      // Bar background
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(0x000000, 0.2);
      barBg.fillRoundedRect(ox + 22, 8, 80, 10, 5);
      this.add(barBg);

      // Bar fill
      const barFill = this.scene.add.graphics();
      this.add(barFill);

      // Value text
      const valText = this.scene.add.text(ox + 62, 24, '', {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#4A3728',
      });
      valText.setOrigin(0.5, 0);
      this.add(valText);

      this.bars[stat.key] = { fill: barFill, color: stat.color, ox, valText };
    });
  }

  createCoinDisplay() {
    this.coinText = this.scene.add.text(620, 5, '', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      fontStyle: 'bold',
    });
    this.add(this.coinText);
  }

  update() {
    for (const [key, bar] of Object.entries(this.bars)) {
      const val = key === 'affection'
        ? Math.min(this.dogState[key], 200)
        : this.dogState[key];
      const maxVal = key === 'affection' ? 200 : 100;
      const pct = val / maxVal;

      bar.fill.clear();
      bar.fill.fillStyle(bar.color, 1);
      bar.fill.fillRoundedRect(bar.ox + 23, 9, Math.max(0, pct * 78), 8, 4);

      bar.valText.setText(Math.round(val));
    }

    this.coinText.setText(`🪙 ${this.dogState.coins}`);
  }
}
