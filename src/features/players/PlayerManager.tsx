import { useMemo, useState } from "react";
import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import {
  getAvailableNFLTeams,
  getLeagueOwnershipSummary,
  getNFLTeamDisplayName,
  getNFLTeamInfo,
  groupPlayersByNFLDivision,
  validateNFLTeamOwnership,
} from "../../engine";
import type { Player } from "../../types/player";

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

  const availableTeams = useMemo(() => getAvailableNFLTeams(players), [players]);

  const selectedTeam = availableTeams.some((team) => team.abbreviation === nflTeam)
    ? nflTeam
    : availableTeams[0]?.abbreviation ?? "";

  const selectedTeamInfo = selectedTeam ? getNFLTeamInfo(selectedTeam) : null;

  const ownershipSummary = useMemo(
    () => getLeagueOwnershipSummary(players),
    [players]
  );

  const divisionGroups = useMemo(
    () => groupPlayersByNFLDivision(players),
    [players]
  );

  const activePlayers = players.filter((player) => player.status === "active");

  const commissioners = players.filter(
    (player) =>
      player.role === "commissioner" ||
      player.role === "backup_commissioner"
  );

  const activePlayer = players.find((player) => player.id === activePlayerId);

  const filteredPlayers = players.filter((player) => {
    const teamInfo = getNFLTeamInfo(player.nflTeam);
    const normalizedSearch = search.toLowerCase();

    const matchesSearch =
      player.name.toLowerCase().includes(normalizedSearch) ||
      player.nflTeam.toLowerCase().includes(normalizedSearch) ||
      getNFLTeamDisplayName(player.nflTeam)
        .toLowerCase()
        .includes(normalizedSearch) ||
      (teamInfo?.division.toLowerCase().includes(normalizedSearch) ?? false) ||
      (teamInfo?.conference.toLowerCase().includes(normalizedSearch) ?? false);

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

  const ownershipValidation = validateNFLTeamOwnership(players, selectedTeam);

  const isAddDisabled =
    players.length >= league.settings.maxPlayers ||
    !name.trim() ||
    !ownershipValidation.valid;

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

    const nextTeam =
      availableTeams.find((team) => team.abbreviation !== selectedTeam)
        ?.abbreviation ?? "";

    setName("");
    setRole("player");
    setNflTeam(nextTeam);
  };

  return (
    <div className="player-manager">
      <SteelHero
        eyebrow="Franchise Command Center"
        title="Player Manager"
        subtitle="One player per NFL franchise. Divisions mirror the real NFL alignment."
        rightContent={
          <div className="standings-hero-panel">
            <span>Active Player</span>

            <div className="player-manager-logo-shell">
              <FranchiseLogo
                nflTeam={activePlayer?.nflTeam}
                customLogo={activePlayer?.customLogo}
                displayName={
                  activePlayer
                    ? getNFLTeamDisplayName(activePlayer.nflTeam)
                    : "No active franchise"
                }
                size="md"
                variant="tile"
              />

              <div>
                <strong>{activePlayer ? activePlayer.name : "None"}</strong>
                <small>
                  {activePlayer
                    ? `${activePlayer.nflTeam} • ${
                        getNFLTeamInfo(activePlayer.nflTeam)?.division ??
                        "No Division"
                      }`
                    : "Select below"}
                </small>
              </div>
            </div>

            {activePlayer ? (
              <SteelBadge variant={getRoleBadgeVariant(activePlayer.role)}>
                {getRoleLabel(activePlayer.role)}
              </SteelBadge>
            ) : (
              <SteelBadge variant="neutral">Unselected</SteelBadge>
            )}
          </div>
        }
      />

      <div className="standings-stat-grid">
        <SteelStatCard
          label="Claimed"
          value={`${ownershipSummary.claimedCount}/${ownershipSummary.totalTeams}`}
          helper="NFL franchises owned"
          icon="🏈"
        />

        <SteelStatCard
          label="Open"
          value={ownershipSummary.openCount}
          helper="Available teams"
          icon="🟡"
        />

        <SteelStatCard
          label="Active"
          value={activePlayers.length}
          helper="Eligible players"
          icon="⚡"
        />

        <SteelStatCard
          label="Max"
          value={league.settings.maxPlayers}
          helper="League capacity"
          icon="🏆"
        />
      </div>

      <SteelCard className="player-manager-add-card">
        <SteelSectionHeader
          eyebrow="Add Franchise Owner"
          title="Assign NFL Team"
          description="Select an open NFL franchise and assign it to a player."
        />

        <div className="player-manager-form-grid">
          <label>
            <span>Player Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter player name"
            />
          </label>

          <label>
            <span>NFL Franchise</span>
            <select
              value={selectedTeam}
              onChange={(event) => setNflTeam(event.target.value)}
              disabled={availableTeams.length === 0}
            >
              {availableTeams.map((team) => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {team.abbreviation} — {team.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Player["role"])}
            >
              <option value="player">Player</option>
              <option value="backup_commissioner">Backup Commish</option>
              <option value="commissioner">Commissioner</option>
            </select>
          </label>

          <SteelButton onClick={handleAddPlayer} disabled={isAddDisabled}>
            Add Player
          </SteelButton>
        </div>

        <div className="standings-hero-panel">
          <span>Selected Franchise</span>

          <div className="player-manager-logo-shell">
            <FranchiseLogo
              nflTeam={selectedTeam}
              displayName={selectedTeamInfo?.displayName}
              size="lg"
              variant="tile"
            />

            <div>
              <strong>
                {selectedTeamInfo ? selectedTeamInfo.displayName : "No teams open"}
              </strong>
              <small>
                {selectedTeamInfo
                  ? `${selectedTeamInfo.conference} • ${selectedTeamInfo.division}`
                  : "All NFL franchises are claimed."}
              </small>
            </div>
          </div>

          {!ownershipValidation.valid ? (
            <SteelBadge variant="danger">{ownershipValidation.reason}</SteelBadge>
          ) : (
            <SteelBadge variant="success">Available</SteelBadge>
          )}
        </div>
      </SteelCard>

      <SteelCard className="player-manager-division-card">
        <SteelSectionHeader
          eyebrow="NFL Division Ownership"
          title="Franchise Board"
          description="Each division holds the same four NFL teams as real life."
        />

        <div className="standings-division-grid">
          {divisionGroups.map((division) => (
            <div className="standings-division-card" key={division.division}>
              <div className="standings-division-topline">
                <div>
                  <span>{division.conference}</span>
                  <strong>{division.division}</strong>
                </div>

                <SteelBadge variant={division.claimedCount === 4 ? "success" : "neutral"}>
                  {division.claimedCount}/4 claimed
                </SteelBadge>
              </div>

              <div className="standings-division-table">
                {division.teams.map((team) => {
                  const owner = division.players.find(
                    (player) => player.nflTeam === team.abbreviation
                  );

                  return (
                    <div
                      className={`standings-division-row ${
                        owner?.id === activePlayerId ? "is-active-player" : ""
                      }`.trim()}
                      key={team.abbreviation}
                    >
                      <div className="standings-division-rank">
                        <FranchiseLogo
                          nflTeam={team.abbreviation}
                          customLogo={owner?.customLogo}
                          displayName={team.displayName}
                          size="sm"
                        />
                        <strong>{team.abbreviation}</strong>
                        <small>NFL</small>
                      </div>

                      <div className="standings-division-player">
                        <strong>{owner ? owner.name : "Open"}</strong>
                        <small>{team.displayName}</small>
                      </div>

                      <SteelBadge variant={owner ? "success" : "neutral"}>
                        {owner ? getRoleLabel(owner.role) : "Open Team"}
                      </SteelBadge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SteelCard>

      <SteelCard className="player-manager-list-card">
        <SteelSectionHeader
          eyebrow="Roster"
          title="Franchise Owners"
          description="Search and switch the active player view."
        />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by player, team, conference, or division"
        />

        <div className="player-manager-filter-row">
          {filters.map((filter) => (
            <SteelButton
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
              variant={activeFilter === filter.id ? "primary" : "secondary"}
              size="sm"
            >
              {filter.label} {filter.count}
            </SteelButton>
          ))}
        </div>

        <div className="standings-list-v2">
          {filteredPlayers.map((player) => {
            const isActive = player.id === activePlayerId;
            const teamInfo = getNFLTeamInfo(player.nflTeam);

            return (
              <SteelCard
                className={`standing-row-v2 ${isActive ? "is-active-player" : ""}`.trim()}
                key={player.id}
              >
                <div className="standings-rank">
                  <FranchiseLogo
                    nflTeam={player.nflTeam}
                    customLogo={player.customLogo}
                    displayName={getNFLTeamDisplayName(player.nflTeam)}
                    size="sm"
                  />
                  <small>{player.nflTeam}</small>
                </div>

                <div className="standings-player">
                  <SteelBadge variant={getRoleBadgeVariant(player.role)}>
                    {getRoleLabel(player.role)}
                  </SteelBadge>
                  <strong>{player.name}</strong>
                  <small>{getNFLTeamDisplayName(player.nflTeam)}</small>
                </div>

                <div className="standings-record">
                  <strong>{teamInfo?.division ?? "—"}</strong>
                  <small>Division</small>
                </div>

                <div className="standings-points">
                  <strong>{teamInfo?.conference ?? "—"}</strong>
                  <small>Conference</small>
                </div>

                <div className="standings-pick-score">
                  <strong>{player.status}</strong>
                  <small>Status</small>
                </div>

                <div className="player-manager-actions">
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

          {filteredPlayers.length === 0 ? (
            <SteelCard className="standings-empty-card">
              No players match that search.
            </SteelCard>
          ) : null}
        </div>
      </SteelCard>
    </div>
  );
}

export default PlayerManager;