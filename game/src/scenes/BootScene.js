import Phaser from 'phaser';
import { AssetGenerator } from '../utils/AssetGenerator.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Loading text
    const loadText = this.add.text(width / 2, height / 2 - 40, '🐕 로딩 중...', {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
    });
    loadText.setOrigin(0.5);

    // Progress bar
    const barBg = this.add.graphics();
    barBg.fillStyle(0xD4A574, 1);
    barBg.fillRoundedRect(width / 2 - 150, height / 2 + 10, 300, 20, 10);

    const bar = this.add.graphics();
    let progress = 0;

    const progressInterval = this.time.addEvent({
      delay: 30,
      callback: () => {
        progress += 0.05;
        bar.clear();
        bar.fillStyle(0xFF6B9D, 1);
        bar.fillRoundedRect(
          width / 2 - 148,
          height / 2 + 12,
          Math.min(progress, 1) * 296,
          16,
          8
        );

        if (progress >= 1) {
          progressInterval.remove();
          AssetGenerator.generateAll(this);
          this.time.delayedCall(200, () => {
            this.scene.start('MainMenuScene');
          });
        }
      },
      loop: true,
    });
  }
}
