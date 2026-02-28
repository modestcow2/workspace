import Phaser from 'phaser';
import { ITEMS } from '../utils/Constants.js';

export class ShopPanel extends Phaser.GameObjects.Container {
  constructor(scene, dogState, inventory) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.dogState = dogState;
    this.inventory = inventory;
    this.visible = false;
    this.currentTab = 'foods';
    this.createPanel();
  }

  createPanel() {
    const W = 600;
    const H = 420;
    const ox = 100;
    const oy = 90;

    // Dimmed backdrop
    this.backdrop = this.scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, 800, 600);
    this.backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, 800, 600), Phaser.Geom.Rectangle.Contains);
    this.add(this.backdrop);

    // Panel background
    this.panelBg = this.scene.add.graphics();
    this.panelBg.fillStyle(0xFFF8EE, 1);
    this.panelBg.fillRoundedRect(ox, oy, W, H, 16);
    this.panelBg.lineStyle(3, 0xD4A574, 1);
    this.panelBg.strokeRoundedRect(ox, oy, W, H, 16);
    this.add(this.panelBg);

    // Title
    this.titleText = this.scene.add.text(400, oy + 20, '🛍️ 상점', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      fontStyle: 'bold',
    });
    this.titleText.setOrigin(0.5, 0);
    this.add(this.titleText);

    // Close button
    const closeBtn = this.scene.add.text(ox + W - 30, oy + 10, '✕', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#4A3728',
    });
    closeBtn.setOrigin(0.5, 0);
    closeBtn.setInteractive();
    closeBtn.on('pointerdown', () => this.hide());
    this.add(closeBtn);

    // Coin display
    this.coinDisplay = this.scene.add.text(ox + 20, oy + 25, '', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
    });
    this.add(this.coinDisplay);

    // Tabs
    this.tabs = [];
    const tabData = [
      { key: 'foods', label: '🍖 음식' },
      { key: 'toys', label: '⚽ 장난감' },
      { key: 'accessories', label: '🎀 악세사리' },
      { key: 'furniture', label: '🛏️ 가구' },
    ];

    tabData.forEach((tab, i) => {
      const tx = ox + 30 + i * 140;
      const ty = oy + 60;
      const tabBtn = this.scene.add.text(tx, ty, tab.label, {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#4A3728',
        backgroundColor: '#E8C990',
        padding: { x: 10, y: 5 },
      });
      tabBtn.setInteractive();
      tabBtn.on('pointerdown', () => {
        this.currentTab = tab.key;
        this.refreshItems();
      });
      this.add(tabBtn);
      this.tabs.push({ btn: tabBtn, key: tab.key });
    });

    // Items container
    this.itemsContainer = this.scene.add.container(0, 0);
    this.add(this.itemsContainer);
  }

  refreshItems() {
    this.itemsContainer.removeAll(true);
    this.coinDisplay.setText(`🪙 ${this.dogState.coins}`);

    // Highlight active tab
    this.tabs.forEach(t => {
      const isActive = t.key === this.currentTab;
      t.btn.setStyle({
        backgroundColor: isActive ? '#D4A574' : '#E8C990',
      });
    });

    const items = ITEMS[this.currentTab] || [];
    const startY = 185;
    const ox = 130;

    items.forEach((item, i) => {
      const iy = startY + i * 65;
      const row = this.scene.add.container(0, 0);

      // Item background
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(0xFFF0DC, 1);
      rowBg.fillRoundedRect(ox, iy, 540, 55, 8);
      row.add(rowBg);

      // Icon
      const icon = this.scene.add.text(ox + 15, iy + 12, item.icon, {
        fontSize: '26px',
      });
      row.add(icon);

      // Name + description
      const name = this.scene.add.text(ox + 55, iy + 8, item.name, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#4A3728',
        fontStyle: 'bold',
      });
      row.add(name);

      // Stats info
      let desc = '';
      if (item.hunger) desc += `배고픔 +${item.hunger} `;
      if (item.happiness) desc += `행복 +${item.happiness}`;
      if (desc) {
        const descText = this.scene.add.text(ox + 55, iy + 30, desc, {
          fontSize: '11px',
          fontFamily: 'Arial',
          color: '#8B7355',
        });
        row.add(descText);
      }

      // Quantity (for foods)
      if (this.currentTab === 'foods') {
        const qty = this.inventory.getFoodCount(item.id);
        const qtyText = this.scene.add.text(ox + 350, iy + 15, `보유: ${qty}`, {
          fontSize: '13px',
          fontFamily: 'Arial',
          color: '#8B7355',
        });
        row.add(qtyText);
      }

      // Owned indicator for non-consumables
      const isOwned = this.currentTab === 'toys' ? this.inventory.hasToy(item.id)
        : this.currentTab === 'accessories' ? this.inventory.hasAccessory(item.id)
        : this.currentTab === 'furniture' ? this.inventory.hasFurniture(item.id)
        : false;

      if (isOwned && this.currentTab !== 'foods') {
        const ownedText = this.scene.add.text(ox + 350, iy + 15, '보유 중 ✓', {
          fontSize: '13px',
          fontFamily: 'Arial',
          color: '#7ED957',
        });
        row.add(ownedText);
      }

      // Buy button
      const canBuy = this.dogState.coins >= item.price && (!isOwned || this.currentTab === 'foods');
      const buyBg = this.scene.add.graphics();
      buyBg.fillStyle(canBuy ? 0xFF6B9D : 0xCCCCCC, 1);
      buyBg.fillRoundedRect(ox + 440, iy + 10, 80, 35, 8);

      const buyText = this.scene.add.text(ox + 480, iy + 27, `🪙${item.price}`, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#FFFFFF',
        fontStyle: 'bold',
      });
      buyText.setOrigin(0.5);

      row.add(buyBg);
      row.add(buyText);

      if (canBuy) {
        buyBg.setInteractive(new Phaser.Geom.Rectangle(ox + 440, iy + 10, 80, 35), Phaser.Geom.Rectangle.Contains);
        buyBg.on('pointerdown', () => {
          this.buyItem(item);
        });
      }

      this.itemsContainer.add(row);
    });
  }

  buyItem(item) {
    if (this.dogState.coins < item.price) return;

    this.dogState.coins -= item.price;

    switch (this.currentTab) {
      case 'foods':
        this.inventory.addFood(item.id);
        break;
      case 'toys':
        this.inventory.addToy(item.id);
        break;
      case 'accessories':
        this.inventory.addAccessory(item.id);
        break;
      case 'furniture':
        this.inventory.addFurniture(item.id);
        break;
    }

    this.scene.events.emit('purchase', item);
    this.refreshItems();
  }

  show() {
    this.setVisible(true);
    this.refreshItems();
  }

  hide() {
    this.setVisible(false);
  }

  isOpen() {
    return this.visible;
  }
}
