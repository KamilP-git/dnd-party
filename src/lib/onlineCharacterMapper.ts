import {
  OnlineCharacterData,
  createDefaultOnlineCharacterData,
} from "@/lib/onlineCharacterTemplate";

export type OnlineCharacterRow = {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  player_name: string;
  class_name: string;
  race: string;
  level: number;
  hp: number;
  max_hp: number | null;
  temporary_hp: number;
  armor_class: number;
  initiative: number;
  speed: number;
  hit_dice: number;
  portrait_url: string;
  description: string;
  data: unknown;
  created_at: string;
  updated_at: string;
};

export type OnlinePlayableCharacter = {
  id: string;
  campaignId: string;
  ownerId: string;

  name: string;
  playerName: string;
  className: string;
  race: string;
  level: number;

  hp: number;
  maxHp: number;
  temporaryHp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  hitDice: number;

  deathSaveSuccesses: number;
  deathSaveFailures: number;

  description: string;
  portraitUrl: string;

  stats: OnlineCharacterData["stats"];
  skillModifiers: OnlineCharacterData["skillModifiers"];
  inventory: OnlineCharacterData["inventory"];
  attackSpells: OnlineCharacterData["attackSpells"];
  classFeatures: OnlineCharacterData["classFeatures"];
  otherTraits: OnlineCharacterData["otherTraits"];
  resources: OnlineCharacterData["resources"];

  createdAt: string;
  updatedAt: string;
};

export function normalizeOnlineCharacterData(
  data: unknown,
): OnlineCharacterData {
  const defaultData = createDefaultOnlineCharacterData();

  if (!data || typeof data !== "object") {
    return defaultData;
  }

  const partialData = data as Partial<OnlineCharacterData>;

  return {
    ...defaultData,
    ...partialData,

    deathSaveSuccesses: partialData.deathSaveSuccesses ?? 0,
    deathSaveFailures: partialData.deathSaveFailures ?? 0,

    stats: {
      ...defaultData.stats,
      ...(partialData.stats ?? {}),
    },

    skillModifiers: {
      ...defaultData.skillModifiers,
      ...(partialData.skillModifiers ?? {}),
    },

    inventory: partialData.inventory ?? defaultData.inventory,
    attackSpells: partialData.attackSpells ?? defaultData.attackSpells,
    classFeatures: partialData.classFeatures ?? defaultData.classFeatures,
    otherTraits: partialData.otherTraits ?? defaultData.otherTraits,
    resources: partialData.resources ?? defaultData.resources,
  };
}

export function onlineRowToPlayableCharacter(
  row: OnlineCharacterRow,
): OnlinePlayableCharacter {
  const data = normalizeOnlineCharacterData(row.data);

  return {
    id: row.id,
    campaignId: row.campaign_id,
    ownerId: row.owner_id,

    name: row.name,
    playerName: row.player_name,
    className: row.class_name,
    race: row.race,
    level: row.level,

    hp: row.hp,
    maxHp: row.max_hp ?? row.hp,
    temporaryHp: row.temporary_hp,
    armorClass: row.armor_class,
    initiative: row.initiative,
    speed: row.speed,
    hitDice: row.hit_dice,

    deathSaveSuccesses: data.deathSaveSuccesses,
    deathSaveFailures: data.deathSaveFailures,

    description: row.description,
    portraitUrl: row.portrait_url,

    stats: data.stats,
    skillModifiers: data.skillModifiers,
    inventory: data.inventory,
    attackSpells: data.attackSpells,
    classFeatures: data.classFeatures,
    otherTraits: data.otherTraits,
    resources: data.resources,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function playableCharacterToOnlineUpdatePayload(
  character: OnlinePlayableCharacter,
) {
  const data: OnlineCharacterData = {
    deathSaveSuccesses: character.deathSaveSuccesses,
    deathSaveFailures: character.deathSaveFailures,

    stats: character.stats,
    skillModifiers: character.skillModifiers,

    inventory: character.inventory,
    attackSpells: character.attackSpells,
    classFeatures: character.classFeatures,
    otherTraits: character.otherTraits,
    resources: character.resources,
  };

  return {
    name: character.name.trim() || "Nowa postać",
    player_name: character.playerName.trim(),
    class_name: character.className.trim(),
    race: character.race.trim(),

    level: character.level,
    hp: character.hp,
    max_hp: character.maxHp,
    temporary_hp: character.temporaryHp,
    armor_class: character.armorClass,
    initiative: character.initiative,
    speed: character.speed,
    hit_dice: character.hitDice,

    portrait_url: character.portraitUrl.trim(),
    description: character.description.trim(),

    data,
    updated_at: new Date().toISOString(),
  };
}