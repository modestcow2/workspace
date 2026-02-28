import { GROWTH_STAGES } from './Constants.js';

export class AssetGenerator {
  static generateAll(scene) {
    this.generateDogSprites(scene);
    this.generateRoomBackground(scene);
    this.generateUI(scene);
    this.generateItems(scene);
    this.generateParticles(scene);
  }

  static generateDogSprites(scene) {
    // Puppy sprite (small, round)
    this.drawDog(scene, 'dog_puppy', 0.6, 0xD4915E);
    this.drawDog(scene, 'dog_juvenile', 0.8, 0xC47F4A);
    this.drawDog(scene, 'dog_adult', 1.0, 0xB36D38);

    // Sleeping dog
    this.drawSleepingDog(scene, 'dog_sleep', 0xD4915E);

    // Heart particle
    const heartGfx = scene.make.graphics({ add: false });
    heartGfx.fillStyle(0xFF6B9D, 1);
    heartGfx.fillCircle(8, 6, 5);
    heartGfx.fillCircle(16, 6, 5);
    heartGfx.fillTriangle(3, 8, 21, 8, 12, 20);
    heartGfx.generateTexture('heart', 24, 22);
    heartGfx.destroy();
  }

  static drawDog(scene, key, scale, color) {
    const g = scene.make.graphics({ add: false });
    const s = scale;
    const w = Math.round(80 * s);
    const h = Math.round(70 * s);
    const cx = 50;
    const cy = 45;

    // Body
    g.fillStyle(color, 1);
    g.fillEllipse(cx, cy + 10 * s, w, h);

    // Head
    g.fillStyle(color, 1);
    g.fillCircle(cx, cy - 20 * s, 25 * s);

    // Ears
    const earColor = Phaser.Display.Color.ValueToColor(color).darken(20).color;
    g.fillStyle(earColor, 1);
    g.fillEllipse(cx - 20 * s, cy - 35 * s, 14 * s, 22 * s);
    g.fillEllipse(cx + 20 * s, cy - 35 * s, 14 * s, 22 * s);

    // Eyes
    g.fillStyle(0x2C1810, 1);
    g.fillCircle(cx - 9 * s, cy - 22 * s, 4 * s);
    g.fillCircle(cx + 9 * s, cy - 22 * s, 4 * s);

    // Eye shine
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(cx - 7 * s, cy - 24 * s, 1.5 * s);
    g.fillCircle(cx + 11 * s, cy - 24 * s, 1.5 * s);

    // Nose
    g.fillStyle(0x2C1810, 1);
    g.fillCircle(cx, cy - 14 * s, 3 * s);

    // Mouth
    g.lineStyle(1.5 * s, 0x2C1810, 0.6);
    g.beginPath();
    g.moveTo(cx, cy - 11 * s);
    g.lineTo(cx - 5 * s, cy - 7 * s);
    g.moveTo(cx, cy - 11 * s);
    g.lineTo(cx + 5 * s, cy - 7 * s);
    g.strokePath();

    // Tail
    g.lineStyle(5 * s, color, 1);
    g.beginPath();
    g.moveTo(cx + 35 * s, cy + 5 * s);
    g.lineTo(cx + 45 * s, cy - 10 * s);
    g.lineTo(cx + 42 * s, cy - 20 * s);
    g.strokePath();

    // Legs
    g.fillStyle(color, 1);
    g.fillRoundedRect(cx - 22 * s, cy + 25 * s, 12 * s, 20 * s, 4 * s);
    g.fillRoundedRect(cx - 5 * s, cy + 25 * s, 12 * s, 20 * s, 4 * s);
    g.fillRoundedRect(cx + 10 * s, cy + 25 * s, 12 * s, 20 * s, 4 * s);
    g.fillRoundedRect(cx + 25 * s, cy + 25 * s, 12 * s, 18 * s, 4 * s);

    // Paw details
    g.fillStyle(earColor, 1);
    g.fillCircle(cx - 16 * s, cy + 44 * s, 4 * s);
    g.fillCircle(cx + 1 * s, cy + 44 * s, 4 * s);
    g.fillCircle(cx + 16 * s, cy + 44 * s, 4 * s);
    g.fillCircle(cx + 31 * s, cy + 42 * s, 4 * s);

    // Cheeks (blush)
    g.fillStyle(0xFFB5B5, 0.3);
    g.fillCircle(cx - 16 * s, cy - 14 * s, 5 * s);
    g.fillCircle(cx + 16 * s, cy - 14 * s, 5 * s);

    g.generateTexture(key, 100, 90);
    g.destroy();
  }

