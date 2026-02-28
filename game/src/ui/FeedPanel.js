import Phaser from 'phaser';
import { ITEMS } from '../utils/Constants.js';

export class FeedPanel extends Phaser.GameObjects.Container {
  constructor(scene, dogState, inventory) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.dogState = dogState;
    this.inventory = inventory;
    this.visible = false;
    this.createPanel();
  }

  createPanel() {
    const W = 400;
    const H = 280;
    const ox = 200;
    const oy = 160;

    this.backdrop = this.scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.3);
    this.backdrop.fillRect(0, 0, 800, 600);
    this.backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, 800, 600), Phaser.Geom.Rectangle.Contains);
    this.backdrop.on('pointerdown', () => this.hide());
    this.add(this.backdrop);

    this.panelBg = this.scene.add.graphics();
    this.panelBg.fillStyle(0xFFF8EE, 1);
    this.panelBg.fillRoundedRect(ox, oy, W, H, 16);
    this.panelBg.lineStyle(3, 0xD4A574, 1);
    this.panelBg.strokeRoundedRect(ox, oy, W, H, 16);
    this.add(this.panelBg);

    const title = this.scene.add.text(400, oy + 15, '🍖 먹이 주기', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.add(title);

    this.itemsContainer = this.scene.add.container(0, 0);
    this.add(this.itemsContainer);
  }

  refresh() {
    this.itemsContainer.removeAll(true);
    const foods = ITEMS.foods;
    const startY = 215;

    foods.forEach((food, i) => {
      const iy = startY + i * 60;
      const qty = this.inventory.getFoodCount(food.id);

      const bg = this.scene.add.graphics();
      bg.fillStyle(0xFFF0DC, 1);
      bg.fillRoundedRect(220, iy, 360, 50, 8);
      this.itemsContainer.add(bg);

      const icon = this.scene.add.text(235, iy + 12, food.icon, { fontSize: '22px' });
      this.itemsContainer.add(icon);

      const name = this.scene.add.text(270, iy + 14, `${food.name} (${qty}개)`, {
        fontSize: '15px',
        fontFamily: 'Arial, sans-serif',
        color: '#4A3728',
      });
      this.itemsContainer.add(name);

      if (qty > 0) {
        const useBtn = this.scene.add.graphics();
        useBtn.fillStyle(0xFF6B9D, 1);
        useBtn.fillRoundedRect(480, iy + 8, 80, 34, 8);
        useBtn.setInteractive(new Phaser.Geom.Rectangle(480, iy + 8, 80, 34), Phaser.Geom.Rectangle.Contains);

        const useTxt = this.scene.add.text(520, iy + 25, '먹이기', {
          fontSize: '13px',
          fontFamily: 'Arial',
          color: '#FFFFFF',
          fontStyle: 'bold',
        });
        useTxt.setOrigin(0.5);

        useBtn.on('pointerdown', () => {
          if (this.inventory.useFood(food.id)) {
            this.dogState.feed(food);
            this.scene.events.emit('dog-fed', food);
            this.hide();
          }
        });

        this.itemsContainer.add(useBtn);
        this.itemsContainer.add(useTxt);
      } else {
        const noText = this.scene.add.text(520, iy + 25, '없음', {
          fontSize: '13px',
          fontFamily: 'Arial',
          color: '#AAAAAA',
        });
        noText.setOrigin(0.5);
        this.itemsContainer.add(noText);
      }
    });
  }

  show() {
    this.setVisible(true);
    this.refresh();
  }

  hide() {
    this.setVisible(false);
  }

  isOpen() {
    return this.visible;
  }
}
