import { STAT_DECAY, GROWTH_STAGES, GROWTH_THRESHOLDS } from '../utils/Constants.js';

export class DogState {
  constructor(savedData = null) {
    if (savedData) {
      Object.assign(this, savedData);
      return;
    }
    this.name = '멍멍이';
    this.hunger = 80;
    this.happiness = 70;
    this.cleanliness = 90;
    this.energy = 100;
    this.affection = 0;
    this.coins = 30;
    this.growthStage = GROWTH_STAGES.PUPPY;
    this.totalPlayTime = 0;
    this.accessory = null;
    this.lastUpdate = Date.now();
  }

  clamp(val) {
    return Math.max(0, Math.min(100, val));
  }

  update(delta) {
    const seconds = delta / 1000;
    this.hunger = this.clamp(this.hunger - STAT_DECAY.hunger * seconds);
    this.happiness = this.clamp(this.happiness - STAT_DECAY.happiness * seconds);
    this.cleanliness = this.clamp(this.cleanliness - STAT_DECAY.cleanliness * seconds);
    this.energy = this.clamp(this.energy - STAT_DECAY.energy * seconds);
    this.totalPlayTime += delta;
    this.checkGrowth();
  }

  feed(food) {
    this.hunger = this.clamp(this.hunger + (food.hunger || 0));
    this.happiness = this.clamp(this.happiness + (food.happiness || 0));
    this.affection += 1;
  }

  pet() {
    this.happiness = this.clamp(this.happiness + 5);
    this.affection += 2;
  }

  play(toy) {
    this.happiness = this.clamp(this.happiness + (toy?.happiness || 15));
    this.energy = this.clamp(this.energy - 10);
    this.affection += 3;
  }

  bathe() {
    this.cleanliness = this.clamp(this.cleanliness + 40);
    this.happiness = this.clamp(this.happiness + 5);
    this.affection += 2;
  }

  sleep() {
    this.energy = this.clamp(this.energy + 50);
    this.affection += 1;
  }

  miniGameReward(coins) {
    this.coins += coins;
    this.happiness = this.clamp(this.happiness + 10);
    this.affection += 5;
  }

  checkGrowth() {
    if (this.growthStage === GROWTH_STAGES.PUPPY) {
      const req = GROWTH_THRESHOLDS[GROWTH_STAGES.JUVENILE];
      if (this.affection >= req.affection && this.totalPlayTime >= req.time) {
        this.growthStage = GROWTH_STAGES.JUVENILE;
        return true;
      }
    } else if (this.growthStage === GROWTH_STAGES.JUVENILE) {
      const req = GROWTH_THRESHOLDS[GROWTH_STAGES.ADULT];
      if (this.affection >= req.affection && this.totalPlayTime >= req.time) {
        this.growthStage = GROWTH_STAGES.ADULT;
        return true;
      }
    }
    return false;
  }

  getMood() {
    const avg = (this.hunger + this.happiness + this.cleanliness + this.energy) / 4;
    if (avg > 70) return 'happy';
    if (avg > 40) return 'neutral';
    return 'sad';
  }

  getOverallScore() {
    return Math.round((this.hunger + this.happiness + this.cleanliness + this.energy) / 4);
  }

  toJSON() {
    return {
      name: this.name,
      hunger: this.hunger,
      happiness: this.happiness,
      cleanliness: this.cleanliness,
      energy: this.energy,
      affection: this.affection,
      coins: this.coins,
      growthStage: this.growthStage,
      totalPlayTime: this.totalPlayTime,
      accessory: this.accessory,
      lastUpdate: Date.now(),
    };
  }
}
