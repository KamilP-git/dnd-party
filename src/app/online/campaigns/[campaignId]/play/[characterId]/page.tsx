"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EditableNumber } from "@/components/EditableNumber";
import { EditableText } from "@/components/EditableText";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { ImageAsset, ImagePickerModal } from "@/components/ImagePickerModal";
import { createClient } from "@/lib/supabase/client";
import {
  OnlineCharacterRow,
  onlineRowToPlayableCharacter,
} from "@/lib/onlineCharacterMapper";

type CharacterTab = "general" | "stats" | "abilities" | "inventory";

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  description: string;
  imageUrl?: string;
};

type AttackSpellItem = {
  id: string;
  name: string;
  imageUrl?: string;
  attackRoll?: string;
  damageRoll?: string;
  description: string;
};

type ClassFeatureItem = {
  id: string;
  name: string;
  imageUrl?: string;
  description: string;
};

type OtherTraitItem = {
  id: string;
  name: string;
  description: string;
};

type CharacterStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

type SkillKey =
  | "acrobatics"
  | "animalHandling"
  | "arcana"
  | "athletics"
  | "deception"
  | "history"
  | "insight"
  | "intimidation"
  | "investigation"
  | "medicine"
  | "nature"
  | "perception"
  | "performance"
  | "persuasion"
  | "religion"
  | "sleightOfHand"
  | "stealth"
  | "survival";

type CharacterSkillModifiers = Partial<Record<SkillKey, number>>;

type CharacterResource = {
  id: string;
  name: string;
  current: number;
  maximum?: number;
  description: string;
};

type Character = {
  id: string;
  name: string;
  playerName: string;
  className: string;
  race: string;
  level: number;
  hp: number;
  maxHp?: number;
  temporaryHp?: number;
  initiative?: number;
  speed?: number;
  hitDice?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  armorClass: number;
  description: string;
  portraitUrl?: string;
  inventory?: InventoryItem[];
  stats?: CharacterStats;
  skillModifiers?: CharacterSkillModifiers;
  attackSpells?: AttackSpellItem[];
  classFeatures?: ClassFeatureItem[];
  otherTraits?: OtherTraitItem[];
  resources?: CharacterResource[];
  campaignIds?: string[];
  campaignId?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type OnlineCampaign = {
  id: string;
  name: string;
  description: string;
  notes: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  archived_at: string | null;
};

type OnlineDiceRollRow = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  user_id: string;
  character_name: string;
  formula: string;
  reason: string;
  rolls: number[];
  modifier: number;
  total: number;
  created_at: string;
};

type ImagePickerTarget =
  | { type: "portrait" }
  | { type: "inventory"; id: string }
  | { type: "attackSpell"; id: string }
  | { type: "classFeature"; id: string };

function onlineRollToLocalRoll(row: OnlineDiceRollRow): DiceRoll {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    characterId: row.character_id ?? "",
    characterName: row.character_name,
    formula: row.formula,
    reason: row.reason,
    rolls: row.rolls,
    modifier: row.modifier,
    total: row.total,
    createdAt: row.created_at,
  };
}

function characterToOnlineUpdatePayload(character: Character) {
  return {
    name: character.name.trim() || "Nowa postać",
    player_name: (character.playerName ?? "").trim(),
    class_name: (character.className ?? "").trim(),
    race: (character.race ?? "").trim(),
    level: character.level,
    hp: character.hp,
    max_hp: character.maxHp ?? character.hp,
    temporary_hp: character.temporaryHp ?? 0,
    armor_class: character.armorClass,
    initiative: character.initiative ?? 0,
    speed: character.speed ?? 30,
    hit_dice: character.hitDice ?? character.level,
    portrait_url: (character.portraitUrl ?? "").trim(),
    description: character.description ?? "",
    data: {
      deathSaveSuccesses: character.deathSaveSuccesses ?? 0,
      deathSaveFailures: character.deathSaveFailures ?? 0,
      stats: {
        ...defaultStats,
        ...(character.stats ?? {}),
      },
      skillModifiers: character.skillModifiers ?? {},
      inventory: character.inventory ?? [],
      attackSpells: character.attackSpells ?? [],
      classFeatures: character.classFeatures ?? [],
      otherTraits: character.otherTraits ?? [],
      resources: character.resources ?? [],
    },
    updated_at: new Date().toISOString(),
  };
}

function getCharacterCampaignIds(character: Character) {
  if (character.campaignIds && character.campaignIds.length > 0) {
    return character.campaignIds;
  }

  return ["main"];
}

type DiceRoll = {
  id: string;
  campaignId: string;
  characterId: string;
  characterName: string;
  formula: string;
  reason: string;
  rolls: number[];
  modifier: number;
  total: number;
  createdAt: string;
};

type DiceType = 4 | 6 | 8 | 10 | 12 | 20;

type DicePoolItem = {
  sides: DiceType;
  count: number;
};

const diceTypes: {
  sides: DiceType;
  label: string;
  icon: string;
}[] = [
  {
    sides: 4,
    label: "D4",
    icon: "△",
  },
  {
    sides: 6,
    label: "D6",
    icon: "□",
  },
  {
    sides: 8,
    label: "D8",
    icon: "◇",
  },
  {
    sides: 10,
    label: "D10",
    icon: "⬟",
  },
  {
    sides: 12,
    label: "D12",
    icon: "⬢",
  },
  {
    sides: 20,
    label: "D20",
    icon: "✦",
  },
];

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

const defaultStats: CharacterStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function getAbilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(modifier: number) {
  if (modifier >= 0) {
    return `+${modifier}`;
  }

  return String(modifier);
}

function getProficiencyBonus(level: number) {
  return Math.ceil(level / 4) + 1;
}

const abilityColumns: {
  key: keyof CharacterStats;
  shortName: string;
  fullName: string;
  icon: string;
}[] = [
  {
    key: "strength",
    shortName: "SIŁA",
    fullName: "Siła",
    icon: "💪",
  },
  {
    key: "dexterity",
    shortName: "ZRĘCZNOŚĆ",
    fullName: "Zręczność",
    icon: "🏹",
  },
  {
    key: "constitution",
    shortName: "WYTRZYMAŁOŚĆ",
    fullName: "Wytrzymałość",
    icon: "🛡️",
  },
  {
    key: "intelligence",
    shortName: "INTELIGENCJA",
    fullName: "Inteligencja",
    icon: "📘",
  },
  {
    key: "wisdom",
    shortName: "MĄDROŚĆ",
    fullName: "Mądrość",
    icon: "👁️",
  },
  {
    key: "charisma",
    shortName: "CHARYZMA",
    fullName: "Charyzma",
    icon: "🎭",
  },
];

const skillCards: {
  key: SkillKey;
  name: string;
  statKey: keyof CharacterStats;
  icon: string;
}[] = [
  {
    key: "athletics",
    name: "Atletyka",
    statKey: "strength",
    icon: "💪",
  },
  {
    key: "acrobatics",
    name: "Akrobatyka",
    statKey: "dexterity",
    icon: "🤸",
  },
  {
    key: "sleightOfHand",
    name: "Zwinne dłonie",
    statKey: "dexterity",
    icon: "🃏",
  },
  {
    key: "stealth",
    name: "Skradanie się",
    statKey: "dexterity",
    icon: "🥷",
  },
  {
    key: "arcana",
    name: "Wiedza tajemna",
    statKey: "intelligence",
    icon: "✨",
  },
  {
    key: "history",
    name: "Historia",
    statKey: "intelligence",
    icon: "📜",
  },
  {
    key: "investigation",
    name: "Śledztwo",
    statKey: "intelligence",
    icon: "🔍",
  },
  {
    key: "nature",
    name: "Natura",
    statKey: "intelligence",
    icon: "🌿",
  },
  {
    key: "religion",
    name: "Religia",
    statKey: "intelligence",
    icon: "⛪",
  },
  {
    key: "animalHandling",
    name: "Zwierzęta",
    statKey: "wisdom",
    icon: "🐺",
  },
  {
    key: "insight",
    name: "Intuicja",
    statKey: "wisdom",
    icon: "👁️",
  },
  {
    key: "medicine",
    name: "Medycyna",
    statKey: "wisdom",
    icon: "🩹",
  },
  {
    key: "perception",
    name: "Percepcja",
    statKey: "wisdom",
    icon: "👀",
  },
  {
    key: "survival",
    name: "Przetrwanie",
    statKey: "wisdom",
    icon: "🏕️",
  },
  {
    key: "deception",
    name: "Oszustwo",
    statKey: "charisma",
    icon: "🎭",
  },
  {
    key: "intimidation",
    name: "Zastraszanie",
    statKey: "charisma",
    icon: "💀",
  },
  {
    key: "performance",
    name: "Występy",
    statKey: "charisma",
    icon: "🎶",
  },
  {
    key: "persuasion",
    name: "Perswazja",
    statKey: "charisma",
    icon: "🗣️",
  },
];

