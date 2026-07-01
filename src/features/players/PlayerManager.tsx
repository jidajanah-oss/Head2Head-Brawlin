import { useMemo, useState } from "react";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import type { Player } from "../../types/player";
import { nflTeams } from "./nflTeams";

type PlayerFilter = "all" | "active" | "commissioners" | "players";

function getRoleLabel(role: Player["role"]) {
  if (role === "commissioner") return "Commissioner";
  if (role === "backup_commissioner") return "Backup Commish";
  return "Player";
}

function getRoleBadgeVariant(role: Player["role"]) {
  if (role === "commissioner") return "gold";
  if (role === "backup_commissioner") return "info";
  return "neutral";
}

function getTeamInitials(team: string) {
  return team.slice(0, 3).toUpperCase();
}

function PlayerManager() {
  const {
    league,
    addPlayer,
    deletePlayer,
    activePlayerId,
    setActivePlayerId,
  } = useLeague();

  const players = league.players;

  const [name, setName] = useState("");
  const [nflTeam, setNflTeam] = useState("BUF");
  const [role, setRole] = useState<Player["role"]>("player");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<PlayerFilter>("all");

  const availableTeams = useMemo(() => {
    const used = new Set(players.map((player) => player.nflTeam));
    return nflTeams.filter((team) => !used.has(team));
  }, [players]);

  const selectedTeam = availableTeams.includes(nflTeam)
    ? nflTeam
    : availableTeams[0] ?? "";

  const activePlayers = players.filter((player) => player.status === "active");
  const commissioners = players.filter(
    (player) =>
      player.role === "commissioner" ||
      player.role === "backup_commissioner"
  );

  const activePlayer = players.find((player) => player.id === activePlayerId);

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(search.toLowerCase()) ||
      player.nflTeam.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "active") return player.status === "active";
    if (activeFilter === "commissioners") {
      return (
        player.role === "commissioner" ||
        player.role === "backup_commissioner"
      );
    }
    if (activeFilter === "players") return player.role === "player";

    return true;
  });

  const isAddDisabled =
    players.length >= league.settings.maxPlayers ||
    !name.trim() ||
    !selectedTeam;

  const filters: Array<{ id: PlayerFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: players.length },
    { id: "active", label: "Active", count: activePlayers.length },
    { id: "commissioners", label: "Commish", count: commissioners.length },
    {
      id: "players",
      label: "Players",
      count: players.filter((player) => player.role === "player").length,
    },
  ];

  const handleAddPlayer = () => {
    if (isAddDisabled) return;

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: name.trim(),
      nflTeam: selectedTeam,
      status: "active",
      role,
    };

    addPlayer(newPlayer);

    setName("");
    setRole("player");
    setNflTeam(availableTeams.find((team) => team !== selectedTeam) ?? "");
  };

  return (
    <main className="player-manager players-v2">
      <SteelHero
        eyebrow="Player Profile"
        title="Me"
        subtitle="Manage your active player card, league roster, and franchise identity."
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Standings"
        secondaryHref="/standings"
        rightContent={
          <div className="players-hero-panel">
            <span>Active Player</span>
            <strong>{activePlayer ? activePlayer.name : "None"}</strong>
            <small>{activePlayer ? activePlayer.nflTeam : "Select below"}</small>
          </div>
        }
      />

      <section className="players-stat-grid">
        <SteelStatCard
          label="Players"
          value={`${players.length}/${league.settings.maxPlayers}`}
          helper="League capacity"
          icon="👥"
        />

        <SteelStatCard
          label="Active"
          value={activePlayers.length}
          helper="Eligible players"
          icon="✅"
        />

        <SteelStatCard
          label="Commish Team"
          value={commissioners.length}
          helper="League operators"
          icon="🛡️"
        />

        <SteelStatCard
          label="Teams Open"
          value={availableTeams.length}
          helper="Available franchises"
          icon="🏈"
        />
      </section>

      <SteelCard className="players-active-card" as="section" variant="gold">
        <SteelSectionHeader
          eyebrow="Current Identity"
          title={activePlayer ? activePlayer.name : "No active player selected"}
          description={
            activePlayer
              ? `${getRoleLabel(activePlayer.role)} • ${activePlayer.nflTeam}`
              : "Choose a player card below to activate the Me experience."
          }
          action={
            activePlayer ? (
              <SteelBadge variant={getRoleBadgeVariant(activePlayer.role)}>
                {getRoleLabel(activePlayer.role)}
              </SteelBadge>
            ) : (
              <SteelBadge variant="neutral">Unselected</SteelBadge>
            )
          }
        />

        {activePlayer ? (
          <div className="players-active-profile">
            <div className="players-franchise-mark">
              {getTeamInitials(activePlayer.nflTeam)}
            </div>

            <div>
              <span>Franchise</span>
              <strong>{activePlayer.nflTeam}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{activePlayer.status}</strong>
            </div>

            <div>
              <span>Role</span>
              <strong>{getRoleLabel(activePlayer.role)}</strong>
            </div>
          </div>
        ) : null}
      </SteelCard>

      <SteelCard className="players-add-card" as="section">
        <SteelSectionHeader
          eyebrow="Roster Tools"
          title="Add League Player"
          description="Create a player profile and assign an available NFL franchise."
        />

        <div className="players-add-form">
          <label>
            Player Name
            <input
              placeholder="Enter player name..."
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label>
            NFL Franchise
            <select
              value={selectedTeam}
              onChange={(event) => setNflTeam(event.target.value)}
              disabled={availableTeams.length === 0}
            >
              {availableTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label>
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Player["role"])}
            >
              <option value="player">Player</option>
              <option value="backup_commissioner">Backup Commish</option>
              <option value="commissioner">Commissioner</option>
            </select>
          </label>

          <SteelButton
            disabled={isAddDisabled}
            onClick={handleAddPlayer}
            size="lg"
            variant="primary"
          >
            Add Player
          </SteelButton>
        </div>
      </SteelCard>

      <section className="players-board-section">
        <SteelSectionHeader
          eyebrow="League Roster"
          title="Player Cards"
          description="Select your active player or manage league participants."
        />

        <div className="players-toolbar">
          <input
            placeholder="Search players or teams..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="players-filter-row">
            {filters.map((filter) => (
              <button
                className={`players-filter ${
                  activeFilter === filter.id ? "is-active" : ""
                }`}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="player-list players-card-grid">
          {filteredPlayers.map((player) => {
            const isActive = player.id === activePlayerId;

            return (
              <SteelCard
                as="article"
                className={`players-card ${isActive ? "is-active-player" : ""}`}
                key={player.id}
              >
                <div className="players-card-top">
                  <div className="players-franchise-mark">
                    {getTeamInitials(player.nflTeam)}
                  </div>

                  <SteelBadge variant={getRoleBadgeVariant(player.role)}>
                    {getRoleLabel(player.role)}
                  </SteelBadge>
                </div>

                <div className="players-card-body">
                  <h3>{player.name}</h3>
                  <p>{player.nflTeam} Franchise</p>
                </div>

                <div className="players-card-meta">
                  <div>
                    <span>Status</span>
                    <strong>{player.status}</strong>
                  </div>

                  <div>
                    <span>Player ID</span>
                    <strong>{player.id.slice(0, 8)}</strong>
                  </div>
                </div>

                <div className="players-card-actions">
                  <SteelButton
                    onClick={() => setActivePlayerId(player.id)}
                    size="sm"
                    variant={isActive ? "primary" : "secondary"}
                  >
                    {isActive ? "Active" : "Set Active"}
                  </SteelButton>

                  <SteelButton
                    onClick={() => deletePlayer(player.id)}
                    size="sm"
                    variant="danger"
                  >
                    Remove
                  </SteelButton>
                </div>
              </SteelCard>
            );
          })}
        </div>

        {filteredPlayers.length === 0 ? (
          <SteelCard className="players-empty-card" as="section">
            <SteelSectionHeader
              eyebrow="No Players"
              title="No matching players found."
              description="Clear the search or add a new player to the roster."
            />
          </SteelCard>
        ) : null}
      </section>
    </main>
  );
}

export default PlayerManager;