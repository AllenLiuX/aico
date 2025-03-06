// PendingRequestsSection.js
import React from "react";
import { Clock, AlertCircle } from "lucide-react";
import PendingTrack from "../PendingTrack";

const PendingRequestsSection = ({
  pendingRequests,
  roomName,
  onApprove,
  onReject,
}) => {
  return (
    <div className="pending-requests-section">
      <div className="playlist-header">
        <h3>
          <Clock size={16} className="icon" />
          Pending Requests ({pendingRequests.length})
        </h3>
      </div>

      {pendingRequests.length > 0 ? (
        <ul className="pending-track-list">
          {pendingRequests.map((track, index) => (
            <PendingTrack
              key={`pending-${track.request_id || track.song_id}`}
              track={track}
              index={index}
              roomName={roomName}
              onApprove={onApprove}
              onReject={onReject}
              requestedBy={track.requested_by || "Guest"}
            />
          ))}
        </ul>
      ) : (
        <div className="no-requests-placeholder">
          <AlertCircle size={24} />
          <p>No pending song requests</p>
        </div>
      )}
    </div>
  );
};

export default PendingRequestsSection;
