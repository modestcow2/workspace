import Phaser from 'phaser';

export class BallGame {
  constructor(scene, dog, dogState) {
    this.scene = scene;
    this.dog = dog;
    this.dogState = dogState;
    this.active = false;
    this.fetchCount = 0;
    this.maxFetches = 5;
  }

  start() {
    this.active = true;
    this.fetchCount = 0;

    // Instruction
    this.instruction = this.scene.add.text(400, 50, '⚽ 공을 드래그해서 던져주세요! (0/5)', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      backgroundColor: '#FFF8EEdd',
      padding: { x: 15, y: 8 },
    });
    this.instruction.setOrigin(0.5, 0);
    this.instruction.setDepth(100);

    this.spawnBall();
  }

  spawnBall() {
    if (!this.active) return;

    this.ball = this.scene.add.image(400, 480, 'ball');
    this.ball.setScale(1.5);
    this.ball.setInteractive({ draggable: true });
    this.ball.setDepth(50);

    let startY = 0;
    this.ball.on('dragstart', (pointer) => {
      startY = pointer.y;
    });

    this.ball.on('drag', (pointer, dragX, dragY) => {
      this.ball.x = dragX;
      this.ball.y = dragY;
    });

    this.ball.on('dragend', (pointer) => {
      const throwPower = startY - pointer.y;
      if (throwPower > 30) {
        this.throwBall(pointer.x, throwPower);
      } else {
        // Not thrown hard enough, reset
        this.scene.tweens.add({
          targets: this.ball,
          x: 400,
          y: 480,
          duration: 300,
        });
      }
    });
  }

  throwBall(targetX, power) {
    const landX = Phaser.Math.Clamp(targetX, 100, 700);
    const landY = Phaser.Math.Clamp(480 - power * 0.3, 350, 450);

    // Ball arc animation
    this.scene.tweens.add({
      targets: this.ball,
      x: landX,
      y: landY,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Dog runs to fetch
        this.dog.moveTo(landX, landY);
        this.scene.time.delayedCall(1500, () => {
          this.fetchCount++;
          this.ball.destroy();
          this.dog.showEmote('⚽');
          this.dog.playHappyAnimation();

          if (this.instruction) {
            this.instruction.setText(`⚽ 공을 드래그해서 던져주세요! (${this.fetchCount}/${this.maxFetches})`);
          }

          if (this.fetchCount >= this.maxFetches) {
            this.end();
          } else {
            this.scene.time.delayedCall(800, () => this.spawnBall());
          }
        });
      },
    });
  }

  end() {
    this.active = false;
    const reward = 10 + this.fetchCount * 2;
    this.dogState.miniGameReward(reward);
    this.dogState.play();

    if (this.instruction) {
      this.instruction.setText(`🎉 잘했어요! +${reward} 코인!`);
      this.scene.time.delayedCall(2000, () => {
        if (this.instruction) {
          this.instruction.destroy();
          this.instruction = null;
        }
      });
    }

    this.scene.events.emit('minigame-end');
  }

  destroy() {
    if (this.ball) this.ball.destroy();
    if (this.instruction) this.instruction.destroy();
    this.active = false;
  }
}

export class TreatFindGame {
  constructor(scene, dog, dogState) {
    this.scene = scene;
    this.dog = dog;
    this.dogState = dogState;
    this.active = false;
    this.treats = [];
    this.found = 0;
    this.totalTreats = 5;
  }

  start() {
    this.active = true;
    this.found = 0;
    this.treats = [];

    this.instruction = this.scene.add.text(400, 50, `🦴 간식을 찾아주세요! (0/${this.totalTreats})`, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      backgroundColor: '#FFF8EEdd',
      padding: { x: 15, y: 8 },
    });
    this.instruction.setOrigin(0.5, 0);
    this.instruction.setDepth(100);

