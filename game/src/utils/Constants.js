export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const COLORS = {
  primary: 0x8B6914,
  secondary: 0xF5E6CA,
  accent: 0xFF6B9D,
  text: 0x4A3728,
  textLight: 0xFFFFFF,
  hunger: 0xFF8C42,
  happiness: 0xFFD700,
  cleanliness: 0x42C6FF,
  energy: 0x7ED957,
  affection: 0xFF6B9D,
  coin: 0xFFD700,
  panelBg: 0xFFF8EE,
  panelBorder: 0xD4A574,
  buttonBg: 0xE8C990,
  buttonHover: 0xD4A574,
};

export const DOG_STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  EATING: 'eating',
  PLAYING: 'playing',
  SLEEPING: 'sleeping',
  BATHING: 'bathing',
  HAPPY: 'happy',
};

export const GROWTH_STAGES = {
  PUPPY: 0,
  JUVENILE: 1,
  ADULT: 2,
};

export const GROWTH_THRESHOLDS = {
  [GROWTH_STAGES.JUVENILE]: { affection: 50, time: 120000 },
  [GROWTH_STAGES.ADULT]: { affection: 150, time: 300000 },
};

export const STAT_DECAY = {
  hunger: 0.15,
  happiness: 0.08,
  cleanliness: 0.05,
  energy: 0.03,
};

export const ITEMS = {
  foods: [
    { id: 'kibble', name: '사료', price: 5, hunger: 25, icon: '🍖' },
    { id: 'treat', name: '간식', price: 10, hunger: 15, happiness: 10, icon: '🦴' },
    { id: 'premium', name: '특별식', price: 25, hunger: 40, happiness: 15, icon: '🥩' },
  ],
  toys: [
    { id: 'ball', name: '공', price: 15, happiness: 20, icon: '⚽' },
    { id: 'rope', name: '로프', price: 20, happiness: 25, icon: '🪢' },
    { id: 'squeaky', name: '삑삑이', price: 30, happiness: 35, icon: '🧸' },
  ],
  accessories: [
    { id: 'ribbon', name: '리본', price: 20, icon: '🎀' },
    { id: 'hat', name: '모자', price: 35, icon: '🎩' },
    { id: 'scarf', name: '스카프', price: 30, icon: '🧣' },
    { id: 'glasses', name: '안경', price: 25, icon: '👓' },
  ],
  furniture: [
    { id: 'bed', name: '강아지 침대', price: 50, icon: '🛏️' },
    { id: 'bowl', name: '밥그릇', price: 15, icon: '🥣' },
    { id: 'plant', name: '화분', price: 20, icon: '🪴' },
    { id: 'lamp', name: '조명', price: 30, icon: '💡' },
  ],
};

export const TIME_OF_DAY = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
};
