type CharacterCardProps = {
  name: string;
  playerName?: string;
  className: string;
  race?: string;
  level: number;
  hp: number;
  armorClass: number;
};

export function CharacterCard({
  name,
  playerName,
  className,
  race,
  level,
  hp,
  armorClass,
}: CharacterCardProps) {
  return (
    <article className="rounded-xl border p-4">
      <h3 className="text-xl font-bold">{name}</h3>

      {playerName ? <p className="text-sm">Gracz: {playerName}</p> : null}

      <p className="mt-2">
        {className}, poziom {level}
      </p>

      {race ? <p>Rasa / pochodzenie: {race}</p> : null}

      <div className="mt-3 flex gap-4">
        <p>HP: {hp}</p>
        <p>AC: {armorClass}</p>
      </div>
    </article>
  );
}
