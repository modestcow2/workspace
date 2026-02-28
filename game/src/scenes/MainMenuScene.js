import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager.js';
import { COLORS } from '../utils/Constants.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Background gradient
    const bg = this.add.graphics();
    bg.fillStyle(0xFFF8EE, 1);
    bg.fillRect(0, 0, width, height);

    // Decorative circles
    bg.fillStyle(0xFFE4C4, 0.3);
    bg.fillCircle(100, 150, 80);
    bg.fillCircle(700, 100, 60);
    bg.fillCircle(650, 500, 90);
    bg.fillStyle(0xFFD1DC, 0.2);
    bg.fillCircle(200, 450, 70);
    bg.fillCircle(500, 200, 50);

    // Title
    const title = this.add.text(width / 2, height / 2 - 120, '🐕 강아지 키우기', {
      fontSize: '48px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 2 - 60, '힐링 타임', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#8B6914',
    });
    subtitle.setOrigin(0.5);

    // Floating dog preview
    const dogPreview = this.add.image(width / 2, height / 2 + 20, 'dog_puppy');
    dogPreview.setScale(1.5);
    this.tweens.add({
      targets: dogPreview,
      y: dogPreview.y - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Start button
    const startY = height / 2 + 110;
    this.createButton(width / 2, startY, '새로 시작', () => {
      SaveManager.deleteSave();
      this.scene.start('GameScene', { newGame: true });
    });

    // Continue button (if save exists)
    if (SaveManager.hasSave()) {
      this.createButton(width / 2, startY + 60, '이어하기', () => {
        this.scene.start('GameScene', { newGame: false });
      });
    }

    // Paw prints decoration
    const pawPositions = [
      [80, 80], [720, 520], [650, 80], [130, 500],
    ];
    pawPositions.forEach(([px, py]) => {
      const paw = this.add.text(px, py, '🐾', {
        fontSize: '30px',
      });
      paw.setOrigin(0.5);
      paw.setAlpha(0.2);
      paw.setRotation(Phaser.Math.Between(-30, 30) * Math.PI / 180);
    });
  }

  createButton(x, y, label, callback) {
    const btn = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0xE8C990, 1);
    bg.fillRoundedRect(-100, -22, 200, 44, 22);
    bg.lineStyle(2, 0xD4A574, 1);
    bg.strokeRoundedRect(-100, -22, 200, 44, 22);

    const text = this.add.text(0, 0, label, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    btn.add([bg, text]);
    btn.setSize(200, 44);
    btn.setInteractive();

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0xD4A574, 1);
      bg.fillRoundedRect(-100, -22, 200, 44, 22);
      bg.lineStyle(2, 0xC49464, 1);
      bg.strokeRoundedRect(-100, -22, 200, 44, 22);
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0xE8C990, 1);
      bg.fillRoundedRect(-100, -22, 200, 44, 22);
      bg.lineStyle(2, 0xD4A574, 1);
      bg.strokeRoundedRect(-100, -22, 200, 44, 22);
    });

    btn.on('pointerdown', callback);
    return btn;
  }
}
