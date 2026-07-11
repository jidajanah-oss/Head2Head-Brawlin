import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  applyLeagueDataTransferBackup,
  createLeagueDataTransferBackup,
  downloadLeagueDataTransferBackup,
  validateLeagueDataTransferText,
} from "../../engine/dataTransferEngine";
import type {
  LeagueDataTransferBackup,
  LeagueDataTransferValidationIssue,
} from "../../engine/dataTransferTypes";

import "../../styles/data-transfer.css";

type ActionState =
  | "idle"
  | "working"
  | "success"
  | "error";

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getRequiredConfirmation(
  backup: LeagueDataTransferBackup | null,
): string {
  if (!backup) {
    return "";
  }

  return backup.summary.season
    ? `RESTORE ${backup.summary.season}`
    : "RESTORE LEAGUE";
}

function CommissionerDataTransfer() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [exportState, setExportState] =
    useState<ActionState>("idle");
  const [exportMessage, setExportMessage] =
    useState("");

  const [
    selectedFileName,
    setSelectedFileName,
  ] = useState("");
  const [
    validationIssues,
    setValidationIssues,
  ] = useState<
    LeagueDataTransferValidationIssue[]
  >([]);
  const [pendingBackup, setPendingBackup] =
    useState<LeagueDataTransferBackup | null>(
      null,
    );
  const [importState, setImportState] =
    useState<ActionState>("idle");
  const [importMessage, setImportMessage] =
    useState("");
  const [confirmation, setConfirmation] =
    useState("");
  const [acknowledged, setAcknowledged] =
    useState(false);

  const requiredConfirmation =
    getRequiredConfirmation(pendingBackup);

  const confirmationMatches =
    confirmation.trim() ===
    requiredConfirmation;

  const canRestore =
    Boolean(pendingBackup) &&
    acknowledged &&
    confirmationMatches &&
    importState !== "working";

  const resetImportSelection = () => {
    setSelectedFileName("");
    setValidationIssues([]);
    setPendingBackup(null);
    setImportState("idle");
    setImportMessage("");
    setConfirmation("");
    setAcknowledged(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadCurrentBackup = () => {
    setExportState("working");
    setExportMessage("");

    try {
      const backup =
        createLeagueDataTransferBackup();

      downloadLeagueDataTransferBackup(
        backup,
      );

      setExportState("success");
      setExportMessage(
        `Backup downloaded for ${backup.summary.leagueName}.`,
      );
    } catch (error) {
      setExportState("error");
      setExportMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the league backup.",
      );
    }
  };

  const validateSelectedFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    resetImportSelection();

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setImportState("working");
    setImportMessage(
      "Validating backup file...",
    );

    try {
      const fileText = await file.text();

      const validation =
        validateLeagueDataTransferText(
          fileText,
        );

      if (!validation.ok) {
        setValidationIssues(
          validation.issues,
        );
        setImportState("error");
        setImportMessage(
          "This backup cannot be restored.",
        );
        return;
      }

      setPendingBackup(validation.backup);
      setValidationIssues([]);
      setImportState("success");
      setImportMessage(
        "Backup validated. Review the details before restoring.",
      );
    } catch (error) {
      setValidationIssues([]);
      setImportState("error");
      setImportMessage(
        error instanceof Error
          ? error.message
          : "Unable to read the selected backup file.",
      );
    }
  };

  const restoreSelectedBackup = () => {
    if (!pendingBackup || !canRestore) {
      return;
    }

    setImportState("working");
    setImportMessage(
      "Restoring league data...",
    );

    try {
      applyLeagueDataTransferBackup(
        pendingBackup,
      );

      setImportState("success");
      setImportMessage(
        "Restore completed. Reloading the application...",
      );

      window.location.reload();
    } catch (error) {
      setImportState("error");
      setImportMessage(
        error instanceof Error
          ? error.message
          : "The league backup could not be restored.",
      );
    }
  };

  return (
    <section className="data-transfer-panel">
      <header className="data-transfer-header">
        <div>
          <span className="data-transfer-kicker">
            League Portability
          </span>

          <h2>Backup &amp; Restore</h2>

          <p>
            Move the complete league between
            localhost, another computer, and the
            live GitHub Pages site without
            re-entering players or results.
          </p>
        </div>

        <div className="data-transfer-header-badge">
          <strong>3</strong>
          <span>Protected data areas</span>
        </div>
      </header>

      <div className="data-transfer-grid">
        <article className="data-transfer-card">
          <div className="data-transfer-card-heading">
            <span>Step 1</span>
            <h3>Download Current League</h3>
            <p>
              Creates one backup containing the
              active league, permanent season
              archives, and season-award coin-flip
              decisions stored in this browser.
            </p>
          </div>

          <div className="data-transfer-included-list">
            <span>Players and NFL assignments</span>
            <span>Picks and weekly scoring</span>
            <span>Payout and playoff history</span>
            <span>Season archives and awards</span>
          </div>

          <button
            type="button"
            className="data-transfer-button data-transfer-button--primary"
            onClick={downloadCurrentBackup}
            disabled={exportState === "working"}
          >
            {exportState === "working"
              ? "Preparing Backup..."
              : "Download League Backup"}
          </button>

          {exportMessage ? (
            <p
              className={`data-transfer-message data-transfer-message--${exportState}`}
              role="status"
            >
              {exportMessage}
            </p>
          ) : null}
        </article>

        <article className="data-transfer-card data-transfer-card--restore">
          <div className="data-transfer-card-heading">
            <span>Step 2</span>
            <h3>Restore a League Backup</h3>
            <p>
              Select a backup file. The file is
              checked before any browser data is
              replaced.
            </p>
          </div>

          <input
            ref={fileInputRef}
            className="data-transfer-file-input"
            type="file"
            accept=".json,.h2h.json,application/json"
            onChange={validateSelectedFile}
          />

          <div className="data-transfer-file-actions">
            <button
              type="button"
              className="data-transfer-button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={importState === "working"}
            >
              Choose Backup File
            </button>

            {selectedFileName ? (
              <button
                type="button"
                className="data-transfer-button data-transfer-button--quiet"
                onClick={resetImportSelection}
                disabled={importState === "working"}
              >
                Clear File
              </button>
            ) : null}
          </div>

          <div className="data-transfer-file-name">
            <span>Selected file</span>
            <strong>
              {selectedFileName ||
                "No backup selected"}
            </strong>
          </div>

          {importMessage ? (
            <p
              className={`data-transfer-message data-transfer-message--${importState}`}
              role="status"
            >
              {importMessage}
            </p>
          ) : null}

          {validationIssues.length > 0 ? (
            <div className="data-transfer-issues">
              <strong>Validation problems</strong>

              <ul>
                {validationIssues.map(
                  (issue) => (
                    <li key={issue.code}>
                      {issue.message}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
        </article>
      </div>

      {pendingBackup ? (
        <section className="data-transfer-review">
          <header>
            <div>
              <span className="data-transfer-kicker">
                Validated Backup
              </span>

              <h3>
                {pendingBackup.summary.leagueName}
              </h3>

              <p>
                Exported{" "}
                {formatDateTime(
                  pendingBackup.exportedAt,
                )}
              </p>
            </div>

            <span className="data-transfer-valid-badge">
              Checksum Verified
            </span>
          </header>

          <div className="data-transfer-summary-grid">
            <div>
              <span>Season</span>
              <strong>
                {pendingBackup.summary.season ??
                  "Not set"}
              </strong>
            </div>

            <div>
              <span>Current Week</span>
              <strong>
                {pendingBackup.summary.currentWeek ??
                  "Not set"}
              </strong>
            </div>

            <div>
              <span>Players</span>
              <strong>
                {
                  pendingBackup.summary
                    .playerCount
                }
              </strong>
            </div>

            <div>
              <span>Season Archives</span>
              <strong>
                {
                  pendingBackup.summary
                    .archiveCount
                }
              </strong>
            </div>

            <div>
              <span>Award Coin Flips</span>
              <strong>
                {
                  pendingBackup.summary
                    .seasonAwardCoinFlipCount
                }
              </strong>
            </div>

            <div>
              <span>Backup Source</span>
              <strong>
                {pendingBackup.source.origin}
              </strong>
              <small>
                {pendingBackup.source.pathname}
              </small>
            </div>
          </div>

          <div className="data-transfer-danger-zone">
            <div>
              <span className="data-transfer-kicker">
                Protected Replacement
              </span>

              <h4>
                This replaces the league stored in
                this browser
              </h4>

              <p>
                The current active league, permanent
                season archives, and season-award
                coin-flip history will be replaced
                together. Download the current league
                first when it must be retained.
              </p>
            </div>

            <label className="data-transfer-acknowledgement">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setAcknowledged(
                    event.target.checked,
                  )
                }
              />

              <span>
                I understand that this restore will
                replace the league data currently
                stored in this browser.
              </span>
            </label>

            <label className="data-transfer-confirmation">
              <span>
                Type{" "}
                <code>
                  {requiredConfirmation}
                </code>{" "}
                to continue
              </span>

              <input
                type="text"
                value={confirmation}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setConfirmation(
                    event.target.value,
                  )
                }
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  requiredConfirmation
                }
              />
            </label>

            <div className="data-transfer-restore-actions">
              <button
                type="button"
                className="data-transfer-button"
                onClick={downloadCurrentBackup}
                disabled={exportState === "working"}
              >
                Download Current Backup First
              </button>

              <button
                type="button"
                className="data-transfer-button data-transfer-button--danger"
                onClick={restoreSelectedBackup}
                disabled={!canRestore}
              >
                {importState === "working"
                  ? "Restoring..."
                  : "Replace & Restore League"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default CommissionerDataTransfer;
