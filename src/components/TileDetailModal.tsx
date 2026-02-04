'use client';

import { useState, useEffect } from 'react';
import ImageUpload from './ImageUpload';
import LocalTime from '@/components/LocalTime';
import { formatNumber } from '@/lib/utils';

interface Tile {
  id: number;
  position: number;
  label: string;
  icon?: string | null;
  description?: string | null;
  tileType: string;
  requiredAmount?: number | null;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  trackingMode?: string | null;
  womCompetitionId?: number | null;
}

interface WomTeamStanding {
  rank: number;
  womTeamName: string;
  localTeamName: string | null;
  color: string | null;
  totalGained: number;
  mvp: string;
}

interface WomPlayerStanding {
  rank: number;
  womPlayerName: string;
  localPlayerName: string | null;
  localTeamName: string | null;
  color: string | null;
  gained: number;
}

interface Submission {
  id: number;
  tileId: number;
  teamId: number;
  playerId: number | null;
  creditPlayerId: number | null;
  amount: number;
  imageUrl: string | null;
  note: string | null;
  createdAt: string;
  uploaderName?: string | null;
  creditPlayerName?: string | null;
}

interface CompletedByTeam {
  teamId: number;
  teamName: string;
  color: string;
}

interface TeamPlayer {
  id: number;
  name: string;
}

interface PlayerStatProgress {
  playerId: number;
  playerName: string;
  current: number;
  gained: number;
}

interface Props {
  tile: Tile;
  submissions: Submission[];
  completedBy: CompletedByTeam[];
  canSubmit: boolean;
  canManage: boolean;
  canToggle: boolean;
  onSubmit?: (data: { tileId: number; teamId: number; amount: number; imageUrl: string; note: string; creditPlayerId: number | null }) => Promise<void>;
  onDelete?: (submissionId: number, reason: string) => Promise<void>;
  onToggle?: (tileId: number) => Promise<void>;
  onClose: () => void;
  eventId: number;
  teamId?: number;
  dropProgress?: { current: number; required: number };
  teamPlayers?: TeamPlayer[];
  currentPlayerId?: number;
  statProgress?: PlayerStatProgress[];
}