    // Hide treats around the room
    for (let i = 0; i < this.totalTreats; i++) {
      const tx = Phaser.Math.Between(100, 700);
      const ty = Phaser.Math.Between(350, 500);
      const treat = this.scene.add.image(tx, ty, 'treat');
      treat.setScale(0.8);
      treat.setAlpha(0.4);
      treat.setInteractive();
      treat.setDepth(20);

      treat.on('pointerdown', () => {
        this.foundTreat(treat);
      });

      this.treats.push(treat);
    }
  }

  foundTreat(treat) {
    if (!this.active) return;
    this.found++;

    // Treat found animation
    this.scene.tweens.add({
      targets: treat,
      alpha: 1,
      scale: 1.5,
      duration: 200,
      onComplete: () => {
        // Dog runs to treat
        this.dog.moveTo(treat.x, treat.y);
        this.scene.time.delayedCall(800, () => {
          treat.destroy();
          this.dog.showEmote('🦴');
        });
      },
    });

    this.instruction.setText(`🦴 간식을 찾아주세요! (${this.found}/${this.totalTreats})`);

    if (this.found >= this.totalTreats) {
      this.scene.time.delayedCall(1000, () => this.end());
    }
  }

  end() {
    this.active = false;
    const reward = 8 + this.found * 3;
    this.dogState.miniGameReward(reward);

    if (this.instruction) {
      this.instruction.setText(`🎉 모두 찾았어요! +${reward} 코인!`);
      this.scene.time.delayedCall(2000, () => {
        if (this.instruction) {
          this.instruction.destroy();
          this.instruction = null;
        }
      });
    }

    this.scene.events.emit('minigame-end');
  }

  destroy() {
    this.treats.forEach(t => { if (t && t.active) t.destroy(); });
    if (this.instruction) this.instruction.destroy();
    this.active = false;
  }
}

export class BathGame {
  constructor(scene, dog, dogState) {
    this.scene = scene;
    this.dog = dog;
    this.dogState = dogState;
    this.active = false;
    this.scrubCount = 0;
    this.targetScrubs = 15;
  }

  start() {
    this.active = true;
    this.scrubCount = 0;

    // Move dog to center
    this.dog.moveTo(400, 440);

    this.instruction = this.scene.add.text(400, 50, '🛁 강아지를 문질러 씻겨주세요! (0%)', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      color: '#4A3728',
      backgroundColor: '#FFF8EEdd',
      padding: { x: 15, y: 8 },
    });
    this.instruction.setOrigin(0.5, 0);
    this.instruction.setDepth(100);

    // Bathtub behind dog
    this.tub = this.scene.add.image(400, 460, 'bathtub');
    this.tub.setScale(1.5);
    this.tub.setDepth(5);

    // Create scrub zone
    this.scrubZone = this.scene.add.zone(400, 440, 200, 150);
    this.scrubZone.setInteractive();
    this.scrubZone.setDepth(60);

    let lastPointerPos = null;
    this.scrubZone.on('pointermove', (pointer) => {
      if (!pointer.isDown || !this.active) return;

      if (lastPointerPos) {
        const dist = Phaser.Math.Distance.Between(
          lastPointerPos.x, lastPointerPos.y, pointer.x, pointer.y
        );
        if (dist > 10) {
          this.scrub(pointer.x, pointer.y);
          lastPointerPos = { x: pointer.x, y: pointer.y };
        }
      } else {
        lastPointerPos = { x: pointer.x, y: pointer.y };
      }
    });

    this.scrubZone.on('pointerup', () => {
      lastPointerPos = null;
    });
  }

  scrub(x, y) {
    this.scrubCount++;

    // Bubble effect
    const bubble = this.scene.add.image(
      x + Phaser.Math.Between(-20, 20),
      y + Phaser.Math.Between(-20, 10),
      'bubble'
    );
    bubble.setScale(Phaser.Math.FloatBetween(0.5, 1.2));
    bubble.setDepth(55);
    this.scene.tweens.add({
      targets: bubble,
      y: bubble.y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => bubble.destroy(),
    });

    const pct = Math.min(100, Math.round((this.scrubCount / this.targetScrubs) * 100));
    this.instruction.setText(`🛁 강아지를 문질러 씻겨주세요! (${pct}%)`);

    if (this.scrubCount >= this.targetScrubs) {
      this.end();
    }
  }

  end() {
    this.active = false;
    this.dogState.bathe();
    this.dog.playBathAnimation();
    const reward = 12;
    this.dogState.miniGameReward(reward);

    if (this.tub) this.tub.destroy();
    if (this.scrubZone) this.scrubZone.destroy();

    if (this.instruction) {
      this.instruction.setText(`✨ 깨끗해졌어요! +${reward} 코인!`);
      this.scene.time.delayedCall(2000, () => {
        if (this.instruction) {
          this.instruction.destroy();
          this.instruction = null;
        }
      });
    }

    this.scene.events.emit('minigame-end');
  }

  destroy() {
    if (this.tub) this.tub.destroy();
    if (this.scrubZone) this.scrubZone.destroy();
    if (this.instruction) this.instruction.destroy();
    this.active = false;
  }
}
