import Phaser from 'phaser';
import { Dog } from '../entities/Dog.js';
import { DogState } from '../systems/DogState.js';
import { Inventory } from '../systems/Inventory.js';
import { SaveManager } from '../systems/SaveManager.js';
import { StatusBar } from '../ui/StatusBar.js';
import { ActionButtons } from '../ui/ActionButtons.js';
import { ShopPanel } from '../ui/ShopPanel.js';
import { FeedPanel } from '../ui/FeedPanel.js';
import { BallGame, TreatFindGame, BathGame } from '../ui/MiniGames.js';
import { TIME_OF_DAY, GROWTH_STAGES } from '../utils/Constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.isNewGame = data?.newGame !== false;
  }

  create() {
    // Load or create state
    if (!this.isNewGame) {
      const saved = SaveManager.load();
      if (saved) {
        this.dogState = new DogState(saved.dog);
        this.inventory = new Inventory(saved.inventory);
        this.roomDecor = saved.roomDecor || {};
      }
    }
    if (!this.dogState) {
      this.dogState = new DogState();
      this.inventory = new Inventory();
      this.roomDecor = {};
      // Starting items
      this.inventory.addFood('kibble', 5);
      this.inventory.addFood('treat', 2);
    }

    this.miniGame = null;
    this.autoSaveTimer = 0;
    this.gameTimeAccum = 0;

    // Create room
    this.createRoom();

    // Create dog
    this.dog = new Dog(this, 400, 440, this.dogState);
    this.dog.setDepth(30);

    // Apply saved accessory
    if (this.dogState.accessory) {
      this.dog.setAccessory(this.dogState.accessory);
    }

    // Place furniture
    this.createFurniture();

    // UI layer
    this.statusBar = new StatusBar(this, 50, 555, this.dogState);
    this.statusBar.setDepth(80);

    this.actionButtons = new ActionButtons(this, 400, 555);
    this.actionButtons.setDepth(80);

    // Bottom bar background
    this.bottomBar = this.add.graphics();
    this.bottomBar.fillStyle(0x4A3728, 0.85);
    this.bottomBar.fillRoundedRect(0, 515, 800, 85, { tl: 15, tr: 15, bl: 0, br: 0 });
    this.bottomBar.setDepth(79);

    // Panels (hidden by default)
    this.shopPanel = new ShopPanel(this, this.dogState, this.inventory);
    this.shopPanel.setDepth(90);

    this.feedPanel = new FeedPanel(this, this.dogState, this.inventory);
    this.feedPanel.setDepth(90);

    // Growth notification
    this.growthText = this.add.text(400, 300, '', {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#FF6B9D',
      fontStyle: 'bold',
      stroke: '#FFFFFF',
      strokeThickness: 4,
    });
    this.growthText.setOrigin(0.5);
    this.growthText.setDepth(95);
    this.growthText.setAlpha(0);

    // Setup event listeners
    this.setupEvents();

    // Time of day
    this.updateTimeOfDay();
    this.time.addEvent({
      delay: 60000,
      callback: () => this.updateTimeOfDay(),
      loop: true,
    });
  }

  createRoom() {
    const tod = this.getTimeOfDay();
    const roomKey = 'room_' + tod;
    this.roomBg = this.add.image(400, 300, roomKey);
    this.roomBg.setDepth(0);
  }

  createFurniture() {
    this.furnitureSprites = [];

    // Default furniture
    const defaultItems = [
      { id: 'bowl', x: 150, y: 470, emoji: '🥣', scale: 1.5 },
    ];

    // Add purchased furniture
    if (this.inventory.hasFurniture('bed')) {
      defaultItems.push({ id: 'bed', x: 650, y: 460, emoji: '🛏️', scale: 1.8 });
    }
    if (this.inventory.hasFurniture('plant')) {
      defaultItems.push({ id: 'plant', x: 80, y: 370, emoji: '🪴', scale: 1.8 });
    }
    if (this.inventory.hasFurniture('lamp')) {
      defaultItems.push({ id: 'lamp', x: 720, y: 340, emoji: '💡', scale: 1.8 });
    }

    defaultItems.forEach(item => {
      const sprite = this.add.text(item.x, item.y, item.emoji, {
        fontSize: `${Math.round(24 * item.scale)}px`,
      });
      sprite.setOrigin(0.5);
      sprite.setDepth(10);
      this.furnitureSprites.push(sprite);
    });
  }

  refreshFurniture() {
    this.furnitureSprites.forEach(s => s.destroy());
    this.furnitureSprites = [];
    this.createFurniture();
  }

  setupEvents() {
    // Dog petting
    this.events.on('dog-pet', () => {
      if (this.miniGame) return;
      this.dogState.pet();
      this.dog.playPetAnimation();
    });

    // Feed action
    this.events.on('action-feed', () => {
      if (this.miniGame) return;
      this.feedPanel.show();
    });

    // Dog was fed
    this.events.on('dog-fed', (food) => {
      this.dog.playEatAnimation();
    });

    // Play action - random mini game
    this.events.on('action-play', () => {
      if (this.miniGame) return;
      if (this.dogState.energy < 10) {
        this.showMessage('체력이 부족해요! 쉬게 해주세요 💤');
        return;
      }
      const games = ['ball', 'treat'];
      const pick = Phaser.Math.RND.pick(games);
      if (pick === 'ball') {
        this.miniGame = new BallGame(this, this.dog, this.dogState);
      } else {
        this.miniGame = new TreatFindGame(this, this.dog, this.dogState);
      }
      this.miniGame.start();
    });

    // Bath action
    this.events.on('action-bath', () => {
      if (this.miniGame) return;
      this.miniGame = new BathGame(this, this.dog, this.dogState);
      this.miniGame.start();
    });

    // Sleep action
    this.events.on('action-sleep', () => {
      if (this.miniGame) return;
      this.dog.playSleepAnimation();
    });

    // Shop action
    this.events.on('action-shop', () => {
      if (this.miniGame) return;
      this.shopPanel.show();
    });

    // Mini game ended
    this.events.on('minigame-end', () => {
      this.miniGame = null;
    });

    // Purchase event
    this.events.on('purchase', (item) => {
      this.showMessage(`${item.icon} ${item.name} 구매 완료!`);
      this.refreshFurniture();
    });
  }

  showMessage(text) {
    const msg = this.add.text(400, 250, text, {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      backgroundColor: '#FFF8EEee',
      padding: { x: 20, y: 10 },
    });
    msg.setOrigin(0.5);
    msg.setDepth(95);
    this.tweens.add({
      targets: msg,
      y: 200,
      alpha: 0,
      duration: 2000,
      delay: 500,
      onComplete: () => msg.destroy(),
    });
  }

  showGrowthNotification() {
    const stageNames = ['아기 강아지', '청소년 강아지', '성견'];
    const stageName = stageNames[this.dogState.growthStage] || '강아지';

    this.growthText.setText(`🎉 ${this.dogState.name}이(가) ${stageName}으로 성장했어요!`);
    this.growthText.setAlpha(1);

    // Star burst effect
    for (let i = 0; i < 20; i++) {
      const star = this.add.image(
        400 + Phaser.Math.Between(-150, 150),
        300 + Phaser.Math.Between(-100, 100),
        'star'
      );
      star.setScale(0);
      star.setDepth(94);
      this.tweens.add({
        targets: star,
        scale: Phaser.Math.FloatBetween(0.5, 1.5),
        alpha: 0,
        duration: 1500,
        delay: i * 50,
        ease: 'Power2',
        onComplete: () => star.destroy(),
      });
    }

    this.tweens.add({
      targets: this.growthText,
      alpha: 0,
      duration: 1000,
      delay: 3000,
    });

    // Update dog sprite
    this.dog.sprite.setTexture(this.dog.getSpriteKey());
    this.dog.updateScale();
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return TIME_OF_DAY.MORNING;
    if (hour >= 12 && hour < 17) return TIME_OF_DAY.AFTERNOON;
    if (hour >= 17 && hour < 20) return TIME_OF_DAY.EVENING;
    return TIME_OF_DAY.NIGHT;
  }

  updateTimeOfDay() {
    const tod = this.getTimeOfDay();
    const roomKey = 'room_' + tod;
    if (this.roomBg && this.roomBg.texture.key !== roomKey) {
      this.tweens.add({
        targets: this.roomBg,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          this.roomBg.setTexture(roomKey);
          this.tweens.add({
            targets: this.roomBg,
            alpha: 1,
            duration: 1000,
          });
        },
      });
    }
  }

  update(time, delta) {
    // Update dog state
    this.dogState.update(delta);

    // Check growth
    const prevStage = this.dogState.growthStage;
    if (this.dogState.checkGrowth() || this.dogState.growthStage !== prevStage) {
      this.showGrowthNotification();
    }

    // Update dog entity
    this.dog.update(time, delta);

    // Update UI
    this.statusBar.update();

    // Auto save every 30 seconds
    this.autoSaveTimer += delta;
    if (this.autoSaveTimer > 30000) {
      this.autoSaveTimer = 0;
      SaveManager.save(this.dogState, this.inventory.toJSON(), this.roomDecor);
    }
  }
}