  static drawSleepingDog(scene, key, color) {
    const g = scene.make.graphics({ add: false });
    const s = 0.7;
    const cx = 50;
    const cy = 50;

    // Curled up body
    g.fillStyle(color, 1);
    g.fillEllipse(cx, cy + 5, 75 * s, 50 * s);

    // Head resting
    g.fillCircle(cx - 20 * s, cy - 10 * s, 22 * s);

    // Ears
    const earColor = Phaser.Display.Color.ValueToColor(color).darken(20).color;
    g.fillStyle(earColor, 1);
    g.fillEllipse(cx - 35 * s, cy - 25 * s, 12 * s, 18 * s);
    g.fillEllipse(cx - 5 * s, cy - 25 * s, 12 * s, 18 * s);

    // Closed eyes (lines)
    g.lineStyle(2, 0x2C1810, 0.8);
    g.beginPath();
    g.moveTo(cx - 28 * s, cy - 12 * s);
    g.lineTo(cx - 18 * s, cy - 12 * s);
    g.moveTo(cx - 12 * s, cy - 12 * s);
    g.lineTo(cx - 2 * s, cy - 12 * s);
    g.strokePath();

    // Nose
    g.fillStyle(0x2C1810, 1);
    g.fillCircle(cx - 20 * s, cy - 4 * s, 2.5 * s);

    // Tail curled
    g.lineStyle(5 * s, color, 1);
    g.beginPath();
    g.arc(cx + 30 * s, cy - 5 * s, 15 * s, 0, Math.PI * 1.2);
    g.strokePath();

    // Zzz
    g.fillStyle(0x6B8CFF, 0.7);
    const style = { font: '14px Arial', fill: '#6B8CFF' };
    g.generateTexture(key, 100, 80);
    g.destroy();
  }

  static generateRoomBackground(scene) {
    // Room backgrounds for different times of day
    this.drawRoom(scene, 'room_morning', 0xFFF8EE, 0x87CEEB, 0xFFE4B5);
    this.drawRoom(scene, 'room_afternoon', 0xFFF5E6, 0x4FC3F7, 0xFFD54F);
    this.drawRoom(scene, 'room_evening', 0xFFE8D0, 0xFF8A65, 0xFFAB40);
    this.drawRoom(scene, 'room_night', 0xE8DCC8, 0x1A237E, 0x283593);
  }

  static drawRoom(scene, key, wallColor, skyColor, accentColor) {
    const g = scene.make.graphics({ add: false });
    const W = 800;
    const H = 600;

    // Wall
    g.fillStyle(wallColor, 1);
    g.fillRect(0, 0, W, H);

    // Subtle wallpaper pattern
    g.fillStyle(accentColor, 0.03);
    for (let x = 0; x < W; x += 40) {
      for (let y = 0; y < H; y += 40) {
        g.fillCircle(x + 20, y + 20, 3);
      }
    }

    // Floor
    const floorY = 420;
    g.fillStyle(0xC4A882, 1);
    g.fillRect(0, floorY, W, H - floorY);

    // Floor planks
    g.lineStyle(1, 0xB39770, 0.3);
    for (let y = floorY; y < H; y += 25) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.strokePath();
    }
    for (let x = 0; x < W; x += 80) {
      g.beginPath();
      g.moveTo(x, floorY);
      g.lineTo(x, H);
      g.strokePath();
    }

    // Baseboard
    g.fillStyle(0x8B7355, 1);
    g.fillRect(0, floorY - 5, W, 8);

    // Window
    const winX = 550;
    const winY = 100;
    const winW = 160;
    const winH = 200;

    // Window frame
    g.fillStyle(0xF5F5DC, 1);
    g.fillRect(winX - 8, winY - 8, winW + 16, winH + 16);
    g.fillStyle(skyColor, 1);
    g.fillRect(winX, winY, winW, winH);

    // Window cross
    g.fillStyle(0xF5F5DC, 1);
    g.fillRect(winX + winW / 2 - 3, winY, 6, winH);
    g.fillRect(winX, winY + winH / 2 - 3, winW, 6);

    // Curtains
    g.fillStyle(0xFFB6C1, 0.3);
    g.fillTriangle(winX - 15, winY - 10, winX + 30, winY - 10, winX - 15, winY + 120);
    g.fillTriangle(winX + winW + 15, winY - 10, winX + winW - 30, winY - 10, winX + winW + 15, winY + 120);

    // Curtain rod
    g.fillStyle(0x8B7355, 1);
    g.fillRect(winX - 20, winY - 15, winW + 40, 6);

    // Wall decoration - picture frame
    g.fillStyle(0x8B7355, 1);
    g.fillRect(100, 120, 110, 90);
    g.fillStyle(0xE8F5E9, 1);
    g.fillRect(105, 125, 100, 80);
    // Simple landscape in frame
    g.fillStyle(0x81C784, 1);
    g.fillRect(105, 165, 100, 40);
    g.fillStyle(0x64B5F6, 1);
    g.fillRect(105, 125, 100, 40);
    g.fillStyle(0xFFEB3B, 1);
    g.fillCircle(170, 140, 12);

