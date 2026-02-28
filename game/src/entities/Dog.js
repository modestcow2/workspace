import Phaser from 'phaser';
import { GROWTH_STAGES, DOG_STATES } from '../utils/Constants.js';

export class Dog extends Phaser.GameObjects.Container {
  constructor(scene, x, y, dogState) {
    super(scene, x, y);
    scene.add.existing(this);

    this.dogState = dogState;
    this.currentAction = DOG_STATES.IDLE;
    this.moveTimer = 0;
    this.targetX = x;
    this.targetY = y;
    this.idleTimer = 0;
    this.bobOffset = 0;
    this.isSleeping = false;
    this.facingRight = true;

    // Boundaries for movement (room floor area)
    this.minX = 80;
    this.maxX = 720;
    this.minY = 380;
    this.maxY = 500;

    this.createSprite();
    this.createNameTag();
    this.createEmoteContainer();
    this.setSize(100, 90);
    this.setInteractive();

    // Enable input
    this.on('pointerdown', () => {
      if (!this.isSleeping) {
        this.scene.events.emit('dog-pet');
      }
    });
  }

  createSprite() {
    const key = this.getSpriteKey();
    this.sprite = this.scene.add.image(0, 0, key);
    this.sprite.setOrigin(0.5, 0.5);
    this.add(this.sprite);
    this.updateScale();
  }

