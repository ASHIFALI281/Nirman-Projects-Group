import { useLang } from "@/i18n";
import { useSite, useSiteImage } from "@/site/SiteData";
import { PageHeader, SectionHeading, Placeholder } from "@/components/site/Shared";
import { ProjectCard } from "@/components/site/ProjectCard";

const Group = ({ status, title, bg, items }) => (
  <section className={`py-24 ${bg}`} data-testid={`projects-${status}-section`}>
    <div className="mx-auto max-w-7xl px-6 lg:px-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <SectionHeading eyebrow={status === "ongoing" ? "On site now" : "Delivered"} title={title} />
        {items.some((p) => p.sample !== false) && <Placeholder label="Sample cards — replace with real projects" />}
      </div>
      <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {items.filter((p) => p.status === status).map((p) => <ProjectCard key={p.id} p={p} />)}
        {!items.some((p) => p.status === status) && <p className="text-slate-500" data-testid={`projects-${status}-empty`}>No {status} projects to show yet.</p>}
      </div>
    </div>
  </section>
);

export default function Projects() {
  const { t } = useLang();
  const { projects } = useSite();
  const img = useSiteImage();
  return (
    <>
      <PageHeader eyebrow={t("nav.projects")} title="Our project portfolio." image={img("projects.header")}
        text="Click any project to view photographs and details. Project records will be managed from the admin dashboard." />
      <Group status="ongoing" title={t("sec.ongoing")} bg="bg-white" items={projects} />
      <Group status="completed" title={t("sec.completed")} bg="bg-slate-50" items={projects} />
    </>
  );
}
