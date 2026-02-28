export class Inventory {
  constructor(savedData = null) {
    if (savedData) {
      this.foods = savedData.foods || {};
      this.toys = savedData.toys || {};
      this.accessories = savedData.accessories || [];
      this.furniture = savedData.furniture || [];
      return;
    }
    this.foods = {};
    this.toys = {};
    this.accessories = [];
    this.furniture = [];
  }

  addFood(foodId, qty = 1) {
    this.foods[foodId] = (this.foods[foodId] || 0) + qty;
  }

  useFood(foodId) {
    if ((this.foods[foodId] || 0) > 0) {
      this.foods[foodId]--;
      return true;
    }
    return false;
  }

  getFoodCount(foodId) {
    return this.foods[foodId] || 0;
  }

  addToy(toyId) {
    this.toys[toyId] = true;
  }

  hasToy(toyId) {
    return !!this.toys[toyId];
  }

  addAccessory(accId) {
    if (!this.accessories.includes(accId)) {
      this.accessories.push(accId);
    }
  }

  hasAccessory(accId) {
    return this.accessories.includes(accId);
  }

  addFurniture(furnId) {
    if (!this.furniture.includes(furnId)) {
      this.furniture.push(furnId);
    }
  }

  hasFurniture(furnId) {
    return this.furniture.includes(furnId);
  }

  toJSON() {
    return {
      foods: { ...this.foods },
      toys: { ...this.toys },
      accessories: [...this.accessories],
      furniture: [...this.furniture],
    };
  }
}
