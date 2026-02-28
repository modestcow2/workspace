const SAVE_KEY = 'puppy_healing_game_save';

export class SaveManager {
  static save(dogState, inventory, roomDecor) {
    const data = {
      dog: dogState.toJSON(),
      inventory: inventory,
      roomDecor: roomDecor,
      savedAt: Date.now(),
      version: 1,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Apply offline time decay
      if (data.dog && data.dog.lastUpdate) {
        const elapsed = Date.now() - data.dog.lastUpdate;
        const hours = elapsed / (1000 * 60 * 60);
        if (hours > 0.1) {
          data.dog.hunger = Math.max(0, data.dog.hunger - hours * 5);
          data.dog.cleanliness = Math.max(0, data.dog.cleanliness - hours * 3);
          data.dog.happiness = Math.max(0, data.dog.happiness - hours * 4);
          data.dog.energy = Math.min(100, data.dog.energy + hours * 10);
        }
      }
      return data;
    } catch (e) {
      console.warn('Load failed:', e);
      return null;
    }
  }

  static hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
