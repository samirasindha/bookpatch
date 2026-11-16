import { Icon, type IconName } from "../components/Icon";

/** Temporary page used while each section is being rebuilt. */
export function ComingSoon({ title, icon }: { title: string; icon: IconName }) {
  return (
    <section className="empty-state">
      <Icon name={icon} size={40} />
      <h1 className="page-title">{title}</h1>
      <p className="muted">This section is being rebuilt.</p>
    </section>
  );
}
