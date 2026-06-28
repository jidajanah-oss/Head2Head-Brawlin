import { nflFranchises } from "../../lib/nflFranchises";

export default function FranchiseAssignmentBoard() {
  return (
    <div className="franchise-board">
      {nflFranchises.map((team) => (
        <div
          key={team.id}
          className="franchise-card"
          style={{
            borderColor: team.primaryColor,
          }}
        >
          <img
            src={team.logo}
            alt={team.fullName}
            className="franchise-logo"
          />

          <h3>{team.fullName}</h3>
          <p>{team.division}</p>

          <div className="franchise-status">
            Unassigned
          </div>
        </div>
      ))}
    </div>
  );
}