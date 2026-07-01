export type OnlineCharacterData = {
  deathSaveSuccesses: number;
  deathSaveFailures: number;

  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };

  skillModifiers: Record<string, number>;

  inventory: {
    id: string;
    name: string;
    quantity: number;
    description: string;
    imageUrl?: string;
  }[];

  attackSpells: {
    id: string;
    name: string;
    imageUrl?: string;
    attackRoll?: string;
    damageRoll?: string;
    description: string;
  }[];

  classFeatures: {
    id: string;
    name: string;
    imageUrl?: string;
    description: string;
  }[];

  otherTraits: {
    id: string;
    name: string;
    description: string;
  }[];

  resources: {
    id: string;
    name: string;
    current: number;
    maximum?: number;
    description: string;
  }[];
};

export function createDefaultOnlineCharacterData(): OnlineCharacterData {
  return {
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,

    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },

    skillModifiers: {},

    inventory: [],
    attackSpells: [],
    classFeatures: [],
    otherTraits: [],
    resources: [],
  };
}