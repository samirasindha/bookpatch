type Props = { user: { name: string; avatarUrl: string | null }; size?: number };

const TINTS = ["#c8873a", "#4a6741", "#9b3a1e", "#3a4a5c", "#8a6a3a"];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({ user, size = 36 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user.avatarUrl) {
    return <img className="avatar" src={user.avatarUrl} alt="" style={style} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar avatar-initial" style={{ ...style, background: tintFor(user.name) }} aria-hidden="true">
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}
