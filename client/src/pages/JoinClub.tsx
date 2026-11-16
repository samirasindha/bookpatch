import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useClubMutations } from "../lib/hooks";

/** Opening an invite link (/join/abc123) joins the club and takes you there. */
export function JoinClubPage() {
  const { code = "" } = useParams();
  const { join } = useClubMutations();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    join
      .mutateAsync({ code })
      .then((r) => navigate(`/clubs/${r.clubId}`, { replace: true }))
      .catch(() => setFailed(true));
  }, [code, join, navigate]);

  return (
    <div className="empty">
      <Icon name="clubs" size={40} />
      {failed ? (
        <>
          <p>This invite link doesn't work anymore. Ask the host for a new one.</p>
          <Link to="/clubs" className="btn btn-outline">
            Go to clubs
          </Link>
        </>
      ) : (
        <p role="status">Joining the club…</p>
      )}
    </div>
  );
}
