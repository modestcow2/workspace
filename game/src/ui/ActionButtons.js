import Phaser from 'phaser';

export class ActionButtons extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    this.buttons = [];
    this.createButtons();
  }

  createButtons() {
    const actions = [
      { id: 'feed', icon: '🍖', label: '먹이' },
      { id: 'play', icon: '⚽', label: '놀기' },
      { id: 'bath', icon: '🛁', label: '목욕' },
      { id: 'sleep', icon: '💤', label: '수면' },
      { id: 'shop', icon: '🛍️', label: '상점' },
    ];

    const spacing = 90;
    const startX = -(actions.length - 1) * spacing / 2;

    actions.forEach((action, i) => {
      const bx = startX + i * spacing;
      const btn = this.createButton(bx, 0, action);
      this.buttons.push(btn);
    });
  }

  createButton(x, y, action) {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xE8C990, 1);
    bg.fillRoundedRect(-33, -33, 66, 66, 14);
    bg.lineStyle(2, 0xD4A574, 1);
    bg.strokeRoundedRect(-33, -33, 66, 66, 14);

    const icon = this.scene.add.text(0, -6, action.icon, {
      fontSize: '26px',
    });
    icon.setOrigin(0.5);

    const label = this.scene.add.text(0, 22, action.label, {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
    });
    label.setOrigin(0.5);

    container.add([bg, icon, label]);
    container.setSize(66, 66);
    container.setInteractive();

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0xD4A574, 1);
      bg.fillRoundedRect(-33, -33, 66, 66, 14);
      bg.lineStyle(2, 0xC49464, 1);
      bg.strokeRoundedRect(-33, -33, 66, 66, 14);
      container.setScale(1.05);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0xE8C990, 1);
      bg.fillRoundedRect(-33, -33, 66, 66, 14);
      bg.lineStyle(2, 0xD4A574, 1);
      bg.strokeRoundedRect(-33, -33, 66, 66, 14);
      container.setScale(1);
    });

    container.on('pointerdown', () => {
      this.scene.events.emit('action-' + action.id);
    });

    this.add(container);
    return container;
  }
}