    // Rug
    g.fillStyle(0xE88D67, 0.4);
    g.fillEllipse(400, 480, 300, 60);
    g.fillStyle(0xD4735E, 0.3);
    g.fillEllipse(400, 480, 240, 45);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  static generateUI(scene) {
    // Button backgrounds
    const btnW = 70;
    const btnH = 70;
    const g = scene.make.graphics({ add: false });

    g.fillStyle(0xE8C990, 1);
    g.fillRoundedRect(0, 0, btnW, btnH, 12);
    g.lineStyle(2, 0xD4A574, 1);
    g.strokeRoundedRect(0, 0, btnW, btnH, 12);
    g.generateTexture('btn_normal', btnW, btnH);
    g.destroy();

    const g2 = scene.make.graphics({ add: false });
    g2.fillStyle(0xD4A574, 1);
    g2.fillRoundedRect(0, 0, btnW, btnH, 12);
    g2.lineStyle(2, 0xC49464, 1);
    g2.strokeRoundedRect(0, 0, btnW, btnH, 12);
    g2.generateTexture('btn_hover', btnW, btnH);
    g2.destroy();

    // Stat bar backgrounds
    const barG = scene.make.graphics({ add: false });
    barG.fillStyle(0xFFFFFF, 1);
    barG.fillRoundedRect(0, 0, 100, 12, 6);
    barG.generateTexture('bar_bg', 100, 12);
    barG.destroy();

    // Ball for mini-game
    const ballG = scene.make.graphics({ add: false });
    ballG.fillStyle(0xFF4444, 1);
    ballG.fillCircle(15, 15, 15);
    ballG.fillStyle(0xFFFFFF, 0.4);
    ballG.fillCircle(10, 10, 5);
    ballG.generateTexture('ball', 30, 30);
    ballG.destroy();

    // Treat for mini-game
    const treatG = scene.make.graphics({ add: false });
    treatG.fillStyle(0xD4915E, 1);
    treatG.fillEllipse(12, 8, 24, 16);
    treatG.fillStyle(0xC47F4A, 1);
    treatG.fillEllipse(12, 8, 16, 10);
    treatG.generateTexture('treat', 24, 16);
    treatG.destroy();

    // Bubble (bath)
    const bubbleG = scene.make.graphics({ add: false });
    bubbleG.fillStyle(0xFFFFFF, 0.6);
    bubbleG.fillCircle(10, 10, 10);
    bubbleG.fillStyle(0xFFFFFF, 0.9);
    bubbleG.fillCircle(7, 7, 3);
    bubbleG.generateTexture('bubble', 20, 20);
    bubbleG.destroy();
  }

  static generateItems(scene) {
    // Food bowl
    const bowlG = scene.make.graphics({ add: false });
    bowlG.fillStyle(0xFF8C42, 1);
    bowlG.fillEllipse(25, 20, 50, 30);
    bowlG.fillStyle(0xFFAA66, 1);
    bowlG.fillEllipse(25, 18, 40, 22);
    bowlG.generateTexture('food_bowl', 50, 35);
    bowlG.destroy();

    // Bathtub
    const tubG = scene.make.graphics({ add: false });
    tubG.fillStyle(0xE0E0E0, 1);
    tubG.fillRoundedRect(0, 10, 120, 60, 10);
    tubG.fillStyle(0x90CAF9, 0.7);
    tubG.fillRoundedRect(5, 15, 110, 45, 8);
    // Bubbles
    tubG.fillStyle(0xFFFFFF, 0.8);
    tubG.fillCircle(20, 15, 8);
    tubG.fillCircle(35, 10, 10);
    tubG.fillCircle(55, 12, 7);
    tubG.fillCircle(75, 8, 9);
    tubG.fillCircle(95, 14, 8);
    tubG.generateTexture('bathtub', 120, 75);
    tubG.destroy();
  }

  static generateParticles(scene) {
    // Star particle
    const starG = scene.make.graphics({ add: false });
    starG.fillStyle(0xFFD700, 1);
    const cx = 8, cy = 8, r = 8, ri = 3;
    starG.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) starG.moveTo(x, y);
      else starG.lineTo(x, y);
      const angle2 = angle + (2 * Math.PI) / 10;
      starG.lineTo(cx + ri * Math.cos(angle2), cy + ri * Math.sin(angle2));
    }
    starG.closePath();
    starG.fillPath();
    starG.generateTexture('star', 16, 16);
    starG.destroy();

    // Sparkle
    const sparkG = scene.make.graphics({ add: false });
    sparkG.fillStyle(0xFFFFFF, 1);
    sparkG.fillCircle(4, 4, 4);
    sparkG.generateTexture('sparkle', 8, 8);
    sparkG.destroy();
  }
}
