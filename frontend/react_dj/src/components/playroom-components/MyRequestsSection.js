// MyRequestsSection.js
import React from "react";
import { UserCheck, Clock, XCircle } from "lucide-react";
import "../../styles/MyRequestsSection.css";

const statusColors = {
  pending: "pending-badge",
  approved: "approved-badge",
  rejected: "rejected-badge",
};

const MyRequestsSection = ({ myRequests = [] }) => {
  return (
    <div className="my-requests-section">
      <div className="playlist-header">
        <h3>
          <UserCheck size={16} className="icon" />
          My Requests ({myRequests.length})
        </h3>
      </div>

      {myRequests.length > 0 ? (
        <ul className="my-requests-list">
          {myRequests.map((req, idx) => {
            const statusClass = statusColors[req.status] || "";
            return (
              <li className="my-request-item" key={`my-req-${req.request_id}`}>
                {(req.image_url || (req.track && req.track.image_url)) && (
                  <img
                    src={req.image_url || (req.track && req.track.image_url)}
                    alt="thumbnail"
                    className="track-thumbnail"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div className="request-details">
                  <span className="track-title">{req.title || (req.track && req.track.title)}</span>
                  <span className="track-artist">{req.artist || (req.track && req.track.artist)}</span>
                  <div className="request-meta">
                    <span className={`status-badge ${statusClass}`}>{req.status}</span>
                    {req.status === "approved" && req.playlist_position !== undefined && (
                      <span className="playlist-position">Plays in {req.playlist_position} songs</span>
                    )}
                    {req.express && (
                      <span className="express-badge" title="Express request">
                        ⚡
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="no-requests-placeholder">
          <Clock size={24} />
          <p>You haven't made any song requests yet</p>
        </div>
      )}
    </div>
  );
};

export default MyRequestsSection;