function parseAndRollFormula(formula: string) {
  const cleanedFormula = formula.replaceAll(" ", "").toLowerCase();

  const match = cleanedFormula.match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) {
    return null;
  }

  const diceCount = Number(match[1] || 1);
  const diceSides = Number(match[2]);
  const modifier = Number(match[3] || 0);

  if (diceCount <= 0 || diceSides <= 0 || diceCount > 100) {
    return null;
  }

  const rolls = Array.from({ length: diceCount }, () => rollDie(diceSides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  return {
    rolls,
    modifier,
    total,
  };
}

function normalizeAttackRollFormula(attackRoll: string) {
  const cleanedAttackRoll = attackRoll.replaceAll(" ", "").toLowerCase();

  if (/^[+-]?\d+$/.test(cleanedAttackRoll)) {
    return `1d20${formatModifier(Number(cleanedAttackRoll))}`;
  }

  return attackRoll;
}

function parseResourceValue(valueText: string) {
  const cleanedValue = valueText.replaceAll(" ", "");
  const [currentText, maximumText] = cleanedValue.split("/");

  const parsedCurrent = Number(currentText || 0);
  const current = Number.isFinite(parsedCurrent) ? parsedCurrent : 0;

  if (maximumText === undefined || maximumText === "") {
    return {
      current: Math.max(0, current),
      maximum: undefined,
    };
  }

  const parsedMaximum = Number(maximumText);
  const maximum = Number.isFinite(parsedMaximum) ? parsedMaximum : 0;
  const safeMaximum = Math.max(0, maximum);

  return {
    current: Math.min(Math.max(0, current), safeMaximum),
    maximum: safeMaximum,
  };
}

function clampResourceCurrent(value: number, maximum?: number) {
  const safeValue = Math.max(0, value);

  if (typeof maximum === "number") {
    return Math.min(safeValue, maximum);
  }

  return safeValue;
}

export default function CampaignPlayPage() {
  const params = useParams();

  const campaignId = String(params.campaignId);
  const characterId = String(params.characterId);

  const [character, setCharacter] = useState<Character | null>(null);
  const [characterTab, setCharacterTab] = useState<CharacterTab>("general");

  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [dicePool, setDicePool] = useState<DicePoolItem[]>([]);
  const [diceModifier, setDiceModifier] = useState(0);
  const [manualFormula, setManualFormula] = useState("1d20");
  const [reason, setReason] = useState("");

  const [campaign, setCampaign] = useState<OnlineCampaign | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ładuję kartę postaci online...");
  const [realtimeStatus, setRealtimeStatus] = useState(
    "Realtime: łączę z Supabase...",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] =
    useState<ImagePickerTarget | null>(null);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const canEdit =
    !!userId &&
    !!character &&
    !!campaign &&
    (campaign.owner_id === userId ||
      ("ownerId" in character && character.ownerId === userId));

  useEffect(() => {
    async function loadOnlineCharacter() {
      setIsLoading(true);
      setStatus("Ładuję kartę postaci online...");

      const supabase = createClient();

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setUserId(null);
        setStatus("Musisz być zalogowany, żeby otworzyć kartę online.");
        setIsLoading(false);
        return;
      }

      setUserId(userData.user.id);

      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaignData) {
        setCampaign(null);
        setCharacter(null);
        setStatus(
          `Nie udało się pobrać kampanii: ${
            campaignError?.message ?? "brak danych"
          }`,
        );
        setIsLoading(false);
        return;
      }

      const { data: characterData, error: characterError } = await supabase
        .from("characters")
        .select("*")
        .eq("id", characterId)
        .eq("campaign_id", campaignId)
        .single();

      if (characterError || !characterData) {
        setCampaign(campaignData as OnlineCampaign);
        setCharacter(null);
        setStatus(
          `Nie udało się pobrać postaci: ${
            characterError?.message ?? "brak danych"
          }`,
        );
        setIsLoading(false);
        return;
      }

      const playableCharacter = onlineRowToPlayableCharacter(
        characterData as OnlineCharacterRow,
      );

      setCampaign(campaignData as OnlineCampaign);
      setCharacter(playableCharacter as unknown as Character);

      const { data: rollData, error: rollError } = await supabase
        .from("dice_rolls")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (rollError) {
        setDiceRolls([]);
      } else {
        setDiceRolls(
          ((rollData ?? []) as OnlineDiceRollRow[]).map(onlineRollToLocalRoll),
        );
      }

      setStatus("Karta postaci online została wczytana.");
      setIsLoading(false);
    }

    void loadOnlineCharacter();
  }, [campaignId, characterId]);

  function saveCharacter(updatedCharacter: Character) {
    if (!canEdit) {
      setStatus("Nie masz uprawnień do edycji tej postaci.");
      return;
    }

    setCharacter(updatedCharacter);
    setStatus("Zapisuję postać online...");

    void (async () => {
      const supabase = createClient();
      const updatePayload = characterToOnlineUpdatePayload(updatedCharacter);

      const { data: updatedRow, error } = await supabase
        .from("characters")
        .update(updatePayload)
        .eq("id", characterId)
        .eq("campaign_id", campaignId)
        .select("*")
        .single();

      if (error || !updatedRow) {
        setStatus(
          `Nie udało się zapisać postaci: ${
            error?.message ?? "brak danych po zapisie"
          }`,
        );
        return;
      }

      const syncedCharacter = onlineRowToPlayableCharacter(
        updatedRow as OnlineCharacterRow,
      ) as unknown as Character;

      setCharacter(syncedCharacter);
      setStatus("Postać została zapisana online.");

      await realtimeChannelRef.current?.send({
        type: "broadcast",
        event: "character-updated",
        payload: {
          character: updatedRow,
        },
      });
    })();
  }

  function updateCharacterField(
    field:
      | "hp"
      | "maxHp"
      | "temporaryHp"
      | "armorClass"
      | "level"
      | "initiative"
      | "speed"
      | "hitDice"
      | "deathSaveSuccesses"
      | "deathSaveFailures",
    value: number,
  ) {
    if (!character) {
      return;
    }

    saveCharacter({
      ...character,
      [field]: Math.max(0, value),
    });
  }

  function updateCharacterTextField(
    field:
      | "name"
      | "playerName"
      | "race"
      | "className"
      | "description"
      | "portraitUrl",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if ((field === "name" || field === "className") && !nextValue) {
      return;
    }

    saveCharacter({
      ...character,
      [field]: nextValue,
    });
  }

  function updateCharacterStat(statKey: keyof CharacterStats, value: number) {
    if (!character) {
      return;
    }

    const currentStats = {
      ...defaultStats,
      ...(character.stats ?? {}),
    };

    saveCharacter({
      ...character,
      stats: {
        ...currentStats,
        [statKey]: value,
      },
    });
  }

  function updateSkillModifier(skillKey: SkillKey, value: number) {
    if (!character) {
      return;
    }

    const updatedCharacter: Character = {
      ...character,
      skillModifiers: {
        ...(character.skillModifiers ?? {}),
        [skillKey]: value,
      },
    };

    saveCharacter(updatedCharacter);
  }
  function addCharacterResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("resourceName") || "").trim();
    const valueText = String(formData.get("resourceValue") || "").trim();
    const description = String(
      formData.get("resourceDescription") || "",
    ).trim();

    if (!name) {
      return;
    }

    const parsedResourceValue = parseResourceValue(valueText);

    const newResource: CharacterResource = {
      id: crypto.randomUUID(),
      name,
      current: parsedResourceValue.current,
      maximum: parsedResourceValue.maximum,
      description,
    };

    saveCharacter({
      ...character,
      resources: [...(character.resources ?? []), newResource],
    });

    event.currentTarget.reset();
  }

  function changeCharacterResourceCurrent(resourceId: string, change: number) {
    if (!character) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        return {
          ...resource,
          current: clampResourceCurrent(
            resource.current + change,
            resource.maximum,
          ),
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function updateCharacterResourceCurrent(resourceId: string, value: number) {
    if (!character) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        return {
          ...resource,
          current: clampResourceCurrent(value, resource.maximum),
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function updateCharacterResourceMaximum(resourceId: string, value: number) {
    if (!character) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        const maximum = Math.max(0, value);

        return {
          ...resource,
          maximum,
          current: clampResourceCurrent(resource.current, maximum),
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function addCharacterResourceMaximum(resourceId: string) {
    if (!character) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        return {
          ...resource,
          maximum: Math.max(resource.current, 1),
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function removeCharacterResourceMaximum(resourceId: string) {
    if (!character) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        return {
          id: resource.id,
          name: resource.name,
          current: resource.current,
          description: resource.description,
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function updateCharacterResourceText(
    resourceId: string,
    field: "name" | "description",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if (field === "name" && !nextValue) {
      return;
    }

    const updatedResources = (character.resources ?? []).map((resource) => {
      if (resource.id === resourceId) {
        return {
          ...resource,
          [field]: nextValue,
        };
      }

      return resource;
    });

    saveCharacter({
      ...character,
      resources: updatedResources,
    });
  }

  function removeCharacterResource(resourceId: string) {
    if (!character) {
      return;
    }

    saveCharacter({
      ...character,
      resources: (character.resources ?? []).filter(
        (resource) => resource.id !== resourceId,
      ),
    });
  }
  function changeInventoryItemQuantity(itemId: string, change: number) {
    if (!character) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity + change),
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function addInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("itemName") || "").trim();
    const quantity = Number(formData.get("itemQuantity") || 1);
    const description = String(formData.get("itemDescription") || "").trim();

    if (!name) {
      return;
    }

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      name,
      imageUrl: "",
      quantity: Math.max(0, quantity),
      description,
    };

    saveCharacter({
      ...character,
      inventory: [...(character.inventory ?? []), newItem],
    });

    event.currentTarget.reset();
  }

  function updateInventoryItemQuantity(itemId: string, quantity: number) {
    if (!character) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, quantity),
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function updateInventoryItemTextField(
    itemId: string,
    field: "name" | "description" | "imageUrl",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if (field === "name" && !nextValue) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: nextValue,
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function removeInventoryItem(itemId: string) {
    if (!character) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).filter(
      (item) => item.id !== itemId,
    );

    saveCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function addAttackSpell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("attackSpellName") || "").trim();
    const attackRoll = String(formData.get("attackRoll") || "").trim();
    const damageRoll = String(formData.get("damageRoll") || "").trim();
    const description = String(formData.get("attackSpellDescription") || "");

    if (!name) {
      return;
    }

    const newItem: AttackSpellItem = {
      id: crypto.randomUUID(),
      name,
      imageUrl: "",
      attackRoll,
      damageRoll,
      description,
    };

    saveCharacter({
      ...character,
      attackSpells: [...(character.attackSpells ?? []), newItem],
    });

    event.currentTarget.reset();
  }

  function updateAttackSpellTextField(
    itemId: string,
    field: "name" | "imageUrl" | "attackRoll" | "damageRoll" | "description",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if (field === "name" && !nextValue) {
      return;
    }

    const updatedItems = (character.attackSpells ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: nextValue,
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      attackSpells: updatedItems,
    });
  }

  function removeAttackSpell(itemId: string) {
    if (!character) {
      return;
    }

    saveCharacter({
      ...character,
      attackSpells: (character.attackSpells ?? []).filter(
        (item) => item.id !== itemId,
      ),
    });
  }

  function addClassFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("classFeatureName") || "").trim();
    const description = String(formData.get("classFeatureDescription") || "");

    if (!name) {
      return;
    }

    const newItem: ClassFeatureItem = {
      id: crypto.randomUUID(),
      name,
      imageUrl: "",
      description,
    };

    saveCharacter({
      ...character,
      classFeatures: [...(character.classFeatures ?? []), newItem],
    });

    event.currentTarget.reset();
  }

  function updateClassFeatureTextField(
    itemId: string,
    field: "name" | "imageUrl" | "description",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if (field === "name" && !nextValue) {
      return;
    }

    const updatedItems = (character.classFeatures ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: nextValue,
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      classFeatures: updatedItems,
    });
  }

  function removeClassFeature(itemId: string) {
    if (!character) {
      return;
    }

    saveCharacter({
      ...character,
      classFeatures: (character.classFeatures ?? []).filter(
        (item) => item.id !== itemId,
      ),
    });
  }

  function addOtherTrait(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("otherTraitName") || "").trim();
    const description = String(formData.get("otherTraitDescription") || "");

    if (!name) {
      return;
    }

    const newItem: OtherTraitItem = {
      id: crypto.randomUUID(),
      name,
      description,
    };

    saveCharacter({
      ...character,
      otherTraits: [...(character.otherTraits ?? []), newItem],
    });

    event.currentTarget.reset();
  }

  function updateOtherTraitTextField(
    itemId: string,
    field: "name" | "description",
    value: string,
  ) {
    if (!character) {
      return;
    }

    const nextValue = field === "description" ? value : value.trim();

    if (field === "name" && !nextValue) {
      return;
    }

    const updatedItems = (character.otherTraits ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: nextValue,
        };
      }

      return item;
    });

    saveCharacter({
      ...character,
      otherTraits: updatedItems,
    });
  }

  function removeOtherTrait(itemId: string) {
    if (!character) {
      return;
    }

    saveCharacter({
      ...character,
      otherTraits: (character.otherTraits ?? []).filter(
        (item) => item.id !== itemId,
      ),
    });
  }

  function addDiceRollToHistory(newRoll: DiceRoll) {
    setDiceRolls((currentRolls) => {
      const alreadyExists = currentRolls.some((roll) => roll.id === newRoll.id);

      if (alreadyExists) {
        return currentRolls;
      }

      return [newRoll, ...currentRolls].slice(0, 50);
    });
  }

  useEffect(() => {
    const supabase = createClient();

    setRealtimeStatus("Realtime: łączę z Supabase...");

    const channel = supabase
      .channel(`campaign-dice-${campaignId}`, {
        config: {
          broadcast: {
            self: true,
            ack: true,
          },
        },
      })
      .on(
        "broadcast",
        {
          event: "new-roll",
        },
        (payload) => {
          const newRoll = payload.payload?.roll as DiceRoll | undefined;

          if (!newRoll || newRoll.campaignId !== campaignId) {
            return;
          }

          setRealtimeStatus(
            `Realtime: odebrano broadcast ${new Date().toLocaleTimeString(
              "pl-PL",
            )}`,
          );

          addDiceRollToHistory(newRoll);
        },
      )
      .on(
        "broadcast",
        {
          event: "character-updated",
        },
        (payload) => {
          const updatedRow = payload.payload?.character as
            | OnlineCharacterRow
            | undefined;

          if (
            !updatedRow ||
            updatedRow.id !== characterId ||
            updatedRow.campaign_id !== campaignId
          ) {
            return;
          }

          setCharacter(
            onlineRowToPlayableCharacter(updatedRow) as unknown as Character,
          );
          setStatus(
            `Karta postaci zaktualizowana ${new Date().toLocaleTimeString(
              "pl-PL",
            )}`,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "characters",
        },
        (payload) => {
          const updatedRow = payload.new as OnlineCharacterRow;

          if (
            updatedRow.id !== characterId ||
            updatedRow.campaign_id !== campaignId
          ) {
            return;
          }

          setCharacter(
            onlineRowToPlayableCharacter(updatedRow) as unknown as Character,
          );
          setStatus(
            `Karta postaci odświeżona z Supabase ${new Date().toLocaleTimeString(
              "pl-PL",
            )}`,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dice_rolls",
        },
        (payload) => {
          const newRoll = onlineRollToLocalRoll(
            payload.new as OnlineDiceRollRow,
          );

          if (newRoll.campaignId !== campaignId) {
            return;
          }

          setRealtimeStatus(
            `Realtime: odebrano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
          );

          addDiceRollToHistory(newRoll);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          realtimeChannelRef.current = channel;
          setRealtimeStatus("Realtime: połączono");
          return;
        }

        if (subscriptionStatus === "CHANNEL_ERROR") {
          setRealtimeStatus("Realtime: błąd kanału");
          return;
        }

        if (subscriptionStatus === "TIMED_OUT") {
          setRealtimeStatus("Realtime: przekroczono czas połączenia");
          return;
        }

        if (subscriptionStatus === "CLOSED") {
          setRealtimeStatus("Realtime: połączenie zamknięte");
          return;
        }

        setRealtimeStatus(`Realtime: ${subscriptionStatus}`);
      });

    return () => {
      realtimeChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, characterId]);

  async function saveOnlineRoll(
    formula: string,
    rollReason: string,
    rolls: number[],
    modifier: number,
    total: number,
  ) {
    if (!character || !userId) {
      return;
    }

    setIsRolling(true);

    const supabase = createClient();

    const { data: insertedRoll, error } = await supabase
      .from("dice_rolls")
      .insert({
        campaign_id: campaignId,
        character_id: character.id,
        user_id: userId,
        character_name: character.name,
        formula,
        reason: rollReason,
        rolls,
        modifier,
        total,
      })
      .select("*")
      .single();

    if (error || !insertedRoll) {
      setStatus(`Nie udało się zapisać rzutu: ${error?.message}`);
      setIsRolling(false);
      return;
    }

    const savedRoll = onlineRollToLocalRoll(insertedRoll as OnlineDiceRollRow);

    addDiceRollToHistory(savedRoll);

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "new-roll",
      payload: {
        roll: savedRoll,
      },
    });

    setRealtimeStatus(
      `Realtime: wysłano broadcast ${new Date().toLocaleTimeString("pl-PL")}`,
    );

    setIsRolling(false);
  }

  async function removeDiceRoll(rollId: string) {
    setDiceRolls((currentRolls) =>
      currentRolls.filter((roll) => roll.id !== rollId),
    );

    const supabase = createClient();

    await supabase
      .from("dice_rolls")
      .delete()
      .eq("id", rollId)
      .eq("campaign_id", campaignId);
  }

  async function clearDiceRollHistory() {
    const confirmed = window.confirm(
      "Czy na pewno chcesz wyczyścić całą historię rzutów tej kampanii?",
    );

    if (!confirmed) {
      return;
    }

    setDiceRolls([]);

    const supabase = createClient();

    await supabase.from("dice_rolls").delete().eq("campaign_id", campaignId);
  }

  function addDieToPool(sides: DiceType) {
    setDicePool((currentPool) => {
      const existingDie = currentPool.find((item) => item.sides === sides);

      if (existingDie) {
        return currentPool.map((item) => {
          if (item.sides === sides) {
            return {
              ...item,
              count: item.count + 1,
            };
          }

          return item;
        });
      }

      return [
        ...currentPool,
        {
          sides,
          count: 1,
        },
      ];
    });
  }

  function changeDicePoolCount(sides: DiceType, change: number) {
    setDicePool((currentPool) =>
      currentPool
        .map((item) => {
          if (item.sides === sides) {
            return {
              ...item,
              count: Math.max(0, item.count + change),
            };
          }

          return item;
        })
        .filter((item) => item.count > 0),
    );
  }

  function clearDicePool() {
    setDicePool([]);
    setDiceModifier(0);
  }

  function getDicePoolFormula(pool: DicePoolItem[], modifier: number) {
    const dicePart = pool
      .map((item) => `${item.count}d${item.sides}`)
      .join("+");

    if (!dicePart) {
      return modifier === 0 ? "Brak kości" : formatModifier(modifier);
    }

    if (modifier === 0) {
      return dicePart;
    }

    return `${dicePart}${formatModifier(modifier)}`;
  }

  function getDicePoolTiles(pool: DicePoolItem[]) {
    return pool.flatMap((item) =>
      Array.from({ length: item.count }, (_, index) => ({
        sides: item.sides,
        key: `${item.sides}-${index}`,
      })),
    );
  }

  function handleDicePoolRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    if (dicePool.length === 0) {
      alert("Dodaj przynajmniej jedną kość do stołu.");
      return;
    }

    const rolls = dicePool.flatMap((item) =>
      Array.from({ length: item.count }, () => rollDie(item.sides)),
    );

    const total =
      rolls.reduce((sum, currentRoll) => sum + currentRoll, 0) + diceModifier;

    void saveOnlineRoll(
      getDicePoolFormula(dicePool, diceModifier),
      reason,
      rolls,
      diceModifier,
      total,
    );

    setReason("");
  }

  function rollManualFormula() {
    makeRoll(manualFormula, reason);
    setReason("");
  }

  function makeRoll(rollFormula: string, rollReason?: string) {
    if (!character) {
      return;
    }

    const rollResult = parseAndRollFormula(rollFormula);

    if (!rollResult) {
      alert("Niepoprawny zapis rzutu. Użyj np. 1d20, 2d6+3 albo 1d8-1.");
      return;
    }

    void saveOnlineRoll(
      rollFormula,
      rollReason || reason,
      rollResult.rolls,
      rollResult.modifier,
      rollResult.total,
    );
  }

  function makeStatRoll(statName: string, statValue: number) {
    const modifier = getAbilityModifier(statValue);
    const formulaWithModifier = `1d20${formatModifier(modifier)}`;

    makeRoll(formulaWithModifier, statName);
  }

  function makeSavingThrowRoll(statName: string, statValue: number) {
    const modifier = getAbilityModifier(statValue);
    const formulaWithModifier = `1d20${formatModifier(modifier)}`;

    makeRoll(formulaWithModifier, `Rzut obronny: ${statName}`);
  }

  function makeSkillRoll(skillName: string, modifier: number) {
    makeRoll(`1d20${formatModifier(modifier)}`, `Umiejętność: ${skillName}`);
  }

  function selectImage(asset: ImageAsset) {
    if (!character || !imagePickerTarget) {
      setImagePickerTarget(null);
      return;
    }

    if (imagePickerTarget.type === "portrait") {
      saveCharacter({
        ...character,
        portraitUrl: asset.url,
      });
    }

    if (imagePickerTarget.type === "inventory") {
      saveCharacter({
        ...character,
        inventory: (character.inventory ?? []).map((item) =>
          item.id === imagePickerTarget.id
            ? {
                ...item,
                imageUrl: asset.url,
              }
            : item,
        ),
      });
    }

    if (imagePickerTarget.type === "attackSpell") {
      saveCharacter({
        ...character,
        attackSpells: (character.attackSpells ?? []).map((item) =>
          item.id === imagePickerTarget.id
            ? {
                ...item,
                imageUrl: asset.url,
              }
            : item,
        ),
      });
    }

    if (imagePickerTarget.type === "classFeature") {
      saveCharacter({
        ...character,
        classFeatures: (character.classFeatures ?? []).map((item) =>
          item.id === imagePickerTarget.id
            ? {
                ...item,
                imageUrl: asset.url,
              }
            : item,
        ),
      });
    }

    setImagePickerTarget(null);
  }

  function getImagePickerCategories() {
    if (!imagePickerTarget) {
      return ["misc"];
    }

    if (imagePickerTarget.type === "portrait") {
      return ["portrait", "creature", "misc"];
    }

    if (imagePickerTarget.type === "inventory") {
      return ["item", "weapon", "armor", "misc"];
    }

    if (imagePickerTarget.type === "attackSpell") {
      return ["spell", "weapon", "symbol", "misc"];
    }

    if (imagePickerTarget.type === "classFeature") {
      return ["feature", "symbol", "misc"];
    }

    return ["misc"];
  }

  function getCharacterTabClass(tab: CharacterTab) {
    const baseClass =
      "rounded-lg border bg-neutral-900 px-4 py-2 font-semibold transition";

    if (characterTab === tab) {
      return `${baseClass} border-red-700 text-red-500`;
    }

    return `${baseClass} border-neutral-700 text-neutral-300 hover:border-neutral-500`;
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-white">
        <div className="mx-auto max-w-6xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-neutral-300">{status}</p>
        </div>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-white">
        <h1 className="text-3xl font-bold">Nie znaleziono postaci</h1>

        <Link
          href={`/online/campaigns/${campaignId}`}
          className="mt-4 inline-block underline"
        >
          Wróć do kampanii
        </Link>
      </main>
    );
  }

  const inventory = character.inventory ?? [];
  const attackSpells = character.attackSpells ?? [];
  const classFeatures = character.classFeatures ?? [];
  const otherTraits = character.otherTraits ?? [];

  const stats = {
    ...defaultStats,
    ...(character.stats ?? {}),
  };

  const proficiencyBonus = getProficiencyBonus(character.level);
  const currentHp = character.hp;
  const maxHp = character.maxHp ?? character.hp;
  const temporaryHp = character.temporaryHp ?? 0;
  const initiative = character.initiative ?? 0;
  const speed = character.speed ?? 30;
  const hitDice = character.hitDice ?? character.level;
  const deathSaveSuccesses = character.deathSaveSuccesses ?? 0;
  const deathSaveFailures = character.deathSaveFailures ?? 0;
  const characterResources = character.resources ?? [];
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-[96vw]">
        <Link
          href={`/online/campaigns/${campaignId}`}
          className="text-sm text-neutral-300 underline"
        >
          Wróć do kampanii
        </Link>

        <header className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-400">Tryb gry</p>

          <h1 className="mt-2 text-4xl font-bold">
            Grasz jako {character.name}
          </h1>

          <p className="mt-2 text-neutral-300">
            {character.race} · {character.className} · poziom {character.level}
          </p>

          <div className="mt-4">
            <AuthPanel />
          </div>
        </header>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <p className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-red-500">
            {status}
          </p>

          <p className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-400">
            {realtimeStatus}
          </p>
        </div>

        <section className="mt-6 grid gap-6 xl:h-[calc(100vh-2rem)] xl:grid-cols-[clamp(260px,35vw,800px)_minmax(0,1fr)] xl:items-stretch">
          <div className="grid min-h-0 gap-4 xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]">
            <aside className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Rzuty</h2>

                  <p className="mt-1 text-xs text-neutral-400">
                    Kliknij kość, aby dodać ją do stołu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearDicePool}
                  className="rounded-lg border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-400"
                >
                  Wyczyść
                </button>
              </div>

              <div className="mt-4 grid grid-cols-6 gap-1">
                {diceTypes.map((die) => (
                  <button
                    key={die.sides}
                    type="button"
                    onClick={() => addDieToPool(die.sides)}
                    className="flex h-12 flex-col items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-bold transition hover:border-red-700"
                  >
                    <span className="text-base text-red-400">{die.icon}</span>
                    <span>{die.label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleDicePoolRoll} className="mt-4 grid gap-3">
                <section className="rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">Stół kości</h3>

                    <p className="text-xs text-neutral-500">
                      {getDicePoolFormula(dicePool, diceModifier)}
                    </p>
                  </div>

                  <div className="mt-2 min-h-[52px] rounded-lg border border-dashed border-neutral-800 bg-black/20 p-1">
                    {dicePool.length === 0 ? (
                      <div className="flex h-12 items-center justify-center text-xs text-neutral-500">
                        Brak kości.
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1">
                        {getDicePoolTiles(dicePool).map((tile) => {
                          const dieInfo = diceTypes.find(
                            (die) => die.sides === tile.sides,
                          );

                          return (
                            <button
                              key={tile.key}
                              type="button"
                              onClick={() =>
                                changeDicePoolCount(tile.sides, -1)
                              }
                              className="flex h-12 flex-col items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 p-1 text-center transition hover:border-red-700 hover:bg-red-950/30"
                              title={`Usuń D${tile.sides}`}
                            >
                              <span className="text-base text-red-400">
                                {dieInfo?.icon ?? "🎲"}
                              </span>

                              <span className="text-[10px] font-bold">
                                {dieInfo?.label ?? `D${tile.sides}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid gap-2 md:grid-cols-[90px_minmax(0,1fr)]">
                  <label className="grid gap-1 text-xs">
                    Mod.
                    <input
                      type="number"
                      value={diceModifier}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);

                        setDiceModifier(
                          Number.isNaN(nextValue) ? 0 : nextValue,
                        );
                      }}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                    />
                  </label>

                  <label className="grid gap-1 text-xs">
                    Powód rzutu
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="np. atak, obrażenia, percepcja"
                      className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={dicePool.length === 0 || isRolling}
                  className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                >
                  {isRolling ? "Rzucam..." : "Rzuć pulą"}
                </button>

                <details className="rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    Ręczny zapis
                  </summary>

                  <p className="mt-2 text-xs text-neutral-500">
                    Dla nietypowych kości, np. 1d3, 1d100 albo 2d7+1.
                  </p>

                  <div className="mt-3 grid gap-2">
                    <input
                      value={manualFormula}
                      onChange={(event) => setManualFormula(event.target.value)}
                      placeholder="np. 1d3"
                      className="rounded-lg border border-neutral-700 bg-neutral-900 p-2"
                    />

                    <button
                      type="button"
                      onClick={rollManualFormula}
                      className="rounded-lg border border-neutral-700 px-4 py-2 font-semibold text-neutral-300"
                    >
                      Rzuć z zapisu
                    </button>
                  </div>
                </details>
              </form>
            </aside>

            <aside className="min-h-0 rounded-xl border border-neutral-700 bg-neutral-900 p-4 xl:overflow-y-auto">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Historia</h2>

                <button
                  type="button"
                  onClick={clearDiceRollHistory}
                  disabled={diceRolls.length === 0}
                  className="rounded-lg border border-red-900 px-3 py-1 text-xs font-semibold text-red-400 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                >
                  Wyczyść
                </button>
              </div>

              {diceRolls.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-400">
                  Nie ma jeszcze rzutów.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 pr-2">
                  {diceRolls.map((roll) => (
                    <article
                      key={roll.id}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold">
                            {roll.characterName}: {roll.formula}
                          </p>

                          {roll.reason ? (
                            <p className="mt-1 break-words text-xs text-neutral-400">
                              {roll.reason}
                            </p>
                          ) : null}

                          <p className="mt-1 text-xs text-neutral-500">
                            Kości: {roll.rolls.join(", ")}
                            {roll.modifier !== 0
                              ? ` ${roll.modifier > 0 ? "+" : ""}${
                                  roll.modifier
                                }`
                              : ""}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-start gap-2">
                          <p className="text-3xl font-bold text-red-500">
                            {roll.total}
                          </p>

                          <button
                            type="button"
                            onClick={() => removeDiceRoll(roll.id)}
                            className="rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                            title="Usuń ten rzut"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>

          <section className="min-h-0 min-w-0 rounded-xl border border-neutral-700 bg-neutral-900 p-6 xl:h-full xl:overflow-y-auto">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-neutral-400">Twoja postać</p>

                <h2 className="text-3xl font-bold">{character.name}</h2>

                <p className="mt-1 text-neutral-400">
                  {character.race} · {character.className} · poziom{" "}
                  {character.level}
                </p>
              </div>
            </div>

            <nav className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setCharacterTab("general")}
                className={getCharacterTabClass("general")}
              >
                Ogólne
              </button>

              <button
                type="button"
                onClick={() => setCharacterTab("stats")}
                className={getCharacterTabClass("stats")}
              >
                Statystyki
              </button>

              <button
                type="button"
                onClick={() => setCharacterTab("abilities")}
                className={getCharacterTabClass("abilities")}
              >
                Umiejętności
              </button>

              <button
                type="button"
                onClick={() => setCharacterTab("inventory")}
                className={getCharacterTabClass("inventory")}
              >
                Ekwipunek
              </button>
            </nav>

            {characterTab === "general" ? (
              <div className="mt-6 grid gap-6">
                <section className="grid gap-6 rounded-xl border border-neutral-700 bg-neutral-800 p-5 xl:grid-cols-[minmax(0,1fr)_clamp(260px,28vw,420px)]">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold">Dane postaci</h3>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-400">
                          Imię postaci
                        </p>

                        <EditableText
                          value={character.name}
                          onSave={(value) =>
                            updateCharacterTextField("name", value)
                          }
                          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"
                          inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-3"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-neutral-400">
                          Poziom
                        </p>

                        <EditableNumber
                          value={character.level}
                          min={1}
                          onSave={(value) =>
                            updateCharacterField("level", value)
                          }
                          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-center text-lg font-bold"
                          inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-3 text-center text-lg font-bold"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-neutral-400">
                          Rasa / pochodzenie
                        </p>

                        <EditableText
                          value={character.race || ""}
                          placeholder="Brak"
                          onSave={(value) =>
                            updateCharacterTextField("race", value)
                          }
                          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"
                          inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-3"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-neutral-400">
                          Klasa postaci
                        </p>

                        <EditableText
                          value={character.className}
                          onSave={(value) =>
                            updateCharacterTextField("className", value)
                          }
                          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"
                          inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-3"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-neutral-400">
                          Gracz
                        </p>

                        <EditableText
                          value={character.playerName || ""}
                          placeholder="Brak"
                          onSave={(value) =>
                            updateCharacterTextField("playerName", value)
                          }
                          className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"
                          inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-3"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold text-neutral-400">
                        Historia / opis postaci
                      </p>

                      <EditableText
                        value={character.description || ""}
                        placeholder="Brak opisu."
                        multiline
                        onSave={(value) =>
                          updateCharacterTextField("description", value)
                        }
                        className="mt-1 block min-h-32 w-full whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left"
                        inputClassName="mt-1 min-h-32 w-full rounded-lg border border-red-700 bg-neutral-900 p-3"
                      />
                    </div>
                  </div>

                  <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-5">
                    <h3 className="text-xl font-bold">Portret postaci</h3>

                    <div
                      onContextMenu={(event) => {
                        event.preventDefault();

                        if (!canEdit) {
                          return;
                        }

                        setImagePickerTarget({ type: "portrait" });
                      }}
                      title={
                        canEdit
                          ? "Kliknij prawym przyciskiem myszy, aby zmienić portret"
                          : "Nie masz uprawnień do edycji portretu"
                      }
                      className="mt-4 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950"
                    >
                      {character.portraitUrl ? (
                        <img
                          src={character.portraitUrl}
                          alt={`Portret postaci ${character.name}`}
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] items-center justify-center bg-neutral-950 text-7xl">
                          🧙
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-center text-xs text-neutral-500">
                      Prawy klik: zmień portret
                    </p>
                  </section>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-2xl font-bold">Mechanika</h3>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">🛡️</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={character.armorClass}
                          min={0}
                          onSave={(value) =>
                            updateCharacterField("armorClass", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Klasa pancerza
                      </p>
                    </article>

                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">⏱️</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={initiative}
                          min={-20}
                          max={50}
                          formatValue={formatModifier}
                          onSave={(value) =>
                            updateCharacterField("initiative", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Inicjatywa
                      </p>
                    </article>

                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">🥾</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={speed}
                          min={0}
                          onSave={(value) =>
                            updateCharacterField("speed", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Szybkość
                      </p>
                    </article>
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-2xl font-bold">Życie</h3>

                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">❤️</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={currentHp}
                          min={0}
                          onSave={(value) => updateCharacterField("hp", value)}
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Obecne HP
                      </p>
                    </article>

                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">🤍</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={temporaryHp}
                          min={0}
                          onSave={(value) =>
                            updateCharacterField("temporaryHp", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Tym. HP
                      </p>
                    </article>

                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">💗</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={maxHp}
                          min={0}
                          onSave={(value) =>
                            updateCharacterField("maxHp", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Maks HP
                      </p>
                    </article>

                    <article className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-center">
                      <p className="text-6xl">🎲</p>

                      <div className="mt-4 flex justify-center">
                        <EditableNumber
                          value={hitDice}
                          min={0}
                          onSave={(value) =>
                            updateCharacterField("hitDice", value)
                          }
                          className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                          inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-3xl font-bold"
                        />
                      </div>

                      <p className="mt-2 text-sm font-bold uppercase text-neutral-400">
                        Kości trafień
                      </p>
                    </article>
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-2xl font-bold">
                    Ochrona przed śmiercią
                  </h3>

                  <div className="mt-5 grid gap-5">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-28 text-right font-bold uppercase text-neutral-300">
                        🪽 Sukcesy
                      </div>

                      <div className="flex gap-3">
                        {[1, 2, 3].map((slot) => (
                          <button
                            key={`death-success-${slot}`}
                            type="button"
                            onClick={() =>
                              updateCharacterField(
                                "deathSaveSuccesses",
                                deathSaveSuccesses === slot ? slot - 1 : slot,
                              )
                            }
                            className={`h-9 w-9 rounded-lg border ${
                              deathSaveSuccesses >= slot
                                ? "border-red-700 bg-red-950 text-red-200"
                                : "border-neutral-600 bg-neutral-900"
                            }`}
                            title={`Sukces ${slot}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <div className="w-28 text-right font-bold uppercase text-neutral-300">
                        💀 Porażki
                      </div>

                      <div className="flex gap-3">
                        {[1, 2, 3].map((slot) => (
                          <button
                            key={`death-failure-${slot}`}
                            type="button"
                            onClick={() =>
                              updateCharacterField(
                                "deathSaveFailures",
                                deathSaveFailures === slot ? slot - 1 : slot,
                              )
                            }
                            className={`h-9 w-9 rounded-lg border ${
                              deathSaveFailures >= slot
                                ? "border-red-700 bg-red-950 text-red-200"
                                : "border-neutral-600 bg-neutral-900"
                            }`}
                            title={`Porażka ${slot}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-2xl font-bold">
                    Zasoby postaci
                  </h3>

                  <p className="mt-1 text-center text-sm text-neutral-400">
                    Dowolne zasoby postaci. Wpisz samą liczbę, np. 37, jeśli
                    zasób nie ma limitu. Wpisz 3 / 5, jeśli zasób ma limit
                    górny, który potem można osobno edytować.
                  </p>

                  <form
                    onSubmit={addCharacterResource}
                    className="mt-5 grid gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 xl:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      name="resourceName"
                      required
                      placeholder="Nazwa, np. Dusze"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <input
                      name="resourceValue"
                      placeholder="Wartość, np. 37 albo 3 / 5"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <button
                      type="submit"
                      className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                    >
                      Dodaj
                    </button>

                    <textarea
                      name="resourceDescription"
                      placeholder="Opis zasobu"
                      className="min-h-20 rounded-lg border border-neutral-700 bg-neutral-950 p-2 xl:col-span-3"
                    />
                  </form>

                  <div className="mt-5">
                    {characterResources.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
                        Brak zasobów postaci.
                      </p>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {characterResources.map((resource) => {
                          const hasMaximum =
                            typeof resource.maximum === "number";
                          const isAtMaximum =
                            hasMaximum && resource.current >= resource.maximum!;

                          return (
                            <article
                              key={resource.id}
                              className="relative rounded-xl border border-red-950/80 bg-neutral-950 p-4"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  removeCharacterResource(resource.id)
                                }
                                className="absolute right-3 top-3 rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                              >
                                x
                              </button>

                              <div className="grid gap-4 pr-8 lg:grid-cols-[minmax(0,1fr)_270px]">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-neutral-400">
                                    Nazwa
                                  </p>

                                  <EditableText
                                    value={resource.name}
                                    onSave={(value) =>
                                      updateCharacterResourceText(
                                        resource.id,
                                        "name",
                                        value,
                                      )
                                    }
                                    className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left font-bold"
                                    inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 font-bold"
                                  />

                                  <p className="mt-3 text-xs font-semibold text-neutral-400">
                                    Opis
                                  </p>

                                  <EditableText
                                    value={resource.description || ""}
                                    placeholder="Opis zasobu."
                                    multiline
                                    onSave={(value) =>
                                      updateCharacterResourceText(
                                        resource.id,
                                        "description",
                                        value,
                                      )
                                    }
                                    className="mt-1 block min-h-24 w-full whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left text-sm text-neutral-300"
                                    inputClassName="mt-1 min-h-24 w-full rounded-lg border border-red-700 bg-neutral-900 p-3 text-sm"
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-neutral-400">
                                    Wartość
                                  </p>

                                  <div className="mt-1 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        changeCharacterResourceCurrent(
                                          resource.id,
                                          -1,
                                        )
                                      }
                                      className="rounded-lg border border-neutral-600 px-3 py-2 text-lg font-bold"
                                    >
                                      ↓
                                    </button>

                                    <EditableNumber
                                      value={resource.current}
                                      min={0}
                                      max={resource.maximum}
                                      onSave={(value) =>
                                        updateCharacterResourceCurrent(
                                          resource.id,
                                          value,
                                        )
                                      }
                                      className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-900 px-4 py-2 text-center text-2xl font-bold text-red-400"
                                      inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-900 px-4 py-2 text-center text-2xl font-bold text-red-400"
                                    />

                                    <button
                                      type="button"
                                      disabled={isAtMaximum}
                                      onClick={() =>
                                        changeCharacterResourceCurrent(
                                          resource.id,
                                          1,
                                        )
                                      }
                                      className="rounded-lg border border-neutral-600 px-3 py-2 text-lg font-bold disabled:cursor-not-allowed disabled:border-neutral-800 disabled:text-neutral-700"
                                    >
                                      ↑
                                    </button>
                                  </div>

                                  <p className="mt-2 text-xs text-neutral-500">
                                    {hasMaximum
                                      ? `${resource.current} / ${resource.maximum}`
                                      : `${resource.current}, bez limitu górnego`}
                                  </p>

                                  <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900 p-3">
                                    <p className="text-xs font-semibold text-neutral-400">
                                      Limit górny
                                    </p>

                                    {hasMaximum ? (
                                      <>
                                        <div className="mt-2 flex items-center gap-2">
                                          <EditableNumber
                                            value={resource.maximum ?? 0}
                                            min={0}
                                            onSave={(value) =>
                                              updateCharacterResourceMaximum(
                                                resource.id,
                                                value,
                                              )
                                            }
                                            className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-950 px-4 py-1 text-center text-xl font-bold"
                                            inputClassName="w-24 rounded-lg border border-red-700 bg-neutral-950 px-4 py-1 text-center text-xl font-bold"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeCharacterResourceMaximum(
                                                resource.id,
                                              )
                                            }
                                            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300"
                                          >
                                            Usuń limit
                                          </button>
                                        </div>

                                        <p className="mt-2 text-xs text-neutral-500">
                                          Limit możesz zwiększyć np. po awansie
                                          poziomu.
                                        </p>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addCharacterResourceMaximum(
                                            resource.id,
                                          )
                                        }
                                        className="mt-2 rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-500"
                                      >
                                        Dodaj limit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {characterTab === "stats" ? (
              <div className="mt-6 space-y-6">
                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-xl font-bold">
                    Premia za biegłość
                  </h3>

                  <div className="mt-4 flex justify-center">
                    <div className="min-w-20 rounded-lg border border-neutral-600 bg-neutral-900 px-6 py-3 text-center text-2xl font-bold">
                      {formatModifier(proficiencyBonus)}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-5">
                  <h3 className="text-center text-xl font-bold">
                    Rzuty obronne
                  </h3>

                  <div className="mt-4 grid grid-cols-6 gap-2">
                    {abilityColumns.map((ability) => {
                      const abilityValue = stats[ability.key];
                      const savingThrowModifier =
                        getAbilityModifier(abilityValue);

                      return (
                        <article
                          key={`save-${ability.key}`}
                          className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-center"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-300">
                            {ability.shortName}
                          </p>

                          <p className="mt-2 text-xl font-bold text-red-500">
                            {formatModifier(savingThrowModifier)}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              makeSavingThrowRoll(
                                ability.fullName,
                                abilityValue,
                              )
                            }
                            className="mt-2 w-full rounded-lg border border-red-700 px-1 py-1.5 text-[10px] font-semibold text-red-500"
                          >
                            Rzuć
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-3">
                  <div className="grid grid-cols-6 gap-2">
                    {abilityColumns.map((ability) => {
                      const abilityValue = stats[ability.key];
                      const abilityModifier = getAbilityModifier(abilityValue);

                      const relatedSkills = skillCards.filter(
                        (skill) => skill.statKey === ability.key,
                      );

                      return (
                        <section
                          key={ability.key}
                          className="rounded-2xl border border-neutral-700 bg-neutral-950 p-2"
                        >
                          <article className="rounded-2xl border-2 border-red-950/70 bg-neutral-900 p-3 text-center shadow-[0_0_18px_rgba(127,29,29,0.18)]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-100">
                              {ability.shortName}
                            </p>

                            <div className="mt-3 text-5xl">{ability.icon}</div>

                            <div className="mt-3 flex justify-center">
                              <EditableNumber
                                value={abilityValue}
                                onSave={(value) =>
                                  updateCharacterStat(ability.key, value)
                                }
                                min={1}
                                max={30}
                                className="min-w-14 rounded-lg border border-neutral-600 bg-neutral-950 px-2 py-1 text-center text-xl font-bold text-white"
                                inputClassName="w-14 rounded-lg border border-red-700 bg-neutral-950 p-1 text-center text-xl font-bold text-white"
                                title="Kliknij dwa razy, aby zmienić wartość cechy"
                              />
                            </div>

                            <p className="mt-2 text-3xl font-bold text-red-500">
                              {formatModifier(abilityModifier)}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                makeStatRoll(ability.fullName, abilityValue)
                              }
                              className="mt-3 w-full rounded-lg border border-red-700 bg-red-950/20 px-2 py-2 text-xs font-semibold text-red-400"
                            >
                              Rzuć {formatModifier(abilityModifier)}
                            </button>
                          </article>

                          <div className="my-3 flex items-center gap-2">
                            <div className="h-px flex-1 bg-neutral-800" />

                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                              Umiejętności
                            </p>

                            <div className="h-px flex-1 bg-neutral-800" />
                          </div>

                          <div className="grid gap-2">
                            {relatedSkills.length === 0 ? (
                              <div className="flex min-h-[250px] items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-black/30 p-3 text-center">
                                <p className="text-xs text-neutral-600">
                                  Brak umiejętności
                                </p>
                              </div>
                            ) : (
                              relatedSkills.map((skill) => {
                                const baseModifier = getAbilityModifier(
                                  stats[skill.statKey],
                                );

                                const modifier =
                                  character.skillModifiers?.[skill.key] ??
                                  baseModifier;

                                return (
                                  <article
                                    key={skill.key}
                                    className="rounded-xl border border-neutral-800 bg-black/40 p-2 text-center"
                                  >
                                    <p className="min-h-[28px] text-[10px] font-bold uppercase leading-tight text-neutral-200">
                                      {skill.name}
                                    </p>

                                    <div className="mt-2 text-2xl opacity-80">
                                      {skill.icon}
                                    </div>

                                    <div className="mt-2 flex justify-center">
                                      <EditableNumber
                                        value={modifier}
                                        onSave={(value) =>
                                          updateSkillModifier(skill.key, value)
                                        }
                                        min={-20}
                                        max={50}
                                        formatValue={formatModifier}
                                        className="min-w-12 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-center text-sm font-bold text-red-500"
                                        inputClassName="w-14 rounded-lg border border-red-700 bg-neutral-950 p-1 text-center text-sm font-bold text-red-500"
                                        title="Kliknij dwa razy, aby zmienić modyfikator umiejętności"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        makeSkillRoll(skill.name, modifier)
                                      }
                                      className="mt-2 w-full rounded-lg border border-neutral-700 px-1 py-1.5 text-[10px] font-semibold text-neutral-300"
                                    >
                                      Rzuć {formatModifier(modifier)}
                                    </button>
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : null}

            {characterTab === "abilities" ? (
              <div className="mt-6 grid gap-5">
                <section className="grid h-[650px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-neutral-700 bg-neutral-800 p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="w-full text-center">
                      <h3 className="text-2xl font-bold">Ataki i czary</h3>

                      <p className="mt-1 text-sm text-neutral-400">
                        Broń, zaklęcia i akcje z rzutem ataku albo obrażeniami.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={addAttackSpell}
                    className="mt-4 grid gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 xl:grid-cols-[1fr_130px_130px_auto]"
                  >
                    <input
                      name="attackSpellName"
                      required
                      placeholder="Nazwa, np. Długi łuk"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <input
                      name="attackRoll"
                      placeholder="atak, np. +5"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <input
                      name="damageRoll"
                      placeholder="obraż., np. 1d8+3"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <button
                      type="submit"
                      className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                    >
                      Dodaj
                    </button>

                    <textarea
                      name="attackSpellDescription"
                      placeholder="Opis ataku, czaru albo akcji"
                      className="min-h-20 rounded-lg border border-neutral-700 bg-neutral-950 p-2 xl:col-span-4"
                    />
                  </form>

                  <div className="min-h-0 overflow-y-auto pr-2 pt-4">
                    {attackSpells.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
                        Brak ataków i czarów. Dodaj pierwszy blok powyżej.
                      </p>
                    ) : (
                      <div className="grid gap-4 2xl:grid-cols-2">
                        {attackSpells.map((item) => (
                          <article
                            key={item.id}
                            className="relative rounded-xl border border-red-950/80 bg-neutral-950 p-3"
                          >
                            <button
                              type="button"
                              onClick={() => removeAttackSpell(item.id)}
                              className="absolute right-3 top-3 rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                            >
                              x
                            </button>

                            <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
                              <div>
                                <div
                                  onContextMenu={(event) => {
                                    event.preventDefault();

                                    if (!canEdit) {
                                      return;
                                    }

                                    setImagePickerTarget({
                                      type: "attackSpell",
                                      id: item.id,
                                    });
                                  }}
                                  title={
                                    canEdit
                                      ? "Kliknij prawym przyciskiem myszy, aby zmienić grafikę"
                                      : "Nie masz uprawnień do edycji grafiki"
                                  }
                                  className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="aspect-square w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-square items-center justify-center text-6xl">
                                      ⚔️
                                    </div>
                                  )}
                                </div>

                                <p className="mt-2 text-center text-xs text-neutral-500">
                                  Prawy klik: zmień grafikę
                                </p>
                              </div>

                              <div className="min-w-0 pr-8">
                                <p className="text-xs font-semibold text-neutral-400">
                                  Nazwa
                                </p>

                                <EditableText
                                  value={item.name}
                                  onSave={(value) =>
                                    updateAttackSpellTextField(
                                      item.id,
                                      "name",
                                      value,
                                    )
                                  }
                                  className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left font-bold"
                                  inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 font-bold"
                                />

                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-semibold text-neutral-400">
                                      Rzut ataku
                                    </p>

                                    <EditableText
                                      value={item.attackRoll || ""}
                                      placeholder="+5 albo 1d20+5"
                                      onSave={(value) =>
                                        updateAttackSpellTextField(
                                          item.id,
                                          "attackRoll",
                                          value,
                                        )
                                      }
                                      className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left text-sm"
                                      inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <p className="text-xs font-semibold text-neutral-400">
                                      Obrażenia
                                    </p>

                                    <EditableText
                                      value={item.damageRoll || ""}
                                      placeholder="1d8+3"
                                      onSave={(value) =>
                                        updateAttackSpellTextField(
                                          item.id,
                                          "damageRoll",
                                          value,
                                        )
                                      }
                                      className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left text-sm"
                                      inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-neutral-400">
                                    Opis
                                  </p>

                                  <EditableText
                                    value={item.description || ""}
                                    placeholder="Opis ataku albo czaru."
                                    multiline
                                    onSave={(value) =>
                                      updateAttackSpellTextField(
                                        item.id,
                                        "description",
                                        value,
                                      )
                                    }
                                    className="mt-1 block min-h-24 w-full whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left text-sm text-neutral-300"
                                    inputClassName="mt-1 min-h-24 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 text-sm"
                                  />
                                </div>

                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  <button
                                    type="button"
                                    disabled={!item.attackRoll?.trim()}
                                    onClick={() =>
                                      makeRoll(
                                        normalizeAttackRollFormula(
                                          item.attackRoll || "",
                                        ),
                                        `${item.name}: atak`,
                                      )
                                    }
                                    className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                                  >
                                    Rzuć atak
                                  </button>

                                  <button
                                    type="button"
                                    disabled={!item.damageRoll?.trim()}
                                    onClick={() =>
                                      makeRoll(
                                        item.damageRoll || "",
                                        `${item.name}: obrażenia`,
                                      )
                                    }
                                    className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                                  >
                                    Rzuć obrażenia
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid h-[540px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-neutral-700 bg-neutral-800 p-4">
                  <div>
                    <h3 className="text-center text-2xl font-bold">
                      Cechy klasowe
                    </h3>

                    <p className="mt-1 text-center text-sm text-neutral-400">
                      Zdolności z klasy, rasy, tła albo specjalnych talentów.
                    </p>
                  </div>

                  <form
                    onSubmit={addClassFeature}
                    className="mt-4 grid gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 xl:grid-cols-[1fr_auto]"
                  >
                    <input
                      name="classFeatureName"
                      required
                      placeholder="Nazwa, np. Chef"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <button
                      type="submit"
                      className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                    >
                      Dodaj
                    </button>

                    <textarea
                      name="classFeatureDescription"
                      placeholder="Opis cechy klasowej"
                      className="min-h-20 rounded-lg border border-neutral-700 bg-neutral-950 p-2 xl:col-span-2"
                    />
                  </form>

                  <div className="min-h-0 overflow-y-auto pr-2 pt-4">
                    {classFeatures.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
                        Brak cech klasowych.
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        {classFeatures.map((item) => (
                          <article
                            key={item.id}
                            className="relative rounded-xl border border-red-950/80 bg-neutral-950 p-3"
                          >
                            <button
                              type="button"
                              onClick={() => removeClassFeature(item.id)}
                              className="absolute right-3 top-3 rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                            >
                              x
                            </button>

                            <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                              <div>
                                <div
                                  onContextMenu={(event) => {
                                    event.preventDefault();

                                    if (!canEdit) {
                                      return;
                                    }

                                    setImagePickerTarget({
                                      type: "classFeature",
                                      id: item.id,
                                    });
                                  }}
                                  title={
                                    canEdit
                                      ? "Kliknij prawym przyciskiem myszy, aby zmienić grafikę"
                                      : "Nie masz uprawnień do edycji grafiki"
                                  }
                                  className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="aspect-square w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex aspect-square items-center justify-center text-6xl">
                                      ✨
                                    </div>
                                  )}
                                </div>

                                <p className="mt-2 text-center text-xs text-neutral-500">
                                  Prawy klik: zmień grafikę
                                </p>
                              </div>

                              <div className="min-w-0 pr-8">
                                <p className="text-xs font-semibold text-neutral-400">
                                  Nazwa
                                </p>

                                <EditableText
                                  value={item.name}
                                  onSave={(value) =>
                                    updateClassFeatureTextField(
                                      item.id,
                                      "name",
                                      value,
                                    )
                                  }
                                  className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left font-bold"
                                  inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 font-bold"
                                />

                                <p className="mt-3 text-xs font-semibold text-neutral-400">
                                  Opis
                                </p>

                                <EditableText
                                  value={item.description || ""}
                                  placeholder="Opis cechy."
                                  multiline
                                  onSave={(value) =>
                                    updateClassFeatureTextField(
                                      item.id,
                                      "description",
                                      value,
                                    )
                                  }
                                  className="mt-1 block min-h-32 w-full whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left text-sm text-neutral-300"
                                  inputClassName="mt-1 min-h-32 w-full rounded-lg border border-red-700 bg-neutral-900 p-3 text-sm"
                                />
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid h-[520px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-neutral-700 bg-neutral-800 p-4">
                  <div>
                    <h3 className="text-center text-2xl font-bold">
                      Inne biegłości i języki
                    </h3>

                    <p className="mt-1 text-center text-sm text-neutral-400">
                      Języki, narzędzia, specjalne biegłości i wiedza postaci.
                    </p>
                  </div>

                  <form
                    onSubmit={addOtherTrait}
                    className="mt-4 grid gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 xl:grid-cols-[1fr_auto]"
                  >
                    <input
                      name="otherTraitName"
                      required
                      placeholder="Nazwa, np. Język ludu Estron"
                      className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                    />

                    <button
                      type="submit"
                      className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                    >
                      Dodaj
                    </button>

                    <textarea
                      name="otherTraitDescription"
                      placeholder="Opis biegłości, języka albo wiedzy"
                      className="min-h-20 rounded-lg border border-neutral-700 bg-neutral-950 p-2 xl:col-span-2"
                    />
                  </form>

                  <div className="min-h-0 overflow-y-auto pr-2 pt-4">
                    {otherTraits.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
                        Brak innych biegłości i języków.
                      </p>
                    ) : (
                      <div className="grid gap-4">
                        {otherTraits.map((item) => (
                          <article
                            key={item.id}
                            className="relative rounded-xl border border-red-950/80 bg-neutral-950 p-3"
                          >
                            <button
                              type="button"
                              onClick={() => removeOtherTrait(item.id)}
                              className="absolute right-3 top-3 rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                            >
                              x
                            </button>

                            <div className="min-w-0 pr-8">
                              <p className="text-xs font-semibold text-neutral-400">
                                Nazwa
                              </p>

                              <EditableText
                                value={item.name}
                                onSave={(value) =>
                                  updateOtherTraitTextField(
                                    item.id,
                                    "name",
                                    value,
                                  )
                                }
                                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left font-bold"
                                inputClassName="mt-1 w-full rounded-lg border border-red-700 bg-neutral-900 p-2 font-bold"
                              />

                              <p className="mt-3 text-xs font-semibold text-neutral-400">
                                Opis
                              </p>

                              <EditableText
                                value={item.description || ""}
                                placeholder="Opis biegłości albo języka."
                                multiline
                                onSave={(value) =>
                                  updateOtherTraitTextField(
                                    item.id,
                                    "description",
                                    value,
                                  )
                                }
                                className="mt-1 block min-h-28 w-full whitespace-pre-wrap rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-left text-sm text-neutral-300"
                                inputClassName="mt-1 min-h-28 w-full rounded-lg border border-red-700 bg-neutral-900 p-3 text-sm"
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
            {characterTab === "inventory" ? (
              <section className="mt-6 grid h-[640px] grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-neutral-700 bg-neutral-800 p-4">
                <div>
                  <h3 className="text-center text-2xl font-bold">Ekwipunek</h3>

                  <p className="mt-1 text-center text-sm text-neutral-400">
                    Przedmioty postaci, ilości, opisy i grafiki.
                  </p>
                </div>

                <form
                  onSubmit={addInventoryItem}
                  className="mt-4 grid gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-3 xl:grid-cols-[1fr_110px_auto]"
                >
                  <input
                    name="itemName"
                    required
                    placeholder="Nazwa, np. Mikstura leczenia"
                    className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                  />

                  <input
                    name="itemQuantity"
                    type="number"
                    min={0}
                    defaultValue={1}
                    className="rounded-lg border border-neutral-700 bg-neutral-950 p-2"
                  />

                  <button
                    type="submit"
                    className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                  >
                    Dodaj
                  </button>

                  <textarea
                    name="itemDescription"
                    placeholder="Opis przedmiotu"
                    className="h-16 max-h-16 min-h-16 resize-none overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-2 xl:col-span-3"
                  />
                </form>

                <div className="min-h-0 overflow-y-auto overscroll-contain pr-2 pt-4">
                  {inventory.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
                      Brak przedmiotów w ekwipunku.
                    </p>
                  ) : (
                    <div className="grid gap-4 2xl:grid-cols-2">
                      {inventory.map((item) => (
                        <article
                          key={item.id}
                          className="relative h-[380px] min-w-0 overflow-hidden rounded-xl border border-red-950/80 bg-neutral-950 p-3"
                        >
                          <button
                            type="button"
                            onClick={() => removeInventoryItem(item.id)}
                            className="absolute right-3 top-3 z-10 rounded border border-red-900 bg-red-950/50 px-2 py-1 text-xs text-red-200"
                          >
                            x
                          </button>

                          <div className="grid h-full min-w-0 gap-4 pr-8 lg:grid-cols-[200px_minmax(0,1fr)]">
                            <div className="min-w-0">
                              <div
                                onContextMenu={(event) => {
                                  event.preventDefault();

                                  if (!canEdit) {
                                    return;
                                  }

                                  setImagePickerTarget({
                                    type: "inventory",
                                    id: item.id,
                                  });
                                }}
                                title={
                                  canEdit
                                    ? "Kliknij prawym przyciskiem myszy, aby zmienić grafikę"
                                    : "Nie masz uprawnień do edycji grafiki"
                                }
                                className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="aspect-square w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex aspect-square items-center justify-center text-6xl">
                                    🎒
                                  </div>
                                )}
                              </div>

                              <p className="mt-2 text-center text-xs text-neutral-500">
                                Prawy klik: zmień grafikę
                              </p>
                            </div>

                            <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)]">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-neutral-400">
                                  Nazwa
                                </p>

                                <EditableText
                                  value={item.name}
                                  onSave={(value) =>
                                    updateInventoryItemTextField(
                                      item.id,
                                      "name",
                                      value,
                                    )
                                  }
                                  className="mt-1 block h-11 max-h-11 min-h-11 w-full overflow-y-auto break-all rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-left font-bold"
                                  inputClassName="mt-1 h-11 max-h-11 min-h-11 w-full resize-none overflow-y-auto rounded-lg border border-red-700 bg-neutral-900 p-2 font-bold"
                                />
                              </div>

                              <div className="mt-3">
                                <p className="text-xs font-semibold text-neutral-400">
                                  Ilość
                                </p>

                                <div className="mt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeInventoryItemQuantity(item.id, -1)
                                    }
                                    className="rounded-lg border border-neutral-600 px-3 py-1 font-bold"
                                  >
                                    -
                                  </button>

                                  <EditableNumber
                                    value={item.quantity}
                                    min={0}
                                    onSave={(value) =>
                                      updateInventoryItemQuantity(
                                        item.id,
                                        value,
                                      )
                                    }
                                    className="min-w-14 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-1 text-center font-bold"
                                    inputClassName="w-20 rounded-lg border border-red-700 bg-neutral-900 px-3 py-1 text-center font-bold"
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeInventoryItemQuantity(item.id, 1)
                                    }
                                    className="rounded-lg border border-neutral-600 px-3 py-1 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 min-h-0">
                                <p className="text-xs font-semibold text-neutral-400">
                                  Opis
                                </p>

                                <textarea
                                  defaultValue={item.description || ""}
                                  placeholder="Opis przedmiotu."
                                  wrap="soft"
                                  onBlur={(event) =>
                                    updateInventoryItemTextField(
                                      item.id,
                                      "description",
                                      event.currentTarget.value,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" &&
                                      (event.ctrlKey || event.metaKey)
                                    ) {
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="mt-1 h-[170px] max-h-[170px] min-h-[170px] w-full resize-none overflow-y-auto break-all rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-300 outline-none focus:border-red-700"
                                />
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </section>
        </section>
      </div>

      {imagePickerTarget ? (
        <ImagePickerModal
          title="Wybierz grafikę z biblioteki"
          allowedCategories={getImagePickerCategories()}
          onSelect={selectImage}
          onClose={() => setImagePickerTarget(null)}
        />
      ) : null}
    </main>
  );
}