export default function TileDetailModal({
  tile,
  submissions,
  completedBy,
  canSubmit,
  canManage,
  canToggle,
  onSubmit,
  onDelete,
  onToggle,
  onClose,
  eventId,
  teamId,
  dropProgress,
  teamPlayers,
  currentPlayerId,
  statProgress,
}: Props) {
  const [amount, setAmount] = useState('1');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  const [creditPlayerId, setCreditPlayerId] = useState<string>(currentPlayerId ? String(currentPlayerId) : '');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [womTeams, setWomTeams] = useState<WomTeamStanding[]>([]);
  const [womPlayers, setWomPlayers] = useState<WomPlayerStanding[]>([]);
  const [womLoading, setWomLoading] = useState(false);
  const [showWomPlayers, setShowWomPlayers] = useState(false);
  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const parsedAmount = parseInt(amount, 10) || 1;

  // Update image URL array when amount changes
  useEffect(() => {
    const targetLength = Math.max(1, parsedAmount);
    setImageUrls((prev) => {
      if (prev.length === targetLength) return prev;
      if (prev.length < targetLength) {
        return [...prev, ...Array(targetLength - prev.length).fill('')];
      }
      return prev.slice(0, targetLength);
    });
  }, [parsedAmount]);

  // Reset form when tile changes or modal opens
  useEffect(() => {
    setAmount('1');
    setImageUrls(['']);
    setNote('');
    setCreditPlayerId(currentPlayerId ? String(currentPlayerId) : '');
    setError('');
    setShowWomPlayers(false);
  }, [tile.id, currentPlayerId]);

  // Fetch WOM data if tile has a competition linked
  useEffect(() => {
    if (!tile.womCompetitionId) {
      setWomTeams([]);
      setWomPlayers([]);
      return;
    }
    setWomLoading(true);
    // Pass teamId to filter WOM data to just this team (for captain view)
    const url = teamId
      ? `/api/events/${eventId}/tiles/${tile.id}/wom?teamId=${teamId}`
      : `/api/events/${eventId}/tiles/${tile.id}/wom`;
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setWomTeams(data.teams || []);
          setWomPlayers(data.players || []);
        }
      })
      .finally(() => setWomLoading(false));
  }, [eventId, tile.id, tile.womCompetitionId, teamId]);

  const isCompleted = completedBy.length > 0;
  const isDrop = tile.tileType === 'drop';
  const isStatTile = !!tile.trackedStat;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit || !teamId) return;

    // Validate all images are uploaded
    const validImages = imageUrls.filter((url) => url && url.trim());
    if (validImages.length === 0) {
      setError('Please upload at least one image as evidence');
      return;
    }

    // If amount > 1, require all images
    if (parsedAmount > 1 && validImages.length < parsedAmount) {
      setError(`Please upload ${parsedAmount} images (one for each drop)`);
      return;
    }

    // Validate credit player selection
    if (!creditPlayerId) {
      setError('Please select who got this drop');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      // Submit each image as a separate submission with amount=1
      // Or if only 1 image, submit with the full amount
      if (validImages.length === 1) {
        await onSubmit({
          tileId: tile.id,
          teamId,
          amount: parsedAmount,
          imageUrl: validImages[0],
          note,
          creditPlayerId: parseInt(creditPlayerId, 10),
        });
      } else {
        // Multiple images = multiple submissions
        for (const url of validImages) {
          await onSubmit({
            tileId: tile.id,
            teamId,
            amount: 1,
            imageUrl: url,
            note,
            creditPlayerId: parseInt(creditPlayerId, 10),
          });
        }
      }
      setAmount('1');
      setImageUrls(['']);
      setNote('');
      setCreditPlayerId('');
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteModal(submissionId: number) {
    setDeleteSubmissionId(submissionId);
    setDeleteReason('');
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!onDelete || !deleteSubmissionId) return;
    if (!deleteReason.trim()) return;
    setDeletingId(deleteSubmissionId);
    try {
      await onDelete(deleteSubmissionId, deleteReason.trim());
      setDeleteModalOpen(false);
      setDeleteSubmissionId(null);
      setDeleteReason('');
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDelete() {
    setDeleteModalOpen(false);
    setDeleteSubmissionId(null);
    setDeleteReason('');
  }

  // Check if user can delete a specific submission
  function canDeleteSubmission(submission: Submission): boolean {
    // If canManage is true (captain/admin), can delete any team submission
    if (canManage) return true;
    // Otherwise, players can only delete their own submissions (where they uploaded it)
    if (currentPlayerId && submission.playerId === currentPlayerId) return true;
    return false;
  }

  async function handleToggle() {
    if (!onToggle) return;
    setToggling(true);
    try {
      await onToggle(tile.id);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 rounded-t-2xl flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {tile.icon && (
              <div className="w-10 h-10 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tile.icon} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{tile.label}</h2>
              {tile.description && (
                <p className="text-sm text-text-muted mt-0.5">{tile.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isDrop
                    ? 'bg-accent-green/20 text-accent-green-light'
                    : isStatTile
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gold/20 text-gold'
                }`}>
                  {isDrop ? 'Drop' : isStatTile ? (tile.statType === 'boss' ? 'Boss KC' : 'XP') : 'Standard'}
                </span>
                {isStatTile && tile.statGoal && (
                  <span className="text-xs text-text-muted">
                    Goal: {tile.statGoal.toLocaleString()} {tile.statType === 'boss' ? 'KC' : 'XP'}
                  </span>
                )}
                {isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green-light font-medium">
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-xl leading-none flex-shrink-0 ml-2"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Completion status */}
          {completedBy.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {completedBy.map((team) => (
                <span
                  key={team.teamId}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
                  style={{ borderColor: team.color, color: team.color }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                  {team.teamName}
                </span>
              ))}
            </div>
          )}

          {/* Drop tile progress */}
          {isDrop && dropProgress && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-muted">Progress</span>
                <span className="font-medium text-accent-green-light">
                  {dropProgress.current}/{dropProgress.required}
                </span>
              </div>
              <div className="w-full bg-brown-dark rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (dropProgress.current / dropProgress.required) * 100)}%`,
                    background: dropProgress.current >= dropProgress.required
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                      : 'linear-gradient(90deg, #eab308cc, #eab308)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Stat tile progress */}
          {isStatTile && statProgress && statProgress.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Player Progress ({tile.trackedStat})
              </h3>
              {/* Team total */}
              {tile.statGoal && (
                <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-muted">Team Total</span>
                    <span className="font-medium text-blue-400">
                      {formatNumber(statProgress.reduce((sum, p) => sum + p.gained, 0))} / {formatNumber(tile.statGoal)}
                    </span>
                  </div>
                  <div className="w-full bg-brown-dark rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (statProgress.reduce((sum, p) => sum + p.gained, 0) / tile.statGoal) * 100)}%`,
                        background: statProgress.reduce((sum, p) => sum + p.gained, 0) >= tile.statGoal
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {statProgress.sort((a, b) => b.gained - a.gained).map((p) => {
                  const goal = tile.statGoal || 0;
                  const percentage = goal > 0 ? Math.min(100, (p.gained / goal) * 100) : 0;
                  const isGoalMet = goal > 0 && p.gained >= goal;
                  return (
                    <div
                      key={p.playerId}
                      className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{p.playerName}</span>
                        <span className={`text-xs font-medium ${isGoalMet ? 'text-accent-green-light' : 'text-blue-400'}`}>
                          +{formatNumber(p.gained)} {tile.statType === 'boss' ? 'KC' : 'XP'}
                        </span>
                      </div>
                      {goal > 0 && (
                        <div className="w-full bg-brown-dark rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              background: isGoalMet
                                ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                : 'linear-gradient(90deg, #3b82f6cc, #3b82f6)',
                            }}
                          />
                        </div>
                      )}
                      <div className="text-xs text-text-muted mt-1">
                        Current: {formatNumber(p.current)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isStatTile && (!statProgress || statProgress.length === 0) && (
            <div className="text-center py-4 text-text-muted text-sm">
              No stat progress data available yet.
            </div>
          )}

          {/* WOM Standings */}
          {tile.womCompetitionId && (
            <div>
              <h3 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                WOM Competition
                <a
                  href={`https://wiseoldman.net/competitions/${tile.womCompetitionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-text-muted hover:text-indigo-400 underline"
                >
                  View on WOM
                </a>
              </h3>
              {womLoading ? (
                <p className="text-sm text-text-muted">Loading WOM data...</p>
              ) : womTeams.length > 0 ? (
                <div className="space-y-2">
                  {/* Team standings */}
                  <div className="space-y-1.5">
                    {womTeams.slice(0, 5).map((wt) => (
                      <div
                        key={wt.rank}
                        className="flex items-center justify-between border border-card-border rounded-lg p-2 bg-brown-dark/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-indigo-400 w-5">#{wt.rank}</span>
                          {wt.color && (
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wt.color }} />
                          )}
                          <span className="text-sm font-medium">{wt.localTeamName || wt.womTeamName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-indigo-400">
                            {formatNumber(wt.totalGained)}
                          </span>
                          <div className="text-[10px] text-text-muted">MVP: {wt.mvp}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Toggle to show individual players */}
                  {womPlayers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowWomPlayers(!showWomPlayers)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {showWomPlayers ? 'Hide players' : `Show top players (${womPlayers.length})`}
                    </button>
                  )}

                  {/* Individual player standings */}
                  {showWomPlayers && womPlayers.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {womPlayers.slice(0, 20).map((wp) => (
                        <div
                          key={wp.rank}
                          className="flex items-center justify-between text-xs border border-card-border/50 rounded px-2 py-1 bg-brown-dark/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted w-4">#{wp.rank}</span>
                            {wp.color && (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wp.color }} />
                            )}
                            <span>{wp.localPlayerName || wp.womPlayerName}</span>
                          </div>
                          <span className="text-indigo-400 font-medium">
                            +{formatNumber(wp.gained)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No WOM data available</p>
              )}
            </div>
          )}

          {/* Standard tile toggle */}
          {!isDrop && canToggle && onToggle && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`w-full py-2 text-sm font-semibold rounded border transition-colors disabled:opacity-50 ${
                isCompleted
                  ? 'bg-red-400/10 border-red-400/30 text-red-400 hover:bg-red-400/20'
                  : 'bg-accent-green/10 border-accent-green/30 text-accent-green-light hover:bg-accent-green/20'
              }`}
            >
              {toggling ? '...' : isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
            </button>
          )}

          {/* Submission gallery */}
          {isDrop && submissions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Submissions ({submissions.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    className="border border-card-border rounded-lg p-2.5 bg-brown-dark/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          {s.creditPlayerName && (
                            <span className="font-medium text-accent-green-light">
                              {s.creditPlayerName}
                            </span>
                          )}
                          <span className="text-gold font-medium">
                            x{s.amount}
                          </span>
                          {s.uploaderName && s.uploaderName !== s.creditPlayerName && (
                            <span className="text-text-muted">
                              (uploaded by {s.uploaderName})
                            </span>
                          )}
                          <span className="text-text-muted">
                            <LocalTime date={s.createdAt} format="date" />
                          </span>
                        </div>
                        {s.note && (
                          <p className="text-xs text-text-muted mt-1">{s.note}</p>
                        )}
                      </div>
                      {canDeleteSubmission(s) && onDelete && (
                        <button
                          onClick={() => openDeleteModal(s.id)}
                          disabled={deletingId === s.id}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                        >
                          {deletingId === s.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                    {s.imageUrl && (
                      <div className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imageUrl}
                          alt="Evidence"
                          className="w-full max-h-40 object-cover rounded border border-card-border cursor-pointer"
                          onClick={() => window.open(s.imageUrl!, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit form for drop tiles */}
          {isDrop && canSubmit && onSubmit && teamId && (
            <form onSubmit={handleSubmit} className="border border-card-border rounded-lg p-3 bg-brown-dark/30 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Add Submission</h3>

              {/* Who got this drop */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Who got this drop? *</label>
                <select
                  value={creditPlayerId}
                  onChange={(e) => setCreditPlayerId(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                  required
                >
                  <option value="">Select team member...</option>
                  {teamPlayers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Evidence Screenshot{parsedAmount > 1 ? 's' : ''} *
                  {parsedAmount > 1 && (
                    <span className="text-yellow-400 ml-1">({imageUrls.filter(u => u).length}/{parsedAmount} uploaded)</span>
                  )}
                </label>
                {parsedAmount === 1 ? (
                  <ImageUpload
                    onImageSelected={(url) => setImageUrls([url])}
                    currentUrl={imageUrls[0] || undefined}
                  />
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="border border-card-border/50 rounded-lg p-2 bg-brown-dark/30">
                        <p className="text-xs text-text-muted mb-1">Drop #{index + 1}</p>
                        <ImageUpload
                          onImageSelected={(newUrl) => {
                            setImageUrls((prev) => {
                              const updated = [...prev];
                              updated[index] = newUrl;
                              return updated;
                            });
                          }}
                          currentUrl={url || undefined}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 text-sm font-semibold rounded bg-accent-green/20 border border-accent-green text-accent-green-light hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={cancelDelete} />
          <div className="relative bg-card-bg border border-card-border rounded-xl w-full max-w-sm p-4 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-3">Confirm Deletion</h3>
            <p className="text-sm text-text-muted mb-4">
              Are you sure you want to delete this submission? This action will be announced in Discord.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-1">Reason for deletion *</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g., Duplicate submission, Wrong tile, etc."
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground resize-none"
                rows={2}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelDelete}
                className="flex-1 py-2 text-sm font-medium rounded border border-card-border text-text-muted hover:bg-brown-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!deleteReason.trim() || deletingId !== null}
                className="flex-1 py-2 text-sm font-semibold rounded bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {deletingId !== null ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