  createNameTag() {
    this.nameTag = this.scene.add.text(0, -55, this.dogState.name, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      backgroundColor: '#FFF8EEcc',
      padding: { x: 8, y: 3 },
      align: 'center',
    });
    this.nameTag.setOrigin(0.5, 1);
    this.add(this.nameTag);
  }

  createEmoteContainer() {
    this.emoteText = this.scene.add.text(30, -60, '', {
      fontSize: '24px',
      fontFamily: 'Arial',
    });
    this.emoteText.setOrigin(0.5, 0.5);
    this.emoteText.setAlpha(0);
    this.add(this.emoteText);
  }

  getSpriteKey() {
    if (this.isSleeping) return 'dog_sleep';
    switch (this.dogState.growthStage) {
      case GROWTH_STAGES.PUPPY: return 'dog_puppy';
      case GROWTH_STAGES.JUVENILE: return 'dog_juvenile';
      case GROWTH_STAGES.ADULT: return 'dog_adult';
      default: return 'dog_puppy';
    }
  }

  updateScale() {
    const scales = [0.9, 1.1, 1.3];
    const s = scales[this.dogState.growthStage] || 0.9;
    this.sprite.setScale(this.facingRight ? s : -s, s);
  }

  showEmote(emoji, duration = 1500) {
    this.emoteText.setText(emoji);
    this.emoteText.setAlpha(1);
    this.scene.tweens.add({
      targets: this.emoteText,
      y: -80,
      alpha: 0,
      duration: duration,
      ease: 'Power2',
      onComplete: () => {
        this.emoteText.y = -60;
      },
    });
  }

  showHearts() {
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        const heart = this.scene.add.image(
          this.x + Phaser.Math.Between(-30, 30),
          this.y - 30,
          'heart'
        );
        heart.setScale(0.5);
        this.scene.tweens.add({
          targets: heart,
          y: heart.y - 60,
          alpha: 0,
          scale: 0.8,
          duration: 800,
          ease: 'Power2',
          onComplete: () => heart.destroy(),
        });
      });
    }
  }

  playEatAnimation() {
    this.currentAction = DOG_STATES.EATING;
    this.showEmote('🍖');

    // Bobbing eat animation
    this.scene.tweens.add({
      targets: this.sprite,
      y: 5,
      duration: 150,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        this.currentAction = DOG_STATES.IDLE;
        this.showEmote('😋');
      },
    });
  }

  playPetAnimation() {
    this.showHearts();
    this.showEmote('💕');

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.1,
      scaleY: this.sprite.scaleY * 1.1,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  playHappyAnimation() {
    this.currentAction = DOG_STATES.HAPPY;
    this.showEmote('⭐');

    this.scene.tweens.add({
      targets: this,
      y: this.y - 20,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.currentAction = DOG_STATES.IDLE;
      },
    });
  }

  playSleepAnimation() {
    this.isSleeping = true;
    this.currentAction = DOG_STATES.SLEEPING;
    this.sprite.setTexture('dog_sleep');
    this.updateScale();

    // Zzz effect
    this.sleepInterval = this.scene.time.addEvent({
      delay: 1500,
      callback: () => {
        if (this.isSleeping) {
          this.showEmote('💤', 1200);
        }
      },
      loop: true,
    });

    this.scene.time.delayedCall(5000, () => {
      this.wakeUp();
    });
  }

  wakeUp() {
    this.isSleeping = false;
    this.currentAction = DOG_STATES.IDLE;
    this.sprite.setTexture(this.getSpriteKey());
    this.updateScale();
    if (this.sleepInterval) {
      this.sleepInterval.remove();
    }
    this.showEmote('😊');
    this.dogState.sleep();
  }

  playBathAnimation() {
    this.currentAction = DOG_STATES.BATHING;
    this.showEmote('🛁');

    // Shake animation
    this.scene.tweens.add({
      targets: this,
      x: this.x - 5,
      duration: 80,
      yoyo: true,
      repeat: 8,
      onComplete: () => {
        this.showEmote('✨');
        this.currentAction = DOG_STATES.IDLE;

        // Sparkle particles
        for (let i = 0; i < 8; i++) {
          const sparkle = this.scene.add.image(
            this.x + Phaser.Math.Between(-40, 40),
            this.y + Phaser.Math.Between(-40, 20),
            'sparkle'
          );
          sparkle.setScale(0.5);
          sparkle.setTint(0x42C6FF);
          this.scene.tweens.add({
            targets: sparkle,
            alpha: 0,
            scale: 1.5,
            duration: 600,
            delay: i * 80,
            onComplete: () => sparkle.destroy(),
          });
        }
      },
    });
  }

  update(time, delta) {
    if (this.isSleeping || this.currentAction !== DOG_STATES.IDLE) return;

    this.idleTimer += delta;

    // Idle bobbing
    this.bobOffset += delta * 0.003;
    this.sprite.y = Math.sin(this.bobOffset) * 3;

    // Wander around the room occasionally
    this.moveTimer += delta;
    if (this.moveTimer > Phaser.Math.Between(3000, 6000)) {
      this.moveTimer = 0;
      this.wanderToNewPosition();
    }

    // Move towards target
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
    if (dist > 5) {
      const speed = 0.5;
      this.x += (this.targetX - this.x) * speed * (delta / 1000) * 2;
      this.y += (this.targetY - this.y) * speed * (delta / 1000) * 2;

      this.facingRight = this.targetX > this.x;
      this.updateScale();
    }

    // Mood-based reactions
    if (this.idleTimer > 10000) {
      this.idleTimer = 0;
      const mood = this.dogState.getMood();
      if (mood === 'sad') {
        this.showEmote('😢');
      } else if (mood === 'happy') {
        this.showEmote('😊');
      }
    }
  }

  wanderToNewPosition() {
    this.targetX = Phaser.Math.Between(this.minX, this.maxX);
    this.targetY = Phaser.Math.Between(this.minY, this.maxY);
  }

  moveTo(x, y) {
    this.targetX = Phaser.Math.Clamp(x, this.minX, this.maxX);
    this.targetY = Phaser.Math.Clamp(y, this.minY, this.maxY);
  }

  setAccessory(accId) {
    // Remove previous accessory display if any
    if (this.accessoryText) {
      this.accessoryText.destroy();
    }
    if (!accId) return;

    const accMap = {
      'ribbon': '🎀',
      'hat': '🎩',
      'scarf': '🧣',
      'glasses': '👓',
    };
    const emoji = accMap[accId] || '';
    if (emoji) {
      this.accessoryText = this.scene.add.text(0, -45, emoji, {
        fontSize: '20px',
      });
      this.accessoryText.setOrigin(0.5, 0.5);
      this.add(this.accessoryText);
    }
    this.dogState.accessory = accId;
  }
}
