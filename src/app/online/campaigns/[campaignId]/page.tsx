"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { createClient } from "@/lib/supabase/client";
import { createDefaultOnlineCharacterData } from "@/lib/onlineCharacterTemplate";

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

type OnlineCharacter = {
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

type CampaignMember = {
  user_id: string;
  display_name: string;
  role: "owner" | "game_master" | "player";
  created_at: string;
};

type DiceRoll = {
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
  { sides: 4, label: "D4", icon: "△" },
  { sides: 6, label: "D6", icon: "□" },
  { sides: 8, label: "D8", icon: "◇" },
  { sides: 10, label: "D10", icon: "⬟" },
  { sides: 12, label: "D12", icon: "⬢" },
  { sides: 20, label: "D20", icon: "✦" },
];

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

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

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getRoleLabel(role: CampaignMember["role"]) {
  if (role === "owner") {
    return "Właściciel kampanii";
  }

  if (role === "game_master") {
    return "Game Master";
  }

  return "Gracz";
}

function getRoleClass(role: CampaignMember["role"]) {
  if (role === "owner") {
    return "border-red-700 bg-red-950/40 text-red-300";
  }

  if (role === "game_master") {
    return "border-yellow-700 bg-yellow-950/30 text-yellow-300";
  }

  return "border-neutral-700 bg-neutral-950 text-neutral-300";
}

export default function OnlineCampaignLobbyPage() {
  const params = useParams();
  const router = useRouter();

  const campaignId = String(params.campaignId);

  const [campaign, setCampaign] = useState<OnlineCampaign | null>(null);
  const [characters, setCharacters] = useState<OnlineCharacter[]>([]);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignNotes, setCampaignNotes] = useState("");
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [formula, setFormula] = useState("1d20");
  const [reason, setReason] = useState("");
  const [dicePool, setDicePool] = useState<DicePoolItem[]>([]);
  const [diceModifier, setDiceModifier] = useState(0);
  const [status, setStatus] = useState("Ładuję lobby kampanii...");
  const [realtimeStatus, setRealtimeStatus] = useState(
    "Realtime: łączę z Supabase...",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<
    string | null
  >(null);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const isCampaignOwner = Boolean(
    campaign && userId && campaign.owner_id === userId,
  );

  const currentMember = useMemo(() => {
    if (!userId) {
      return null;
    }

    return members.find((member) => member.user_id === userId) ?? null;
  }, [members, userId]);

  const isGameMaster = currentMember?.role === "game_master";
  const canRollAsDm = isCampaignOwner || isGameMaster;
  const myCharacters = useMemo(() => {
    if (!userId) {
      return [];
    }

    return characters.filter((character) => character.owner_id === userId);
  }, [characters, userId]);

  const otherCharacters = useMemo(() => {
    if (!userId) {
      return characters;
    }

    return characters.filter((character) => character.owner_id !== userId);
  }, [characters, userId]);

  const playableCharacters = useMemo(() => {
    if (isCampaignOwner) {
      return characters;
    }

    return myCharacters;
  }, [characters, myCharacters, isCampaignOwner]);

  async function loadCampaignMembers() {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_campaign_members", {
      campaign_id_to_check: campaignId,
    });

    if (error) {
      setMembers([]);
      setStatus(`Nie udało się pobrać członków kampanii: ${error.message}`);
      return;
    }

    setMembers((data ?? []) as CampaignMember[]);
  }

  async function loadCampaignLobby() {
    setIsLoading(true);
    setStatus("Ładuję lobby kampanii...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserId(null);
      setCampaign(null);
      setCharacters([]);
      setMembers([]);
      setDiceRolls([]);
      setStatus("Musisz być zalogowany, żeby otworzyć kampanię online.");
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
      setCharacters([]);
      setMembers([]);
      setStatus(
        `Nie udało się pobrać kampanii: ${
          campaignError?.message ?? "brak danych"
        }`,
      );
      setIsLoading(false);
      return;
    }

    const { data: memberData, error: memberError } = await supabase.rpc(
      "get_campaign_members",
      {
        campaign_id_to_check: campaignId,
      },
    );

    const loadedMembers = memberError
      ? []
      : ((memberData ?? []) as CampaignMember[]);

    setMembers(loadedMembers);

    const { data: characterData, error: characterError } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (characterError) {
      setCampaign(campaignData as OnlineCampaign);
      setCharacters([]);
      setStatus(`Nie udało się pobrać postaci: ${characterError.message}`);
      setIsLoading(false);
      return;
    }

    const loadedCharacters = (characterData ?? []) as OnlineCharacter[];

    const { data: rollData, error: rollError } = await supabase
      .from("dice_rolls")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (rollError) {
      setDiceRolls([]);
    } else {
      setDiceRolls((rollData ?? []) as DiceRoll[]);
    }

    setCampaign(campaignData as OnlineCampaign);
    setCharacters(loadedCharacters);
    setCampaignName(campaignData.name ?? "");
    setCampaignDescription(campaignData.description ?? "");
    setCampaignNotes(campaignData.notes ?? "");

    const isOwner = campaignData.owner_id === userData.user.id;
    const currentLoadedMember =
      loadedMembers.find((member) => member.user_id === userData.user.id) ??
      null;

    const canDefaultToDm =
      isOwner || currentLoadedMember?.role === "game_master";

    const firstPlayableCharacter = isOwner
      ? loadedCharacters[0]
      : loadedCharacters.find(
          (character) => character.owner_id === userData.user.id,
        );

    setSelectedCharacterId(
      firstPlayableCharacter?.id ?? (canDefaultToDm ? "dm" : ""),
    );

    setStatus(
      memberError
        ? `Lobby wczytane, ale nie udało się pobrać członków: ${memberError.message}`
        : "Lobby kampanii zostało wczytane.",
    );

    setIsLoading(false);
  }

  useEffect(() => {
    void loadCampaignLobby();
  }, [campaignId]);

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

          if (!newRoll) {
            return;
          }

          if (newRoll.campaign_id !== campaignId) {
            return;
          }

          setRealtimeStatus(
            `Realtime: odebrano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
          );

          addDiceRollToHistory(newRoll);
        },
      )
      .on(
        "broadcast",
        {
          event: "delete-roll",
        },
        (payload) => {
          const deletedRoll = payload.payload as
            | {
                campaign_id?: string;
                roll_id?: string;
              }
            | undefined;

          if (!deletedRoll) {
            return;
          }

          if (deletedRoll.campaign_id !== campaignId) {
            return;
          }

          if (!deletedRoll.roll_id) {
            return;
          }

          setDiceRolls((currentRolls) =>
            currentRolls.filter((roll) => roll.id !== deletedRoll.roll_id),
          );

          setRealtimeStatus(
            `Realtime: usunięto rzut ${new Date().toLocaleTimeString("pl-PL")}`,
          );
        },
      )
      .on(
        "broadcast",
        {
          event: "clear-rolls",
        },
        (payload) => {
          const clearData = payload.payload as
            | {
                campaign_id?: string;
                mode?: "all" | "user";
                user_id?: string;
              }
            | undefined;

          if (!clearData) {
            return;
          }

          if (clearData.campaign_id !== campaignId) {
            return;
          }

          if (clearData.mode === "all") {
            setDiceRolls([]);
          }

          if (clearData.mode === "user" && clearData.user_id) {
            setDiceRolls((currentRolls) =>
              currentRolls.filter((roll) => roll.user_id !== clearData.user_id),
            );
          }

          setRealtimeStatus(
            `Realtime: wyczyszczono rzuty ${new Date().toLocaleTimeString(
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
          const newRoll = payload.new as DiceRoll;

          if (newRoll.campaign_id !== campaignId) {
            return;
          }

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
  }, [campaignId]);

  async function changeCampaignMemberRole(
    memberUserId: string,
    newRole: "player" | "game_master",
  ) {
    if (!isCampaignOwner) {
      setStatus("Tylko właściciel kampanii może zmieniać role.");
      return;
    }

    setIsChangingRole(true);
    setStatus("Zmieniam rolę członka kampanii...");

    const supabase = createClient();

    const { error } = await supabase.rpc("set_campaign_member_role", {
      campaign_id_to_update: campaignId,
      user_id_to_update: memberUserId,
      new_role: newRole,
    });

    if (error) {
      setStatus(`Nie udało się zmienić roli: ${error.message}`);
      setIsChangingRole(false);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((member) => {
        if (member.user_id !== memberUserId) {
          return member;
        }

        return {
          ...member,
          role: newRole,
        };
      }),
    );

    setStatus("Rola członka kampanii została zmieniona.");
    setIsChangingRole(false);

    await loadCampaignMembers();
  }

  async function removeCampaignMember(memberToRemove: CampaignMember) {
    if (!isCampaignOwner) {
      setStatus("Tylko właściciel kampanii może usuwać członków.");
      return;
    }

    if (memberToRemove.role === "owner") {
      setStatus("Nie można usunąć właściciela kampanii.");
      return;
    }

    if (memberToRemove.user_id === userId) {
      setStatus("Nie możesz usunąć samego siebie z kampanii.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć użytkownika „${
        memberToRemove.display_name || "Bez nazwy"
      }” z kampanii? Jego postacie zostaną w kampanii, ale straci do nich dostęp.`,
    );

    if (!confirmed) {
      return;
    }

    setRemovingMemberUserId(memberToRemove.user_id);
    setStatus("Usuwam członka z kampanii...");

    const supabase = createClient();

    const { error } = await supabase.rpc("remove_campaign_member", {
      campaign_id_to_update: campaignId,
      user_id_to_remove: memberToRemove.user_id,
    });

    if (error) {
      setStatus(`Nie udało się usunąć członka kampanii: ${error.message}`);
      setRemovingMemberUserId(null);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.filter(
        (member) => member.user_id !== memberToRemove.user_id,
      ),
    );

    setStatus(
      "Członek został usunięty z kampanii. Jego postacie zostały w kampanii.",
    );
    setRemovingMemberUserId(null);

    await loadCampaignMembers();
  }
  async function saveCampaignDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!campaign) {
      setStatus("Nie wczytano kampanii.");
      return;
    }

    if (!isCampaignOwner) {
      setStatus("Tylko właściciel kampanii może edytować kampanię.");
      return;
    }

    const cleanedName = campaignName.trim();
    const cleanedDescription = campaignDescription.trim();
    const cleanedNotes = campaignNotes.trim();

    if (!cleanedName) {
      setStatus("Nazwa kampanii nie może być pusta.");
      return;
    }

    setIsSavingCampaign(true);
    setStatus("Zapisuję dane kampanii...");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("campaigns")
      .update({
        name: cleanedName,
        description: cleanedDescription,
        notes: cleanedNotes,
      })
      .eq("id", campaignId)
      .select("*")
      .single();

    if (error || !data) {
      setStatus(
        `Nie udało się zapisać kampanii: ${
          error?.message ?? "brak danych po zapisie"
        }`,
      );
      setIsSavingCampaign(false);
      return;
    }

    setCampaign(data as OnlineCampaign);
    setCampaignName(data.name ?? "");
    setCampaignDescription(data.description ?? "");
    setCampaignNotes(data.notes ?? "");

    setStatus("Dane kampanii zostały zapisane.");
    setIsSavingCampaign(false);
  }
  async function createOnlineCharacter() {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby stworzyć postać.");
      return;
    }

    setIsCreatingCharacter(true);
    setStatus("Tworzę Twoją postać online...");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("characters")
      .insert({
        campaign_id: campaignId,
        owner_id: userId,
        name: "Nowa postać online",
        player_name: "",
        class_name: "",
        race: "",
        level: 1,
        hp: 10,
        max_hp: 10,
        temporary_hp: 0,
        armor_class: 10,
        initiative: 0,
        speed: 30,
        hit_dice: 1,
        portrait_url: "",
        description: "",
        data: createDefaultOnlineCharacterData(),
      })
      .select("*")
      .single();

    if (error || !data) {
      setStatus(`Nie udało się stworzyć postaci: ${error?.message}`);
      setIsCreatingCharacter(false);
      return;
    }

    setStatus("Postać została stworzona. Otwieram kartę...");
    setIsCreatingCharacter(false);

    router.push(`/online/campaigns/${campaignId}/play/${data.id}`);
  }

  async function deleteOnlineCharacter(characterIdToDelete: string) {
    const characterToDelete = characters.find(
      (character) => character.id === characterIdToDelete,
    );

    if (!characterToDelete || !userId) {
      return;
    }

    const canDelete =
      characterToDelete.owner_id === userId || campaign?.owner_id === userId;

    if (!canDelete) {
      setStatus("Nie masz uprawnień do usunięcia tej postaci.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć postać „${characterToDelete.name}”?`,
    );

    if (!confirmed) {
      return;
    }

    setStatus("Usuwam postać...");

    const supabase = createClient();

    const { error } = await supabase
      .from("characters")
      .delete()
      .eq("id", characterIdToDelete)
      .eq("campaign_id", campaignId);

    if (error) {
      setStatus(`Nie udało się usunąć postaci: ${error.message}`);
      return;
    }

    setCharacters((currentCharacters) =>
      currentCharacters.filter(
        (character) => character.id !== characterIdToDelete,
      ),
    );

    if (selectedCharacterId === characterIdToDelete) {
      setSelectedCharacterId("");
    }

    setStatus("Postać została usunięta.");
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
      return modifier === 0
        ? "Brak kości"
        : `${modifier >= 0 ? "+" : ""}${modifier}`;
    }

    if (modifier === 0) {
      return dicePart;
    }

    return `${dicePart}${modifier >= 0 ? "+" : ""}${modifier}`;
  }

  function getDicePoolTiles(pool: DicePoolItem[]) {
    return pool.flatMap((item) =>
      Array.from({ length: item.count }, (_, index) => ({
        sides: item.sides,
        key: `${item.sides}-${index}`,
      })),
    );
  }

  async function saveDiceRoll(
    rollFormula: string,
    rollReason: string,
    rolls: number[],
    modifier: number,
    total: number,
  ) {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby rzucać online.");
      return;
    }

    const isDmRoll =
      selectedCharacterId === "dm" || (canRollAsDm && !selectedCharacterId);

    const selectedCharacter = playableCharacters.find(
      (character) => character.id === selectedCharacterId,
    );

    if (!selectedCharacter && !isDmRoll) {
      setStatus("Najpierw wybierz postać albo rzuć jako DM.");
      return;
    }

    setIsRolling(true);
    setStatus("Zapisuję rzut online...");

    const supabase = createClient();

    const { data: insertedRoll, error } = await supabase
      .from("dice_rolls")
      .insert({
        campaign_id: campaignId,
        character_id: isDmRoll ? null : selectedCharacter?.id,
        user_id: userId,
        character_name: isDmRoll ? "DM" : (selectedCharacter?.name ?? "Postać"),
        formula: rollFormula,
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

    const savedRoll = insertedRoll as DiceRoll;

    addDiceRollToHistory(savedRoll);

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "new-roll",
      payload: {
        roll: savedRoll,
      },
    });

    setStatus("Rzut online został zapisany.");
    setRealtimeStatus(
      `Realtime: wysłano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
    );
    setIsRolling(false);
  }

  async function makeRoll(rollFormula: string, rollReason: string) {
    const rollResult = parseAndRollFormula(rollFormula);

    if (!rollResult) {
      setStatus("Niepoprawny zapis rzutu. Użyj np. 1d20, 2d6+3 albo 1d8-1.");
      return;
    }

    await saveDiceRoll(
      rollFormula,
      rollReason,
      rollResult.rolls,
      rollResult.modifier,
      rollResult.total,
    );
  }

  async function handleDicePoolRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dicePool.length === 0) {
      setStatus("Dodaj przynajmniej jedną kość do stołu.");
      return;
    }

    const rolls = dicePool.flatMap((item) =>
      Array.from({ length: item.count }, () => rollDie(item.sides)),
    );

    const total =
      rolls.reduce((sum, currentRoll) => sum + currentRoll, 0) + diceModifier;

    await saveDiceRoll(
      getDicePoolFormula(dicePool, diceModifier),
      reason,
      rolls,
      diceModifier,
      total,
    );

    setReason("");
  }

  async function deleteDiceRoll(rollToDelete: DiceRoll) {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby usuwać rzuty.");
      return;
    }

    const canDelete = rollToDelete.user_id === userId || isCampaignOwner;

    if (!canDelete) {
      setStatus("Możesz usunąć tylko swoje rzuty.");
      return;
    }

    const confirmed = window.confirm("Czy na pewno chcesz usunąć ten rzut?");

    if (!confirmed) {
      return;
    }

    setStatus("Usuwam rzut...");

    const supabase = createClient();

    const { error } = await supabase
      .from("dice_rolls")
      .delete()
      .eq("id", rollToDelete.id)
      .eq("campaign_id", campaignId);

    if (error) {
      setStatus(`Nie udało się usunąć rzutu: ${error.message}`);
      return;
    }

    setDiceRolls((currentRolls) =>
      currentRolls.filter((roll) => roll.id !== rollToDelete.id),
    );

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "delete-roll",
      payload: {
        campaign_id: campaignId,
        roll_id: rollToDelete.id,
      },
    });

    setStatus("Rzut został usunięty.");
  }

  async function clearMyDiceRolls() {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby czyścić rzuty.");
      return;
    }

    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć wszystkie swoje rzuty z tej kampanii?",
    );

    if (!confirmed) {
      return;
    }

    setStatus("Usuwam Twoje rzuty...");

    const supabase = createClient();

    const { error } = await supabase
      .from("dice_rolls")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", userId);

    if (error) {
      setStatus(`Nie udało się usunąć Twoich rzutów: ${error.message}`);
      return;
    }

    setDiceRolls((currentRolls) =>
      currentRolls.filter((roll) => roll.user_id !== userId),
    );

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "clear-rolls",
      payload: {
        campaign_id: campaignId,
        mode: "user",
        user_id: userId,
      },
    });

    setStatus("Twoje rzuty zostały usunięte.");
  }

  async function clearCampaignDiceRolls() {
    if (!isCampaignOwner) {
      setStatus("Tylko właściciel kampanii może wyczyścić całą historię.");
      return;
    }

    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć CAŁĄ historię rzutów w tej kampanii?",
    );

    if (!confirmed) {
      return;
    }

    setStatus("Usuwam całą historię rzutów...");

    const supabase = createClient();

    const { error } = await supabase
      .from("dice_rolls")
      .delete()
      .eq("campaign_id", campaignId);

    if (error) {
      setStatus(`Nie udało się wyczyścić historii: ${error.message}`);
      return;
    }

    setDiceRolls([]);

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "clear-rolls",
      payload: {
        campaign_id: campaignId,
        mode: "all",
      },
    });

    setStatus("Cała historia rzutów została wyczyszczona.");
  }

  async function handleCustomRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await makeRoll(formula, reason);

    setReason("");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-neutral-300">{status}</p>
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-red-500">{status}</p>

          <Link
            href="/online"
            className="mt-4 inline-block rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300"
          >
            Wróć do kampanii online
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/" className="text-neutral-300 underline">
                  Strona główna
                </Link>

                <span className="text-neutral-600">/</span>

                <Link href="/online" className="text-neutral-300 underline">
                  Kampanie online
                </Link>
              </div>

              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
                Lobby kampanii
              </p>

              <h1 className="mt-2 text-4xl font-bold">{campaign.name}</h1>

              {campaign.description ? (
                <p className="mt-3 max-w-3xl text-neutral-300">
                  {campaign.description}
                </p>
              ) : (
                <p className="mt-3 max-w-3xl text-neutral-400">
                  Brak opisu kampanii.
                </p>
              )}

              {isGameMaster ? (
                <p className="mt-4 inline-block rounded-lg border border-yellow-700 bg-yellow-950/30 px-3 py-2 text-sm font-semibold text-yellow-300">
                  Masz rolę Game Mastera w tej kampanii.
                </p>
              ) : null}
            </div>

            <AuthPanel />
          </div>
        </header>

        {status ? (
          <p className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-red-400">
            {status}
          </p>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-2xl border border-red-950 bg-red-950/20 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Postać gracza
            </p>

            <h2 className="mt-3 text-3xl font-bold">Stwórz swoją postać</h2>

            <p className="mt-3 text-neutral-300">
              Każdy gracz powinien stworzyć własną postać. Po stworzeniu od razu
              otworzy się karta postaci online.
            </p>

            <button
              type="button"
              onClick={createOnlineCharacter}
              disabled={isCreatingCharacter}
              className="mt-6 rounded-lg border border-red-700 bg-red-950/40 px-5 py-3 font-semibold text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isCreatingCharacter ? "Tworzę..." : "Stwórz swoją postać"}
            </button>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            {isCampaignOwner ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
                  Kod zaproszenia
                </p>

                <div className="mt-4 rounded-xl border border-red-900 bg-neutral-950 p-5 text-center">
                  <p className="text-4xl font-black tracking-[0.25em] text-red-300">
                    {campaign.invite_code}
                  </p>
                </div>

                <p className="mt-4 text-sm text-neutral-400">
                  Podaj ten kod graczom. Gracz wchodzi na stronę główną, klika
                  „Dołącz do kampanii” i wpisuje kod.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Status
                </p>

                <h2 className="mt-3 text-2xl font-bold">Jesteś w kampanii</h2>

                <p className="mt-3 text-neutral-400">
                  Możesz stworzyć swoją postać albo otworzyć istniejącą kartę.
                </p>
              </>
            )}
          </article>
        </section>
        {isCampaignOwner ? (
          <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <div>
              <h2 className="text-2xl font-bold">Ustawienia kampanii</h2>

              <p className="mt-1 text-sm text-neutral-400">
                Tylko właściciel kampanii może zmieniać nazwę, opis i notatki
                kampanii.
              </p>
            </div>

            <form onSubmit={saveCampaignDetails} className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm">
                Nazwa kampanii
                <input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="np. Klątwa Czarnego Lasu"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Opis kampanii
                <textarea
                  value={campaignDescription}
                  onChange={(event) =>
                    setCampaignDescription(event.target.value)
                  }
                  placeholder="Krótki opis kampanii widoczny dla graczy."
                  rows={4}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Notatki kampanii
                <textarea
                  value={campaignNotes}
                  onChange={(event) => setCampaignNotes(event.target.value)}
                  placeholder="Prywatne / organizacyjne notatki kampanii."
                  rows={5}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <button
                type="submit"
                disabled={isSavingCampaign}
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
              >
                {isSavingCampaign ? "Zapisuję..." : "Zapisz dane kampanii"}
              </button>
            </form>
          </section>
        ) : null}
        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Członkowie kampanii</h2>

              <p className="mt-1 text-sm text-neutral-400">
                Rola Game Mastera działa tylko w tej kampanii. To nie jest admin
                aplikacji.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCampaignMembers()}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
            >
              Odśwież członków
            </button>
          </div>

          {members.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-neutral-700 p-6 text-center text-neutral-400">
              Nie udało się wczytać członków kampanii albo nie ma ich jeszcze na
              liście.
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {members.map((member) => {
                const canManageThisMember =
                  isCampaignOwner &&
                  member.user_id !== userId &&
                  member.role !== "owner";

                return (
                  <article
                    key={member.user_id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-lg font-bold">
                          {member.display_name || "Bez nazwy"}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          Dołączył: {formatDate(member.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${getRoleClass(
                            member.role,
                          )}`}
                        >
                          {getRoleLabel(member.role)}
                        </span>

                        {canManageThisMember ? (
                          member.role === "game_master" ? (
                            <button
                              type="button"
                              disabled={isChangingRole}
                              onClick={() =>
                                changeCampaignMemberRole(
                                  member.user_id,
                                  "player",
                                )
                              }
                              className="rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold text-neutral-300 disabled:text-neutral-600"
                            >
                              Zmień na gracza
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isChangingRole}
                              onClick={() =>
                                changeCampaignMemberRole(
                                  member.user_id,
                                  "game_master",
                                )
                              }
                              className="rounded-lg border border-yellow-700 px-3 py-2 text-sm font-semibold text-yellow-300 disabled:text-neutral-600"
                            >
                              Nadaj Game Mastera
                            </button>
                          )
                        ) : null}

                        {canManageThisMember ? (
                          <button
                            type="button"
                            disabled={removingMemberUserId === member.user_id}
                            onClick={() => removeCampaignMember(member)}
                            className="rounded-lg border border-red-900 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:text-neutral-600"
                          >
                            {removingMemberUserId === member.user_id
                              ? "Usuwam..."
                              : "Usuń z kampanii"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Twoje postacie</h2>

              <p className="mt-1 text-sm text-neutral-400">
                Te postacie możesz edytować. Właściciel kampanii może zarządzać
                wszystkimi postaciami.
              </p>
            </div>

            <button
              type="button"
              onClick={createOnlineCharacter}
              disabled={isCreatingCharacter}
              className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isCreatingCharacter ? "Tworzę..." : "Nowa postać"}
            </button>
          </div>

          {myCharacters.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-700 p-8 text-center">
              <p className="text-neutral-400">
                Nie masz jeszcze postaci w tej kampanii.
              </p>

              <button
                type="button"
                onClick={createOnlineCharacter}
                disabled={isCreatingCharacter}
                className="mt-4 rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-500 disabled:text-neutral-600"
              >
                Stwórz pierwszą postać
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {myCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  campaignId={campaignId}
                  canDelete={
                    character.owner_id === userId ||
                    campaign.owner_id === userId
                  }
                  onDelete={() => deleteOnlineCharacter(character.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Postacie w kampanii</h2>

          <p className="mt-1 text-sm text-neutral-400">
            Właściciel kampanii i Game Master widzą wszystkie postacie. Zwykły
            gracz widzi głównie swoje postacie.
          </p>

          {characters.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-neutral-700 p-6 text-center text-neutral-400">
              W kampanii nie ma jeszcze żadnych postaci.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {otherCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  campaignId={campaignId}
                  canDelete={
                    character.owner_id === userId ||
                    campaign.owner_id === userId
                  }
                  onDelete={() => deleteOnlineCharacter(character.id)}
                />
              ))}

              {otherCharacters.length === 0 ? (
                <p className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-neutral-400">
                  Nie ma jeszcze postaci innych graczy albo nie masz uprawnień,
                  żeby je widzieć.
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Rzuty realtime</h2>

                <p className="mt-2 text-sm text-neutral-400">
                  Lobby używa takiego samego stołu kości jak karta postaci. DM i
                  Game Master mogą rzucać bez tworzenia postaci.
                </p>
              </div>

              <button
                type="button"
                onClick={clearDicePool}
                className="rounded-lg border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-400"
              >
                Wyczyść stół
              </button>
            </div>

            {!canRollAsDm && playableCharacters.length === 0 ? (
              <p className="mt-5 rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-400">
                Najpierw stwórz postać, żeby rzucać.
              </p>
            ) : (
              <form onSubmit={handleDicePoolRoll} className="mt-5 grid gap-4">
                <label className="grid gap-1 text-sm">
                  Kto rzuca?
                  <select
                    value={selectedCharacterId}
                    onChange={(event) =>
                      setSelectedCharacterId(event.target.value)
                    }
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  >
                    {canRollAsDm ? (
                      <option value="dm">DM / Game Master</option>
                    ) : null}

                    {playableCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-6 gap-1">
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
                    Dla prostych zapisów, np. 1d20, 2d6+3 albo 1d8-1.
                  </p>

                  <div className="mt-3 grid gap-2">
                    <input
                      value={formula}
                      onChange={(event) => setFormula(event.target.value)}
                      placeholder="np. 1d20+5"
                      className="rounded-lg border border-neutral-700 bg-neutral-900 p-2"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        void makeRoll(formula, reason);
                        setReason("");
                      }}
                      disabled={isRolling}
                      className="rounded-lg border border-neutral-700 px-4 py-2 font-semibold text-neutral-300 disabled:text-neutral-600"
                    >
                      Rzuć z zapisu
                    </button>
                  </div>
                </details>
              </form>
            )}
          </aside>

          <section className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Historia rzutów online</h2>

                <p className="mt-1 text-sm text-neutral-400">
                  Możesz usuwać swoje rzuty. Właściciel kampanii może wyczyścić
                  całą historię.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearMyDiceRolls}
                  className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
                >
                  Wyczyść moje rzuty
                </button>

                {isCampaignOwner ? (
                  <button
                    type="button"
                    onClick={clearCampaignDiceRolls}
                    className="rounded-lg border border-red-900 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/30"
                  >
                    Wyczyść wszystko
                  </button>
                ) : null}
              </div>
            </div>

            {diceRolls.length === 0 ? (
              <p className="mt-5 text-neutral-400">
                Nie ma jeszcze żadnych rzutów online.
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {diceRolls.map((roll) => (
                  <article
                    key={roll.id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">
                          {roll.character_name} rzuca {roll.formula}
                        </p>

                        {roll.reason ? (
                          <p className="mt-1 text-sm text-neutral-400">
                            {roll.reason}
                          </p>
                        ) : null}

                        <p className="mt-1 text-xs text-neutral-500">
                          Kości: {roll.rolls.join(", ")}
                          {roll.modifier !== 0
                            ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-neutral-600">
                          {formatDate(roll.created_at)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <p className="text-4xl font-black text-red-500">
                          {roll.total}
                        </p>

                        {roll.user_id === userId || isCampaignOwner ? (
                          <button
                            type="button"
                            onClick={() => deleteDiceRoll(roll)}
                            className="rounded-lg border border-red-900 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-950/30"
                          >
                            Usuń
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function CharacterCard({
  character,
  campaignId,
  canDelete,
  onDelete,
}: {
  character: OnlineCharacter;
  campaignId: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-neutral-700 bg-neutral-800 p-4">
      <div className="flex gap-4">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
          {character.portrait_url ? (
            <img
              src={character.portrait_url}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">
              🧙
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-bold">{character.name}</h3>

          <p className="mt-1 text-sm text-neutral-400">
            {character.race || "Rasa"} · {character.class_name || "Klasa"} ·
            poziom {character.level}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">HP</p>
              <p className="font-bold">
                {character.hp}/{character.max_hp ?? character.hp}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">KP</p>
              <p className="font-bold">{character.armor_class}</p>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">Szyb.</p>
              <p className="font-bold">{character.speed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/online/campaigns/${campaignId}/play/${character.id}`}
          className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
        >
          Graj online
        </Link>

        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400"
          >
            Usuń postać
          </button>
        ) : null}
      </div>
    </article>
  );
}
